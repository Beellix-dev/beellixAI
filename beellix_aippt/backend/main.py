import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pathlib import Path

import config
from llm.qwen_client import QwenClient
from llm.gemini_client import GeminiClient
from services.ppt_service import PPTService
from services.pdf_service import PDFService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Beellix AI PPT", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录，用于提供生成的图片
IMAGES_DIR = Path("generated_images")
IMAGES_DIR.mkdir(exist_ok=True)
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


def get_llm_clients(provider: str = "", api_key: str = ""):
    """根据供应商选择返回 (text_llm, image_llm, provider_name)"""
    provider = provider or config.get_active_provider()
    if provider == "qwen":
        client = QwenClient(api_key=api_key if api_key else None)
        return client, client, provider
    elif provider == "gemini":
        client = GeminiClient(api_key=api_key if api_key else None)
        return client, client, provider
    else:
        raise ValueError(f"未知供应商: {provider}")


@app.websocket("/ws/generate")
async def websocket_generate(ws: WebSocket):
    """
    WebSocket 端点，处理 PPT 生成的双向通信。

    前端 → 后端消息格式：
      { "action": "generate", "topic": "...", "provider": "qwen" }
      { "action": "cancel" }

    后端 → 前端消息格式：
      { "event": "status|outline|slide|done|error", "data": {...} }
    """
    await ws.accept()
    logger.info("WebSocket 连接已建立")

    cancel_event = asyncio.Event()
    connected = True
    generate_task: asyncio.Task | None = None

    async def safe_send(data: str) -> bool:
        """安全发送消息，连接断开时返回 False。"""
        nonlocal connected
        if not connected:
            return False
        try:
            await ws.send_text(data)
            return True
        except (WebSocketDisconnect, RuntimeError):
            connected = False
            cancel_event.set()
            return False

    async def run_generation(topic: str, provider: str, api_key: str = ""):
        """在后台任务中运行生成流水线，结果通过 WebSocket 推送。"""
        try:
            text_llm, image_llm, resolved_provider = get_llm_clients(provider, api_key)
            service = PPTService(text_llm, image_llm, resolved_provider)

            async for event in service.generate(topic, cancel_event):
                msg = json.dumps(event.model_dump(), ensure_ascii=False)
                if not await safe_send(msg):
                    logger.info("WebSocket 已断开，停止生成")
                    return
        except Exception as e:
            if not connected:
                logger.info("WebSocket 在生成过程中断开")
                return
            logger.error(f"生成过程异常: {e}")
            await safe_send(json.dumps(
                {"event": "error", "data": {"message": str(e)}},
                ensure_ascii=False,
            ))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            action = msg.get("action", "")

            if action == "generate":
                # 如果有正在进行的生成任务，先取消
                if generate_task and not generate_task.done():
                    cancel_event.set()
                    await generate_task
                    cancel_event.clear()

                topic = msg.get("topic", "").strip()
                provider = msg.get("provider", "")
                api_key = msg.get("apiKey", "").strip()

                if not topic:
                    await safe_send(json.dumps(
                        {"event": "error", "data": {"message": "主题不能为空"}},
                        ensure_ascii=False,
                    ))
                    continue

                generate_task = asyncio.create_task(
                    run_generation(topic, provider, api_key)
                )

            elif action == "cancel":
                if generate_task and not generate_task.done():
                    cancel_event.set()
                    logger.info("收到取消请求")

    except WebSocketDisconnect:
        logger.info("WebSocket 连接已关闭")
        connected = False
        cancel_event.set()
        if generate_task and not generate_task.done():
            await generate_task


@app.get("/api/health")
async def health():
    active = config.get_active_provider()
    return {
        "status": "ok",
        "providers": {
            "qwen": bool(config.QWEN_API_KEY),
            "gemini": bool(config.GEMINI_API_KEY),
        },
        "active_provider": active if active else None,
    }


@app.post("/api/providers/save-key")
async def save_api_key(request: dict):
    """验证 API Key 有效性并保存到 .env。"""
    provider = request.get("provider", "").strip()
    api_key = request.get("apiKey", "").strip()

    if provider not in ("qwen", "gemini"):
        return {"success": False, "error": f"未知供应商: {provider}"}
    if not api_key:
        return {"success": False, "error": "API Key 不能为空"}

    # 用提供的 Key 创建临时 Client，发极简请求验证有效性
    try:
        if provider == "qwen":
            client = QwenClient(api_key=api_key)
            await client.chat("Reply OK", "Say OK")
        else:
            client = GeminiClient(api_key=api_key)
            await client.chat("Reply OK", "Say OK")
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"API Key 验证失败 [{provider}]: {err_msg}")
        return {"success": False, "error": f"API Key 无效: {err_msg[:200]}"}

    # 验证通过，保存到 .env 和模块变量
    try:
        config.update_api_key(provider, api_key)
    except Exception as e:
        return {"success": False, "error": f"保存失败: {str(e)}"}

    return {"success": True, "provider": provider}


@app.post("/api/export/pdf")
async def export_pdf(request: dict):
    """
    导出 PDF 端点
    
    请求体格式：
    {
        "slides": [
            {"html": "<div>...</div>", "imageUrl": "http://..."},
            ...
        ],
        "title": "演示文稿标题"
    }
    """
    try:
        slides_data = request.get("slides", [])
        title = request.get("title", "演示文稿")
        
        if not slides_data:
            return Response(
                content="没有幻灯片数据",
                status_code=400,
                media_type="text/plain"
            )
        
        # 构建每页的完整 HTML（包含背景图片，转换为 base64）
        slides_html = []
        for slide in slides_data:
            html_content = slide.get("html", "")
            image_url = slide.get("imageUrl", "")
            
            # 转换图片 URL 为 base64
            if image_url:
                image_base64 = PDFService._convert_image_to_base64(image_url)
                full_slide_html = f"""
<div style="position: relative; width: 100%; height: 100%;">
    <img src="{image_base64}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
    <div style="position: relative; width: 100%; height: 100%;">
        {html_content}
    </div>
</div>
"""
            else:
                full_slide_html = html_content
            
            slides_html.append(full_slide_html)
        
        # 生成 PDF
        pdf_bytes = await PDFService.generate_pdf_from_html(slides_html, title)
        
        # 返回 PDF 文件 - 使用 RFC 5987 编码支持中文文件名
        from urllib.parse import quote
        filename = title.replace("/", "_").replace("\\", "_") + ".pdf"
        filename_encoded = quote(filename)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"
            }
        )
    
    except Exception as e:
        logger.error(f"PDF 导出失败: {e}")
        return Response(
            content=f"PDF 导出失败: {str(e)}",
            status_code=500,
            media_type="text/plain"
        )
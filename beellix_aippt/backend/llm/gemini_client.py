import logging
import httpx

from llm.base import BaseLLMClient
import config
from utils.image_saver import save_image_from_base64

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiClient(BaseLLMClient):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or config.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("未配置 Gemini API Key")

    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{GEMINI_BASE_URL}/{config.GEMINI_TEXT_MODEL}:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "thinkingConfig": {
                    "thinkingBudget": 8192,
                },
            },
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Gemini API 错误 [{resp.status_code}]: {resp.text[:500]}")
                resp.raise_for_status()
            # 启用 thinking 后，思考部分带 thought:true，跳过它取实际输出
            parts = resp.json()["candidates"][0]["content"]["parts"]
            thinking_len = sum(len(p.get("text", "")) for p in parts if p.get("thought"))
            if thinking_len:
                logger.debug(f"Gemini thinking 长度: {thinking_len} 字符")
            for part in parts:
                if "text" in part and not part.get("thought"):
                    return part["text"]
            # fallback: 取最后一个 text part
            for part in reversed(parts):
                if "text" in part:
                    return part["text"]
            raise RuntimeError("Gemini 未返回文本内容")

    async def generate_image(self, prompt: str, size: str = "1280*720", negative_prompt: str = "") -> str:
        """生成图片并保存到本地，返回本地文件路径"""
        url = f"{GEMINI_BASE_URL}/{config.GEMINI_IMAGE_MODEL}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": "16:9",
                    "imageSize": "2K",
                },
            },
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Gemini 图片 API 错误 [{resp.status_code}]: {resp.text[:500]}")
                resp.raise_for_status()
            parts = resp.json()["candidates"][0]["content"]["parts"]
            for part in parts:
                if "inlineData" in part:
                    b64_data = part["inlineData"]["data"]

                    # 保存 base64 图片到本地
                    local_path = save_image_from_base64(b64_data)
                    return local_path

        raise RuntimeError("Gemini 未返回图片数据")
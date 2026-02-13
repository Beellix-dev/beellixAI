import logging
import base64
import io
from pathlib import Path
from playwright.sync_api import sync_playwright
from concurrent.futures import ThreadPoolExecutor
import asyncio
import httpx
from fpdf import FPDF

logger = logging.getLogger(__name__)

# 创建线程池用于运行同步的 Playwright
_executor = ThreadPoolExecutor(max_workers=2)

# 幻灯片截图分辨率（与前端保持一致）
_SLIDE_W = 1280
_SLIDE_H = 720

# PDF 页面尺寸（mm）— 标准 16:9 宽屏（13.333 × 7.5 英寸）
_PAGE_W_MM = 338.667
_PAGE_H_MM = 190.5


class PDFService:
    """使用 Playwright 截图 + fpdf2 生成像素级一致的 PDF"""

    @staticmethod
    def _convert_image_to_base64(image_url: str) -> str:
        """将图片 URL 转换为 base64 数据 URI"""
        try:
            # 如果是相对路径，转换为本地文件路径
            if image_url.startswith("/images/"):
                local_path = Path("generated_images") / image_url.replace("/images/", "")
                if local_path.exists():
                    with open(local_path, "rb") as f:
                        image_data = f.read()
                    base64_data = base64.b64encode(image_data).decode("utf-8")
                    return f"data:image/png;base64,{base64_data}"

            # 如果是完整 URL，下载图片
            elif image_url.startswith("http"):
                response = httpx.get(image_url, timeout=10)
                if response.status_code == 200:
                    base64_data = base64.b64encode(response.content).decode("utf-8")
                    content_type = response.headers.get("content-type", "image/png")
                    return f"data:{content_type};base64,{base64_data}"

            return image_url
        except Exception as e:
            logger.warning(f"无法转换图片 {image_url}: {e}")
            return image_url

    @staticmethod
    def _build_slide_html(slide_content: str) -> str:
        """为单张幻灯片构建完整的 HTML 文档"""
        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{
    width: {_SLIDE_W}px;
    height: {_SLIDE_H}px;
    overflow: hidden;
    background: white;
    font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB",
                 "WenQuanYi Zen Hei", "Noto Sans SC", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}}
img {{ display: block; }}
</style>
</head>
<body>{slide_content}</body>
</html>"""

    @staticmethod
    def _generate_pdf_sync(slides_html: list[str], title: str) -> bytes:
        """截图每张幻灯片，合成为 PDF（在线程池中运行）

        核心策略：用 page.screenshot() 代替 page.pdf()。
        screenshot 走的是屏幕渲染管线，完整支持 backdrop-filter、text-shadow 等
        CSS 特性，输出与浏览器显示完全一致。然后用 fpdf2 将截图逐页嵌入 PDF。
        """
        logger.info(f"开始生成 PDF（截图模式），共 {len(slides_html)} 页")

        screenshots: list[bytes] = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": _SLIDE_W, "height": _SLIDE_H},
                device_scale_factor=2,  # 2x 缩放，输出 3840×2160 高清截图
            )

            for i, slide_html in enumerate(slides_html):
                html_doc = PDFService._build_slide_html(slide_html)
                page.set_content(html_doc, wait_until="networkidle", timeout=15000)
                # 额外等待确保字体渲染、CSS 动画等完成
                page.wait_for_timeout(800)

                png_bytes = page.screenshot(type="png", full_page=False)
                screenshots.append(png_bytes)
                logger.info(f"第 {i + 1}/{len(slides_html)} 页截图完成")

            browser.close()

        # 将截图合成为 PDF —— 16:9 自定义页面尺寸
        pdf = FPDF(unit="mm", format=(_PAGE_W_MM, _PAGE_H_MM))
        pdf.set_auto_page_break(False)

        for png in screenshots:
            pdf.add_page()
            pdf.image(io.BytesIO(png), x=0, y=0, w=_PAGE_W_MM, h=_PAGE_H_MM)

        pdf_bytes = pdf.output()
        logger.info(f"PDF 生成完成，大小: {len(pdf_bytes)} 字节")
        return bytes(pdf_bytes)

    @staticmethod
    async def generate_pdf_from_html(slides_html: list[str], title: str = "演示文稿") -> bytes:
        """
        从幻灯片 HTML 列表生成 PDF

        Args:
            slides_html: 每页幻灯片的完整 HTML 内容列表
            title: PDF 文档标题

        Returns:
            PDF 文件的字节内容
        """
        loop = asyncio.get_event_loop()
        pdf_bytes = await loop.run_in_executor(
            _executor,
            PDFService._generate_pdf_sync,
            slides_html,
            title,
        )
        return pdf_bytes
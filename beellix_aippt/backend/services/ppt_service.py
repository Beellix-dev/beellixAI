import asyncio
import logging
from typing import AsyncGenerator

from models import PlannerResult, FinalSlide, WSEvent
from agents.ppt_planner_agent import PPTPlannerAgent
from agents.ppt_designer_agent import PPTDesignerAgent
from agents.ppt_artist_agent import PPTArtistAgent
from llm.base import BaseLLMClient

logger = logging.getLogger(__name__)


class PPTService:
    """编排完整的 PPT 生成流水线，支持通过 cancel_event 中途取消。"""

    def __init__(self, text_llm: BaseLLMClient, image_llm: BaseLLMClient, provider: str):
        self.planner = PPTPlannerAgent(text_llm, provider)
        self.designer = PPTDesignerAgent(text_llm, provider)
        self.artist = PPTArtistAgent(image_llm, provider)

    async def generate(
        self, topic: str, cancel_event: asyncio.Event | None = None
    ) -> AsyncGenerator[WSEvent, None]:
        """
        完整流水线，以异步生成器逐步推送 WSEvent：
          - "status"   — 进度状态更新
          - "outline"  — 完整大纲
          - "slide"    — 单页幻灯片完成
          - "done"     — 全部完成
          - "error"    — 发生错误
        """

        def is_cancelled() -> bool:
            return cancel_event is not None and cancel_event.is_set()

        # --- 第一步：生成大纲 ---
        yield WSEvent(event="status", data={"status": "planning", "message": "正在规划幻灯片大纲..."})

        try:
            outline: PlannerResult = await self.planner.generate_outline(topic)
        except Exception as e:
            logger.error(f"Planner 失败: {e}")
            yield WSEvent(event="error", data={"message": f"大纲生成失败: {e}"})
            return

        if is_cancelled():
            yield WSEvent(event="error", data={"message": "已取消生成"})
            return

        yield WSEvent(event="outline", data=outline.model_dump())

        # 构建 metadata
        metadata = {
            "topic": outline.topic,
            "title": outline.title,
            "visualTheme": outline.visualTheme,
            "tone": outline.tone,
            "accentColor": outline.accentColor,
        }

        # --- 第二步 & 第三步：逐页设计 + 生成配图 ---
        slides: list[FinalSlide] = []
        total = len(outline.slides)

        for i, slide_outline in enumerate(outline.slides):
            if is_cancelled():
                yield WSEvent(event="error", data={"message": "已取消生成"})
                return

            yield WSEvent(event="status", data={
                "status": "designing",
                "slideIndex": i,
                "totalSlides": total,
                "message": f"正在设计第 {i + 1}/{total} 页：{slide_outline.title}",
            })

            try:
                # 设计幻灯片
                design = await self.designer.design_slide(
                    metadata=metadata,
                    slide_outline=slide_outline.model_dump(),
                    index=i,
                )

                if is_cancelled():
                    yield WSEvent(event="error", data={"message": "已取消生成"})
                    return

                yield WSEvent(event="status", data={
                    "status": "generating_image",
                    "slideIndex": i,
                    "totalSlides": total,
                    "message": f"正在为第 {i + 1}/{total} 页生成配图...",
                })

                # 生成配图
                image_local_path = await self.artist.generate_image(design.imagePrompt)
                
                # 将本地路径转换为前端可访问的 URL
                # 例如: generated_images/slide_20240101_120000.png -> /images/slide_20240101_120000.png
                image_filename = image_local_path.split("/")[-1].split("\\")[-1]  # 兼容 Windows 和 Unix 路径
                image_url = f"/images/{image_filename}"

                # 替换占位符
                final_html = design.htmlContent.replace("__SLIDE_IMAGE__", image_url)

                slide = FinalSlide(
                    index=i,
                    outline=slide_outline,
                    design=design,
                    imageUrl=image_url,
                    finalHtml=final_html,
                )
                slides.append(slide)

                yield WSEvent(event="slide", data=slide.model_dump())

            except Exception as e:
                logger.error(f"第 {i + 1} 页失败: {e}")
                yield WSEvent(event="error", data={
                    "message": f"第 {i + 1} 页生成失败: {e}",
                    "slideIndex": i,
                })

        # --- 第四步：完成 ---
        yield WSEvent(event="done", data={
            "totalSlides": len(slides),
            "title": outline.title,
        })
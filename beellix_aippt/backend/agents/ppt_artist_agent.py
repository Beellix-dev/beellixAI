import logging

from prompts import get_image_enhancer
from llm.base import BaseLLMClient

logger = logging.getLogger(__name__)

FALLBACK_IMAGE_URL = "https://placehold.co/1280x720?text={text}"


class PPTArtistAgent:
    """增强图片提示词并调用图像模型生成配图。"""

    def __init__(self, llm: BaseLLMClient, provider: str):
        self.llm = llm
        self.enhance = get_image_enhancer(provider)

    async def generate_image(self, image_prompt: str) -> str:
        """增强提示词并生成图片，返回图片 URL。"""
        logger.info(f"Artist: 为提示词生成图片 '{image_prompt[:60]}...'")

        enhanced = self.enhance(image_prompt)

        # enhance 可能返回 dict(含 negative_prompt) 或纯字符串
        if isinstance(enhanced, dict):
            prompt = enhanced["prompt"]
            negative_prompt = enhanced.get("negative_prompt", "")
            logger.info(f"Artist: 增强后提示词 '{prompt[:80]}...'")
        else:
            prompt = enhanced
            negative_prompt = ""
            logger.info(f"Artist: 增强后提示词 '{prompt[:80]}...'")

        try:
            url = await self.llm.generate_image(prompt, negative_prompt=negative_prompt)
            logger.info("Artist: 图片生成成功")
            return url
        except Exception as e:
            logger.warning(f"Artist: 图片生成失败 ({e})，使用占位图")
            fallback_text = image_prompt[:50].replace(" ", "+")
            return FALLBACK_IMAGE_URL.format(text=fallback_text)
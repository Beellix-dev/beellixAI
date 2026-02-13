import json
import logging

from models import DesignerResult
from prompts import get_designer_prompts
from llm.base import BaseLLMClient
from utils.text import extract_json

logger = logging.getLogger(__name__)


class PPTDesignerAgent:
    """为单页幻灯片生成 HTML/CSS 内容。"""

    def __init__(self, llm: BaseLLMClient, provider: str):
        self.llm = llm
        self.provider = provider

    async def design_slide(
        self, metadata: dict, slide_outline: dict, index: int
    ) -> DesignerResult:
        logger.info(f"Designer: 设计第 {index + 1} 页 '{slide_outline['title']}'")

        system_prompt, build_user_prompt = get_designer_prompts(self.provider)
        user_prompt = build_user_prompt(metadata, slide_outline, index)

        raw = await self.llm.chat(system_prompt, user_prompt)
        logger.info(f"Designer 第 {index + 1} 页原始响应长度: {len(raw)} 字符，前 300 字符: {raw[:300]}")

        text = extract_json(raw)

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Designer 第 {index + 1} 页 JSON 解析失败: {e}\n响应文本前 500 字符: {text[:500]}")
            raise ValueError(f"第 {index + 1} 页设计 JSON 解析失败: {e}") from e

        result = DesignerResult(**data)

        logger.info(f"Designer: 第 {index + 1} 页完成")
        return result
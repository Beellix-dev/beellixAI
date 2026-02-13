import json
import logging

from models import PlannerResult
from prompts import get_planner_prompts
from llm.base import BaseLLMClient
from utils.text import extract_json

logger = logging.getLogger(__name__)


class PPTPlannerAgent:
    """根据主题生成完整的演示文稿大纲。"""

    def __init__(self, llm: BaseLLMClient, provider: str):
        self.llm = llm
        self.provider = provider

    async def generate_outline(self, topic: str) -> PlannerResult:
        logger.info(f"Planner: 为主题 '{topic}' 生成大纲")

        system_prompt, user_template = get_planner_prompts(self.provider)
        user_prompt = user_template.format(topic=topic)

        raw = await self.llm.chat(system_prompt, user_prompt)
        logger.info(f"Planner 原始响应长度: {len(raw)} 字符，前 300 字符: {raw[:300]}")

        text = extract_json(raw)

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Planner JSON 解析失败: {e}\n响应文本前 500 字符: {text[:500]}")
            raise ValueError(f"大纲 JSON 解析失败: {e}") from e

        result = PlannerResult(**data)

        logger.info(f"Planner: 生成了 {len(result.slides)} 页幻灯片大纲")
        return result
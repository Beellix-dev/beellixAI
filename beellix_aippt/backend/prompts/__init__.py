from typing import Callable

from prompts.qwen_prompts import (
    QWEN_PLANNER_SYSTEM_PROMPT,
    QWEN_PLANNER_USER_PROMPT,
    QWEN_DESIGNER_SYSTEM_PROMPT,
    build_qwen_designer_user_prompt,
    enhance_prompt_for_qwen,
)
from prompts.gemini_prompts import (
    GEMINI_PLANNER_SYSTEM_PROMPT,
    GEMINI_PLANNER_USER_PROMPT,
    GEMINI_DESIGNER_SYSTEM_PROMPT,
    build_gemini_designer_user_prompt,
    enhance_prompt_for_gemini,
)


def get_planner_prompts(provider: str) -> tuple[str, str]:
    """返回 (system_prompt, user_prompt_template)"""
    if provider == "qwen":
        return QWEN_PLANNER_SYSTEM_PROMPT, QWEN_PLANNER_USER_PROMPT
    return GEMINI_PLANNER_SYSTEM_PROMPT, GEMINI_PLANNER_USER_PROMPT


def get_designer_prompts(provider: str) -> tuple[str, Callable]:
    """返回 (system_prompt, user_prompt_builder_func)"""
    if provider == "qwen":
        return QWEN_DESIGNER_SYSTEM_PROMPT, build_qwen_designer_user_prompt
    return GEMINI_DESIGNER_SYSTEM_PROMPT, build_gemini_designer_user_prompt


def get_image_enhancer(provider: str) -> Callable:
    """返回对应供应商的图片提示词增强函数"""
    if provider == "qwen":
        return enhance_prompt_for_qwen
    return enhance_prompt_for_gemini
from abc import ABC, abstractmethod


class BaseLLMClient(ABC):
    @abstractmethod
    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        """发送文本补全请求，返回原始文本响应。"""
        ...

    @abstractmethod
    async def generate_image(self, prompt: str, size: str = "1280*720", negative_prompt: str = "") -> str:
        """根据提示词生成图片，返回图片 URL 或 base64。"""
        ...
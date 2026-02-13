import logging
import httpx

from llm.base import BaseLLMClient
import config
from utils.image_saver import save_image_from_url

logger = logging.getLogger(__name__)

QWEN_CHAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
# qwen-image-max 使用同步 multimodal-generation 端点（不再是异步 text2image）
QWEN_IMAGE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"


class QwenClient(BaseLLMClient):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or config.QWEN_API_KEY
        if not self.api_key:
            raise ValueError("未配置千问 API Key")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": config.QWEN_TEXT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(QWEN_CHAT_URL, headers=self.headers, json=payload)
            if resp.status_code != 200:
                logger.error(f"Qwen API 错误 [{resp.status_code}]: {resp.text[:500]}")
                resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def generate_image(self, prompt: str, size: str = "1280*720", negative_prompt: str = "") -> str:
        """调用 qwen-image-max 同步生成图片，返回本地文件路径。

        qwen-image-max 使用 multimodal-generation 端点，同步返回结果，
        请求体为 messages 格式，negative_prompt 放在 parameters 中。
        """
        payload = {
            "model": config.QWEN_IMAGE_MODEL,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    }
                ]
            },
            "parameters": {
                "size": size,
                "prompt_extend": False,
                "watermark": False,
            },
        }
        if negative_prompt:
            payload["parameters"]["negative_prompt"] = negative_prompt

        async with httpx.AsyncClient(timeout=180) as client:
            logger.info(f"Qwen 图片生成请求 (同步): model={config.QWEN_IMAGE_MODEL}, size={size}")
            resp = await client.post(QWEN_IMAGE_URL, headers=self.headers, json=payload)
            if resp.status_code != 200:
                logger.error(f"Qwen 图片 API 错误 [{resp.status_code}]: {resp.text[:500]}")
                resp.raise_for_status()

            data = resp.json()
            # 响应格式: output.choices[0].message.content[0].image
            image_url = data["output"]["choices"][0]["message"]["content"][0]["image"]
            logger.info(f"Qwen 图片生成成功: {image_url[:80]}...")
            local_path = await save_image_from_url(image_url)
            return local_path
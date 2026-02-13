import re


def extract_json(raw: str) -> str:
    """从 LLM 响应中提取 JSON 文本，处理 <think> 块、markdown 围栏等。"""
    text = raw.strip()

    # 去除 qwen3 系列模型的 <think>...</think> 推理块
    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()

    # 去除 markdown 代码围栏
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()

    # 兜底：找到第一个 { 和最后一个 } 之间的内容
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]

    return text
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# 模型注册表
QWEN_TEXT_MODEL = "qwen3-max"
QWEN_IMAGE_MODEL = "qwen-image-max"
GEMINI_TEXT_MODEL = "gemini-3-pro-preview"
GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"

# provider → 模块变量名 / 环境变量名 映射
_KEY_MAP = {
    "qwen": "QWEN_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


def get_active_provider() -> str:
    """根据配置的 Key 自动选择供应商。优先级：Gemini > 千问。无 Key 时返回空字符串。"""
    if GEMINI_API_KEY:
        return "gemini"
    if QWEN_API_KEY:
        return "qwen"
    return ""


def update_api_key(provider: str, key: str) -> None:
    """动态更新 API Key：模块变量 + os.environ + .env 文件。"""
    global QWEN_API_KEY, GEMINI_API_KEY

    env_name = _KEY_MAP.get(provider)
    if not env_name:
        raise ValueError(f"未知供应商: {provider}")

    # 1. 更新模块级变量
    if provider == "qwen":
        QWEN_API_KEY = key
    else:
        GEMINI_API_KEY = key

    # 2. 更新 os.environ（影响后续 os.getenv）
    os.environ[env_name] = key

    # 3. 读取 .env 文件，替换或追加对应行，写回
    env_path = Path(__file__).parent / ".env"
    lines: list[str] = []
    found = False
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines(keepends=True)
        new_lines: list[str] = []
        for line in lines:
            stripped = line.lstrip()
            if stripped.startswith(f"{env_name}="):
                new_lines.append(f"{env_name}={key}\n")
                found = True
            else:
                new_lines.append(line if line.endswith("\n") else line + "\n")
        lines = new_lines

    if not found:
        lines.append(f"{env_name}={key}\n")

    env_path.write_text("".join(lines), encoding="utf-8")
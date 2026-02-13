import os
import base64
import httpx
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# 图片保存目录
IMAGES_DIR = Path("generated_images")
IMAGES_DIR.mkdir(exist_ok=True)


async def save_image_from_url(url: str, filename: str = None) -> str:
    """
    从 URL 下载图片并保存到本地，返回本地路径。
    
    Args:
        url: 图片的 URL 地址
        filename: 可选的文件名，如果不提供则自动生成
    
    Returns:
        本地图片路径（相对于项目根目录）
    """
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"slide_{timestamp}.png"
    
    filepath = IMAGES_DIR / filename
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            with open(filepath, "wb") as f:
                f.write(response.content)
            
            logger.info(f"图片已保存到: {filepath}")
            return str(filepath)
    
    except Exception as e:
        logger.error(f"保存图片失败: {e}")
        raise


def save_image_from_base64(base64_data: str, filename: str = None) -> str:
    """
    从 base64 数据保存图片到本地，返回本地路径。
    
    Args:
        base64_data: base64 编码的图片数据（可以包含 data:image/png;base64, 前缀）
        filename: 可选的文件名，如果不提供则自动生成
    
    Returns:
        本地图片路径（相对于项目根目录）
    """
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"slide_{timestamp}.png"
    
    filepath = IMAGES_DIR / filename
    
    try:
        # 移除 data:image/png;base64, 前缀（如果存在）
        if "base64," in base64_data:
            base64_data = base64_data.split("base64,")[1]
        
        # 解码并保存
        image_bytes = base64.b64decode(base64_data)
        
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        
        logger.info(f"图片已保存到: {filepath}")
        return str(filepath)
    
    except Exception as e:
        logger.error(f"保存 base64 图片失败: {e}")
        raise

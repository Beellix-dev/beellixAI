from pydantic import BaseModel


# --- Planner 输出 ---
class SlideOutline(BaseModel):
    title: str
    purpose: str
    visualAdvice: str


class PlannerResult(BaseModel):
    topic: str
    title: str
    subtitle: str
    targetAudience: str
    presentationGoal: str
    tone: str
    visualTheme: str
    accentColor: str
    researchContext: str
    slides: list[SlideOutline]


# --- Designer 输出 ---
class SlideStat(BaseModel):
    value: str
    label: str


class DesignerResult(BaseModel):
    title: str
    subtitle: str = ""
    content: list[str]
    imagePrompt: str
    htmlContent: str
    designDirective: str = ""
    stats: list[SlideStat] = []


# --- 最终幻灯片 ---
class FinalSlide(BaseModel):
    index: int
    outline: SlideOutline
    design: DesignerResult
    imageUrl: str
    finalHtml: str


# --- WebSocket 消息 ---
class WSMessage(BaseModel):
    """前端 → 后端的 WebSocket 消息"""
    action: str           # "generate" | "cancel"
    topic: str = ""
    provider: str = ""    # "qwen" | "gemini"，为空则自动检测


class WSEvent(BaseModel):
    """后端 → 前端的 WebSocket 事件"""
    event: str            # "status" | "outline" | "slide" | "done" | "error"
    data: dict = {}
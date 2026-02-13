# Beellix AI PPT - AI 演示文稿生成器

这是一个基于多Agent架构的AI内容生成与演示文稿创作Demo。“自主协同、探索无限可能”是我们设计的核心思路，我们希望通过简单的自然语言交互，让用户无需繁琐操作，只需描述需求，就能由多Agent自主协同完成逻辑拆解、内容梳理、版式设计，最终生成结构清晰、版式精美的PPT演示文稿。这是我们研发过程中的一个初期demo，现阶段先分享出来，主要是为了让大家轻松体验、玩玩看，感受多智能体协同创作的乐趣。更多内容创作场景与扩展能力在打磨完善中，产品体验、功能稳定性也在持续优化迭代，不夸大、不画饼，真诚呈现每一步的探索与进步。作为研发初期的demo，本项目不仅是一个简单的演示工具，更创新性的探索开放、可扩展的核心理念，致力于探索多Agent协同在内容创作、自动化处理、智能交互等领域的更多可能性——它没有固定的边界，不是单一功能的工具，而是一个充满想象空间的AI实验平台，未来将随着需求迭代、技术升级，持续拓展能力边界，解锁更多未知可能，从核心能力出发，逐步成长为更全面、更实用的智能协同系统。

## 📸 效果展示

<p align="center">
  <img src="demo/light&dark.png" width="45%" />
  <img src="demo/gygm.png" width="45%" />
</p>

## ✨ 功能特性

- 🤖 **多 Agent 协作**：规划、设计、配图三个 Agent 协同工作
- 🎨 **智能设计**：自动生成符合主题的视觉风格和配色方案
- 🖼️ **AI 配图**：为每页幻灯片生成匹配的背景图片
- 💬 **实时交互**：WebSocket 实时推送生成进度
- 📊 **实时预览**：支持幻灯片缩略图和全屏演示模式
- 📄 **PDF 导出**：一键导出高质量 PDF 文档
- 🔄 **多模型支持**：支持阿里千问和谷歌 Gemini 两种 AI 模型

## 🏗️ 技术架构!

### 后端技术栈

- **框架**：FastAPI + WebSocket
- **AI 模型**：
  - 阿里千问（Qwen）：文本生成 + 图像生成
  - 谷歌 Gemini：文本生成 + 图像生成
- **PDF 生成**：Playwright（浏览器渲染）
- **依赖管理**：uv + pyproject.toml

### 前端技术栈

- **框架**：React 19 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS 4
- **图标**：Lucide React
- **截图**：html2canvas-pro

### 核心 Agent 架构

```
用户输入主题
    ↓
PPTPlannerAgent（规划 Agent）
    ├─ 分析主题和目标受众
    ├─ 确定视觉主题和色调
    └─ 生成幻灯片大纲
    ↓
PPTDesignerAgent（设计 Agent）
    ├─ 为每页设计 HTML/CSS 布局
    ├─ 生成内容和排版
    └─ 创建图片提示词
    ↓
PPTArtistAgent（配图 Agent）
    ├─ 根据提示词生成背景图
    └─ 保存图片到本地
    ↓
最终输出完整演示文稿
```

## 🚀 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- uv（Python 包管理器）

### 1. 克隆项目

```bash
git clone <repository-url>
cd beellix-aippt
```

### 2. 后端设置

```bash
# 安装 uv（如果尚未安装）
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 安装依赖
cd backend
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 API Key（可选，也可在前端界面配置）
# QWEN_API_KEY=your_qwen_api_key
# GEMINI_API_KEY=your_gemini_api_key

# 安装 Playwright 浏览器（用于 PDF 导出）
uv run playwright install chromium

# 启动后端服务
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 访问应用

打开浏览器访问：`http://localhost:5173`

## 📖 使用指南

### 基本使用流程

1. **选择 AI 模型**：在左侧面板选择"阿里千问"或"谷歌 Gemini"
2. **配置 API Key**：
   - 如果服务器未配置 Key，需要在输入框中输入 API Key
   - 点击"保存"按钮验证并保存到服务器
3. **输入主题**：在输入框中描述你想要的 PPT 主题，例如：
   - "帮我生成一个关于人工智能发展历程的 PPT"
   - "制作一份产品发布会演示文稿"
4. **等待生成**：AI 会自动完成规划、设计和配图
5. **预览和编辑**：
   - 使用左右箭头或点击缩略图切换幻灯片
   - 支持键盘快捷键（←/→）翻页
6. **导出和演示**：
   - 点击"查看和导出"按钮
   - 选择"演示视图"进行全屏演示
   - 选择"导出 PDF"下载文档

### API Key 获取

#### 阿里千问
1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
2. 创建应用并获取 API Key
3. 确保开通了文本生成和图像生成服务

#### 谷歌 Gemini
1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建 API Key
3. 确保有访问 Gemini 模型的权限

## 📁 项目结构

```
beellix-aippt/
├── backend/                    # 后端服务
│   ├── agents/                 # AI Agent 实现
│   │   ├── ppt_planner_agent.py    # 规划 Agent
│   │   ├── ppt_designer_agent.py   # 设计 Agent
│   │   └── ppt_artist_agent.py     # 配图 Agent
│   ├── llm/                    # LLM 客户端封装
│   │   ├── base.py             # 基类
│   │   ├── qwen_client.py      # 千问客户端
│   │   └── gemini_client.py    # Gemini 客户端
│   ├── services/               # 业务服务
│   │   ├── ppt_service.py      # PPT 生成服务
│   │   └── pdf_service.py      # PDF 导出服务
│   ├── prompts/                # Prompt 模板
│   ├── utils/                  # 工具函数
│   ├── generated_images/       # 生成的图片存储
│   ├── models.py               # 数据模型
│   ├── config.py               # 配置管理
│   └── main.py                 # FastAPI 应用入口
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/         # React 组件
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── utils/              # 工具函数
│   │   └── App.tsx             # 主应用组件
│   ├── public/                 # 静态资源
│   └── package.json
├── pyproject.toml              # Python 项目配置
└── README.md                   # 项目文档
```

## 🔧 配置说明

### 后端配置（backend/.env）

```env
# 阿里千问 API Key
QWEN_API_KEY=your_qwen_api_key

# 谷歌 Gemini API Key
GEMINI_API_KEY=your_gemini_api_key
```

### 模型配置（backend/config.py）

```python
# 文本生成模型
QWEN_TEXT_MODEL = "qwen3-max"
GEMINI_TEXT_MODEL = "gemini-3-pro-preview"

# 图像生成模型
QWEN_IMAGE_MODEL = "qwen-image-max"
GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"
```

## 🎯 核心功能实现

### WebSocket 实时通信

后端通过 WebSocket 推送生成进度：

```python
# 事件类型
- "status"   # 进度状态更新
- "outline"  # 完整大纲生成完成
- "slide"    # 单页幻灯片完成
- "done"     # 全部完成
- "error"    # 发生错误
```

### 幻灯片设计

每页幻灯片包含：
- 标题和副标题
- 内容列表
- 自定义 HTML/CSS 布局
- AI 生成的背景图片
- 响应式设计（1280×720 标准尺寸）

### PDF 导出

使用 Playwright 进行高质量渲染：
- 保持原始设计和样式
- 支持中文文件名
- 自动处理图片 base64 编码
- 标准 A4 横向布局

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 联系我们
beellix@qq.com


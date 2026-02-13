import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertCircle
} from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { slideCache } from './utils/slideCache';

// --- 聊天消息类型 ---
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// --- 进度步骤 ---
interface ProgressStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

function App() {
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('qwen');
  const [apiKey, setApiKey] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const [providerStatus, setProviderStatus] = useState<{ qwen: boolean; gemini: boolean }>({ qwen: false, gemini: false });
  const [savingKey, setSavingKey] = useState(false);
  const [saveKeyMsg, setSaveKeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mainSlideRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const { state, startGeneration, cancelGeneration } = useWebSocket();

  // 主预览区 ResizeObserver — 计算适配容器的缩放比
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      // 同时考虑宽度和高度，取较小的缩放比以确保完整显示
      const scaleX = width / 1280;
      const scaleY = height / 720;
      setPreviewScale(Math.min(scaleX, scaleY));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 启动时检查服务端 Key 配置状态
  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then(r => r.json())
      .then(data => {
        if (data.providers) {
          setProviderStatus(data.providers);
        }
      })
      .catch(() => {});
  }, []);

  // 自动清除 save-key 消息
  useEffect(() => {
    if (!saveKeyMsg) return;
    const timer = setTimeout(() => setSaveKeyMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [saveKeyMsg]);

  // 保存 API Key 到服务器
  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim() || savingKey) return;
    setSavingKey(true);
    setSaveKeyMsg(null);
    try {
      const resp = await fetch('http://localhost:8000/api/providers/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedModel, apiKey: apiKey.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setProviderStatus(prev => ({ ...prev, [selectedModel]: true }));
        setSaveKeyMsg({ type: 'success', text: 'API Key 验证通过，已保存到服务器' });
        setApiKey('');
      } else {
        setSaveKeyMsg({ type: 'error', text: data.error || '保存失败' });
      }
    } catch (e) {
      setSaveKeyMsg({ type: 'error', text: '无法连接到服务器' });
    } finally {
      setSavingKey(false);
    }
  }, [apiKey, selectedModel, savingKey]);

  // 自动清除导出错误提示
  useEffect(() => {
    if (!exportError) return;
    const timer = setTimeout(() => setExportError(null), 5000);
    return () => clearTimeout(timer);
  }, [exportError]);

  // 键盘快捷键：左右箭头翻页
  useEffect(() => {
    if (state.slides.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框中，不处理
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentSlideIndex(prev => Math.min(state.slides.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.slides.length]);

  // 自动滚动缩略图到当前幻灯片
  useEffect(() => {
    if (!thumbnailContainerRef.current || state.slides.length === 0) return;

    const container = thumbnailContainerRef.current;
    const thumbnailWidth = 192; // h-24 aspect-video ≈ 192px width
    const gap = 16; // gap-4 = 16px
    const scrollPosition = currentSlideIndex * (thumbnailWidth + gap);

    container.scrollTo({
      left: scrollPosition - container.clientWidth / 2 + thumbnailWidth / 2,
      behavior: 'smooth',
    });
  }, [currentSlideIndex, state.slides.length]);

  // 导出 PDF - 通过后端 Playwright 生成高质量 PDF
  const handleExportPdf = useCallback(async () => {
    if (state.slides.length === 0 || exportProgress) return;

    setExportProgress({ current: 0, total: state.slides.length });

    try {
      // 准备幻灯片数据
      const slidesData = state.slides.map(slide => ({
        html: slide.finalHtml,
        imageUrl: slide.imageUrl || '',
      }));

      const title = state.outline?.title || '演示文稿';

      // 调用后端 API
      const response = await fetch('http://localhost:8000/api/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slides: slidesData,
          title: title,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'PDF 导出失败');
      }

      // 下载 PDF 文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'presentation';
      a.download = filename + '.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportProgress({ current: state.slides.length, total: state.slides.length });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出 PDF 失败');
    } finally {
      setTimeout(() => setExportProgress(null), 500);
    }
  }, [state.slides, state.outline?.title, exportProgress]);

  // 自动滚动到聊天底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, state.statusMessage]);

  // 构建进度步骤
  const getProgressSteps = (): ProgressStep[] => {
    const phase = state.phase;
    const steps: ProgressStep[] = [
      {
        label: '初始化幻灯片项目',
        status: phase === 'idle' ? 'pending' : 'done',
      },
      {
        label: '规划幻灯片大纲',
        status: phase === 'planning' ? 'active' : state.outline ? 'done' : 'pending',
      },
    ];

    if (state.outline) {
      state.outline.slides.forEach((s, i) => {
        const slideReady = state.slides.some(sl => sl.index === i);
        const isDesigning = !slideReady && state.currentSlideIndex === i;
        steps.push({
          label: `设计第 ${i + 1} 页：${s.title}`,
          status: slideReady ? 'done' : isDesigning ? 'active' : 'pending',
        });
      });
    }

    return steps;
  };

  // 发送消息
  const handleSend = () => {
    const topic = inputValue.trim();
    if (!topic) return;

    // 生成前校验：服务端无 Key 且用户也没输入
    const serverHasKey = providerStatus[selectedModel as keyof typeof providerStatus];
    if (!serverHasKey && !apiKey.trim()) {
      setSaveKeyMsg({ type: 'error', text: `请先输入 ${selectedModel === 'qwen' ? '千问' : 'Gemini'} API Key 或保存到服务器` });
      return;
    }

    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: topic },
      { role: 'assistant', content: `好的，我来为您生成关于「${topic}」的演示文稿，请稍等...` },
    ]);
    setInputValue('');
    setCurrentSlideIndex(0);
    startGeneration(topic, selectedModel, apiKey);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 是否正在生成
  const isGenerating = !['idle', 'done', 'error'].includes(state.phase);
  const steps = getProgressSteps();
  const activeSteps = steps.filter(s => s.status !== 'pending').length;

  // 自动跳转到最新生成的幻灯片
  useEffect(() => {
    if (state.slides.length > 0 && isGenerating) {
      // 生成过程中，自动跳转到最新生成的幻灯片
      setCurrentSlideIndex(state.slides.length - 1);
    }
  }, [state.slides.length, isGenerating]);

  // 当前预览的幻灯片
  const previewSlide = state.slides[currentSlideIndex];

  // 自动截图缓存当前幻灯片
  useEffect(() => {
    if (!previewSlide || !mainSlideRef.current) return;

    const captureTimeout = setTimeout(async () => {
      try {
        const slideId = `slide-${previewSlide.index}`;
        await slideCache.captureSlide(slideId, mainSlideRef.current!);
      } catch (error) {
        console.error('Failed to capture slide:', error);
      }
    }, 500); // 等待渲染完成

    return () => clearTimeout(captureTimeout);
  }, [previewSlide]);

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden font-sans text-gray-800">
      
      {/* ============ 顶部标题栏 ============ */}
      <header className="w-full h-12 border-b border-gray-200 bg-white flex items-center px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/beellix-logo.png?v=4" alt="Beellix Logo" className="h-6 w-auto object-contain" />
          <span className="text-lg font-semibold text-gray-800">beellix</span>
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-xl font-bold text-blue-600">AI PPT</span>
        </div>
        <div className="w-[120px]"></div> {/* 占位，保持居中 */}
      </header>

      <div className="flex flex-1 overflow-hidden">

      {/* ============ 左侧面板 - 聊天界面 ============ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r border-gray-200 h-full relative bg-gray-50">

        {/* 聊天记录 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {chatMessages.map((msg, i) => (
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm leading-relaxed shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-start gap-2 max-w-[90%]">
                <div className="bg-gray-50 px-5 py-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed text-gray-700 shadow-sm border border-gray-100">
                  {msg.content}
                </div>
              </div>
            )
          ))}

          {/* 进度状态卡片 */}
          {state.phase !== 'idle' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden mx-1 shadow-sm">
              <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>使用工具 | 深度思考</span>
                </div>
                {isGenerating && (
                  <span className="text-xs text-gray-400">剩余 {steps.length - activeSteps} 个事项</span>
                )}
              </div>
              <div className="p-2 bg-white">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2 ${step.status === 'active' ? 'bg-blue-50/50 rounded-lg' : ''}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {step.status === 'done' && (
                        <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {step.status === 'active' && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      )}
                      {step.status === 'pending' && (
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <span className={`text-sm ${step.status === 'active' ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {state.phase === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mx-1 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* 完成提示 */}
          {state.phase === 'done' && (
            <div className="flex flex-col items-start gap-2 max-w-[90%]">
              <div className="bg-green-50 px-5 py-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed text-green-800 shadow-sm border border-green-100">
                演示文稿已生成完毕！共 {state.slides.length} 页，请在右侧预览区查看。
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 输入区 */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isGenerating}
              className="ml-auto text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600 disabled:opacity-50"
            >
              <option value="qwen">阿里千问</option>
              <option value="gemini">谷歌 Gemini</option>
            </select>
          </div>
          
          {/* API Key 输入区 */}
          <div className="mb-2">
            {/* 服务端 Key 状态提示 */}
            {providerStatus[selectedModel as keyof typeof providerStatus] ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 mb-1.5 px-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>服务器已配置 {selectedModel === 'qwen' ? '千问' : 'Gemini'} API Key</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-1.5 px-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>服务器未配置 {selectedModel === 'qwen' ? '千问' : 'Gemini'} API Key，请输入</span>
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                type="password"
                placeholder={providerStatus[selectedModel as keyof typeof providerStatus]
                  ? `输入新的 API Key（可选，覆盖服务器配置）`
                  : `输入 ${selectedModel === 'qwen' ? '千问' : 'Gemini'} API Key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isGenerating || savingKey}
                className={`flex-1 text-xs border rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600 placeholder-gray-400 disabled:opacity-50 ${
                  !providerStatus[selectedModel as keyof typeof providerStatus] && !apiKey.trim()
                    ? 'border-amber-300'
                    : 'border-gray-200'
                }`}
              />
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || isGenerating || savingKey}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>保存</span>
              </button>
            </div>
            {/* 保存结果提示 */}
            {saveKeyMsg && (
              <div className={`text-xs mt-1.5 px-1 ${saveKeyMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {saveKeyMsg.text}
              </div>
            )}
          </div>
          
          <div className="relative border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors bg-white">
            <textarea
              className="w-full p-3 pr-10 resize-none outline-none text-sm min-h-[60px] rounded-lg bg-transparent placeholder-gray-400"
              placeholder="输入'帮我生成一个关于AI的PPT'..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
            />

            <div className="absolute bottom-2 right-2">
              {isGenerating ? (
                <button
                  onClick={cancelGeneration}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className={`p-1.5 rounded transition-colors ${
                    inputValue.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-300'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="text-center mt-1.5 text-xs text-gray-400">
            按 Enter 发送，Shift + Enter 换行
          </div>
        </div>
      </div>

      {/* ============ 右侧面板 - 幻灯片预览 ============ */}
      <div className="flex-1 bg-gray-50 flex flex-col h-full overflow-hidden relative">
        {state.slides.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
              {isGenerating ? (
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              ) : (
                <Sparkles className="w-10 h-10 text-blue-500" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {isGenerating ? '正在生成演示文稿...' : 'AI 演示文稿生成器'}
            </h3>
            <p className="text-sm text-gray-400">
              {isGenerating ? '请稍候，AI 正在为您创作精美幻灯片' : '在左侧输入主题，立即生成精美 PPT'}
            </p>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-gray-800 text-lg">{state.outline?.title || '演示文稿'}</h1>
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md font-medium">
              {state.slides.length} / {state.totalSlides} Slides
            </span>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
             <img src="/beellix-logo.png?v=4" alt="Logo" className="w-8 h-8 object-contain" />
             <span className="text-sm font-semibold">AI PPT</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPdf}
              disabled={isGenerating || !!exportProgress}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{exportProgress ? `正在导出... ${exportProgress.current}/${exportProgress.total}` : '导出 PDF'}</span>
              {exportProgress && <Loader2 className="w-4 h-4 animate-spin" />}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-8 gap-8">
            {/* Main Slide Preview */}
            <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-center relative">
               {previewSlide ? (
                 <>
                   <div
                     ref={previewContainerRef}
                     className="aspect-video bg-white rounded-xl shadow-2xl overflow-hidden relative flex items-center justify-center"
                   >
                     <div
                       ref={mainSlideRef}
                       style={{
                         width: 1280,
                         height: 720,
                         transform: `scale(${previewScale})`,
                         transformOrigin: 'center center',
                       }}
                     >
                       {/* 如果有图片URL，先显示图片 */}
                       {previewSlide.imageUrl && (
                         <img
                           src={previewSlide.imageUrl}
                           alt={previewSlide.design.title}
                           style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                         />
                       )}
                       {/* 然后渲染HTML内容 */}
                       <div
                         style={{ position: 'relative', width: '100%', height: '100%' }}
                         dangerouslySetInnerHTML={{ __html: previewSlide.finalHtml }}
                       />
                     </div>
                   </div>
                   
                   {/* 左右翻页按钮 */}
                   {state.slides.length > 1 && (
                     <>
                       <button
                         onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                         disabled={currentSlideIndex === 0}
                         className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110"
                       >
                         <ChevronLeft className="w-6 h-6 text-gray-700" />
                       </button>
                       <button
                         onClick={() => setCurrentSlideIndex(prev => Math.min(state.slides.length - 1, prev + 1))}
                         disabled={currentSlideIndex === state.slides.length - 1}
                         className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110"
                       >
                         <ChevronRight className="w-6 h-6 text-gray-700" />
                       </button>
                     </>
                   )}
                 </>
               ) : (
                 <div className="aspect-video bg-gray-100 rounded-xl shadow-2xl flex items-center justify-center">
                   <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
                 </div>
               )}
            </div>

            {/* Thumbnail Strip */}
            <div className="h-40 shrink-0 w-full max-w-6xl mx-auto relative">
               <div className="text-sm font-medium text-gray-500 mb-4">
                 幻灯片预览 ({currentSlideIndex + 1}/{state.slides.length})
               </div>
               <div className="relative">
                 {/* 缩略图滚动容器 */}
                 <div ref={thumbnailContainerRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth">
                    {state.slides.map((slide, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`h-24 aspect-video rounded-lg cursor-pointer relative overflow-hidden transition-all flex-shrink-0 bg-white ${
                          idx === currentSlideIndex 
                            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-50' 
                            : 'border border-gray-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {/* 缩略图使用固定 1280×720 画布 + 缩放 */}
                        <div className="absolute inset-0 overflow-hidden">
                          <div
                            style={{
                              width: 1280,
                              height: 720,
                              transform: 'scale(0.15)',
                              transformOrigin: 'top left',
                              position: 'relative',
                            }}
                          >
                            {/* 背景图片 */}
                            {slide.imageUrl && (
                              <img
                                src={slide.imageUrl}
                                alt={slide.design.title}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            {/* HTML内容 */}
                            <div
                              style={{ position: 'relative', width: '100%', height: '100%' }}
                              dangerouslySetInnerHTML={{ __html: slide.finalHtml }}
                            />
                          </div>
                        </div>
                        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm z-10 ${
                          idx === currentSlideIndex ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                 </div>
               
                 {/* 缩略图翻页按钮 */}
                 {state.slides.length > 3 && (
                   <>
                     <button
                       onClick={() => {
                         if (thumbnailContainerRef.current) {
                           thumbnailContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                         }
                       }}
                       className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all hover:scale-110 z-10"
                     >
                       <ChevronLeft className="w-5 h-5 text-gray-700" />
                     </button>
                     <button
                       onClick={() => {
                         if (thumbnailContainerRef.current) {
                           thumbnailContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                         }
                       }}
                       className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all hover:scale-110 z-10"
                     >
                       <ChevronRight className="w-5 h-5 text-gray-700" />
                     </button>
                   </>
                 )}
               </div>
            </div>
        </div>
          </>
        )}

        {/* 导出 PDF 进度遮罩 */}
        {exportProgress && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-base font-medium text-gray-800">正在导出 PDF...</div>
              <div className="text-sm text-gray-500">
                {exportProgress.current} / {exportProgress.total} 页
              </div>
            </div>
          </div>
        )}

        {/* 导出失败 toast */}
        {exportError && (
          <div className="absolute top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
            <X className="w-4 h-4 cursor-pointer flex-shrink-0" onClick={() => setExportError(null)} />
            <span>{exportError}</span>
          </div>
        )}
      </div>
      </div> {/* 闭合 flex 容器 */}
    </div>
  );
}

export default App;

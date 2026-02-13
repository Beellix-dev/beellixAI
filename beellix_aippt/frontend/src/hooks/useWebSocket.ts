import { useRef, useState, useCallback } from 'react';

// --- 类型定义 ---

export interface SlideOutline {
  title: string;
  purpose: string;
  visualAdvice: string;
}

export interface SlideDesign {
  title: string;
  subtitle: string;
  content: string[];
  imagePrompt: string;
  htmlContent: string;
  designDirective: string;
  stats: { value: string; label: string }[];
}

export interface FinalSlide {
  index: number;
  outline: SlideOutline;
  design: SlideDesign;
  imageUrl: string;
  finalHtml: string;
}

export interface OutlineData {
  topic: string;
  title: string;
  subtitle: string;
  targetAudience: string;
  presentationGoal: string;
  tone: string;
  visualTheme: string;
  accentColor: string;
  researchContext: string;
  slides: SlideOutline[];
}

export interface StatusData {
  status: string;
  message: string;
  slideIndex?: number;
  totalSlides?: number;
}

export type GenerationPhase = 'idle' | 'connecting' | 'planning' | 'designing' | 'generating_image' | 'done' | 'error';

export interface GenerationState {
  phase: GenerationPhase;
  statusMessage: string;
  outline: OutlineData | null;
  slides: FinalSlide[];
  currentSlideIndex: number;
  totalSlides: number;
  error: string;
}

// --- Hook ---

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<GenerationState>({
    phase: 'idle',
    statusMessage: '',
    outline: null,
    slides: [],
    currentSlideIndex: -1,
    totalSlides: 0,
    error: '',
  });

  const resetState = useCallback(() => {
    setState({
      phase: 'idle',
      statusMessage: '',
      outline: null,
      slides: [],
      currentSlideIndex: -1,
      totalSlides: 0,
      error: '',
    });
  }, []);

  const startGeneration = useCallback((topic: string, provider: string, apiKey: string = '') => {
    // 关闭已有连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    setState(prev => ({
      ...prev,
      phase: 'connecting',
      statusMessage: '正在连接服务器...',
      outline: null,
      slides: [],
      currentSlideIndex: -1,
      totalSlides: 0,
      error: '',
    }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/generate`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'generate', topic, provider, apiKey }));
      setState(prev => ({ ...prev, phase: 'planning', statusMessage: '正在规划幻灯片大纲...' }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const { event, data } = msg;

      switch (event) {
        case 'status':
          setState(prev => ({
            ...prev,
            phase: data.status as GenerationPhase,
            statusMessage: data.message,
            currentSlideIndex: data.slideIndex ?? prev.currentSlideIndex,
            totalSlides: data.totalSlides ?? prev.totalSlides,
          }));
          break;

        case 'outline':
          setState(prev => ({
            ...prev,
            outline: data as OutlineData,
            totalSlides: data.slides.length,
            statusMessage: `大纲已生成，共 ${data.slides.length} 页`,
          }));
          break;

        case 'slide':
          setState(prev => ({
            ...prev,
            slides: [...prev.slides, data as FinalSlide],
          }));
          break;

        case 'done':
          setState(prev => ({
            ...prev,
            phase: 'done',
            statusMessage: `全部完成！共 ${data.totalSlides} 页`,
          }));
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            phase: 'error',
            error: data.message,
            statusMessage: data.message,
          }));
          break;
      }
    };

    ws.onerror = () => {
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: '与服务器的连接出错',
        statusMessage: '连接出错',
      }));
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, []);

  const cancelGeneration = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'cancel' }));
    }
  }, []);

  return { state, startGeneration, cancelGeneration, resetState };
}

export type UseWebSocketReturn = ReturnType<typeof useWebSocket>;

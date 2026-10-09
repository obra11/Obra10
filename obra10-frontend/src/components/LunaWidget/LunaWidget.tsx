import { useState, useRef, useEffect, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

const BUTTON = 64;
const POS_KEY = 'obra10_luna_pos';

type Point = { x: number; y: number };

function readSavedPos(): Point | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Point;
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
  } catch { /* ignore */ }
  return null;
}

function clampPos(point: Point): Point {
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - BUTTON - pad);
  const maxY = Math.max(pad, window.innerHeight - BUTTON - pad);
  return {
    x: Math.min(Math.max(pad, point.x), maxX),
    y: Math.min(Math.max(pad, point.y), maxY),
  };
}

function panelFromAnchor(anchor: Point): CSSProperties {
  const margin = 12;
  const width = Math.min(380, window.innerWidth - margin * 2);
  const height = Math.min(560, window.innerHeight - margin * 2);
  let left = anchor.x + BUTTON - width;
  if (anchor.x < window.innerWidth / 2) left = anchor.x;
  left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);
  let top = anchor.y - height - margin;
  if (top < margin) top = Math.min(anchor.y + BUTTON + margin, window.innerHeight - height - margin);
  top = Math.max(margin, top);
  return { position: 'fixed', left, top, width, height };
}

interface LunaAcao {
  id: string;
  resumo: string;
  status: 'pendente' | 'feita' | 'cancelada';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  acao?: LunaAcao;
}

function acaoDoPayload(raw: any): LunaAcao | undefined {
  if (!raw?.id) return undefined;
  return { id: String(raw.id), resumo: String(raw.resumo || ''), status: 'pendente' };
}

function getSpeechRecognitionCtor(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** Garante permissão de microfone antes do SpeechRecognition (melhor em mobile/PWA). */
async function ensureMicrophonePermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator?.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err: any) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'denied';
    return 'denied';
  }
}

export default function LunaWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Oi! Sou a Luna, sua assessora no Obra 10. Posso olhar qualquer obra da empresa, diários, catálogo, equipe e te explicar como usar o sistema. O que você precisa?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    latest: Point;
  } | null>(null);
  const [pos, setPos] = useState<Point | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = readSavedPos();
    return saved ? clampPos(saved) : null;
  });
  const [dragging, setDragging] = useState(false);

  const hasSpeech = !!getSpeechRecognitionCtor();
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const inObra = /^\/obras\/[^/]+/.test(pathname);
  const inViewer = /\/visualizador\/?$/i.test(pathname);
  const clearance = narrow && inObra && !inViewer ? 96 : 0;
  const buttonBottom = narrow ? 12 + clearance : 24;
  const panelBottom = buttonBottom + 76;

  useEffect(() => {
    const onResize = () => setPos((prev) => (prev ? clampPos(prev) : prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { x: rect.left, y: rect.top };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
      latest: origin,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 8) drag.moved = true;
    if (!drag.moved) return;
    const next = clampPos({ x: drag.originX + dx, y: drag.originY + dy });
    drag.latest = next;
    setDragging(true);
    setPos(next);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (drag.moved) {
      localStorage.setItem(POS_KEY, JSON.stringify(drag.latest));
      return;
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch { /* ignore */ }
    };
  }, []);

  const responderAcao = async (id: string, confirmar: boolean) => {
    const xsrf =
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('XSRF-TOKEN='))
        ?.split('=')[1] || localStorage.getItem('obra10_csrf_token') || '';
    try {
    const { data } = await api.post(
      `/ai/acoes/${id}/${confirmar ? 'confirmar' : 'cancelar'}`,
      {},
      { headers: { 'x-xsrf-token': xsrf } },
    );
    setMessages((prev) =>
      prev.map((item) =>
        item.acao?.id === id
          ? {
              ...item,
              content: confirmar
                ? `${item.content}\n\n${data?.resumo || 'Ajuste gravado.'}`
                : item.content,
              acao: { ...item.acao, status: confirmar ? 'feita' : 'cancelada' },
            }
          : item,
      ),
    );
    } catch (err: any) {
      const detalhe = err?.response?.data?.message || 'Não consegui gravar esse ajuste.';
      setMessages((prev) =>
        prev.map((item) =>
          item.acao?.id === id
            ? { ...item, content: `${item.content}\n\n${detalhe}` }
            : item,
        ),
      );
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const history = newMessages.slice(0, -1);

    const finishWith = (content: string, acao?: LunaAcao) => {
      setMessages([...newMessages, { role: 'assistant', content, ...(acao ? { acao } : {}) }]);
      setLoading(false);
    };

    try {
      const base = (api.defaults.baseURL as string) || '';
      const xsrf =
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('XSRF-TOKEN='))
          ?.split('=')[1] || localStorage.getItem('obra10_csrf_token') || '';
      let obraId = '';
      try {
        const raw = localStorage.getItem('obra10_obraAtiva');
        if (raw && raw !== 'undefined') obraId = JSON.parse(raw)?.id || '';
      } catch { /* ignore */ }

      const res = await fetch(`${base}/ai/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-xsrf-token': xsrf,
          ...(obraId ? { 'x-obra-id': obraId } : {}),
        },
        body: JSON.stringify({ message: text, history }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok || !res.body) {
        const { data } = await api.post(
          '/ai/chat',
          { message: text, history },
          { timeout: 120000 },
        );
        finishWith(data.reply || 'Não consegui responder agora.', acaoDoPayload(data.acao));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      let acao: LunaAcao | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          let ev: any;
          try {
            ev = JSON.parse(trimmed.slice(5).trim());
          } catch {
            continue;
          }
          if (ev.type === 'delta' && ev.text) {
            acc += ev.text;
            setLoading(false);
            setMessages([...newMessages, { role: 'assistant', content: acc, ...(acao ? { acao } : {}) }]);
          }
          if ((ev.type === 'acao' || ev.type === 'done') && ev.acao?.id) {
            acao = { id: ev.acao.id, resumo: ev.acao.resumo, status: 'pendente' };
          }
          if (ev.type === 'done' || ev.type === 'error') {
            acc = ev.reply || acc;
          }
        }
      }
      finishWith(
        acc ||
          'Não consegui montar a resposta. Tente de novo em instantes.',
        acao,
      );
    } catch {
      try {
        const { data } = await api.post(
          '/ai/chat',
          { message: text, history },
          { timeout: 120000 },
        );
        finishWith(data.reply || 'Não consegui consultar agora.', acaoDoPayload(data.acao));
      } catch {
        finishWith(
          'Não consegui consultar o Obra 10 agora. Tente novamente em instantes.',
        );
      }
    }
  };

  const toggleVoice = async () => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setMicHint('Seu navegador não suporta ditado por voz. Use Chrome ou Edge.');
      return;
    }

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch { /* ignore */ }
      setListening(false);
      return;
    }

    setMicHint(null);

    // Em HTTPS/PWA, pedir o microfone explicitamente evita "not-allowed" silencioso
    if (!window.isSecureContext) {
      setMicHint('O microfone só funciona em conexão segura (HTTPS). Abra o site pelo endereço oficial.');
      return;
    }

    const permission = await ensureMicrophonePermission();
    if (permission === 'denied') {
      setMicHint(
        'Permissão do microfone bloqueada. No celular: toque no cadeado/ícone do site na barra de endereço → Permissões → Microfone → Permitir, e tente de novo.',
      );
      return;
    }

    try {
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setListening(true);
        setMicHint('Ouvindo… fale agora');
      };

      rec.onresult = (e: any) => {
        let finalText = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = e.results[i][0]?.transcript || '';
          if (e.results[i].isFinal) finalText += piece;
          else interim += piece;
        }
        if (interim) setInput(interim);
        if (finalText.trim()) {
          setListening(false);
          setMicHint(null);
          setInput('');
          sendMessage(finalText.trim());
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        const code = event?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setMicHint(
            'Acesso ao microfone negado. Libere o microfone nas permissões do site (cadeado na barra de endereço) e toque de novo no microfone.',
          );
        } else if (code === 'no-speech') {
          setMicHint('Não ouvi nada. Toque no microfone e fale um pouco mais perto.');
        } else if (code === 'audio-capture') {
          setMicHint('Não foi possível capturar áudio. Verifique se outro app está usando o microfone.');
        } else if (code === 'network') {
          setMicHint('Falha de rede no reconhecimento de voz. Verifique a conexão e tente novamente.');
        } else if (code !== 'aborted') {
          setMicHint(`Erro no microfone (${code}). Tente novamente.`);
        }
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
        setMicHint((prev) => (prev === 'Ouvindo… fale agora' ? null : prev));
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Falha ao iniciar SpeechRecognition:', err);
      setListening(false);
      setMicHint('Não foi possível iniciar o microfone. Atualize a página e tente novamente.');
    }
  };

  return (
    <>
      {open && (
        <div style={{
          ...(pos
            ? panelFromAnchor(pos)
            : {
                position: 'fixed',
                bottom: narrow ? `calc(${panelBottom}px + env(safe-area-inset-bottom, 0px))` : panelBottom,
                right: narrow ? 12 : 24,
                width: 'min(380px, calc(100vw - 24px))',
                height: narrow ? `min(560px, calc(100dvh - ${panelBottom + 12}px - env(safe-area-inset-bottom, 0px)))` : 560,
              }),
          background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', zIndex: 46, overflow: 'hidden',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: '#E5192C', padding: '12px 16px', display: 'flex',
            alignItems: 'center', gap: '10px'
          }}>
            <img src="/luna-avatar.png?v=3" alt="Luna" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Luna</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Assessora Obra 10</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: '4px' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9f9f9' }}>
            {messages.map((m, i) => (
              <div key={i}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                {m.role === 'assistant' && (
                  <img src="/luna-avatar.png?v=3" alt="Luna" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? '#E5192C' : 'white',
                  color: m.role === 'user' ? 'white' : '#1a1a1a',
                  fontSize: 14, lineHeight: 1.5,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.content}
                </div>
              </div>
              {m.acao?.status === 'pendente' && (
                <div style={{ display: 'flex', gap: 8, marginLeft: m.role === 'assistant' ? 36 : 0 }}>
                  <button
                    type="button"
                    onClick={() => responderAcao(m.acao!.id, true)}
                    style={{
                      border: 'none', borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
                      background: '#E5192C', color: 'white', fontWeight: 700, fontSize: 13,
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => responderAcao(m.acao!.id, false)}
                    style={{
                      border: '1px solid #e0e0e0', borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
                      background: 'white', color: '#333', fontSize: 13,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <img src="/luna-avatar.png?v=3" alt="Luna" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: '50%', background: '#E5192C', display: 'inline-block',
                        animation: 'luna-bounce 1.2s infinite', animationDelay: `${i * 0.2}s`
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '12px', background: 'white', borderTop: '1px solid #f0f0f0' }}>
            {micHint && (
              <div style={{
                marginBottom: 8, padding: '8px 10px', borderRadius: 10,
                background: listening ? '#fef2f2' : '#fff7ed',
                color: listening ? '#991b1b' : '#9a3412',
                fontSize: 12, lineHeight: 1.4,
              }}>
                {micHint}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder={listening ? 'Ouvindo…' : 'Digite sua pergunta...'}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid #e0e0e0',
                  fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif'
                }}
              />
              {hasSpeech && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={listening ? 'Parar de ouvir' : 'Falar com a Luna'}
                  style={{
                    width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: listening ? '#E5192C' : '#f0f0f0',
                    color: listening ? 'white' : '#666', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: listening ? 'luna-pulse 1s infinite' : 'none'
                  }}
                >🎤</button>
              )}
              <button type="button" onClick={() => sendMessage(input)} style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#E5192C', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>➤</button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        title="Arraste para mover. Toque para falar com a Luna"
        aria-label="Falar com a Luna"
        style={{
          position: 'fixed',
          ...(pos
            ? { left: pos.x, top: pos.y }
            : {
                bottom: `calc(${buttonBottom}px + env(safe-area-inset-bottom, 0px))`,
                right: narrow ? 16 : 24,
              }),
          width: BUTTON, height: BUTTON,
          borderRadius: '50%', border: 'none', padding: 0, overflow: 'hidden',
          background: '#E5192C', boxShadow: '0 4px 16px rgba(229,25,44,0.35)', zIndex: 45,
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <img src="/luna-avatar.png?v=3" alt="" draggable={false} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', margin: 4, pointerEvents: 'none' }} />
      </button>

      <style>{`
        @keyframes luna-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes luna-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(229,25,44,0.4)} 50%{box-shadow:0 0 0 8px rgba(229,25,44,0)} }
      `}</style>
    </>
  );
}

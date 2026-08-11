import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Oi! Sou a Luna. Posso olhar os diários da obra (chuva, efetivo, atividades…) ou te ajudar com uma dúvida técnica em fonte aberta. O que você precisa?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const hasSpeech = !!getSpeechRecognitionCtor();

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

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const history = newMessages.slice(0, -1);
      const { data } = await api.post('/ai/chat', { message: text, history });
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content:
            'Não consegui consultar os diários agora. Tente novamente em instantes.',
        },
      ]);
    } finally {
      setLoading(false);
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
          position: 'fixed', bottom: '90px', right: '24px', width: 'min(380px, calc(100vw - 24px))', height: '560px',
          background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: '#E5192C', padding: '12px 16px', display: 'flex',
            alignItems: 'center', gap: '10px'
          }}>
            <img src="/luna-avatar.png?v=3" alt="Luna" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Luna</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Assistente Obra 10</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: '4px' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9f9f9' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
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
        onClick={() => setOpen(o => !o)}
        title="Falar com a Luna"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', width: 64, height: 64,
          borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
          background: '#E5192C', boxShadow: '0 4px 16px rgba(229,25,44,0.35)', zIndex: 9999
        }}
      >
        <img src="/luna-avatar.png?v=3" alt="Luna" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', margin: 4 }} />
      </button>

      <style>{`
        @keyframes luna-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes luna-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(229,25,44,0.4)} 50%{box-shadow:0 0 0 8px rgba(229,25,44,0)} }
      `}</style>
    </>
  );
}

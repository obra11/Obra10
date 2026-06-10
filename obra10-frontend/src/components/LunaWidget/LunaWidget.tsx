import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function LunaWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou a Luna, sua assistente no Obra 10. Posso consultar RDOs, verificar pendências e te ajudar a navegar pelo sistema. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
      setMessages([...newMessages, { role: 'assistant', content: 'Não consegui me conectar agora. Tente novamente em instantes.' }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (!hasSpeech) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', width: '380px', height: '560px',
          background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: '#E5192C', padding: '12px 16px', display: 'flex',
            alignItems: 'center', gap: '10px'
          }}>
            <img src="/luna-avatar.png" alt="Luna" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' }} />
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
                  <img src="/luna-avatar.png" alt="Luna" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
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
                <img src="/luna-avatar.png" alt="Luna" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
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

          <div style={{ padding: '12px', background: 'white', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Digite sua pergunta..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid #e0e0e0',
                fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif'
              }}
            />
            {hasSpeech && (
              <button onClick={toggleVoice} style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: listening ? '#E5192C' : '#f0f0f0',
                color: listening ? 'white' : '#666', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: listening ? 'luna-pulse 1s infinite' : 'none'
              }}>🎤</button>
            )}
            <button onClick={() => sendMessage(input)} style={{
              width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#E5192C', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>➤</button>
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
        <img src="/luna-avatar.png" alt="Luna" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', margin: 4 }} />
      </button>

      <style>{`
        @keyframes luna-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes luna-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(229,25,44,0.4)} 50%{box-shadow:0 0 0 8px rgba(229,25,44,0)} }
      `}</style>
    </>
  );
}

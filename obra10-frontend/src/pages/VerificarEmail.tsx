import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

export const VerificarEmail: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token não encontrado na URL.'); return; }
    api.get(`/tenants/verificar-email?token=${token}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data.mensagem);
        setTimeout(() => navigate('/contratacao'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Token inválido ou expirado.');
      });
  }, [token]);

  const handleResend = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      await api.post('/tenants/reenviar-verificacao', { email });
      setResendDone(true);
    } catch { } finally { setResendLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md w-full">
        {status === 'loading' && (
          <>
            <Loader2 size={56} className="mx-auto mb-4 text-red-600 animate-spin" />
            <h2 className="text-xl font-bold text-gray-900">Verificando seu e-mail...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">E-mail verificado!</h2>
            <p className="text-gray-500 text-sm mb-4">{message}</p>
            <p className="text-xs text-gray-400">Redirecionando para seleção de módulos...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={56} className="mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link inválido</h2>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
            {!resendDone ? (
              <div className="space-y-3">
                <input
                  type="email" placeholder="Seu e-mail cadastrado"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
                <button
                  onClick={handleResend} disabled={resendLoading || !email}
                  className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {resendLoading ? <><Loader2 size={14} className="animate-spin" />Reenviando...</> : <><Mail size={14} />Reenviar e-mail</>}
                </button>
              </div>
            ) : (
              <div className="bg-green-50 text-green-700 text-sm rounded-xl p-4 border border-green-200">
                ✅ E-mail de verificação reenviado! Verifique sua caixa de entrada.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

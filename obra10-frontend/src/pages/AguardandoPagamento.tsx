import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle, Loader2, Copy, ExternalLink, CreditCard } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export const AguardandoPagamento: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<'pix' | 'paypal'>('pix');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const qrCode = state?.qrCode || '';
  const qrBase64 = state?.qrCodeBase64 || '';
  const link = state?.linkPagamento || '';
  const valor = state?.valor || 0;

  useEffect(() => {
    if (!id) return;
    intervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/cobrancas/${id}/status`);
        if (res.data.pago) {
          setStatus('paid');
          clearInterval(intervalRef.current!);
          setTimeout(() => navigate('/dashboard'), 3000);
        }
      } catch { }
    }, 5000);
    return () => clearInterval(intervalRef.current!);
  }, [id]);

  const copyPix = () => {
    navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'paid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md w-full">
          <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento confirmado!</h2>
          <p className="text-gray-500 mb-4">Seus módulos foram ativados. Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
        <div className="mb-4">
          <div className="w-12 h-12 rounded-full bg-yellow-50 border-2 border-yellow-200 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Loader2 size={24} className="text-yellow-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Aguardando pagamento</h2>
          <p className="text-gray-500 text-sm mt-1">R$ {Number(valor).toFixed(2)} — verificando a cada 5 segundos</p>
        </div>

        {/* Gateway Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button 
            onClick={() => setMethod('pix')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${method === 'pix' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2">PIX</span>
          </button>
          <button 
            onClick={() => setMethod('paypal')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${method === 'paypal' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2"><CreditCard size={16}/> Cartão (PayPal)</span>
          </button>
        </div>

        {method === 'pix' && (
          <div className="animate-in fade-in zoom-in duration-300">
            {qrBase64 ? (
              <img src={`data:image/png;base64,${qrBase64.replace('data:image/png;base64,', '')}`}
                alt="QR Code PIX" className="w-56 h-56 mx-auto rounded-xl border border-gray-100 mb-4" />
            ) : (
              <div className="w-56 h-56 mx-auto bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
                <p className="text-gray-400 text-xs">QR Code indisponível (modo mock)</p>
              </div>
            )}

            {qrCode && (
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl p-3 text-left">
                  <p className="text-xs text-gray-400 mb-1 font-semibold">Chave PIX Copia e Cola</p>
                  <p className="text-xs text-gray-700 break-all font-mono leading-relaxed">{qrCode.slice(0, 80)}...</p>
                </div>
                <button onClick={copyPix}
                  className="w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                  {copied ? <><CheckCircle size={16} className="text-green-500" />Copiado!</> : <><Copy size={16} />Copiar Chave PIX</>}
                </button>
              </div>
            )}

            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="mt-3 w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <ExternalLink size={16} />Abrir link de pagamento
              </a>
            )}
          </div>
        )}

        {method === 'paypal' && (
          <div className="animate-in fade-in zoom-in duration-300">
            <PayPalScriptProvider options={{ 
              clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
              currency: "BRL",
              intent: "capture"
            }}>
              <PayPalButtons 
                style={{ layout: "vertical", shape: "rect", color: "gold" }}
                createOrder={async () => {
                  try {
                    const res = await api.post(`/cobrancas/${id}/paypal/create-order`);
                    return res.data.orderId;
                  } catch (err: any) {
                    alert('Erro ao criar pedido no PayPal: ' + (err.response?.data?.message || err.message));
                    return "";
                  }
                }}
                onApprove={async (data) => {
                  try {
                    await api.post(`/cobrancas/${id}/paypal/capture-order`, { orderId: data.orderID });
                    setStatus('paid');
                    setTimeout(() => navigate('/dashboard'), 3000);
                  } catch (err: any) {
                    alert('Erro ao capturar pagamento: ' + (err.response?.data?.message || err.message));
                  }
                }}
                onError={(err) => {
                  console.error('PayPal Error:', err);
                  // Ignore se for erro de Mock Mode (client=test)
                  if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
                    setStatus('paid');
                    setTimeout(() => navigate('/dashboard'), 3000);
                  }
                }}
              />
            </PayPalScriptProvider>
            
            {!import.meta.env.VITE_PAYPAL_CLIENT_ID && (
              <p className="text-xs text-yellow-600 mt-2 bg-yellow-50 p-2 rounded">
                Simulação: Ao tentar pagar (e dar erro por ser ambiente de teste), o sistema fingirá que pagou!
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">Após o pagamento, os módulos são ativados automaticamente.</p>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Ticket, Plus, Loader2, Save, X, Ban, Send } from 'lucide-react';
import { format } from 'date-fns';

export const AdminCupons: React.FC = () => {
  const [cupons, setCupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({
    codigo: '', tipo: 'DESCONTO_PERCENTUAL', valor: '', mesesGratuitos: '', duracaoMeses: '', usosMaximos: '', expiraEm: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchCupons = async () => {
    try {
      const res = await api.get('/admin/cupons');
      setCupons(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCupons();
  }, []);

  const handleToggleBloqueio = async (id: string, ativo: boolean) => {
    if (!window.confirm(`Tem certeza que deseja ${ativo ? 'desativar' : 'ativar'} este cupom?`)) return;
    try {
      await api.patch(`/admin/cupons/${id}/toggle`);
      fetchCupons();
    } catch (err) {
      alert('Erro ao alterar status do cupom');
    }
  };

  const handleCriarCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.toUpperCase(),
        tipo: form.tipo,
      };

      if (form.tipo === 'GRATUIDADE') {
        payload.mesesGratuitos = Number(form.mesesGratuitos);
      } else {
        payload.valor = Number(form.valor);
      }

      if (form.duracaoMeses) payload.duracaoMeses = Number(form.duracaoMeses);
      if (form.usosMaximos) payload.usosMaximos = Number(form.usosMaximos);
      if (form.expiraEm) payload.expiraEm = form.expiraEm;

      await api.post('/admin/cupons', payload);
      setShowModal(false);
      setForm({ codigo: '', tipo: 'DESCONTO_PERCENTUAL', valor: '', mesesGratuitos: '', duracaoMeses: '', usosMaximos: '', expiraEm: '' });
      fetchCupons();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar cupom');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviar = async (cupomId: string) => {
    const empresaId = window.prompt('Digite o ID, CNPJ ou CPF do cliente:');
    if (!empresaId) return;
    
    try {
      const res = await api.post('/admin/cupons/enviar', { empresaId, cupomId });
      alert(res.data.message);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao enviar cupom');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciador de Cupons</h1>
          <p className="text-sm text-gray-500 mt-1">Crie e acompanhe códigos promocionais e isenções de mensalidade.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
        >
          <Plus size={18} /> Novo Cupom
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cupons.map(c => (
          <div key={c.id} className={`bg-white rounded-xl border p-5 relative overflow-hidden transition-all ${c.ativo ? 'border-gray-200 hover:border-red-200 shadow-sm' : 'border-gray-200 opacity-60 bg-gray-50'}`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${c.ativo ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            
            <div className="flex justify-between items-start mb-4 mt-2">
              <div className="flex items-center gap-2">
                <Ticket className={c.ativo ? 'text-red-500' : 'text-gray-400'} size={24} />
                <h3 className="text-xl font-black text-gray-900 tracking-tight">{c.codigo}</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${c.tipo === 'GRATUIDADE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {c.tipo.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Benefício:</span>
                <span className="font-bold text-gray-900">
                  {c.tipo === 'GRATUIDADE' ? `${c.mesesGratuitos} meses grátis` : c.tipo === 'DESCONTO_PERCENTUAL' ? `${c.valor}% OFF` : `R$ ${Number(c.valor).toFixed(2)} OFF`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Uso (atual/max):</span>
                <span className="font-medium text-gray-900">{c.usosAtuais} / {c.usosMaximos || '♾️'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ciclo (duração):</span>
                <span className="font-medium text-gray-900">{c.duracaoMeses ? `${c.duracaoMeses} meses/empresa` : 'Vitalício'}</span>
              </div>
              {c.expiraEm && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Prazo max resgate:</span>
                  <span className="font-medium text-red-600">{format(new Date(c.expiraEm), 'dd/MM/yyyy')}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-4">
              <button onClick={() => handleEnviar(c.id)} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition">
                <Send size={14} /> Distribuir
              </button>
              <button onClick={() => handleToggleBloqueio(c.id, c.ativo)} className={`flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${c.ativo ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-gray-800 text-white hover:bg-gray-900'}`}>
                <Ban size={14} /> {c.ativo ? 'Desativar' : 'Habilitar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Cadastrar Novo Cupom</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleCriarCupom} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Código Promocional</label>
                  <input required type="text" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="w-full border p-2.5 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-red-100 focus:border-red-500" placeholder="Ex: RDO2024" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Desconto</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, valor: '', mesesGratuitos: '' })} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500">
                    <option value="DESCONTO_PERCENTUAL">Percentual (%)</option>
                    <option value="DESCONTO_FIXO">Fixo (R$)</option>
                    <option value="GRATUIDADE">Gratuidade Total</option>
                  </select>
                </div>
              </div>

              {form.tipo === 'GRATUIDADE' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Meses totais de gratuidade</label>
                  <input required type="number" min="1" value={form.mesesGratuitos} onChange={e => setForm({ ...form, mesesGratuitos: e.target.value })} className="w-full border p-2.5 rounded-lg text-sm" placeholder="Ex: 3 (ganha 3 faturas grátis)" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Valor do Desconto {form.tipo === 'DESCONTO_PERCENTUAL' ? '(%)' : '(R$)'}</label>
                  <input required type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} className="w-full border p-2.5 rounded-lg text-sm" placeholder={form.tipo === 'DESCONTO_PERCENTUAL' ? "Ex: 15 para 15%" : "Ex: 50.00 para 50 reais"} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Limite máx. de resgates</label>
                  <input type="number" min="1" value={form.usosMaximos} onChange={e => setForm({ ...form, usosMaximos: e.target.value })} className="w-full border p-2.5 rounded-lg text-sm" placeholder="Opcional. Ex: 100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Duração ciclo (meses)</label>
                  <input type="number" min="1" value={form.duracaoMeses} onChange={e => setForm({ ...form, duracaoMeses: e.target.value })} className="w-full border p-2.5 rounded-lg text-sm" placeholder="Opcional. Ex: 6 meses" />
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">Por quantos meses o cliente desfruta deste cupom antes de expirar a licença (Se vazio: Vitalício).</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data que sai da validade</label>
                <input type="date" value={form.expiraEm} onChange={e => setForm({ ...form, expiraEm: e.target.value })} className="w-full border p-2.5 rounded-lg text-sm" />
                <p className="text-[10px] text-gray-400 mt-1 leading-tight">Data limite para resgate global. Depois disso ninguém consegue acionar.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2">
                  {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Gerar Cupom
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

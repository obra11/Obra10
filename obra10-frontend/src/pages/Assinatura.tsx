import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, Clock, Users, Package } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

export const Assinatura: React.FC = () => {
  const navigate = useNavigate();
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const response = await api.get('/tenants/meu-plano');
      setDados(response.data);
      setPlanoSelecionado(response.data.plano);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados do plano.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!planoSelecionado || planoSelecionado === dados?.plano) return;
    setUpgrading(true);
    try {
      await api.post('/tenants/meu-plano/upgrade', { plano: planoSelecionado });
      alert('Plano atualizado com sucesso!');
      setShowUpgradeModal(false);
      carregarDados();
    } catch (e: any) {
      alert('Erro ao atualizar plano: ' + (e?.response?.data?.message || e.message));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;

  return (
    <div className="min-h-screen bg-lunardeli-gray p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-red-600 mb-6 font-semibold">
          <ArrowLeft size={20} className="mr-2" /> Voltar ao Painel
        </button>
        
        <h1 className="text-3xl font-bold text-lunardeli-dark flex items-center mb-8">
          <CreditCard className="mr-3 text-red-600" size={32}/> Meu Plano e Contrato
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col items-start">
            <h2 className="text-lg font-semibold text-gray-500 mb-1">Seu Plano Atual</h2>
            <p className="text-4xl font-extrabold text-gray-800">{dados?.plano}</p>
            <div className="flex items-center mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded w-max border mb-4">
              <ShieldCheck size={16} className="text-green-500 mr-2" /> Status: <span className="font-bold ml-1">{dados?.ativo ? 'Ativo' : 'Inativo'}</span> {dados?.suspensa && <span className="text-red-500 font-bold ml-1">(Suspenso)</span>}
            </div>
            <button onClick={() => setShowUpgradeModal(true)} className="px-4 py-2 bg-lunardeli-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors">
              Alterar Plano
            </button>
          </div>
          <div className="flex flex-col justify-center space-y-4">
            <div className="flex items-center text-gray-700">
              <Users className="text-gray-400 mr-3" size={20} />
              <span>Limite de Usuários: <strong>{dados?.usuariosAtivos} / {dados?.limiteUsuarios}</strong></span>
            </div>
            <div className="flex items-center text-gray-700">
              <Clock className="text-gray-400 mr-3" size={20} />
              <span>Cliente desde: <strong>{format(new Date(dados?.createdAt), 'dd/MM/yyyy')}</strong></span>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Package className="mr-2" size={24}/> Módulos Contratados</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {dados?.modulos?.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">Nenhum módulo ativo.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Módulo</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados?.modulos?.map((m: any) => (
                  <tr key={m.slug} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{m.nome} <span className="text-xs text-gray-400 ml-2 border rounded px-1">{m.slug}</span></td>
                    <td className="px-6 py-4">
                      {m.ativo ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Ativo</span> : <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">Inativo</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {m.expiresAt ? format(new Date(m.expiresAt), 'dd/MM/yyyy') : 'Renovação Mensal'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Histórico de Cobranças</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {dados?.historicoCobrancas?.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">Nenhuma cobrança registrada ainda.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Referência</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Valor</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Vencimento</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados?.historicoCobrancas?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-700">{format(new Date(c.mesReferencia), 'MM/yyyy')}</td>
                    <td className="px-6 py-4 font-semibold">R$ {parseFloat(c.valor).toFixed(2).replace('.', ',')}</td>
                    <td className="px-6 py-4 text-gray-600">{format(new Date(c.dataVencimento), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.status === 'PAGO' ? 'bg-green-100 text-green-700' : c.status === 'VENCIDO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DE UPGRADE */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-2xl font-black mb-2 text-lunardeli-dark">Escolher novo Plano</h3>
            <p className="text-gray-500 mb-6 text-sm">Selecione a opção que melhor atende o tamanho da sua equipe.</p>
            
            <div className="space-y-4 mb-8">
              {['BASICO', 'PRO', 'ENTERPRISE'].map(opt => (
                <div 
                  key={opt}
                  onClick={() => setPlanoSelecionado(opt)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${planoSelecionado === opt ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg text-gray-800">{opt}</h4>
                      <p className="text-sm text-gray-500 leading-none mt-1">
                        Até {opt === 'BASICO' ? '5' : opt === 'PRO' ? '20' : '100'} usuários cadastrados
                      </p>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${planoSelecionado === opt ? 'border-red-600' : 'border-gray-300'}`}>
                      {planoSelecionado === opt && <div className="h-3 w-3 rounded-full bg-red-600" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpgrade}
                disabled={upgrading || planoSelecionado === dados?.plano}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {upgrading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

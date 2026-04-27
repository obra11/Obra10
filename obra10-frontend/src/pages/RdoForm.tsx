import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { rdoService } from '../services/rdo.service';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sun, Users, FileText, Bell, CheckCircle, XCircle, AlertCircle, Clock, Plus, Trash2 } from 'lucide-react';
import { ProfissionalSelector } from '../components/ProfissionalSelector';
import { MotivoNaoExecucaoModal, type MotivoNaoExecucao } from '../components/MotivoNaoExecucaoModal';
import api from '../services/api';

type StatusExecucao = 'EXECUTADO' | 'PARCIAL' | 'NAO_EXECUTADO';
type RdoStatus = 'RASCUNHO' | 'EM_PREENCHIMENTO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO';

interface TarefaLocal {
  id?: string;
  descricao: string;
  frenteServico?: string;
  statusExecucao: StatusExecucao;
  motivoNaoExecucao?: MotivoNaoExecucao;
  motivoTexto?: string;
}

interface Efetivo { funcaoCargo: string; empresaTerceira: string; quantidade: number; }
interface AlertaObra { id: string; tipo: string; mensagem: string; }

const STATUS_CONFIG: Record<RdoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO:         { label: 'Rascunho',         color: 'bg-gray-100 text-gray-600 border-gray-200',    icon: <Clock size={14} /> },
  EM_PREENCHIMENTO: { label: 'Em Preenchimento',  color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <FileText size={14} /> },
  SUBMETIDO:        { label: 'Aguardando Aprovação', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle size={14} /> },
  APROVADO:         { label: 'Aprovado',          color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle size={14} /> },
  REJEITADO:        { label: 'Rejeitado',         color: 'bg-red-50 text-red-700 border-red-200',       icon: <XCircle size={14} /> },
};

export const RdoForm: React.FC = () => {
  const { obraAtiva } = useAuth();
  const navigate = useNavigate();

  // RDO header
  const [dataRef, setDataRef] = useState(new Date().toISOString().split('T')[0]);
  const [climaManha, setClimaManha] = useState('Claro');
  const [climaTarde, setClimaTarde] = useState('Claro');
  const [condicaoTerreno, setCondicaoTerreno] = useState('Praticável');

  // Efetivos (seleção por toque)
  const [efetivos, setEfetivos] = useState<Efetivo[]>([]);

  // Tarefas com motivo de não execução
  const [tarefas, setTarefas] = useState<TarefaLocal[]>([]);
  const [novaTarefaDesc, setNovaTarefaDesc] = useState('');
  const [novaTarefaFrente, setNovaTarefaFrente] = useState('');
  const [modalMotivo, setModalMotivo] = useState<{ index: number; status: StatusExecucao } | null>(null);

  // Alertas de obra
  const [alertas, setAlertas] = useState<AlertaObra[]>([]);

  // Estado do RDO
  const [rdoId, setRdoId] = useState<string | null>(null);
  const [rdoStatus, setRdoStatus] = useState<RdoStatus>('RASCUNHO');
  const [rejeitadoMotivo, _setRejeitadoMotivo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Carregar alertas da obra
  useEffect(() => {
    if (!obraAtiva?.id) return;
    api.get('/alertas', { headers: { 'x-obra-id': obraAtiva.id } })
      .then(r => setAlertas(r.data))
      .catch(() => setAlertas([]));
  }, [obraAtiva?.id]);

  // ── Motivos ──────────────────────────────────────────────────────────────────
  const tarefasPendentesMotivo = tarefas.filter(
    t => (t.statusExecucao === 'NAO_EXECUTADO' || t.statusExecucao === 'PARCIAL') && !t.motivoNaoExecucao,
  );

  const alterarStatusTarefa = (index: number, status: StatusExecucao) => {
    if (status === 'NAO_EXECUTADO' || status === 'PARCIAL') {
      setModalMotivo({ index, status });
    } else {
      setTarefas(prev => prev.map((t, i) => i === index ? { ...t, statusExecucao: status, motivoNaoExecucao: undefined, motivoTexto: undefined } : t));
    }
  };

  const confirmarMotivo = (motivo: MotivoNaoExecucao, texto?: string) => {
    if (!modalMotivo) return;
    setTarefas(prev => prev.map((t, i) =>
      i === modalMotivo.index ? { ...t, statusExecucao: modalMotivo.status as StatusExecucao, motivoNaoExecucao: motivo, motivoTexto: texto } : t
    ));
    setModalMotivo(null);
  };

  // ── Adicionar efetivo via ProfissionalSelector ────────────────────────────────
  const addEfetivo = (p: { funcaoCargo: string; empresaTerceira: string }) => {
    const existe = efetivos.findIndex(e => e.funcaoCargo === p.funcaoCargo && e.empresaTerceira === p.empresaTerceira);
    if (existe >= 0) {
      setEfetivos(prev => prev.map((e, i) => i === existe ? { ...e, quantidade: e.quantidade + 1 } : e));
    } else {
      setEfetivos(prev => [...prev, { ...p, quantidade: 1 }]);
    }
  };

  // ── Salvar RDO em partes (auto-save) ─────────────────────────────────────────
  const salvarRdo = async () => {
    if (!obraAtiva?.id) return;
    setIsSaving(true); setError('');
    try {
      let id = rdoId;
      if (!id) {
        const rdo = await rdoService.criarRdo(obraAtiva.id, { dataReferencia: dataRef, climaManha, climaTarde, condicaoTerreno });
        id = rdo.id;
        setRdoId(id);
      }

      // Adiciona efetivos
      for (const ef of efetivos) {
        await rdoService.addEfetivo(obraAtiva.id, id!, ef);
      }

      // Adiciona tarefas
      for (const t of tarefas) {
        if (!t.id) {
          await api.post(`/rdos/${id}/tarefas`,
            { descricao: t.descricao, frenteServico: t.frenteServico, statusExecucao: t.statusExecucao, motivoNaoExecucao: t.motivoNaoExecucao, motivoTexto: t.motivoTexto },
            { headers: { 'x-obra-id': obraAtiva.id } }
          );
        }
      }
      setRdoStatus('EM_PREENCHIMENTO');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar RDO.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Submeter RDO ─────────────────────────────────────────────────────────────
  const submeterRdo = async () => {
    if (tarefasPendentesMotivo.length > 0) {
      setError(`${tarefasPendentesMotivo.length} tarefa(s) sem motivo de não execução. Preencha antes de submeter.`);
      return;
    }
    if (!obraAtiva?.id) return;
    setIsSubmitting(true); setError('');
    try {
      let id = rdoId;
      if (!id) await salvarRdo();
      await api.put(`/rdos/${id}/submeter`, {}, { headers: { 'x-obra-id': obraAtiva.id } });
      setRdoStatus('SUBMETIDO');
      navigate(`/obras/${obraAtiva.id}/rdos`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao submeter RDO.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toques = `${efetivos.reduce((s, e) => s + e.quantidade, 0)} trabalhadores`;
  const status = STATUS_CONFIG[rdoStatus];
  const podeEditar = rdoStatus === 'RASCUNHO' || rdoStatus === 'EM_PREENCHIMENTO';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Modal de motivo */}
      {modalMotivo && tarefas[modalMotivo.index] && (
        <MotivoNaoExecucaoModal
          tarefaDescricao={tarefas[modalMotivo.index].descricao}
          statusExecucao={modalMotivo.status as 'PARCIAL' | 'NAO_EXECUTADO'}
          onConfirm={confirmarMotivo}
          onCancel={() => setModalMotivo(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Diário de Obra</h1>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${status.color}`}>
                {status.icon} {status.label}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">RDO · {new Date(dataRef).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {podeEditar && (
          <div className="flex gap-2">
            <button onClick={salvarRdo} disabled={isSaving} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={submeterRdo}
              disabled={isSubmitting || tarefasPendentesMotivo.length > 0}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              <Send size={16} /> {isSubmitting ? 'Submetendo...' : 'Submeter RDO'}
            </button>
          </div>
        )}
      </div>

      {/* Atenção: motivos pendentes */}
      {tarefasPendentesMotivo.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 text-amber-500" />
          <span><strong>{tarefasPendentesMotivo.length} tarefa(s)</strong> marcada(s) como não executada/parcial sem motivo. Preencha para liberar o envio.</span>
        </div>
      )}

      {/* Alerta de rejeição */}
      {rdoStatus === 'REJEITADO' && rejeitadoMotivo && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-bold text-red-800 flex items-center gap-2"><XCircle size={16} /> RDO Rejeitado</p>
          <p className="text-sm text-red-700 mt-1">{rejeitadoMotivo}</p>
        </div>
      )}

      {/* Alertas de aferição */}
      {alertas.length > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="text-sm font-bold text-orange-800 flex items-center gap-2"><Bell size={16} /> {alertas.length} alerta(s) da obra</p>
          {alertas.map(a => <p key={a.id} className="text-sm text-orange-700 mt-1">• {a.mensagem}</p>)}
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-xl">{error}</div>}

      <div className="space-y-6">
        {/* Card 1: Condições do Dia */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Sun size={20} className="text-red-600" /> Condições do Dia</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Data', type: 'date', value: dataRef, set: setDataRef },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} disabled={!podeEditar}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 disabled:bg-gray-50" />
              </div>
            ))}
            {[
              { label: 'Clima (Manhã)', value: climaManha, set: setClimaManha },
              { label: 'Clima (Tarde)', value: climaTarde, set: setClimaTarde },
              { label: 'Terreno', value: condicaoTerreno, set: setCondicaoTerreno },
            ].map(sel => (
              <div key={sel.label}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{sel.label}</label>
                <select value={sel.value} onChange={e => sel.set(e.target.value)} disabled={!podeEditar}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 disabled:bg-gray-50">
                  {sel.label.includes('Terreno')
                    ? ['Praticável', 'Parcialmente Praticável', 'Impraticável'].map(o => <option key={o}>{o}</option>)
                    : ['Claro', 'Nublado', 'Chuvoso', 'Impraticável'].map(o => <option key={o}>{o}</option>)
                  }
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Efetivo — seleção por toque */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Users size={20} className="text-red-600" /> Efetivo — {toques}</h3>
          </div>
          {efetivos.length > 0 && (
            <div className="mb-4 space-y-2">
              {efetivos.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-sm font-medium">{e.funcaoCargo} <span className="text-gray-500">({e.empresaTerceira})</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEfetivos(prev => prev.map((ef, j) => j === i && ef.quantidade > 1 ? {...ef, quantidade: ef.quantidade - 1} : ef))}
                      className="w-7 h-7 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600">−</button>
                    <span className="w-8 text-center font-bold">{e.quantidade}</span>
                    <button onClick={() => setEfetivos(prev => prev.map((ef, j) => j === i ? {...ef, quantidade: ef.quantidade + 1} : ef))}
                      className="w-7 h-7 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600">+</button>
                    <button onClick={() => setEfetivos(prev => prev.filter((_, j) => j !== i))}
                      className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {podeEditar && (
            <ProfissionalSelector
              obraId={obraAtiva?.id ?? ''}
              selecionados={efetivos}
              onAdd={addEfetivo}
              onRemove={i => setEfetivos(prev => prev.filter((_, j) => j !== i))}
            />
          )}
        </div>

        {/* Card 3: Tarefas com motivo de não execução */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><FileText size={20} className="text-red-600" /> Tarefas do Dia</h3>

          {podeEditar && (
            <div className="mb-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input value={novaTarefaDesc} onChange={e => setNovaTarefaDesc(e.target.value)}
                  placeholder="Descrição da tarefa..." className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
                <input value={novaTarefaFrente} onChange={e => setNovaTarefaFrente(e.target.value)}
                  placeholder="Frente de serviço" className="col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
                <button onClick={() => {
                  if (!novaTarefaDesc.trim()) return;
                  setTarefas(prev => [...prev, { descricao: novaTarefaDesc.trim(), frenteServico: novaTarefaFrente || undefined, statusExecucao: 'EXECUTADO' }]);
                  setNovaTarefaDesc(''); setNovaTarefaFrente('');
                }} className="flex items-center justify-center gap-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  <Plus size={15} /> Adicionar
                </button>
              </div>
            </div>
          )}

          {tarefas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma tarefa adicionada ainda.</p>
          ) : (
            <div className="space-y-2">
              {tarefas.map((t, i) => (
                <div key={i} className={`p-4 rounded-xl border ${t.statusExecucao === 'NAO_EXECUTADO' ? 'border-red-200 bg-red-50' : t.statusExecucao === 'PARCIAL' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{t.descricao}</p>
                      {t.frenteServico && <p className="text-xs text-gray-500 mt-0.5">{t.frenteServico}</p>}
                      {t.motivoNaoExecucao && (
                        <p className="text-xs text-red-600 mt-1">⚠ {t.motivoNaoExecucao.replace(/_/g, ' ')} {t.motivoTexto ? `— ${t.motivoTexto}` : ''}</p>
                      )}
                      {(t.statusExecucao === 'NAO_EXECUTADO' || t.statusExecucao === 'PARCIAL') && !t.motivoNaoExecucao && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Motivo obrigatório — clique para preencher</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {podeEditar && (['EXECUTADO', 'PARCIAL', 'NAO_EXECUTADO'] as StatusExecucao[]).map(s => (
                        <button key={s} onClick={() => alterarStatusTarefa(i, s)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            t.statusExecucao === s
                              ? s === 'EXECUTADO' ? 'bg-green-600 text-white border-green-600' : s === 'PARCIAL' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-600 text-white border-red-600'
                              : 'border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}>
                          {s === 'EXECUTADO' ? '✓' : s === 'PARCIAL' ? '½' : '✗'}
                        </button>
                      ))}
                      {podeEditar && (
                        <button onClick={() => setTarefas(prev => prev.filter((_, j) => j !== i))}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

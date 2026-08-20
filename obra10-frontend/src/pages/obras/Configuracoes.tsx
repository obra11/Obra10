import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Trash2, Loader2, Upload, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { getImageUrl } from '../../utils/image';

export const Configuracoes: React.FC = () => {
  const { user, obraAtiva, setObraAtiva, updateObraImage, fetchSession } = useAuth();
  const navigate = useNavigate();

  const toDateInput = (value?: string | null) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  };

  const [nome, setNome] = useState(obraAtiva?.nome || '');
  const [endereco, setEndereco] = useState(obraAtiva?.endereco || '');
  const [status, setStatus] = useState(obraAtiva?.status || 'ATIVA');
  const [clienteNome, setClienteNome] = useState(obraAtiva?.clienteNome || '');
  const [dataInicio, setDataInicio] = useState(toDateInput(obraAtiva?.dataInicio));
  const [dataPrevisaoTermino, setDataPrevisaoTermino] = useState(
    toDateInput(obraAtiva?.dataPrevisaoTermino),
  );
  const [percentualAvanco, setPercentualAvanco] = useState(
    obraAtiva?.percentualAvanco == null ? '' : String(obraAtiva.percentualAvanco),
  );

  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (obraAtiva) {
      setNome(obraAtiva.nome);
      setEndereco(obraAtiva.endereco || '');
      setStatus(obraAtiva.status);
      setClienteNome(obraAtiva.clienteNome || '');
      setDataInicio(toDateInput(obraAtiva.dataInicio));
      setDataPrevisaoTermino(toDateInput(obraAtiva.dataPrevisaoTermino));
      setPercentualAvanco(
        obraAtiva.percentualAvanco == null ? '' : String(obraAtiva.percentualAvanco),
      );
    }
  }, [obraAtiva]);

  const isGestor =
    user?.perfilGlobal === 'GESTOR' || user?.perfilGlobal === 'SUPER_ADMIN';

  const handleSave = async () => {
    if (!nome.trim() || !obraAtiva) return;
    setLoadingSave(true);
    setSaveSuccess(false);
    try {
      const payload = {
        nome,
        endereco,
        status,
        clienteNome: clienteNome.trim() || null,
        dataInicio: dataInicio || null,
        dataPrevisaoTermino: dataPrevisaoTermino || null,
        percentualAvanco: percentualAvanco.trim() === '' ? null : Number(percentualAvanco),
      };
      const res = await api.patch(`/obras/${obraAtiva.id}`, payload);
      const updatedObra = {
        ...obraAtiva,
        ...payload,
        percentualAvanco: res.data?.percentualAvanco ?? payload.percentualAvanco,
        dataInicio: res.data?.dataInicio ?? payload.dataInicio,
        dataPrevisaoTermino: res.data?.dataPrevisaoTermino ?? payload.dataPrevisaoTermino,
      };
      setObraAtiva(updatedObra);
      await fetchSession();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert('Erro ao salvar configurações: ' + (e?.response?.data?.message || e.message));
    } finally {
      setLoadingSave(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !obraAtiva) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/upload/obra/${obraAtiva.id}/imagem`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateObraImage(obraAtiva.id, response.data.url);
      await fetchSession();
    } catch (err: any) {
      console.error('Erro ao fazer upload da imagem:', err);
      alert('Erro ao atualizar imagem de capa: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!obraAtiva || confirmWord !== 'EXCLUIR') return;
    setLoadingDelete(true);
    try {
      await api.delete(`/obras/${obraAtiva.id}`);
      setObraAtiva(null);
      await fetchSession();
      navigate('/dashboard');
    } catch (e: any) {
      alert('Erro ao excluir obra: ' + (e?.response?.data?.message || e.message));
    } finally {
      setLoadingDelete(false);
      setShowConfirmDelete(false);
    }
  };

  if (!obraAtiva) {
    return (
      <div className="p-6 text-center text-gray-500">
        Nenhum canteiro de obras ativo selecionado.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b pb-4">
        <div className="bg-lunardeli-red/10 p-2.5 rounded-lg text-lunardeli-red">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configurações da Obra</h1>
          <p className="text-sm text-gray-500">Gerencie as informações gerais, evolução, imagem de capa, status e exclusão do canteiro ativo.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Informações Gerais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Cover Image Upload Column */}
            <div className="md:col-span-1 flex flex-col items-center">
              <span className="block text-sm font-bold text-gray-600 mb-2 self-start">Imagem de Capa</span>
              <div className="w-full aspect-[4/3] rounded-lg bg-gray-50 border border-gray-200 overflow-hidden relative group">
                {obraAtiva.imageUrl ? (
                  <img src={getImageUrl(obraAtiva.imageUrl)} alt={obraAtiva.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                    <span>Sem Imagem de Capa</span>
                  </div>
                )}
                {/* Desktop: overlay no hover. Mobile: sempre visível (não existe hover). */}
                {isGestor && (
                  <label className="absolute inset-0 bg-black/55 md:bg-black/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity text-center p-2">
                    {uploadingImage ? (
                      <Loader2 className="animate-spin text-white mb-1" size={20} />
                    ) : (
                      <Upload className="text-white mb-1" size={20} />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {uploadingImage ? 'Enviando...' : 'Alterar Capa'}
                    </span>
                    <input type="file" className="hidden" accept="image/*" disabled={uploadingImage} onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              {isGestor && (
                <label className="mt-3 w-full md:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 active:bg-gray-50 cursor-pointer">
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploadingImage ? 'Enviando...' : 'Escolher foto da obra'}
                  <input type="file" className="hidden" accept="image/*" disabled={uploadingImage} onChange={handleImageUpload} />
                </label>
              )}
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Use imagens retangulares (relação de aspecto 4:3 ou 16:9).
              </p>
            </div>

            {/* Inputs Column */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Canteiro de Obras *</label>
                <input
                  type="text"
                  disabled={!isGestor}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Nome da Obra"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Endereço da Obra</label>
                <input
                  type="text"
                  disabled={!isGestor}
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Endereço Completo"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Status da Obra</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['ATIVA', 'INATIVA', 'FINALIZADA'] as const).map((s) => {
                    const isActive = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!isGestor}
                        onClick={() => setStatus(s)}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border uppercase tracking-wider text-center transition-all ${
                          isActive
                            ? s === 'ATIVA'
                              ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500'
                              : s === 'INATIVA'
                              ? 'bg-yellow-50 border-yellow-500 text-yellow-700 ring-1 ring-yellow-500'
                              : 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500'
                            : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
                        } disabled:opacity-50`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cliente / contratante</label>
                <input
                  type="text"
                  disabled={!isGestor}
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Nome do cliente da obra"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Data de início</label>
                  <input
                    type="date"
                    disabled={!isGestor}
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full min-h-12 px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Previsão de término</label>
                  <input
                    type="date"
                    disabled={!isGestor}
                    value={dataPrevisaoTermino}
                    onChange={(e) => setDataPrevisaoTermino(e.target.value)}
                    className="w-full min-h-12 px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Avanço físico (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  disabled={!isGestor}
                  value={percentualAvanco}
                  onChange={(e) => setPercentualAvanco(e.target.value)}
                  className="w-full sm:w-40 min-h-12 px-3.5 py-2 border rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="0–100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Footer Bar */}
        {isGestor && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600 h-6">
              {saveSuccess && (
                <>
                  <CheckCircle size={16} />
                  <span className="text-xs font-bold">Alterações salvas com sucesso!</span>
                </>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={loadingSave || !nome.trim()}
              className="px-6 py-2 bg-lunardeli-red hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              {loadingSave ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Alterações
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {isGestor && (
        <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="bg-red-100 p-2 rounded-lg text-red-600 shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-red-800">Zona de Perigo</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Excluir este canteiro de obras removerá permanentemente todos os relatórios (RDOs), 
                    efetivos registrados, ocorrências, fotos e anexos armazenados na nuvem.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConfirmWord('');
                    setShowConfirmDelete(true);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Trash2 size={14} /> Excluir Obra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-2 text-red-600 mb-4">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold">Você tem certeza absoluta?</h3>
              </div>
              
              <div className="text-sm text-gray-600 space-y-3">
                <p>
                  Esta ação não pode ser desfeita. Todos os dados da obra <strong>{obraAtiva.nome}</strong> serão excluídos permanentemente.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 flex items-start gap-2">
                  <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                  <span>
                    <strong>Importante:</strong> Um e-mail de confirmação será enviado para <strong>{user?.email}</strong> assim que a exclusão for concluída.
                  </span>
                </div>
                <p>
                  Para confirmar, digite a palavra <strong className="text-red-600 select-all">EXCLUIR</strong> no campo abaixo:
                </p>
              </div>

              <input
                type="text"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mt-4 font-bold uppercase tracking-wider text-center text-red-600 bg-red-50/50"
                placeholder="Digite EXCLUIR"
              />
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmWord !== 'EXCLUIR' || loadingDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {loadingDelete ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

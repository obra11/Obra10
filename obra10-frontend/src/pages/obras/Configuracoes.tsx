import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Trash2, Loader2, Upload, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { getImageUrl } from '../../utils/image';

type CapaRascunho = {
  url: string;
  largura: number;
  altura: number;
};

type Pan = { x: number; y: number };

function enquadrar(quadroW: number, quadroH: number, imgW: number, imgH: number, zoom: number, pan: Pan) {
  const caber = Math.min(quadroW / imgW, quadroH / imgH);
  const escala = caber * zoom;
  const dw = imgW * escala;
  const dh = imgH * escala;
  const maxX = Math.max(0, (dw - quadroW) / 2);
  const maxY = Math.max(0, (dh - quadroH) / 2);
  const x = Math.min(maxX, Math.max(-maxX, pan.x));
  const y = Math.min(maxY, Math.max(-maxY, pan.y));
  return {
    dw,
    dh,
    x,
    y,
    left: (quadroW - dw) / 2 + x,
    top: (quadroH - dh) / 2 + y,
  };
}

export const Configuracoes: React.FC = () => {
  const { user, obraAtiva, setObraAtiva, updateObraImage, fetchSession } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState(obraAtiva?.nome || '');
  const [endereco, setEndereco] = useState(obraAtiva?.endereco || '');
  const [status, setStatus] = useState(obraAtiva?.status || 'ATIVA');

  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rascunhoCapa, setRascunhoCapa] = useState<CapaRascunho | null>(null);
  const [zoomCapa, setZoomCapa] = useState(1);
  const [panCapa, setPanCapa] = useState<Pan>({ x: 0, y: 0 });
  const quadroRef = useRef<HTMLDivElement>(null);
  const [quadroTamanho, setQuadroTamanho] = useState({ w: 0, h: 0 });
  const arrasteRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (obraAtiva) {
      setNome(obraAtiva.nome);
      setEndereco(obraAtiva.endereco || '');
      setStatus(obraAtiva.status);
    }
  }, [obraAtiva]);

  useEffect(() => {
    if (!rascunhoCapa) return;
    const el = quadroRef.current;
    if (!el) return;
    const medir = () => setQuadroTamanho({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    const aoRoda = (e: WheelEvent) => {
      e.preventDefault();
      setZoomCapa((atual) => Math.min(3, Math.max(1, atual + (e.deltaY < 0 ? 0.08 : -0.08))));
    };
    el.addEventListener('wheel', aoRoda, { passive: false });
    return () => {
      obs.disconnect();
      el.removeEventListener('wheel', aoRoda);
    };
  }, [rascunhoCapa]);

  const isGestor = user?.perfilGlobal === 'GESTOR';

  const handleSave = async () => {
    if (!nome.trim() || !obraAtiva) return;
    setLoadingSave(true);
    setSaveSuccess(false);
    try {
      await api.patch(`/obras/${obraAtiva.id}`, { nome, endereco, status });
      const updatedObra = { ...obraAtiva, nome, endereco, status };
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

  const fecharRascunhoCapa = () => {
    setRascunhoCapa((atual) => {
      if (atual) URL.revokeObjectURL(atual.url);
      return null;
    });
    setZoomCapa(1);
    setPanCapa({ x: 0, y: 0 });
    arrasteRef.current = null;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !obraAtiva) return;
    const url = URL.createObjectURL(file);
    const imagem = new Image();
    imagem.onload = () => {
      setRascunhoCapa((atual) => {
        if (atual) URL.revokeObjectURL(atual.url);
        return { url, largura: imagem.naturalWidth, altura: imagem.naturalHeight };
      });
      setZoomCapa(1);
      setPanCapa({ x: 0, y: 0 });
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Não foi possível abrir essa imagem.');
    };
    imagem.src = url;
  };

  const confirmarCapa = async () => {
    if (!rascunhoCapa || !obraAtiva || !quadroRef.current) return;
    const quadroW = quadroRef.current.clientWidth;
    const quadroH = quadroRef.current.clientHeight;
    if (!quadroW || !quadroH) return;

    setUploadingImage(true);
    try {
      const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        img.src = rascunhoCapa.url;
      });
      const outW = 1600;
      const outH = 1200;
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível preparar a capa.');
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, outW, outH);
      const view = enquadrar(quadroW, quadroH, rascunhoCapa.largura, rascunhoCapa.altura, zoomCapa, panCapa);
      const fator = outW / quadroW;
      ctx.drawImage(imagem, view.left * fator, view.top * fator, view.dw * fator, view.dh * fator);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((gerado) => (gerado ? resolve(gerado) : reject(new Error('Falha ao gerar a capa.'))), 'image/jpeg', 0.92);
      });
      const arquivo = new File([blob], 'capa-obra.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', arquivo);
      const response = await api.post(`/upload/obra/${obraAtiva.id}/imagem`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateObraImage(obraAtiva.id, response.data.url);
      await fetchSession();
      fecharRascunhoCapa();
    } catch (err: any) {
      console.error('Erro ao fazer upload da imagem:', err);
      alert('Erro ao atualizar imagem de capa: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const moverCapa = (clienteX: number, clienteY: number) => {
    const arraste = arrasteRef.current;
    const quadro = quadroRef.current;
    if (!arraste || !quadro || !rascunhoCapa) return;
    const proposto = {
      x: arraste.panX + (clienteX - arraste.x),
      y: arraste.panY + (clienteY - arraste.y),
    };
    const limitado = enquadrar(quadro.clientWidth, quadro.clientHeight, rascunhoCapa.largura, rascunhoCapa.altura, zoomCapa, proposto);
    setPanCapa({ x: limitado.x, y: limitado.y });
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
          <p className="text-sm text-gray-500">Gerencie as informações gerais, imagem de capa, status e exclusão do canteiro ativo.</p>
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
                Depois de escolher a foto, use o zoom para a capa mostrar a imagem inteira.
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

      {rascunhoCapa && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-800">Ajustar imagem de capa</h3>
              <p className="text-sm text-gray-500 mt-1">
                No zoom mínimo a foto inteira cabe no quadro. Aumente para aproximar e arraste para posicionar.
              </p>
              <div
                ref={quadroRef}
                className="mt-4 w-full aspect-[4/3] rounded-lg bg-gray-100 border border-gray-200 overflow-hidden relative touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  arrasteRef.current = { x: e.clientX, y: e.clientY, panX: panCapa.x, panY: panCapa.y };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => moverCapa(e.clientX, e.clientY)}
                onPointerUp={() => { arrasteRef.current = null; }}
                onPointerCancel={() => { arrasteRef.current = null; }}
              >
                {(() => {
                  const view = quadroTamanho.w
                    ? enquadrar(quadroTamanho.w, quadroTamanho.h, rascunhoCapa.largura, rascunhoCapa.altura, zoomCapa, panCapa)
                    : null;
                  return (
                    <img
                      src={rascunhoCapa.url}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none select-none"
                      style={view ? { width: view.dw, height: view.dh, left: view.left, top: view.top } : { width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  );
                })()}
              </div>
              <label className="mt-4 block text-xs font-bold text-gray-600">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoomCapa}
                  onChange={(e) => {
                    const proximo = Number(e.target.value);
                    setZoomCapa(proximo);
                    if (!quadroTamanho.w) return;
                    const limitado = enquadrar(quadroTamanho.w, quadroTamanho.h, rascunhoCapa.largura, rascunhoCapa.altura, proximo, panCapa);
                    setPanCapa({ x: limitado.x, y: limitado.y });
                  }}
                  className="mt-2 w-full accent-lunardeli-red"
                />
                <span className="mt-1 flex justify-between font-medium text-gray-400">
                  <span>Imagem inteira</span>
                  <span>Aproximar</span>
                </span>
              </label>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={fecharRascunhoCapa}
                disabled={uploadingImage}
                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCapa}
                disabled={uploadingImage}
                className="px-5 py-2 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Usar esta capa
              </button>
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

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Save,
  TrendingUp,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getImageUrl } from '../../utils/image';
import { parseUTCDate } from '../../utils/date';
import { AvancoObraBar } from '../../components/AvancoObraBar';

type FotoEvolucao = {
  id: string;
  rdoId: string;
  urlS3: string;
  viewUrl: string;
  legenda: string;
  criadorNome: string | null;
  createdAt: string;
};

type DiaEvolucao = {
  data: string;
  rdoId: string;
  rdoStatus: string;
  atividades: string[];
  fotos: FotoEvolucao[];
};

type EvolucaoPayload = {
  obra: {
    id: string;
    nome: string;
    status: string;
    imageUrl?: string | null;
    clienteNome?: string | null;
    dataInicio?: string | null;
    dataPrevisaoTermino?: string | null;
    percentualAvanco?: number | null;
  };
  resumo: {
    totalFotos: number;
    totalDiasComFoto: number;
    totalRdos: number;
    primeiraData: string | null;
    ultimaData: string | null;
  };
  dias: DiaEvolucao[];
};

function fotoSrc(foto: FotoEvolucao): string {
  return getImageUrl(foto.viewUrl || foto.urlS3);
}

function formatarDia(iso: string): string {
  return format(parseUTCDate(iso), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export const EvolucaoObra: React.FC = () => {
  const { obraAtiva, user, setObraAtiva, fetchSession } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<EvolucaoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordemAntiga, setOrdemAntiga] = useState(false);
  const [lightbox, setLightbox] = useState<{ fotos: FotoEvolucao[]; index: number } | null>(null);
  const [percentualEdit, setPercentualEdit] = useState<string>('');
  const [savingPct, setSavingPct] = useState(false);

  const canEdit =
    user?.perfilGlobal === 'GESTOR' ||
    user?.perfilGlobal === 'SUPER_ADMIN' ||
    user?.capabilities?.editarObra === true;

  const carregar = async () => {
    if (!obraAtiva?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/obras/${obraAtiva.id}/evolucao`);
      setData(res.data);
      setPercentualEdit(
        res.data?.obra?.percentualAvanco == null
          ? ''
          : String(res.data.obra.percentualAvanco),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao carregar a evolução da obra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [obraAtiva?.id]);

  const diasOrdenados = useMemo(() => {
    const dias = (data?.dias || []).filter((d) => d.fotos.length > 0);
    if (ordemAntiga) return [...dias].sort((a, b) => a.data.localeCompare(b.data));
    return dias;
  }, [data, ordemAntiga]);

  const fotosTimeline = useMemo(
    () => diasOrdenados.flatMap((d) => d.fotos),
    [diasOrdenados],
  );

  const primeiraFoto = useMemo(() => {
    const comFoto = [...(data?.dias || [])]
      .filter((d) => d.fotos.length > 0)
      .sort((a, b) => a.data.localeCompare(b.data));
    return comFoto[0]?.fotos[0] || null;
  }, [data]);

  const ultimaFoto = useMemo(() => {
    const comFoto = [...(data?.dias || [])]
      .filter((d) => d.fotos.length > 0)
      .sort((a, b) => a.data.localeCompare(b.data));
    const ultimo = comFoto[comFoto.length - 1];
    if (!ultimo) return null;
    return ultimo.fotos[ultimo.fotos.length - 1] || null;
  }, [data]);

  const salvarPercentual = async () => {
    if (!obraAtiva?.id || !canEdit) return;
    setSavingPct(true);
    try {
      const valor = percentualEdit.trim() === '' ? null : Number(percentualEdit);
      const res = await api.patch(`/obras/${obraAtiva.id}`, { percentualAvanco: valor });
      const updated = {
        ...obraAtiva,
        percentualAvanco: res.data?.percentualAvanco ?? valor,
      };
      setObraAtiva(updated);
      await fetchSession();
      await carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar o avanço físico.');
    } finally {
      setSavingPct(false);
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
    <div className="flex-1 p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Evolução da Obra</h1>
            <p className="text-sm text-gray-500 mt-1">
              Linha do tempo fotográfica do canteiro: {obraAtiva.nome}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOrdemAntiga((v) => !v)}
              className="min-h-12 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {ordemAntiga ? 'Ver do mais recente' : 'Ver do mais antigo'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/obras/${obraAtiva.id}/configuracoes`)}
              className="min-h-12 px-4 py-2.5 rounded-xl bg-lunardeli-red text-white text-sm font-bold hover:bg-red-700"
            >
              Datas e cadastro
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 size={36} className="animate-spin text-lunardeli-red mb-3" />
            <p className="text-sm font-medium">Montando a linha do tempo...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Fotos no canteiro</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data?.resumo.totalFotos ?? 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Dias com registro</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data?.resumo.totalDiasComFoto ?? 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Início</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                  {data?.obra.dataInicio
                    ? format(parseUTCDate(data.obra.dataInicio), 'dd/MM/yyyy')
                    : data?.resumo.primeiraData
                    ? format(parseUTCDate(data.resumo.primeiraData), 'dd/MM/yyyy')
                    : '—'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Previsão de término</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                  {data?.obra.dataPrevisaoTermino
                    ? format(parseUTCDate(data.obra.dataPrevisaoTermino), 'dd/MM/yyyy')
                    : '—'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-red-50 text-lunardeli-red p-2.5 rounded-lg">
                  <TrendingUp size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-800">Avanço físico</h2>
                  {data?.obra.clienteNome && (
                    <p className="text-xs text-gray-500 mt-0.5">Cliente: {data.obra.clienteNome}</p>
                  )}
                </div>
              </div>
              <AvancoObraBar percentual={data?.obra.percentualAvanco} className="mb-4" />
              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                    Atualizar avanço (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={percentualEdit}
                    onChange={(e) => setPercentualEdit(e.target.value)}
                    className="w-full sm:w-28 min-h-12 px-3 border rounded-lg outline-none focus:ring-2 focus:ring-lunardeli-red"
                    placeholder="0–100"
                  />
                  <button
                    type="button"
                    onClick={salvarPercentual}
                    disabled={savingPct}
                    className="min-h-12 px-4 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingPct ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Salvar
                  </button>
                </div>
              )}
            </div>

            {primeiraFoto && ultimaFoto && primeiraFoto.id !== ultimaFoto.id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({ fotos: [primeiraFoto, ultimaFoto], index: 0 })
                  }
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left shadow-sm"
                >
                  <div className="aspect-[16/10] bg-gray-100">
                    <img src={fotoSrc(primeiraFoto)} alt="Início" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-800">Antes</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {data?.resumo.primeiraData
                        ? format(parseUTCDate(data.resumo.primeiraData), 'dd/MM/yyyy')
                        : ''}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({ fotos: [primeiraFoto, ultimaFoto], index: 1 })
                  }
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left shadow-sm"
                >
                  <div className="aspect-[16/10] bg-gray-100">
                    <img src={fotoSrc(ultimaFoto)} alt="Agora" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <Camera size={14} className="text-lunardeli-red" />
                    <span className="text-sm font-bold text-gray-800">Agora</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {data?.resumo.ultimaData
                        ? format(parseUTCDate(data.resumo.ultimaData), 'dd/MM/yyyy')
                        : ''}
                    </span>
                  </div>
                </button>
              </div>
            )}

            {fotosTimeline.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500">
                <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-gray-700">Ainda não há fotos na evolução desta obra.</p>
                <p className="text-sm mt-2 max-w-md mx-auto">
                  As fotos tiradas nos diários de obra aparecem aqui, agrupadas por dia, para mostrar o andamento do canteiro.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/obras/${obraAtiva.id}/rdos`)}
                  className="mt-5 min-h-12 px-5 bg-lunardeli-red text-white font-bold rounded-xl inline-flex items-center gap-2"
                >
                  Ir para os RDOs <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {diasOrdenados.map((dia) => (
                  <section key={dia.data} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-800 capitalize">
                          {formatarDia(dia.data)}
                        </h3>
                        {dia.atividades.length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {dia.atividades.join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/obras/${obraAtiva.id}/rdos/${dia.rdoId}`)}
                        className="min-h-12 px-3 text-xs font-bold text-lunardeli-red inline-flex items-center gap-1"
                      >
                        Abrir RDO <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {dia.fotos.map((foto, idx) => (
                        <button
                          key={foto.id}
                          type="button"
                          onClick={() => setLightbox({ fotos: dia.fotos, index: idx })}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative group min-h-[96px]"
                        >
                          <img
                            src={fotoSrc(foto)}
                            alt={foto.legenda || 'Foto da evolução'}
                            className="w-full h-full object-cover"
                          />
                          {foto.legenda && (
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-2 py-1 truncate">
                              {foto.legenda}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm font-semibold truncate px-2">
              {lightbox.fotos[lightbox.index]?.legenda || 'Foto da evolução'}
            </p>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="p-3 min-h-12 min-w-12 rounded-lg hover:bg-white/10"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center relative px-12">
            {lightbox.fotos.length > 1 && (
              <button
                type="button"
                className="absolute left-2 p-3 min-h-12 min-w-12 rounded-full bg-white/10 text-white"
                onClick={() =>
                  setLightbox((cur) =>
                    cur
                      ? {
                          ...cur,
                          index: (cur.index - 1 + cur.fotos.length) % cur.fotos.length,
                        }
                      : cur,
                  )
                }
              >
                <ChevronLeft />
              </button>
            )}
            <img
              src={fotoSrc(lightbox.fotos[lightbox.index])}
              alt=""
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
            {lightbox.fotos.length > 1 && (
              <button
                type="button"
                className="absolute right-2 p-3 min-h-12 min-w-12 rounded-full bg-white/10 text-white"
                onClick={() =>
                  setLightbox((cur) =>
                    cur
                      ? { ...cur, index: (cur.index + 1) % cur.fotos.length }
                      : cur,
                  )
                }
              >
                <ChevronRight />
              </button>
            )}
          </div>
          <p className="text-center text-white/70 text-xs pb-6">
            {lightbox.index + 1} / {lightbox.fotos.length}
          </p>
        </div>
      )}
    </div>
  );
};

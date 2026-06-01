import React, { useEffect, useState } from 'react';
import { X, Image as ImageIcon, Film, User, Calendar, Loader2, Maximize2, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface MediaItem {
  id: string;
  tipoArquivo: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
  criador?: {
    nome: string;
  };
  urlS3: string;
  viewUrl: string;
}

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  isOpen,
  onClose,
  obraId,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'todas' | 'fotos' | 'videos'>('todas');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);

  // Lightbox & Video State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && obraId) {
      setSelectedMonth('');
      carregarMidias();
    }
  }, [isOpen, obraId]);

  const carregarMidias = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/anexos/obra', {
        headers: { 'x-obra-id': obraId },
      });
      const data = res.data || [];
      setItems(data);

      const monthsMap = new Map<string, string>();
      data.forEach((item: MediaItem) => {
        if (!item.createdAt) return;
        const d = new Date(item.createdAt);
        if (isNaN(d.getTime())) return;
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
        monthsMap.set(val, capitalizedLabel);
      });
      
      const sortedMonths = Array.from(monthsMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([value, label]) => ({ value, label }));
      setMonths(sortedMonths);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Erro ao buscar as mídias da obra.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalFotos = items.filter((item) => item.mimeType?.startsWith('image/')).length;
  const totalVideos = items.filter((item) => item.mimeType?.startsWith('video/')).length;

  const filteredItems = items.filter((item) => {
    const isFoto = item.mimeType?.startsWith('image/');
    const isVideo = item.mimeType?.startsWith('video/');
    if (activeTab === 'fotos' && !isFoto) return false;
    if (activeTab === 'videos' && !isVideo) return false;

    if (selectedMonth) {
      const date = new Date(item.createdAt);
      if (!isNaN(date.getTime())) {
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthYear !== selectedMonth) return false;
      }
    }
    return true;
  });

  const filteredFotos = filteredItems.filter((item) => item.mimeType?.startsWith('image/'));
  const fotos = filteredFotos;

  // Group filtered items by date (YYYY-MM-DD)
  const groupsMap: Record<string, { formattedDate: string; items: MediaItem[] }> = {};
  filteredItems.forEach((item) => {
    if (!item.createdAt) return;
    const dateObj = new Date(item.createdAt);
    if (isNaN(dateObj.getTime())) return;
    const yyyymmdd = dateObj.toISOString().split('T')[0];
    const formattedDate = format(dateObj, 'dd/MM/yyyy');
    
    if (!groupsMap[yyyymmdd]) {
      groupsMap[yyyymmdd] = {
        formattedDate,
        items: [],
      };
    }
    groupsMap[yyyymmdd].items.push(item);
  });

  const sortedDates = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));

  const getFileUrl = (urlS3: string, viewUrl?: string) => {
    if (viewUrl) return viewUrl;
    if (!urlS3) return '';
    if (urlS3.startsWith('http://') || urlS3.startsWith('https://')) {
      return urlS3;
    }
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const cleanPath = urlS3.startsWith('/') ? urlS3 : `/${urlS3}`;
    return `${cleanBase}${cleanPath}`;
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! + 1) % fotos.length);
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! - 1 + fotos.length) % fotos.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      {/* Modal Card */}
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden h-[85vh] flex flex-col border border-gray-100">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-lg md:text-xl flex items-center gap-2">
              <ImageIcon size={22} className="text-lunardeli-red" /> Galeria de Mídias
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Fotos e vídeos anexados em todos os diários de obra deste projeto.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector & Month Filter */}
        <div className="px-5 py-2 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar whitespace-nowrap">
            <button
              onClick={() => setActiveTab('todas')}
              className={`flex items-center gap-2 py-2 px-3 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'todas'
                  ? 'border-lunardeli-red text-lunardeli-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Todas ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('fotos')}
              className={`flex items-center gap-2 py-2 px-3 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'fotos'
                  ? 'border-lunardeli-red text-lunardeli-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <ImageIcon size={16} /> Fotos ({totalFotos})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex items-center gap-2 py-2 px-3 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'videos'
                  ? 'border-lunardeli-red text-lunardeli-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Film size={16} /> Vídeos ({totalVideos})
            </button>
          </div>

          {/* Filtro de Mês */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Mês:
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-lunardeli-red/50 shadow-sm cursor-pointer"
            >
              <option value="">Todos os meses</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gallery Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 size={36} className="animate-spin text-lunardeli-red mb-3" />
              <p className="text-sm font-medium">Buscando arquivos de mídia...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center max-w-md mx-auto my-12 border border-red-100">
              <p className="font-semibold mb-2">Ops! Houve um erro</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">Nenhuma mídia encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedDates.map((yyyymmdd) => {
                const group = groupsMap[yyyymmdd];
                return (
                  <div key={yyyymmdd} className="space-y-4">
                    {/* Header de Data com divisor */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                        <Calendar size={12} className="text-lunardeli-red" />
                        {group.formattedDate}
                      </span>
                      <div className="flex-1 border-t border-gray-200"></div>
                    </div>

                    {/* Grid de mídias deste dia */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                      {group.items.map((item) => {
                        const isVideo = item.mimeType?.startsWith('video/');
                        if (isVideo) {
                          return (
                            <div
                              key={item.id}
                              onClick={() => setPlayingVideoUrl(getFileUrl(item.urlS3, item.viewUrl))}
                              className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow group flex flex-col"
                            >
                              <div className="relative aspect-video w-full bg-gray-900 flex items-center justify-center">
                                <Film className="text-gray-600 group-hover:scale-110 transition-transform" size={32} />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:bg-lunardeli-red group-hover:text-white transition-colors">
                                    <Play size={16} className="ml-0.5" />
                                  </div>
                                </div>
                              </div>
                              <div className="p-3 flex-1 flex flex-col justify-between">
                                <p className="text-xs font-bold text-gray-800 truncate" title={item.nomeOriginal}>
                                  {item.nomeOriginal}
                                </p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400 truncate">
                                    <User size={10} className="shrink-0" />
                                    <span>{item.criador?.nome || 'Desconhecido'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          const clickIdx = filteredFotos.findIndex((f) => f.id === item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => setLightboxIndex(clickIdx)}
                              className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow group flex flex-col"
                            >
                              <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                                <img
                                  src={getFileUrl(item.urlS3, item.viewUrl)}
                                  alt={item.nomeOriginal}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 className="text-white" size={20} />
                                </div>
                              </div>
                              <div className="p-3 flex-1 flex flex-col justify-between">
                                <p className="text-xs font-bold text-gray-800 truncate" title={item.nomeOriginal}>
                                  {item.nomeOriginal}
                                </p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400 truncate">
                                    <User size={10} className="shrink-0" />
                                    <span>{item.criador?.nome || 'Desconhecido'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for Photos */}
      {lightboxIndex !== null && (
        <div
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 animate-fadeIn"
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>

          {/* Navigation Controls */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors select-none"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={handleNextPhoto}
                className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors select-none"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          {/* Large Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[80vh] flex flex-col items-center justify-center relative"
          >
            <img
              src={getFileUrl(fotos[lightboxIndex].urlS3, fotos[lightboxIndex].viewUrl)}
              alt={fotos[lightboxIndex].nomeOriginal}
              className="max-w-full max-h-[75vh] object-contain rounded-lg select-none"
            />
            {/* Info overlay */}
            <div className="mt-4 text-center text-white space-y-1">
              <p className="text-sm font-bold">{fotos[lightboxIndex].nomeOriginal}</p>
              <p className="text-xs opacity-75">
                Por {fotos[lightboxIndex].criador?.nome || 'Desconhecido'} em{' '}
                {format(new Date(fotos[lightboxIndex].createdAt), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Popup */}
      {playingVideoUrl && (
        <div
          onClick={() => setPlayingVideoUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fadeIn"
        >
          <button
            onClick={() => setPlayingVideoUrl(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl"
          >
            <video
              src={playingVideoUrl}
              controls
              autoPlay
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

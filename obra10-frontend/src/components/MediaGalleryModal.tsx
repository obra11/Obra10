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
  const [activeTab, setActiveTab] = useState<'fotos' | 'videos'>('fotos');

  // Lightbox & Video State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && obraId) {
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
      setItems(res.data || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Erro ao buscar as mídias da obra.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fotos = items.filter((item) => item.mimeType?.startsWith('image/'));
  const videos = items.filter((item) => item.mimeType?.startsWith('video/'));

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

        {/* Tab Selector */}
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-4 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('fotos')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'fotos'
                ? 'border-lunardeli-red text-lunardeli-red'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ImageIcon size={16} /> Fotos ({fotos.length})
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'videos'
                ? 'border-lunardeli-red text-lunardeli-red'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Film size={16} /> Vídeos ({videos.length})
          </button>
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
          ) : activeTab === 'fotos' && fotos.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">Nenhuma foto encontrada neste projeto.</p>
            </div>
          ) : activeTab === 'videos' && videos.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Film size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">Nenhum vídeo encontrado neste projeto.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {activeTab === 'fotos'
                ? fotos.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setLightboxIndex(idx)}
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
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar size={10} className="shrink-0" />
                            <span>
                              {format(new Date(item.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                : videos.map((item) => (
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
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar size={10} className="shrink-0" />
                            <span>
                              {format(new Date(item.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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

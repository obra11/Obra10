import React, { useState, useRef, useEffect } from 'react';
import { Download, Printer, Share2, Loader2, CheckCircle, MoreVertical, Edit, Image } from 'lucide-react';
import api from '../services/api';

interface RdoShareBarProps {
  rdoId: string;
  obraId: string;
  rdoLabel?: string;
  /** Se true, renderiza como menu de três pontos (compacto) para listas. */
  compact?: boolean;
  /** Callback para abrir / editar o RDO via menu compacto. */
  onOpen?: () => void;
}

/**
 * Barra de ações de exportação para um único RDO.
 *
 * - Baixar PDF: gera PDF simples (sem fotos) e dispara download.
 * - Baixar com Fotos: gera PDF incluindo álbum fotográfico (?fotos=true).
 * - Imprimir: abre o PDF simples em nova aba e dispara window.print().
 * - Compartilhar: Web Share API nativa (WhatsApp, Telegram…).
 *   Fallback desktop: copia a URL do PDF para o clipboard.
 */
export const RdoShareBar: React.FC<RdoShareBarProps> = ({
  rdoId,
  obraId,
  rdoLabel = 'RDO',
  compact = false,
  onOpen,
}) => {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFotosLoading, setPdfFotosLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  /** Requisita o PDF ao backend e retorna o Blob bruto. */
  const fetchPdfBlob = async (comFotos = false): Promise<Blob> => {
    const params = comFotos ? '?fotos=true' : '';
    const response = await api.get(`/rdos/${rdoId}/pdf${params}`, {
      headers: { 'x-obra-id': obraId },
      responseType: 'blob',
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const fetchPdfBlobUrl = async (comFotos = false): Promise<string> => {
    const blob = await fetchPdfBlob(comFotos);
    return URL.createObjectURL(blob);
  };

  const filenamePdf = `${rdoLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  /** Download simples do PDF (sem fotos). */
  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const url = await fetchPdfBlobUrl(false);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenamePdf;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('[RdoShareBar] Erro ao baixar PDF:', e);
      alert('Não foi possível gerar o PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  /** Download do PDF com álbum de fotos. */
  const handleDownloadComFotos = async () => {
    if (pdfFotosLoading) return;
    setPdfFotosLoading(true);
    try {
      const url = await fetchPdfBlobUrl(true);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenamePdf.replace('.pdf', '_ComFotos.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('[RdoShareBar] Erro ao baixar PDF com fotos:', e);
      alert('Não foi possível gerar o PDF com fotos.');
    } finally {
      setPdfFotosLoading(false);
    }
  };

  /** Abre o PDF em nova aba e dispara impressão. */
  const handlePrint = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const url = await fetchPdfBlobUrl(false);
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          setTimeout(() => win.print(), 500);
        });
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      console.error('[RdoShareBar] Erro ao imprimir:', e);
      alert('Não foi possível abrir o PDF para impressão.');
    } finally {
      setPdfLoading(false);
    }
  };

  /** Compartilha via Web Share API ou copia link para clipboard. */
  const handleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const backendBase = (import.meta as any).env?.VITE_API_URL || window.location.origin;
      const pdfUrl = `${backendBase}/rdos/${rdoId}/pdf`;

      if (navigator.share) {
        let shared = false;
        try {
          const blob = await fetchPdfBlob(false);
          const file = new File([blob], filenamePdf, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: rdoLabel,
              text: `Segue o ${rdoLabel} em anexo gerado pelo sistema OBRA 10.`,
              files: [file],
            });
            shared = true;
          }
        } catch (fileErr) {
          console.warn('[RdoShareBar] Fallback para URL:', fileErr);
        }
        if (!shared) {
          await navigator.share({
            title: rdoLabel,
            text: `Segue o ${rdoLabel} gerado pelo sistema OBRA 10.`,
            url: pdfUrl,
          });
        }
      } else {
        await navigator.clipboard.writeText(pdfUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[RdoShareBar] Erro ao compartilhar:', e);
      }
    } finally {
      setShareLoading(false);
    }
  };

  // ── Modo compacto: menu de 3 pontos ──────────────────────────────────────────
  if (compact) {
    return (
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-lunardeli-red transition-colors"
        >
          <MoreVertical size={20} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-52 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden divide-y divide-gray-50">
            <div className="py-1">
              {onOpen && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpen(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit size={15} className="text-gray-400" /> Abrir / Editar
                </button>
              )}
            </div>
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleDownloadPdf(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {pdfLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Download size={15} className="text-gray-400" />}
                Baixar PDF
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleDownloadComFotos(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {pdfFotosLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Image size={15} className="text-gray-400" />}
                Baixar com Fotos
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handlePrint(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer size={15} className="text-gray-400" /> Imprimir
              </button>
            </div>
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleShare(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {copied ? <CheckCircle size={15} className="text-green-500" /> : shareLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Share2 size={15} className="text-gray-400" />}
                {copied ? 'Link copiado!' : 'Compartilhar...'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Modo expandido ─────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2">
      {/* Download PDF simples */}
      <button
        id="rdo-download-pdf-btn"
        onClick={handleDownloadPdf}
        disabled={pdfLoading || pdfFotosLoading}
        title="Baixar PDF sem fotos"
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-lunardeli-red text-white text-sm font-bold rounded-xl hover:bg-red-700 active:bg-red-800 shadow-sm transition-colors disabled:opacity-60"
      >
        {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        <span className="hidden sm:inline">PDF</span>
      </button>

      {/* Download com Fotos */}
      <button
        id="rdo-download-pdf-fotos-btn"
        onClick={handleDownloadComFotos}
        disabled={pdfLoading || pdfFotosLoading}
        title="Baixar PDF com álbum fotográfico"
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
      >
        {pdfFotosLoading ? <Loader2 size={16} className="animate-spin text-gray-500" /> : <Image size={16} />}
        <span className="hidden sm:inline">+Fotos</span>
      </button>

      {/* Imprimir */}
      <button
        id="rdo-print-btn"
        onClick={handlePrint}
        disabled={pdfLoading}
        title="Imprimir RDO"
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
      >
        <Printer size={16} />
        <span className="hidden sm:inline">Imprimir</span>
      </button>

      {/* Compartilhar */}
      <button
        id="rdo-share-btn"
        onClick={handleShare}
        disabled={shareLoading}
        title={copied ? 'Link copiado!' : 'Compartilhar via WhatsApp, e-mail…'}
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
      >
        {copied
          ? <CheckCircle size={16} className="text-green-500" />
          : shareLoading
            ? <Loader2 size={16} className="animate-spin" />
            : <Share2 size={16} />}
        <span className="hidden sm:inline">
          {copied ? 'Copiado!' : 'Compartilhar'}
        </span>
      </button>
    </div>
  );
};

export default RdoShareBar;

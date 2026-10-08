import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Layers, Loader2, Minus, Plus, RotateCw, Ruler, Search, X } from 'lucide-react';
import api from '../../services/api';
import { OfficePreview } from './OfficePreview';

type Kind = 'pdf' | 'ifc' | 'dwg' | 'doc' | 'docx' | 'xls' | 'xlsx';

interface TabItem {
  id: string;
  name: string;
  file: File;
  kind: Kind;
}

interface IfcModel {
  id: string;
  name: string;
  visible: boolean;
}

const IFC_WORKSPACE = 'ifc-workspace';
const MODEL_COLORS = ['#E5192C', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2'];

interface PdfState {
  page: number;
  pages: number;
  zoom: number;
  matches: number;
  match: number;
  measuring?: boolean;
  measure?: string;
}

const PDF_LIMIT = 100 * 1024 * 1024;
const IFC_LIMIT = 300 * 1024 * 1024;
const DWG_LIMIT = 100 * 1024 * 1024;
const OFFICE_LIMIT = 30 * 1024 * 1024;
const OFFICE_KINDS = new Set<Kind>(['doc', 'docx', 'xls', 'xlsx']);
interface DwgState {
  zoom: number;
  measuring: boolean;
}

function extOf(name: string) {
  return (name.split('.').pop() || '').toLowerCase();
}

function kindOf(name: string): Kind | null {
  const ext = extOf(name);
  if (ext === 'docs') return 'docx';
  if (ext === 'pdf' || ext === 'ifc' || ext === 'dwg' || ext === 'doc' || ext === 'docx' || ext === 'xls' || ext === 'xlsx') return ext;
  return null;
}

async function readError(error: any) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const json = JSON.parse(text);
      return json.message || text;
    } catch {
      return text || 'Não foi possível converter o DWG.';
    }
  }
  return error?.response?.data?.message || error?.message || 'Não foi possível abrir o arquivo.';
}

export const Visualizador: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [ifcModels, setIfcModels] = useState<IfcModel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pdfState, setPdfState] = useState<PdfState>({ page: 1, pages: 0, zoom: 100, matches: 0, match: 0 });
  const [dwgState, setDwgState] = useState<DwgState>({ zoom: 100, measuring: false });
  const [query, setQuery] = useState('');
  const [officeText, setOfficeText] = useState('');
  const [officeSource, setOfficeSource] = useState<File | null>(null);
  const active = tabs.find((tab) => tab.id === activeId) || null;
  const ifcActive = activeId === IFC_WORKSPACE && ifcModels.length > 0;

  useEffect(() => {
    let dead = false;
    let viewer: any;
    const loadEngine = new Function(
      'specifier',
      'return import(specifier)',
    ) as (specifier: string) => Promise<{ mountViewer: (host: HTMLElement, hooks?: any) => any }>;
    loadEngine('/viewer/engine.js').then((mod) => {
      if (dead || !hostRef.current) return;
      viewer = mod.mountViewer(hostRef.current, {
        onStatus: ({ message, error }: { message: string; error?: boolean }) => {
          setNotice(message || '');
          setNoticeError(!!error);
        },
        onPdfState: (state: PdfState) => setPdfState(state),
        onDwgState: (state: DwgState) => setDwgState((prev) => ({ ...prev, ...state })),
      });
      viewerRef.current = viewer;
    }).catch((error) => {
      if (!dead) {
        setNotice(error?.message || 'Não foi possível carregar o visualizador.');
        setNoticeError(true);
      }
    });
    return () => {
      dead = true;
      viewer?.destroy();
      viewerRef.current = null;
    };
  }, []);

  const show = async (tab: TabItem) => {
    const viewer = viewerRef.current;
    if (!viewer) {
      setNotice('O visualizador ainda está carregando.');
      setNoticeError(true);
      return;
    }
    setBusy(true);
    setNotice(tab.kind === 'dwg' ? 'Lendo DWG no dispositivo…' : tab.kind === 'doc' ? `Lendo ${tab.name}…` : `Abrindo ${tab.name}…`);
    setNoticeError(false);
    try {
      if (OFFICE_KINDS.has(tab.kind)) {
        setOfficeSource(tab.kind === 'doc' || tab.kind === 'xls' ? null : tab.file);
        if (tab.kind === 'doc') {
          const form = new FormData();
          form.append('file', tab.file, tab.file.name);
          const response = await api.post('/visualizador/doc', form, { timeout: 60000 });
          setOfficeText(String(response.data?.text || ''));
          setNotice('Arquivo .doc antigo: o texto abre, mas a formatação completa fica no .docx.');
          setNoticeError(false);
        } else {
          setOfficeText('');
          setNotice('');
        }
        viewer.blank?.();
        setActiveId(tab.id);
        return;
      }
      await viewer.open(tab.file);
      if (tab.kind !== 'dwg') {
        viewer.setMeasureScale?.(null);
        setNotice('');
      }
      setActiveId(tab.id);
    } catch (error: any) {
      setNotice(await readError(error));
      setNoticeError(true);
    } finally {
      setBusy(false);
    }
  };

  const showIfcWorkspace = () => {
    const viewer = viewerRef.current;
    if (!viewer?.showIfc()) {
      setNotice('Abra um IFC para montar a compatibilização.');
      setNoticeError(true);
      return;
    }
    setActiveId(IFC_WORKSPACE);
    setNotice('Modelos sobrepostos no mesmo ambiente. Desmarque um modelo para ocultá-lo.');
    setNoticeError(false);
  };

  const addIfcModel = async (file: File): Promise<boolean> => {
    const viewer = viewerRef.current;
    if (!viewer) {
      setNotice('O visualizador ainda está carregando.');
      setNoticeError(true);
      return false;
    }
    const id = `${file.name}:${file.size}:${file.lastModified}`;
    if (ifcModels.some((model) => model.id === id)) {
      showIfcWorkspace();
      return true;
    }
    setBusy(true);
    setNotice(`Sobrepondo ${file.name}…`);
    setNoticeError(false);
    try {
      await viewer.addIfc(file, id);
      setIfcModels((prev) => prev.some((model) => model.id === id) ? prev : [...prev, { id, name: file.name, visible: true }]);
      setActiveId(IFC_WORKSPACE);
      setNotice('Modelos sobrepostos no mesmo ambiente. Desmarque um modelo para ocultá-lo.');
      setNoticeError(false);
      return true;
    } catch (error: any) {
      setNotice(await readError(error));
      setNoticeError(true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleIfc = (id: string) => {
    const model = ifcModels.find((item) => item.id === id);
    if (!model) return;
    const visible = !model.visible;
    viewerRef.current?.setIfcVisible(id, visible);
    setIfcModels((prev) => prev.map((item) => item.id === id ? { ...item, visible } : item));
  };

  const removeIfc = (id: string) => {
    viewerRef.current?.removeIfc(id);
    const next = ifcModels.filter((item) => item.id !== id);
    setIfcModels(next);
    if (!next.length && activeId === IFC_WORKSPACE) {
      const fallback = tabs[tabs.length - 1];
      if (fallback) show(fallback);
      else setActiveId(null);
    }
  };

  const addFiles = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    const nextTabs: TabItem[] = [];
    let stackedIfc = false;
    for (const file of incoming) {
      const kind = kindOf(file.name);
      if (!kind) {
        setNotice('Escolha um PDF, DWG, IFC, Word ou Excel.');
        setNoticeError(true);
        continue;
      }
      const limit = kind === 'ifc' ? IFC_LIMIT : kind === 'dwg' ? DWG_LIMIT : OFFICE_KINDS.has(kind) ? OFFICE_LIMIT : PDF_LIMIT;
      if (file.size > limit) {
        const mb = kind === 'ifc' ? 300 : OFFICE_KINDS.has(kind) ? 30 : 100;
        setNotice(`O limite para ${kind.toUpperCase()} é ${mb} MB.`);
        setNoticeError(true);
        continue;
      }
      if (kind === 'ifc') {
        if (await addIfcModel(file)) stackedIfc = true;
        continue;
      }
      const existing = tabs.find((tab) => tab.name === file.name && tab.file.size === file.size);
      if (existing) {
        await show(existing);
        continue;
      }
      nextTabs.push({
        id: `${Date.now()}-${file.name}-${file.size}`,
        name: file.name,
        file,
        kind,
      });
    }
    if (!nextTabs.length) return;
    setTabs((prev) => [...prev, ...nextTabs]);
    if (!stackedIfc) await show(nextTabs[0]);
  };

  const closeTab = (id: string) => {
    const next = tabs.filter((tab) => tab.id !== id);
    setTabs(next);
    if (activeId === id) {
      const fallback = next[next.length - 1];
      if (fallback) show(fallback);
      else if (ifcModels.length) showIfcWorkspace();
      else setActiveId(null);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-lunardeli-gray"
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-bold text-lunardeli-dark sm:text-lg">Visualizador de arquivos</h1>
          <p className="truncate text-xs text-gray-500">IFCs se sobrepõem. PDF, DWG, Word e Excel abrem em abas.</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-lunardeli-red px-3 py-2 text-sm font-semibold text-white"
        >
          <FolderOpen size={16} />
          Abrir arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.dwg,.ifc,.doc,.docx,.xls,.xlsx,application/pdf"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {(tabs.length > 0 || ifcModels.length > 0) && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
          {ifcModels.length > 0 && (
            <button
              type="button"
              onClick={showIfcWorkspace}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${ifcActive ? 'border-lunardeli-red bg-red-50 text-lunardeli-dark' : 'border-gray-200 bg-gray-50 text-lunardeli-dark'}`}
            >
              <Layers size={14} />
              Modelos IFC
              <span className="text-gray-500">{ifcModels.filter((model) => model.visible).length}/{ifcModels.length}</span>
            </button>
          )}
          {tabs.map((tab) => (
            <div key={tab.id} className={`flex shrink-0 items-center rounded-full border ${tab.id === activeId ? 'border-lunardeli-red bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <button type="button" onClick={() => show(tab)} className="max-w-[180px] truncate px-3 py-1 text-xs font-semibold text-lunardeli-dark">
                {tab.name}
              </button>
              <button type="button" aria-label={`Fechar ${tab.name}`} onClick={() => closeTab(tab.id)} className="pr-2 text-gray-500">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {ifcActive && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
          {ifcModels.map((model, index) => (
            <div key={model.id} className={`flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 text-xs ${model.visible ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-100 text-gray-400'}`}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={model.visible}
                  onChange={() => toggleIfc(model.id)}
                  aria-label={`Mostrar ${model.name}`}
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[index % MODEL_COLORS.length] }} />
                <span className="max-w-[160px] truncate font-semibold text-lunardeli-dark">{model.name}</span>
              </label>
              <button type="button" aria-label={`Remover ${model.name}`} onClick={() => removeIfc(model.id)} className="text-gray-500">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => viewerRef.current?.fit()} className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold">
            Ajustar
          </button>
        </div>
      )}

      {notice && (
        <div className={`shrink-0 px-3 py-2 text-xs sm:text-sm ${noticeError ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
          {notice}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {!active && !ifcActive && !busy && (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center ${dragOver ? 'bg-red-50/80' : ''}`}>
            <div>
              <p className="font-display text-lg font-bold text-lunardeli-dark">Abra um PDF, DWG, IFC, Word ou Excel</p>
              <p className="mt-2 max-w-md text-sm text-gray-600">
                O DWG abre como desenho vetorial, com layers e medição. IFCs entram juntos, um sobre o outro.
              </p>
            </div>
          </div>
        )}
        {active && OFFICE_KINDS.has(active.kind) && (
          <div className="absolute inset-0 z-[2] bg-white">
            <OfficePreview file={officeSource || active.file} kind={active.kind as 'doc' | 'docx' | 'xls' | 'xlsx'} text={officeText} />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-white">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}
      </div>

      {active?.kind === 'dwg' && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-3 py-2">
          <button type="button" aria-label="Diminuir" onClick={() => viewerRef.current?.zoom(0.8)} className="rounded-lg border border-gray-200 p-2"><Minus size={16} /></button>
          <button type="button" aria-label="Aumentar" onClick={() => viewerRef.current?.zoom(1.25)} className="rounded-lg border border-gray-200 p-2"><Plus size={16} /></button>
          <button type="button" onClick={() => viewerRef.current?.fit()} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">Ajustar</button>
          <button type="button" aria-label="Girar" onClick={() => viewerRef.current?.rotate()} className="rounded-lg border border-gray-200 p-2"><RotateCw size={16} /></button>
          <button
            type="button"
            aria-pressed={dwgState.measuring}
            onClick={() => viewerRef.current?.toggleMeasure()}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${dwgState.measuring ? 'border-lunardeli-red bg-red-50 text-lunardeli-dark' : 'border-gray-200'}`}
          >
            <Ruler size={16} />
            Medir
          </button>
          <button type="button" onClick={() => viewerRef.current?.openLayers()} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">
            <Layers size={16} />
            Layers
          </button>
          <button type="button" onClick={() => viewerRef.current?.toggleBackground()} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">Fundo</button>
          <span className="text-xs text-gray-500">{dwgState.zoom || 100}%</span>
        </div>
      )}

      {active?.kind === 'pdf' && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-3 py-2">
          <button type="button" aria-label="Diminuir" onClick={() => viewerRef.current?.zoom(0.8)} className="rounded-lg border border-gray-200 p-2"><Minus size={16} /></button>
          <button type="button" aria-label="Aumentar" onClick={() => viewerRef.current?.zoom(1.25)} className="rounded-lg border border-gray-200 p-2"><Plus size={16} /></button>
          <button type="button" onClick={() => viewerRef.current?.fit()} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">Ajustar</button>
          <button type="button" aria-label="Girar" onClick={() => viewerRef.current?.rotate()} className="rounded-lg border border-gray-200 p-2"><RotateCw size={16} /></button>
          <button
            type="button"
            aria-pressed={!!pdfState.measuring}
            onClick={() => viewerRef.current?.toggleMeasure()}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${pdfState.measuring ? 'border-lunardeli-red bg-red-50 text-lunardeli-dark' : 'border-gray-200'}`}
          >
            <Ruler size={16} />
            Medir
          </button>
          {pdfState.measure ? <span className="text-xs font-semibold text-lunardeli-dark">{pdfState.measure}</span> : pdfState.measuring ? <span className="text-xs text-gray-500">Toque em dois pontos.</span> : null}
          <span className="text-xs text-gray-500">{pdfState.zoom || 100}%</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Página anterior" onClick={() => viewerRef.current?.go((pdfState.page || 1) - 1)} className="rounded-lg border border-gray-200 px-2 py-1 text-sm">‹</button>
            <input
              type="number"
              min={1}
              max={pdfState.pages || 1}
              value={pdfState.page || 1}
              aria-label="Número da página"
              onChange={(event) => viewerRef.current?.go(event.target.value)}
              className="w-14 rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
            <span className="text-xs text-gray-500">/ {pdfState.pages || 1}</span>
            <button type="button" aria-label="Próxima página" onClick={() => viewerRef.current?.go((pdfState.page || 1) + 1)} className="rounded-lg border border-gray-200 px-2 py-1 text-sm">›</button>
          </div>
          <form
            className="flex min-w-[180px] flex-1 items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              viewerRef.current?.search(query);
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar no PDF"
              aria-label="Texto para buscar"
              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
            <button type="submit" aria-label="Buscar" className="rounded-lg border border-gray-200 p-2"><Search size={16} /></button>
          </form>
          {pdfState.matches > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <button type="button" onClick={() => viewerRef.current?.nextMatch(-1)} className="rounded border px-2 py-1">↑</button>
              <span>{pdfState.match}/{pdfState.matches}</span>
              <button type="button" onClick={() => viewerRef.current?.nextMatch(1)} className="rounded border px-2 py-1">↓</button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-lunardeli-red text-white shadow-lg md:hidden"
        aria-label="Abrir arquivo"
      >
        <FolderOpen size={22} />
      </button>
    </div>
  );
};

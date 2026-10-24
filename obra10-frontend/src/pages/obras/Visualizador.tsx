import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Layers, Loader2, Minus, Plus, RotateCw, Ruler, Search, X } from 'lucide-react';
import { APP_VERSION } from '../../appVersion';
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
  color?: string | null;
}

const IFC_WORKSPACE = 'ifc-workspace';

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
    loadEngine(`/viewer/engine.js?v=${encodeURIComponent(APP_VERSION)}`).then((mod) => {
      if (dead || !hostRef.current) return;
      viewer = mod.mountViewer(hostRef.current, {
        onStatus: ({ message, error }: { message: string; error?: boolean }) => {
          setNotice(message || '');
          setNoticeError(!!error);
        },
        onPdfState: (state: PdfState) => setPdfState(state),
        onDwgState: (state: DwgState) => setDwgState((prev) => ({ ...prev, ...state })),
        onIfcModels: (models: IfcModel[]) => {
          setIfcModels((prev) => models.map((model) => {
            const current = prev.find((item) => item.id === model.id);
            return { ...model, name: current?.name || model.name };
          }));
          if (!models.length) {
            setActiveId((current) => current === IFC_WORKSPACE ? null : current);
          }
        },
        onWalk: ({ active, placing }: { active: boolean; placing: boolean; through: boolean }) => {
          if (placing) {
            setNotice('Toque no piso para começar a caminhar.');
            setNoticeError(false);
          } else if (active) {
            setNotice('Caminhando: arraste para olhar, use o círculo ou W A S D. Esc ou Sair volta à órbita.');
            setNoticeError(false);
          } else {
            setNotice('');
          }
        },
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
      setIfcModels((prev) => prev.some((model) => model.id === id) ? prev : [...prev, { id, name: file.name, visible: true, color: null }]);
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

  const toolBtn = (activeBtn?: boolean) =>
    `inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
      activeBtn
        ? 'border-[#e5c46d] bg-[#24523d] text-[#ffe49a]'
        : 'border-[#355544] bg-[#16392c] text-[#edf5ef]'
    }`;
  const iconBtn = 'rounded-lg border border-[#355544] bg-[#16392c] p-2 text-[#edf5ef]';

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-[#172334]"
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
      <div ref={hostRef} className="absolute inset-0" />

      {!active && !ifcActive && !busy && (
        <div className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center p-6 text-center ${dragOver ? 'bg-[#E5192C]/15' : ''}`}>
          <div>
            <p className="font-display text-lg font-bold text-[#edf5ef]">Abra um PDF, DWG, IFC, Word ou Excel</p>
            <p className="mt-2 max-w-md text-sm text-[#b8cbb9]">
              O DWG abre como desenho vetorial, com layers e medição. IFCs entram juntos, com cor, corte, nível e caminhar.
            </p>
          </div>
        </div>
      )}

      <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2 ${ifcActive ? 'pl-[132px]' : ''}`}>
        {(tabs.length > 0 || ifcModels.length > 0) && (
          <div className="pointer-events-auto flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {ifcModels.length > 0 && (
              <button
                type="button"
                onClick={showIfcWorkspace}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  ifcActive
                    ? 'border-[#e5c46d] bg-[#16392c] text-[#ffe49a]'
                    : 'border-[#355544] bg-[#102c21]/90 text-[#edf5ef]'
                }`}
              >
                <Layers size={14} />
                Modelos IFC
                <span className="text-[#b8cbb9]">{ifcModels.filter((model) => model.visible).length}/{ifcModels.length}</span>
              </button>
            )}
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex shrink-0 items-center rounded-full border ${
                  tab.id === activeId
                    ? 'border-[#e5c46d] bg-[#16392c]'
                    : 'border-[#355544] bg-[#102c21]/90'
                }`}
              >
                <button type="button" onClick={() => show(tab)} className="max-w-[180px] truncate px-3 py-1 text-xs font-semibold text-[#edf5ef]">
                  {tab.name}
                </button>
                <button type="button" aria-label={`Fechar ${tab.name}`} onClick={() => closeTab(tab.id)} className="pr-2 text-[#b8cbb9]">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="pointer-events-auto ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg bg-lunardeli-red px-3 py-2 text-sm font-semibold text-white shadow-lg"
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

      {notice && (
        <div className={`pointer-events-none absolute inset-x-0 top-14 z-20 mx-2 rounded-lg px-3 py-2 text-xs sm:text-sm ${noticeError ? 'bg-red-950/90 text-red-100' : 'bg-[#102c21]/90 text-[#ffe49a]'}`}>
          {notice}
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

      {active?.kind === 'dwg' && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 bg-[#102c21]/95 px-3 py-2 text-[#edf5ef]">
          <button type="button" aria-label="Diminuir" onClick={() => viewerRef.current?.zoom(0.8)} className={iconBtn}><Minus size={16} /></button>
          <button type="button" aria-label="Aumentar" onClick={() => viewerRef.current?.zoom(1.25)} className={iconBtn}><Plus size={16} /></button>
          <button type="button" onClick={() => viewerRef.current?.fit()} className={toolBtn()}>Ajustar</button>
          <button type="button" aria-label="Girar" onClick={() => viewerRef.current?.rotate()} className={iconBtn}><RotateCw size={16} /></button>
          <button
            type="button"
            aria-pressed={dwgState.measuring}
            onClick={() => viewerRef.current?.toggleMeasure()}
            className={toolBtn(dwgState.measuring)}
          >
            <Ruler size={16} />
            Medir
          </button>
          <button type="button" onClick={() => viewerRef.current?.openLayers()} className={toolBtn()}>
            <Layers size={16} />
            Layers
          </button>
          <button type="button" onClick={() => viewerRef.current?.toggleBackground()} className={toolBtn()}>Fundo</button>
          <span className="text-xs text-[#b8cbb9]">{dwgState.zoom || 100}%</span>
        </div>
      )}

      {active?.kind === 'pdf' && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 bg-[#102c21]/95 px-3 py-2 text-[#edf5ef]">
          <button type="button" aria-label="Diminuir" onClick={() => viewerRef.current?.zoom(0.8)} className={iconBtn}><Minus size={16} /></button>
          <button type="button" aria-label="Aumentar" onClick={() => viewerRef.current?.zoom(1.25)} className={iconBtn}><Plus size={16} /></button>
          <button type="button" onClick={() => viewerRef.current?.fit()} className={toolBtn()}>Ajustar</button>
          <button type="button" aria-label="Girar" onClick={() => viewerRef.current?.rotate()} className={iconBtn}><RotateCw size={16} /></button>
          <button
            type="button"
            aria-pressed={!!pdfState.measuring}
            onClick={() => viewerRef.current?.toggleMeasure()}
            className={toolBtn(!!pdfState.measuring)}
          >
            <Ruler size={16} />
            Medir
          </button>
          {pdfState.measure ? <span className="text-xs font-semibold text-[#ffe49a]">{pdfState.measure}</span> : pdfState.measuring ? <span className="text-xs text-[#b8cbb9]">Toque em dois pontos.</span> : null}
          <span className="text-xs text-[#b8cbb9]">{pdfState.zoom || 100}%</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Página anterior" onClick={() => viewerRef.current?.go((pdfState.page || 1) - 1)} className="rounded-lg border border-[#355544] bg-[#16392c] px-2 py-1 text-sm">‹</button>
            <input
              type="number"
              min={1}
              max={pdfState.pages || 1}
              value={pdfState.page || 1}
              aria-label="Número da página"
              onChange={(event) => viewerRef.current?.go(event.target.value)}
              className="w-14 rounded-lg border border-[#355544] bg-[#0a2018] px-2 py-1 text-sm text-[#edf5ef]"
            />
            <span className="text-xs text-[#b8cbb9]">/ {pdfState.pages || 1}</span>
            <button type="button" aria-label="Próxima página" onClick={() => viewerRef.current?.go((pdfState.page || 1) + 1)} className="rounded-lg border border-[#355544] bg-[#16392c] px-2 py-1 text-sm">›</button>
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
              className="w-full rounded-lg border border-[#355544] bg-[#0a2018] px-2 py-1 text-sm text-[#edf5ef] placeholder:text-[#81a384]"
            />
            <button type="submit" aria-label="Buscar" className={iconBtn}><Search size={16} /></button>
          </form>
          {pdfState.matches > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <button type="button" onClick={() => viewerRef.current?.nextMatch(-1)} className="rounded border border-[#355544] px-2 py-1">↑</button>
              <span>{pdfState.match}/{pdfState.matches}</span>
              <button type="button" onClick={() => viewerRef.current?.nextMatch(1)} className="rounded border border-[#355544] px-2 py-1">↓</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Eraser, PenLine, Type, Undo2 } from 'lucide-react';
import { IMAGE_COMPRESS_QUALITY } from '../utils/mediaLimits';

export type AnnotateTool = 'pen' | 'arrow' | 'text';

const COLORS = [
  { id: 'red', value: '#E5192C', label: 'Vermelho' },
  { id: 'yellow', value: '#FACC15', label: 'Amarelo' },
  { id: 'white', value: '#FFFFFF', label: 'Branco' },
] as const;

type Point = { x: number; y: number };

type StrokeShape = { kind: 'stroke'; color: string; width: number; points: Point[] };
type ArrowShape = { kind: 'arrow'; color: string; width: number; from: Point; to: Point };
type TextShape = { kind: 'text'; color: string; x: number; y: number; text: string; fontSize: number };
type Shape = StrokeShape | ArrowShape | TextShape;

interface PhotoAnnotateModalProps {
  file: File;
  index: number;
  total: number;
  skipLabel?: string;
  saveLabel?: string;
  onSkip: () => void;
  onSave: (file: File) => void | Promise<void>;
}

function strokeWidthFor(imgW: number) {
  return Math.max(6, Math.round(imgW * 0.007));
}

function fontSizeFor(imgW: number) {
  return Math.max(22, Math.round(imgW * 0.032));
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = Math.max(width * 4.2, 18);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - head * Math.cos(angle - Math.PI / 6),
    to.y - head * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - head * Math.cos(angle + Math.PI / 6),
    to.y - head * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function paintShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (shape.kind === 'stroke') {
    if (shape.points.length < 2) {
      ctx.restore();
      return;
    }
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
  } else if (shape.kind === 'arrow') {
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.beginPath();
    ctx.moveTo(shape.from.x, shape.from.y);
    ctx.lineTo(shape.to.x, shape.to.y);
    ctx.stroke();
    drawArrowHead(ctx, shape.from, shape.to, shape.width);
  } else {
    ctx.font = `700 ${shape.fontSize}px Inter, system-ui, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(3, Math.round(shape.fontSize * 0.12));
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.fillStyle = shape.color;
    ctx.strokeText(shape.text, shape.x, shape.y);
    ctx.fillText(shape.text, shape.x, shape.y);
  }
  ctx.restore();
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a foto.'));
    };
    img.src = url;
  });
}

async function bakeToJpeg(img: HTMLImageElement, shapes: Shape[], original: File): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0);
  for (const shape of shapes) paintShape(ctx, shape);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', IMAGE_COMPRESS_QUALITY),
  );
  if (!blob || blob.size === 0) return original;
  const base = (original.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

export const PhotoAnnotateModal: React.FC<PhotoAnnotateModalProps> = ({
  file,
  index,
  total,
  skipLabel = 'Usar sem marcar',
  saveLabel = 'Salvar marcações',
  onSkip,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const shapesRef = useRef<Shape[]>([]);
  const liveRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<AnnotateTool>('pen');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  toolRef.current = tool;
  colorRef.current = color;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const shape of shapesRef.current) paintShape(ctx, shape);
    if (liveRef.current) paintShape(ctx, liveRef.current);
  }, []);

  useEffect(() => {
    shapesRef.current = shapes;
    redraw();
  }, [shapes, redraw]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const img = await loadImage(file);
        if (cancelled) return;
        imgRef.current = img;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const fit = () => {
          const wrap = canvas.parentElement;
          if (!wrap || !img.naturalWidth) return;
          const scale = Math.min(
            wrap.clientWidth / img.naturalWidth,
            wrap.clientHeight / img.naturalHeight,
            1,
          );
          canvas.style.width = `${Math.max(1, Math.round(img.naturalWidth * scale))}px`;
          canvas.style.height = `${Math.max(1, Math.round(img.naturalHeight * scale))}px`;
        };
        fit();
        const wrap = canvas.parentElement;
        if (wrap && typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(fit);
          ro.observe(wrap);
        }
        redraw();
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || 'Não foi possível abrir a foto.');
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [file, redraw]);

  const toImagePoint = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || loadError) return;
    const pt = toImagePoint(e);
    if (!pt) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const imgW = canvasRef.current?.width || 1080;
    const width = strokeWidthFor(imgW);

    if (toolRef.current === 'text') {
      setTextDraft(pt);
      setTextValue('');
      window.setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    drawingRef.current = true;
    if (toolRef.current === 'pen') {
      liveRef.current = { kind: 'stroke', color: colorRef.current, width, points: [pt] };
    } else {
      liveRef.current = { kind: 'arrow', color: colorRef.current, width, from: pt, to: pt };
    }
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !liveRef.current) return;
    const pt = toImagePoint(e);
    if (!pt) return;
    e.preventDefault();
    const live = liveRef.current;
    if (live.kind === 'stroke') {
      const last = live.points[live.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return;
      live.points.push(pt);
    } else if (live.kind === 'arrow') {
      live.to = pt;
    }
    redraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    const live = liveRef.current;
    liveRef.current = null;
    if (!live) return;
    if (live.kind === 'stroke' && live.points.length < 2) {
      redraw();
      return;
    }
    if (live.kind === 'arrow') {
      const len = Math.hypot(live.to.x - live.from.x, live.to.y - live.from.y);
      if (len < 12) {
        redraw();
        return;
      }
    }
    setShapes((prev) => [...prev, live]);
  };

  const confirmText = () => {
    const trimmed = textValue.trim();
    if (!textDraft || !trimmed) {
      setTextDraft(null);
      setTextValue('');
      return;
    }
    const imgW = canvasRef.current?.width || 1080;
    setShapes((prev) => [
      ...prev,
      {
        kind: 'text',
        color,
        x: textDraft.x,
        y: textDraft.y,
        text: trimmed,
        fontSize: fontSizeFor(imgW),
      },
    ]);
    setTextDraft(null);
    setTextValue('');
  };

  const handleSave = async () => {
    if (busy) return;
    const img = imgRef.current;
    if (!img || shapes.length === 0) {
      onSkip();
      return;
    }
    setBusy(true);
    try {
      const baked = await bakeToJpeg(img, shapes, file);
      await onSave(baked);
    } catch (err) {
      console.error('Falha ao gravar marcações:', err);
      onSkip();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Marcar foto">
      <header className="flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div>
          <p className="text-sm font-bold leading-tight">Marcar foto</p>
          <p className="text-[11px] text-white/60">
            {total > 1 ? `${index + 1} de ${total}` : 'Risco, seta ou texto antes de salvar'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShapes((prev) => prev.slice(0, -1))}
            disabled={shapes.length === 0 || busy}
            className="p-2 rounded-lg disabled:opacity-30"
            aria-label="Desfazer"
          >
            <Undo2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => { setShapes([]); setTextDraft(null); setTextValue(''); }}
            disabled={shapes.length === 0 || busy}
            className="p-2 rounded-lg disabled:opacity-30"
            aria-label="Limpar"
          >
            <Eraser size={20} />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-3 pb-2 overflow-x-auto">
        {([
          { id: 'pen' as const, label: 'Risco', icon: PenLine },
          { id: 'arrow' as const, label: 'Seta', icon: ArrowUpRight },
          { id: 'text' as const, label: 'Texto', icon: Type },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTool(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
              tool === item.id ? 'bg-lunardeli-red text-white' : 'bg-white/10 text-white/80'
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.value)}
              aria-label={c.label}
              className={`h-7 w-7 rounded-full border-2 ${
                color === c.value ? 'border-white scale-110' : 'border-white/30'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-zinc-950 px-2">
        {loadError ? (
          <p className="text-sm text-white/80 text-center px-6">{loadError}</p>
        ) : (
          <canvas
            ref={canvasRef}
            className="block"
            style={{ touchAction: 'none', maxWidth: '100%', maxHeight: '100%' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
      </div>

      {textDraft && (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-white/10">
          <input
            ref={textInputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmText();
              if (e.key === 'Escape') { setTextDraft(null); setTextValue(''); }
            }}
            placeholder="Escreva e toque em OK"
            className="flex-1 min-w-0 rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/40"
            maxLength={80}
          />
          <button
            type="button"
            onClick={confirmText}
            className="shrink-0 bg-lunardeli-red px-3 py-2 rounded-lg text-xs font-bold"
          >
            OK
          </button>
        </div>
      )}

      <footer className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-zinc-900">
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/10 disabled:opacity-50"
        >
          {skipLabel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !!loadError}
          className="flex-1 py-3 rounded-xl text-sm font-bold bg-lunardeli-red disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Check size={16} />
          {busy ? 'Salvando…' : saveLabel}
        </button>
      </footer>
    </div>
  );
};

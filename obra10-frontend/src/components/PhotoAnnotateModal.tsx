import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Circle, Eraser, PenLine, Type, Undo2 } from 'lucide-react';
import { IMAGE_COMPRESS_QUALITY } from '../utils/mediaLimits';

export type AnnotateTool = 'pen' | 'arrow' | 'circle' | 'text';
export type SizeId = 's' | 'm' | 'l' | 'xl';

const COLORS = [
  { id: 'red', value: '#E5192C', label: 'Vermelho' },
  { id: 'yellow', value: '#FACC15', label: 'Amarelo' },
  { id: 'white', value: '#FFFFFF', label: 'Branco' },
] as const;

const SIZE_PRESETS: { id: SizeId; label: string; strokeMul: number; fontMul: number }[] = [
  { id: 's', label: 'Fino', strokeMul: 0.55, fontMul: 0.72 },
  { id: 'm', label: 'Médio', strokeMul: 1, fontMul: 1 },
  { id: 'l', label: 'Grosso', strokeMul: 1.75, fontMul: 1.4 },
  { id: 'xl', label: 'Extra', strokeMul: 2.7, fontMul: 1.9 },
];

type Point = { x: number; y: number };

type StrokeShape = { kind: 'stroke'; color: string; width: number; points: Point[] };
type ArrowShape = { kind: 'arrow'; color: string; width: number; from: Point; to: Point };
type CircleShape = { kind: 'circle'; color: string; width: number; cx: number; cy: number; r: number };
type TextShape = { kind: 'text'; color: string; x: number; y: number; text: string; fontSize: number };
type Shape = StrokeShape | ArrowShape | CircleShape | TextShape;

interface PhotoAnnotateModalProps {
  file: File;
  index: number;
  total: number;
  skipLabel?: string;
  saveLabel?: string;
  onSkip: () => void;
  onSave: (file: File) => void | Promise<void>;
}

function sizePreset(id: SizeId) {
  return SIZE_PRESETS.find((s) => s.id === id) || SIZE_PRESETS[1];
}

function strokeWidthFor(imgW: number, size: SizeId) {
  return Math.max(4, Math.round(imgW * 0.007 * sizePreset(size).strokeMul));
}

function fontSizeFor(imgW: number, size: SizeId) {
  return Math.max(16, Math.round(imgW * 0.032 * sizePreset(size).fontMul));
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
  } else if (shape.kind === 'circle') {
    if (shape.r < 2) {
      ctx.restore();
      return;
    }
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.beginPath();
    ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    ctx.stroke();
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

function shapeBounds(ctx: CanvasRenderingContext2D, shape: Shape): { x: number; y: number; w: number; h: number } {
  const pad = 14;
  if (shape.kind === 'stroke') {
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
  }
  if (shape.kind === 'arrow') {
    const x = Math.min(shape.from.x, shape.to.x) - pad;
    const y = Math.min(shape.from.y, shape.to.y) - pad;
    return {
      x,
      y,
      w: Math.abs(shape.to.x - shape.from.x) + pad * 2,
      h: Math.abs(shape.to.y - shape.from.y) + pad * 2,
    };
  }
  if (shape.kind === 'circle') {
    return {
      x: shape.cx - shape.r - pad,
      y: shape.cy - shape.r - pad,
      w: shape.r * 2 + pad * 2,
      h: shape.r * 2 + pad * 2,
    };
  }
  ctx.save();
  ctx.font = `700 ${shape.fontSize}px Inter, system-ui, sans-serif`;
  const w = ctx.measureText(shape.text).width;
  ctx.restore();
  return {
    x: shape.x - 8,
    y: shape.y - shape.fontSize - 6,
    w: w + 16,
    h: shape.fontSize * 1.35 + 12,
  };
}

function paintSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
  const b = shapeBounds(ctx, shape);
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

function distPointSeg(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitTest(ctx: CanvasRenderingContext2D, shape: Shape, pt: Point, slop: number): boolean {
  if (shape.kind === 'stroke') {
    for (let i = 1; i < shape.points.length; i++) {
      if (distPointSeg(pt, shape.points[i - 1], shape.points[i]) <= slop + shape.width) return true;
    }
    return false;
  }
  if (shape.kind === 'arrow') {
    return distPointSeg(pt, shape.from, shape.to) <= slop + shape.width * 1.6;
  }
  if (shape.kind === 'circle') {
    const d = Math.hypot(pt.x - shape.cx, pt.y - shape.cy);
    return Math.abs(d - shape.r) <= slop + shape.width || d <= shape.r;
  }
  const b = shapeBounds(ctx, shape);
  return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
}

function hitIndex(ctx: CanvasRenderingContext2D, shapes: Shape[], pt: Point, slop: number): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTest(ctx, shapes[i], pt, slop)) return i;
  }
  return -1;
}

function translateShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.kind === 'stroke') {
    return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (shape.kind === 'arrow') {
    return {
      ...shape,
      from: { x: shape.from.x + dx, y: shape.from.y + dy },
      to: { x: shape.to.x + dx, y: shape.to.y + dy },
    };
  }
  if (shape.kind === 'circle') {
    return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
  }
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

function applySizeToShape(shape: Shape, imgW: number, size: SizeId): Shape {
  if (shape.kind === 'text') return { ...shape, fontSize: fontSizeFor(imgW, size) };
  return { ...shape, width: strokeWidthFor(imgW, size) };
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
  const movingRef = useRef<{ index: number; last: Point } | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tool, setTool] = useState<AnnotateTool>('pen');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [size, setSize] = useState<SizeId>('m');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;
  selectedRef.current = selected;

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
    const sel = selectedRef.current;
    if (sel != null && shapesRef.current[sel] && !liveRef.current) {
      paintSelection(ctx, shapesRef.current[sel]);
    }
  }, []);

  useEffect(() => {
    shapesRef.current = shapes;
    redraw();
  }, [shapes, selected, redraw]);

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

  const touchSlop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return 28;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return 28;
    return (36 * canvas.width) / rect.width;
  };

  const commitShapes = (next: Shape[], select?: number | null) => {
    shapesRef.current = next;
    setShapes(next);
    selectedRef.current = select === undefined ? selectedRef.current : select;
    setSelected(select === undefined ? selected : select);
    redraw();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || loadError) return;
    const pt = toImagePoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!pt || !ctx) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const hit = hitIndex(ctx, shapesRef.current, pt, touchSlop());
    if (hit >= 0) {
      drawingRef.current = false;
      liveRef.current = null;
      movingRef.current = { index: hit, last: pt };
      selectedRef.current = hit;
      setSelected(hit);
      redraw();
      return;
    }

    selectedRef.current = null;
    setSelected(null);
    const imgW = canvas?.width || 1080;
    const width = strokeWidthFor(imgW, sizeRef.current);

    if (toolRef.current === 'text') {
      setTextDraft(pt);
      setTextValue('');
      window.setTimeout(() => textInputRef.current?.focus(), 50);
      redraw();
      return;
    }

    drawingRef.current = true;
    if (toolRef.current === 'pen') {
      liveRef.current = { kind: 'stroke', color: colorRef.current, width, points: [pt] };
    } else if (toolRef.current === 'circle') {
      liveRef.current = { kind: 'circle', color: colorRef.current, width, cx: pt.x, cy: pt.y, r: 0 };
    } else {
      liveRef.current = { kind: 'arrow', color: colorRef.current, width, from: pt, to: pt };
    }
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toImagePoint(e);
    if (!pt) return;
    e.preventDefault();

    const moving = movingRef.current;
    if (moving) {
      const dx = pt.x - moving.last.x;
      const dy = pt.y - moving.last.y;
      if (dx === 0 && dy === 0) return;
      const next = shapesRef.current.map((shape, i) =>
        i === moving.index ? translateShape(shape, dx, dy) : shape,
      );
      shapesRef.current = next;
      movingRef.current = { index: moving.index, last: pt };
      redraw();
      return;
    }

    if (!drawingRef.current || !liveRef.current) return;
    const live = liveRef.current;
    if (live.kind === 'stroke') {
      const last = live.points[live.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return;
      live.points.push(pt);
    } else if (live.kind === 'arrow') {
      live.to = pt;
    } else if (live.kind === 'circle') {
      live.r = Math.max(0, Math.hypot(pt.x - live.cx, pt.y - live.cy));
    }
    redraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (movingRef.current) {
      const idx = movingRef.current.index;
      movingRef.current = null;
      commitShapes([...shapesRef.current], idx);
      return;
    }
    if (!drawingRef.current) return;
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
    if (live.kind === 'circle' && live.r < 10) {
      redraw();
      return;
    }
    const next = [...shapesRef.current, live];
    commitShapes(next, next.length - 1);
  };

  const confirmText = () => {
    const trimmed = textValue.trim();
    if (!textDraft || !trimmed) {
      setTextDraft(null);
      setTextValue('');
      return;
    }
    const imgW = canvasRef.current?.width || 1080;
    const shape: TextShape = {
      kind: 'text',
      color,
      x: textDraft.x,
      y: textDraft.y,
      text: trimmed,
      fontSize: fontSizeFor(imgW, size),
    };
    const next = [...shapesRef.current, shape];
    setTextDraft(null);
    setTextValue('');
    commitShapes(next, next.length - 1);
  };

  const changeSize = (nextSize: SizeId) => {
    setSize(nextSize);
    const idx = selectedRef.current;
    const imgW = canvasRef.current?.width || 1080;
    if (idx == null || !shapesRef.current[idx]) return;
    const next = shapesRef.current.map((shape, i) =>
      i === idx ? applySizeToShape(shape, imgW, nextSize) : shape,
    );
    commitShapes(next, idx);
  };

  const changeColor = (nextColor: string) => {
    setColor(nextColor);
    const idx = selectedRef.current;
    if (idx == null || !shapesRef.current[idx]) return;
    const next = shapesRef.current.map((shape, i) =>
      i === idx ? { ...shape, color: nextColor } : shape,
    );
    commitShapes(next, idx);
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
      const baked = await bakeToJpeg(img, shapesRef.current, file);
      await onSave(baked);
    } catch (err) {
      console.error('Falha ao gravar marcações:', err);
      onSkip();
    } finally {
      setBusy(false);
    }
  };

  const selectedKind = selected != null ? shapes[selected]?.kind : null;

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Marcar foto">
      <header className="flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div>
          <p className="text-sm font-bold leading-tight">Marcar foto</p>
          <p className="text-[11px] text-white/60">
            {total > 1
              ? `${index + 1} de ${total}`
              : selectedKind
                ? 'Arraste para mover · mude a espessura abaixo'
                : 'Risco, seta, círculo ou texto'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const next = shapesRef.current.slice(0, -1);
              commitShapes(next, next.length ? next.length - 1 : null);
            }}
            disabled={shapes.length === 0 || busy}
            className="p-2 rounded-lg disabled:opacity-30"
            aria-label="Desfazer"
          >
            <Undo2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              setTextDraft(null);
              setTextValue('');
              commitShapes([], null);
            }}
            disabled={shapes.length === 0 || busy}
            className="p-2 rounded-lg disabled:opacity-30"
            aria-label="Limpar"
          >
            <Eraser size={20} />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-3 pb-1.5 overflow-x-auto">
        {([
          { id: 'pen' as const, label: 'Risco', icon: PenLine },
          { id: 'arrow' as const, label: 'Seta', icon: ArrowUpRight },
          { id: 'circle' as const, label: 'Círculo', icon: Circle },
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
              onClick={() => changeColor(c.value)}
              aria-label={c.label}
              className={`h-7 w-7 rounded-full border-2 ${
                color === c.value ? 'border-white scale-110' : 'border-white/30'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wide text-white/45 shrink-0">
          {selectedKind === 'text' || tool === 'text' ? 'Altura' : 'Espessura'}
        </span>
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => changeSize(preset.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
              size === preset.id ? 'bg-white text-black' : 'bg-white/10 text-white/80'
            }`}
          >
            {preset.label}
          </button>
        ))}
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

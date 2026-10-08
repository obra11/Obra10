import type { CSSProperties } from 'react';
import * as XLSX from 'xlsx';

export interface TextRun {
  text: string;
  style: CSSProperties;
}

export interface SheetCell {
  text: string;
  runs?: TextRun[];
  style: CSSProperties;
  colSpan?: number;
  rowSpan?: number;
  skip?: boolean;
}

export interface SheetView {
  name: string;
  rows: SheetCell[][];
  widths: number[];
  rowHeights: Array<number | undefined>;
  truncated: boolean;
}

const ROW_CAP = 2000;
const COL_CAP = 80;

function argbToCss(argb?: string) {
  if (!argb) return undefined;
  const hex = argb.length >= 6 ? argb.slice(-6) : '';
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  if (argb.length === 8 && argb.slice(0, 2).toLowerCase() === '00') return undefined;
  return `#${hex}`;
}

function fontToStyle(font?: {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | string;
  strike?: boolean;
  color?: { argb?: string };
}): CSSProperties {
  const style: CSSProperties = {};
  if (!font) return style;
  if (font.name) style.fontFamily = `"${font.name}", Calibri, sans-serif`;
  if (font.size) style.fontSize = `${font.size}pt`;
  if (font.bold) style.fontWeight = 700;
  if (font.italic) style.fontStyle = 'italic';
  const color = argbToCss(font.color?.argb);
  if (color) style.color = color;
  const decoration = [font.underline ? 'underline' : '', font.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (decoration) style.textDecoration = decoration;
  return style;
}

function sideBorder(border?: { style?: string; color?: { argb?: string } }) {
  if (!border?.style) return undefined;
  const width = border.style === 'thick' ? '2.5px' : border.style === 'medium' ? '2px' : '1px';
  return `${width} solid ${argbToCss(border.color?.argb) || '#000000'}`;
}

function cellStyle(cell: {
  font?: Parameters<typeof fontToStyle>[0];
  fill?: { type?: string; pattern?: string; fgColor?: { argb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: { top?: { style?: string; color?: { argb?: string } }; right?: { style?: string; color?: { argb?: string } }; bottom?: { style?: string; color?: { argb?: string } }; left?: { style?: string; color?: { argb?: string } } };
}): CSSProperties {
  const style: CSSProperties = {
    ...fontToStyle(cell.font),
    whiteSpace: 'pre-wrap',
    verticalAlign: 'bottom',
    padding: '1px 4px',
    border: '1px solid #e6e8ec',
  };
  const fill = cell.fill;
  if (fill?.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
    const background = argbToCss(fill.fgColor?.argb);
    if (background) style.backgroundColor = background;
  }
  const horizontal = cell.alignment?.horizontal;
  if (horizontal === 'center' || horizontal === 'centerContinuous') style.textAlign = 'center';
  else if (horizontal === 'right') style.textAlign = 'right';
  else if (horizontal === 'left' || horizontal === 'justify') style.textAlign = horizontal;
  const vertical = cell.alignment?.vertical;
  if (vertical === 'top') style.verticalAlign = 'top';
  else if (vertical === 'center' || vertical === 'middle' || vertical === 'distributed') style.verticalAlign = 'middle';
  else if (vertical === 'bottom') style.verticalAlign = 'bottom';
  const border = cell.border;
  const top = sideBorder(border?.top);
  const right = sideBorder(border?.right);
  const bottom = sideBorder(border?.bottom);
  const left = sideBorder(border?.left);
  if (top) style.borderTop = top;
  if (right) style.borderRight = right;
  if (bottom) style.borderBottom = bottom;
  if (left) style.borderLeft = left;
  return style;
}

function decodeAddress(address: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]), column };
}

export async function readSheets(buffer: ArrayBuffer): Promise<SheetView[]> {
  try {
    return await readXlsx(buffer);
  } catch {
    return readLegacy(buffer);
  }
}

async function readXlsx(buffer: ArrayBuffer): Promise<SheetView[]> {
  const excel = await import('exceljs');
  const Workbook = excel.Workbook;
  const book = new Workbook();
  await book.xlsx.load(buffer);
  return book.worksheets.map((sheet) => {
    const rowCount = Math.min(sheet.rowCount || 0, ROW_CAP);
    const columnCount = Math.min(sheet.columnCount || 0, COL_CAP);
    const truncated = (sheet.rowCount || 0) > ROW_CAP || (sheet.columnCount || 0) > COL_CAP;
    const origin = new Map<string, { rowSpan: number; colSpan: number }>();
    const skip = new Set<string>();
    for (const range of sheet.model.merges || []) {
      const [start, end] = String(range).split(':');
      const from = decodeAddress(start);
      const to = end ? decodeAddress(end) : from;
      if (!from || !to) continue;
      origin.set(`${from.row}:${from.column}`, {
        rowSpan: to.row - from.row + 1,
        colSpan: to.column - from.column + 1,
      });
      for (let row = from.row; row <= to.row; row += 1) {
        for (let column = from.column; column <= to.column; column += 1) {
          if (row !== from.row || column !== from.column) skip.add(`${row}:${column}`);
        }
      }
    }
    const widths = Array.from({ length: columnCount }, (_, index) => {
      const column = sheet.getColumn(index + 1);
      if (column.hidden) return 0;
      const width = Number(column.width) || 10;
      return Math.max(24, Math.round(width * 8));
    });
    const rowHeights: Array<number | undefined> = [];
    const rows: SheetCell[][] = [];
    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      rowHeights.push(row.hidden ? 0 : row.height || undefined);
      const cells: SheetCell[] = [];
      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const key = `${rowIndex}:${columnIndex}`;
        if (skip.has(key)) {
          cells.push({ text: '', style: {}, skip: true });
          continue;
        }
        const cell = row.getCell(columnIndex);
        const value = cell.value as { richText?: { text?: string; font?: Parameters<typeof fontToStyle>[0] }[] } | null;
        const runs = value && typeof value === 'object' && Array.isArray(value.richText)
          ? value.richText.map((run) => ({ text: String(run.text || ''), style: fontToStyle(run.font) }))
          : undefined;
        const span = origin.get(key);
        cells.push({
          text: runs ? runs.map((run) => run.text).join('') : String(cell.text || ''),
          runs,
          style: cellStyle(cell),
          colSpan: span && span.colSpan > 1 ? span.colSpan : undefined,
          rowSpan: span && span.rowSpan > 1 ? span.rowSpan : undefined,
        });
      }
      rows.push(cells);
    }
    return { name: sheet.name, rows, widths, rowHeights, truncated };
  });
}

function readLegacy(buffer: ArrayBuffer): SheetView[] {
  const book = XLSX.read(buffer, { type: 'array', cellDates: true });
  return book.SheetNames.map((name) => {
    const grid = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(book.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
    });
    const rows = grid.slice(0, ROW_CAP).map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return cells.slice(0, COL_CAP).map((value) => ({
        text: value == null ? '' : String(value),
        style: {
          whiteSpace: 'pre-wrap' as const,
          padding: '2px 4px',
          border: '1px solid #e6e8ec',
          verticalAlign: 'bottom' as const,
        },
      }));
    });
    const width = Math.max(1, ...rows.map((row) => row.length));
    return {
      name,
      rows,
      widths: Array.from({ length: width }, () => 96),
      rowHeights: rows.map(() => undefined),
      truncated: grid.length > ROW_CAP || grid.some((row) => Array.isArray(row) && row.length > COL_CAP),
    };
  });
}

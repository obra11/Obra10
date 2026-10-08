import React, { useEffect, useState } from 'react';
import { readSheets, type SheetView } from './excelFormat';

type OfficeKind = 'doc' | 'docx' | 'xls' | 'xlsx';

interface OfficePreviewProps {
  file: File;
  kind: OfficeKind;
  text?: string;
}

function kindOfFile(file: File, fallback: OfficeKind): OfficeKind {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'doc' || ext === 'docx' || ext === 'xls' || ext === 'xlsx') return ext;
  return fallback;
}

export const OfficePreview: React.FC<OfficePreviewProps> = ({ file, kind, text }) => {
  const resolved = kindOfFile(file, kind);
  const [sheets, setSheets] = useState<SheetView[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [error, setError] = useState('');
  const [docxHost, setDocxHost] = useState<HTMLDivElement | null>(null);
  const [docxStyle, setDocxStyle] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (resolved !== 'xls' && resolved !== 'xlsx') return;
    let dead = false;
    setError('');
    setSheetIndex(0);
    setSheets([]);
    file.arrayBuffer().then(async (buffer) => {
      const next = await readSheets(buffer);
      if (!dead) setSheets(next);
    }).catch(() => {
      if (!dead) setError('Não foi possível ler a formatação desta planilha.');
    });
    return () => { dead = true; };
  }, [file, resolved]);

  useEffect(() => {
    if (resolved !== 'docx' || !docxHost || !docxStyle) return;
    let dead = false;
    setError('');
    docxHost.replaceChildren();
    docxStyle.replaceChildren();
    file.arrayBuffer().then(async (buffer) => {
      const { renderAsync } = await import('docx-preview');
      if (dead) return;
      await renderAsync(buffer, docxHost, docxStyle, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        ignoreFonts: false,
        ignoreWidth: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
      });
    }).catch(() => {
      if (!dead) setError('Não foi possível abrir este documento com a formatação original.');
    });
    return () => { dead = true; };
  }, [file, resolved, docxHost, docxStyle]);

  if (error) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-red-800">{error}</div>;
  }

  if (resolved === 'doc') {
    return (
      <article className="h-full overflow-auto bg-white p-4 sm:p-8">
        <p className="mb-4 text-xs text-gray-500">Não foi possível preservar a formatação deste .doc neste computador.</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-lunardeli-dark">{text || 'Lendo o documento…'}</pre>
      </article>
    );
  }

  if (resolved === 'docx') {
    return (
      <div className="office-docx h-full overflow-auto bg-[#f3f4f6]">
        <style>{`
          .office-docx .docx-wrapper { background: #f3f4f6; padding: 16px; }
          .office-docx .docx { margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
          .office-docx .docx table { border-collapse: collapse; }
        `}</style>
        <div ref={setDocxStyle} />
        <div ref={setDocxHost} className="min-h-full" />
      </div>
    );
  }

  const sheet = sheets[sheetIndex];
  const truncated = sheets.some((item) => item.truncated);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-200 px-3 py-2">
          {sheets.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSheetIndex(index)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${index === sheetIndex ? 'border-lunardeli-red bg-red-50 text-lunardeli-dark' : 'border-gray-200 bg-gray-50 text-lunardeli-dark'}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      {truncated && <p className="shrink-0 bg-amber-50 px-3 py-2 text-xs text-amber-900">Planilha grande: a visualização mostra as primeiras linhas e colunas, com a formatação original.</p>}
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {!sheet && <p className="p-6 text-sm text-gray-500">Lendo a planilha…</p>}
        {sheet && !sheet.rows.length && <p className="p-6 text-sm text-gray-500">Esta aba está vazia.</p>}
        {sheet && sheet.rows.length > 0 && (
          <table className="border-collapse">
            <colgroup>
              {sheet.widths.map((width, index) => (
                <col key={index} style={{ width: width ? `${width}px` : undefined }} />
              ))}
            </colgroup>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={`${sheet.name}-${rowIndex}`} style={{ height: sheet.rowHeights[rowIndex] ? `${sheet.rowHeights[rowIndex]}pt` : undefined }}>
                  {row.map((cell, columnIndex) => cell.skip ? null : (
                    <td
                      key={columnIndex}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      style={cell.style}
                    >
                      {cell.runs?.length
                        ? cell.runs.map((run, runIndex) => <span key={runIndex} style={run.style}>{run.text}</span>)
                        : cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

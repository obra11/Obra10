import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DWG_LIMIT = 100 * 1024 * 1024;
const DOC_LIMIT = 30 * 1024 * 1024;

export interface DwgScale {
  unit: string;
  unitsPerPoint: number;
  modelPage: number;
}

function readScale(stdout: string): DwgScale | null {
  const match = String(stdout || '').match(/OBRA10_SCALE\s+(\{.*\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const unitsPerPoint = Number(parsed.unitsPerPoint);
    const unit = String(parsed.unit || '').replace(/[^\w]/g, '').slice(0, 8);
    const modelPage = Math.max(1, Math.floor(Number(parsed.modelPage) || 1));
    if (!unit || !Number.isFinite(unitsPerPoint) || unitsPerPoint <= 0) return null;
    return { unit, unitsPerPoint, modelPage };
  } catch {
    return null;
  }
}

async function scriptPath(): Promise<string> {
  const candidates = [
    join(process.cwd(), 'python', 'dwg_to_pdf.py'),
    join(__dirname, '..', '..', '..', 'python', 'dwg_to_pdf.py'),
    join(__dirname, '..', '..', '..', '..', 'python', 'dwg_to_pdf.py'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* próximo */
    }
  }
  throw new BadRequestException('Conversor DWG não encontrado no servidor.');
}

function pythonInvocation(script: string, input: string, output: string) {
  if (process.env.PYTHON) {
    return { command: process.env.PYTHON, args: [script, input, output] };
  }
  if (process.platform === 'win32') {
    return { command: 'py', args: ['-3.13', script, input, output] };
  }
  return { command: 'python3', args: [script, input, output] };
}

@Injectable()
export class VisualizadorService {
  async dwgParaPdf(buffer: Buffer, originalName: string): Promise<{ pdf: Buffer; scale: DwgScale | null }> {
    const name = (originalName || '').toLowerCase();
    if (!name.endsWith('.dwg')) {
      throw new BadRequestException('Envie um arquivo com terminação .dwg.');
    }
    if (!buffer?.length) {
      throw new BadRequestException('O arquivo DWG está vazio.');
    }
    if (buffer.length > DWG_LIMIT) {
      throw new BadRequestException('O limite para DWG é 100 MB.');
    }

    const dir = await mkdtemp(join(tmpdir(), 'obra10-dwg-'));
    const input = join(dir, 'entrada.dwg');
    const output = join(dir, 'saida.pdf');
    try {
      await writeFile(input, buffer);
      const script = await scriptPath();
      const python = pythonInvocation(script, input, output);
      let stdout = '';
      try {
        const result = await execFileAsync(python.command, python.args, {
          timeout: 120000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
        });
        stdout = String(result.stdout || '');
      } catch (error: any) {
        const detail = String(error?.stderr || error?.message || 'falha na conversão')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 400);
        throw new BadRequestException(
          detail || 'Não foi possível converter o DWG em PDF.',
        );
      }
      const pdf = await readFile(output);
      if (pdf.length < 5 || pdf.subarray(0, 4).toString() !== '%PDF') {
        throw new BadRequestException('A conversão não gerou um PDF válido.');
      }
      return { pdf, scale: readScale(stdout) };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async docParaTexto(buffer: Buffer, originalName: string): Promise<string> {
    const name = (originalName || '').toLowerCase();
    if (!name.endsWith('.doc') || name.endsWith('.docx')) {
      throw new BadRequestException('Envie um arquivo com terminação .doc.');
    }
    if (!buffer?.length) throw new BadRequestException('O arquivo Word está vazio.');
    if (buffer.length > DOC_LIMIT) throw new BadRequestException('O limite para Word é 30 MB.');
    const { createRequire } = await import('node:module');
    const require = createRequire(__filename);
    const WordExtractor = require('word-extractor') as new () => {
      extract: (source: Buffer) => Promise<{ getBody: (options?: { filterUnicode?: boolean }) => string }>;
    };
    try {
      const document = await new WordExtractor().extract(buffer);
      const text = document.getBody({ filterUnicode: false }).replace(/\u0000/g, '').trim();
      if (!text) throw new BadRequestException('Este .doc não tem texto legível.');
      return text.slice(0, 2_000_000);
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Não foi possível ler este arquivo .doc. Salve como .docx para ver a formatação.');
    }
  }
}

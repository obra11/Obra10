import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type DossiePdfItem = {
  nome: string;
  funcao: string;
  ativo: boolean;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  matricula?: string;
  dataAdmissao?: string;
  tipoContrato?: string;
  obraNome?: string | null;
  cidade?: string;
  uf?: string;
  endereco?: string;
  alocacoes?: Array<{
    obraNome: string;
    dataInicio?: string | null;
    dataFim?: string | null;
    atual?: boolean;
  }>;
  treinamentos: Array<{
    nome: string;
    tipo: string;
    dataRealizacao?: string | null;
    validade?: string | null;
    situacao?: string | null;
    cargaHoraria?: number | null;
    instrutor?: string | null;
  }>;
  exames: Array<{
    nome: string;
    tipo: string;
    dataRealizacao?: string | null;
    validade?: string | null;
    situacao?: string | null;
    resultado?: string | null;
    clinica?: string | null;
  }>;
  epis: Array<{
    nome: string;
    quantidade: string;
    dataRecebimento?: string | null;
    validadeEpi?: string | null;
    ca?: string | null;
    situacao?: string | null;
  }>;
};

export type DadosDossiePdf = {
  empresa: string;
  documento?: string;
  emitidoEm: string;
  pessoas: DossiePdfItem[];
};

const VERMELHO = rgb(0.898, 0.098, 0.173);
const ESCURO = rgb(0.11, 0.11, 0.11);
const CINZA = rgb(0.35, 0.35, 0.35);
const BRANCO = rgb(1, 1, 1);
const LINHA = rgb(0.9, 0.9, 0.9);
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 48;

function san(valor: unknown) {
  return String(valor ?? '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u007F-\u009F]/g, '')
    .replace(/[^\u0020-\u00FF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function dataBr(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor)) return '';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function rotulo(mapa: Record<string, string>, valor?: string | null) {
  if (!valor) return '';
  return mapa[valor] || valor;
}

const CONTRATOS: Record<string, string> = {
  CLT: 'CLT',
  TEMPORARIO: 'Temporario',
  ESTAGIO: 'Estagio',
  APRENDIZ: 'Aprendiz',
  AUTONOMO: 'Autonomo',
  TERCEIRIZADO: 'Terceirizado',
};

const SITUACAO: Record<string, string> = {
  VIGENTE: 'Vigente',
  A_VENCER: 'A vencer',
  VENCIDO: 'Vencido',
};

const TIPO_TREINO: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  RECORRENTE: 'Recorrente',
};

const TIPO_EXAME: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periodico',
  RETORNO_TRABALHO: 'Retorno ao trabalho',
  MUDANCA_FUNCAO: 'Mudanca de funcao',
  DEMISSIONAL: 'Demissional',
};

const RESULTADO: Record<string, string> = {
  APTO: 'Apto',
  APTO_RESTRICOES: 'Apto com restricoes',
  INAPTO: 'Inapto',
};

function quebrar(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number,
) {
  const palavras = san(texto).split(' ').filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tenta = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tenta, tamanho) <= largura) atual = tenta;
    else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

export async function gerarPdfDossie(dados: DadosDossiePdf): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pessoas = dados.pessoas.length ? dados.pessoas : [];
  const titulo =
    pessoas.length > 1
      ? `Relatorio de pessoal (${pessoas.length} funcionarios)`
      : 'Ficha cadastral e historico profissional';

  const estado = {
    pagina: pdf.addPage([LARGURA, ALTURA]) as PDFPage,
    y: ALTURA - 64,
  };

  const cabecalho = (continua = false) => {
    estado.pagina.drawRectangle({ x: 0, y: ALTURA - 46, width: LARGURA, height: 46, color: VERMELHO });
    estado.pagina.drawText('OBRA 10', { x: MARGEM, y: ALTURA - 28, size: 11, font: negrito, color: BRANCO });
    estado.pagina.drawText(continua ? `${titulo} (cont.)` : titulo, {
      x: MARGEM + 72,
      y: ALTURA - 29,
      size: 12,
      font: negrito,
      color: BRANCO,
    });
    estado.y = ALTURA - 64;
  };

  const nova = () => {
    estado.pagina = pdf.addPage([LARGURA, ALTURA]);
    cabecalho(true);
  };

  const garantir = (altura: number) => {
    if (estado.y - altura < 56) nova();
  };

  const linha = (texto: string, opts?: { negrito?: boolean; tamanho?: number; cor?: typeof ESCURO }) => {
    const tamanho = opts?.tamanho ?? 10;
    const fonte = opts?.negrito ? negrito : regular;
    const linhas = quebrar(texto, fonte, tamanho, LARGURA - MARGEM * 2);
    for (const trecho of linhas) {
      garantir(14);
      estado.pagina.drawText(trecho, {
        x: MARGEM,
        y: estado.y,
        size: tamanho,
        font: fonte,
        color: opts?.cor ?? ESCURO,
      });
      estado.y -= 14;
    }
  };

  const secao = (nome: string) => {
    garantir(28);
    estado.y -= 8;
    estado.pagina.drawText(nome.toUpperCase(), {
      x: MARGEM,
      y: estado.y,
      size: 9,
      font: negrito,
      color: VERMELHO,
    });
    estado.y -= 6;
    estado.pagina.drawLine({
      start: { x: MARGEM, y: estado.y },
      end: { x: LARGURA - MARGEM, y: estado.y },
      thickness: 0.6,
      color: LINHA,
    });
    estado.y -= 14;
  };

  const campo = (rotuloCampo: string, valor?: string | null) => {
    const texto = san(valor);
    if (!texto) return;
    linha(`${rotuloCampo}: ${texto}`);
  };

  cabecalho(false);
  linha(san(dados.empresa) || 'Empresa', { negrito: true, tamanho: 12 });
  if (dados.documento) linha(`CNPJ/CPF: ${san(dados.documento)}`, { tamanho: 9, cor: CINZA });
  linha(`Emitido em ${san(dados.emitidoEm)}`, { tamanho: 9, cor: CINZA });
  linha('Documento destinado a comprovacao cadastral e de capacitacao junto a contratante.', {
    tamanho: 8,
    cor: CINZA,
  });

  for (let i = 0; i < pessoas.length; i += 1) {
    const pessoa = pessoas[i];
    if (i > 0) {
      estado.pagina = pdf.addPage([LARGURA, ALTURA]);
      cabecalho(false);
      linha(san(dados.empresa) || 'Empresa', { negrito: true, tamanho: 12 });
    }

    secao('Identificacao');
    linha(san(pessoa.nome) || 'Funcionario', { negrito: true, tamanho: 13 });
    campo('Funcao', pessoa.funcao);
    campo('Situacao', pessoa.ativo ? 'Ativo' : 'Inativo');
    campo('CPF', pessoa.cpf);
    campo('RG', pessoa.rg);
    campo('Nascimento', dataBr(pessoa.dataNascimento));
    campo('Matricula', pessoa.matricula);
    campo('Admissao', dataBr(pessoa.dataAdmissao));
    campo('Contrato', rotulo(CONTRATOS, pessoa.tipoContrato));
    campo('Obra', pessoa.obraNome || undefined);
    campo('Telefone', pessoa.telefone);
    campo('E-mail', pessoa.email);
    campo('Endereco', pessoa.endereco);
    campo('Cidade', [pessoa.cidade, pessoa.uf].filter(Boolean).join('/'));

    secao('Alocacao de mao de obra');
    if (!pessoa.alocacoes?.length) {
      linha(pessoa.obraNome
        ? `Atualmente em ${san(pessoa.obraNome)}.`
        : 'Sem alocacao em obra na data de emissao.', { tamanho: 9, cor: CINZA });
    } else {
      for (const item of pessoa.alocacoes) {
        linha(san(item.obraNome) || 'Obra', { negrito: true, tamanho: 10 });
        linha(
          [
            item.dataInicio ? `de ${dataBr(item.dataInicio)}` : '',
            item.atual || !item.dataFim ? 'ate a presente data' : item.dataFim ? `ate ${dataBr(item.dataFim)}` : '',
          ]
            .filter(Boolean)
            .join(' '),
          { tamanho: 9, cor: CINZA },
        );
      }
    }

    secao('Treinamentos e certificacoes');
    if (!pessoa.treinamentos.length) {
      linha('Nenhum treinamento registrado ate a emissao deste relatorio.', { tamanho: 9, cor: CINZA });
    } else {
      for (const item of pessoa.treinamentos) {
        garantir(36);
        linha(
          `${san(item.nome)} (${rotulo(TIPO_TREINO, item.tipo) || 'Treinamento'})`,
          { negrito: true, tamanho: 10 },
        );
        linha(
          [
            item.dataRealizacao ? `Realizado em ${dataBr(item.dataRealizacao)}` : '',
            item.validade ? `valido ate ${dataBr(item.validade)}` : '',
            item.cargaHoraria ? `${String(item.cargaHoraria).replace('.', ',')}h` : '',
            item.instrutor ? `instrutor ${san(item.instrutor)}` : '',
            rotulo(SITUACAO, item.situacao),
          ]
            .filter(Boolean)
            .join(' · '),
          { tamanho: 9, cor: CINZA },
        );
      }
    }

    secao('Exames ocupacionais');
    if (!pessoa.exames.length) {
      linha('Nenhum exame ocupacional registrado ate a emissao deste relatorio.', { tamanho: 9, cor: CINZA });
    } else {
      for (const item of pessoa.exames) {
        garantir(36);
        linha(
          `${san(item.nome)} (${rotulo(TIPO_EXAME, item.tipo) || 'Exame'})`,
          { negrito: true, tamanho: 10 },
        );
        linha(
          [
            item.dataRealizacao ? `Realizado em ${dataBr(item.dataRealizacao)}` : '',
            item.validade ? `valido ate ${dataBr(item.validade)}` : '',
            rotulo(RESULTADO, item.resultado),
            item.clinica ? san(item.clinica) : '',
            rotulo(SITUACAO, item.situacao),
          ]
            .filter(Boolean)
            .join(' · '),
          { tamanho: 9, cor: CINZA },
        );
      }
    }

    secao('Entrega de EPI');
    if (!pessoa.epis.length) {
      linha('Nenhuma entrega de EPI registrada ate a emissao deste relatorio.', { tamanho: 9, cor: CINZA });
    } else {
      for (const item of pessoa.epis) {
        garantir(36);
        linha(san(item.nome), { negrito: true, tamanho: 10 });
        linha(
          [
            item.quantidade ? `Qtd ${item.quantidade}` : '',
            item.dataRecebimento ? `recebido em ${dataBr(item.dataRecebimento)}` : '',
            item.validadeEpi ? `validade ${dataBr(item.validadeEpi)}` : '',
            item.ca ? `CA ${san(item.ca)}` : '',
            rotulo(SITUACAO, item.situacao),
          ]
            .filter(Boolean)
            .join(' · '),
          { tamanho: 9, cor: CINZA },
        );
      }
    }

    garantir(28);
    estado.y -= 10;
    linha('Documento gerado pelo Obra 10. As informacoes refletem o cadastro na data de emissao.', {
      tamanho: 8,
      cor: CINZA,
    });
  }

  return Buffer.from(await pdf.save());
}

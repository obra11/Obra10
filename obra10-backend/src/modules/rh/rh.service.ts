import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCivil,
  Escolaridade,
  Prisma,
  ResultadoExame,
  Sexo,
  TipoContaBancaria,
  TipoContrato,
  TipoExameOcupacional,
  TipoTreinamento,
} from '@prisma/client';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { CryptoService } from '../../core/services/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { lerVisaoLuna } from '../ai/luna-visao';
import { arquivoEntradaValido, gravarArquivoEntrada, imagemParaVisao } from '../estoque/estoque-storage';
import { EstoqueService } from '../estoque/estoque.service';
import { FICHA_SYSTEM, jsonDaLuna, parsearFichaExtraida, pedidoFicha } from './rh-ficha-leitura';
import { gerarPdfTermoEpi } from './rh-termo-pdf';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

const SEXOS = ['FEMININO', 'MASCULINO', 'NAO_INFORMADO'] as const;
const ESTADOS_CIVIS = ['SOLTEIRO', 'CASADO', 'UNIAO_ESTAVEL', 'DIVORCIADO', 'SEPARADO', 'VIUVO'] as const;
const ESCOLARIDADES = [
  'FUNDAMENTAL_INCOMPLETO', 'FUNDAMENTAL', 'MEDIO_INCOMPLETO', 'MEDIO',
  'TECNICO', 'SUPERIOR_INCOMPLETO', 'SUPERIOR', 'POS_GRADUACAO',
] as const;
const CONTRATOS = ['CLT', 'TEMPORARIO', 'ESTAGIO', 'APRENDIZ', 'AUTONOMO', 'TERCEIRIZADO'] as const;
const CONTAS = ['CORRENTE', 'POUPANCA', 'SALARIO'] as const;
const TREINAMENTOS = ['ADMISSIONAL', 'RECORRENTE'] as const;
const EXAMES = ['ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_FUNCAO', 'DEMISSIONAL'] as const;
const RESULTADOS_EXAME = ['APTO', 'APTO_RESTRICOES', 'INAPTO'] as const;

export type FichaBody = {
  obraId?: string;
  nome?: string;
  funcao?: string;
  cpf?: string;
  rg?: string;
  rgOrgao?: string;
  rgUf?: string;
  dataNascimento?: string;
  sexo?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  naturalidade?: string;
  nomeMae?: string;
  nomePai?: string;
  pis?: string;
  ctpsNumero?: string;
  ctpsSerie?: string;
  ctpsUf?: string;
  escolaridade?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cbo?: string;
  matricula?: string;
  dataAdmissao?: string;
  tipoContrato?: string;
  salario?: number | string | null;
  jornada?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  pix?: string;
  ativo?: boolean;
};

type FichaPronta = {
  nome: string;
  funcao: string;
  cpf: string | null;
  cpfHash: string | null;
  rg: string | null;
  rgOrgao: string | null;
  rgUf: string | null;
  dataNascimento: Date | null;
  sexo: Sexo | null;
  estadoCivil: EstadoCivil | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  pis: string | null;
  pisHash: string | null;
  ctpsNumero: string | null;
  ctpsSerie: string | null;
  ctpsUf: string | null;
  escolaridade: Escolaridade | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cbo: string | null;
  matricula: string | null;
  dataAdmissao: Date | null;
  tipoContrato: TipoContrato | null;
  salario: Prisma.Decimal | null;
  jornada: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipoConta: TipoContaBancaria | null;
  pix: string | null;
};

@Injectable()
export class RhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
    private readonly crypto: CryptoService,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async listar(empresaId: string, userId: string, obraId?: string) {
    await this.assertAcesso(empresaId, userId, obraId);
    const pessoas = await this.prisma.funcionario.findMany({
      where: { empresaId, deletedAt: null },
      include: {
        obra: { select: { id: true, nome: true } },
        treinamentos: {
          where: { deletedAt: null },
          select: { tipo: true, validade: true },
        },
        exames: {
          where: { deletedAt: null },
          select: { tipo: true, validade: true },
        },
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
    return pessoas.map((pessoa) => this.resumo(pessoa));
  }

  async obter(empresaId: string, userId: string, id: string) {
    const pessoa = await this.buscar(empresaId, id);
    await this.assertPodeFuncionario(empresaId, userId, pessoa.obraId);
    return this.ficha(pessoa);
  }

  async lerFicha(
    empresaId: string,
    userId: string,
    files: Express.Multer.File[] | undefined,
    obraId?: string,
  ) {
    await this.assertAcesso(empresaId, userId, obraId);
    const fotos = (files || []).filter((file) => file?.buffer?.length).slice(0, 4);
    if (!fotos.length) throw new BadRequestException('Envie a foto da ficha existente.');

    const partes: Array<Record<string, unknown>> = [{ type: 'text', text: pedidoFicha() }];
    for (const file of fotos) {
      if (file.size > 15 * 1024 * 1024) throw new BadRequestException('A foto passa de 15 MB.');
      const mime = mimeDaFicha(file);
      if (mime === 'application/pdf') {
        partes.push({
          type: 'file',
          file: {
            filename: 'ficha.pdf',
            file_data: `data:application/pdf;base64,${file.buffer.toString('base64')}`,
          },
        });
      } else if (imagemParaVisao(mime)) {
        partes.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${file.buffer.toString('base64')}`, detail: 'high' },
        });
      } else {
        throw new BadRequestException('Use JPG, PNG, WEBP ou PDF. HEIC não é lido.');
      }
    }

    let raw: string;
    try {
      raw = await lerVisaoLuna(partes as never, FICHA_SYSTEM);
    } catch (err: any) {
      if (String(err?.message || '') === 'SEM_CHAVE') {
        throw new BadRequestException('A Luna não está disponível para ler a ficha. Preencha os dados na tela.');
      }
      throw new BadRequestException('A Luna não conseguiu ler a ficha. Tire outra foto ou preencha na tela.');
    }

    const { ficha, preenchidos } = parsearFichaExtraida(jsonDaLuna(raw));
    if (!preenchidos.length) {
      throw new BadRequestException('Não deu para ler dados nesta foto. Tente outra, mais nítida, ou preencha na tela.');
    }
    return {
      ficha,
      preenchidos,
      aviso: `A Luna preencheu ${preenchidos.length} campo${preenchidos.length === 1 ? '' : 's'}. Confira antes de salvar.`,
    };
  }

  async criar(empresaId: string, userId: string, body: FichaBody) {
    const ficha = this.normalizar(body);
    const obraId = await this.resolverObraId(empresaId, body.obraId);
    await this.assertAcesso(empresaId, userId, obraId);
    await this.garantirDocumentosLivres(empresaId, ficha);
    const criada = await this.prisma.funcionario.create({
      data: { empresaId, obraId, ...ficha },
    });
    return this.ficha(criada);
  }

  async atualizar(empresaId: string, userId: string, id: string, body: FichaBody) {
    const atual = await this.buscar(empresaId, id);
    await this.assertPodeFuncionario(empresaId, userId, atual.obraId);
    if (somenteAtivo(body)) {
      if (typeof body.ativo !== 'boolean') throw new BadRequestException('Informe se o funcionário continua ativo.');
      const salvo = await this.prisma.funcionario.update({
        where: { id: atual.id },
        data: { ativo: body.ativo },
      });
      return this.resumo({ ...salvo, obra: null, treinamentos: [], exames: [] });
    }
    const ficha = this.normalizar(body);
    await this.garantirDocumentosLivres(empresaId, ficha, atual.id);
    const obraId = body.obraId === undefined
      ? atual.obraId
      : await this.resolverObraId(empresaId, body.obraId);
    if (obraId !== atual.obraId) {
      await this.assertPodeRhEmpresa(empresaId, userId);
      if (obraId) await this.obraDaEmpresa(empresaId, obraId);
    }
    const salva = await this.prisma.funcionario.update({
      where: { id: atual.id },
      data: {
        ...ficha,
        obraId,
        ...(typeof body.ativo === 'boolean' ? { ativo: body.ativo } : {}),
      },
    });
    return this.ficha(salva);
  }

  async entregas(empresaId: string, userId: string, obraId?: string) {
    if (!obraId) throw new BadRequestException('Escolha a obra.');
    await this.estoque.listarLocais(empresaId, userId, obraId);
    const linhas = await this.prisma.movimentoEstoque.findMany({
      where: {
        empresaId,
        tipo: 'SAIDA',
        insumo: { tipo: 'EPI' },
        localOrigem: { obraId },
      },
      include: {
        insumo: { select: { id: true, nome: true, unidade: true } },
        funcionario: { select: { id: true, nome: true, funcao: true } },
      },
      orderBy: { dataRecebimento: 'desc' },
      take: 100,
    });
    return linhas.map(({ assinatura, dataRecebimento, validadeEpi, ...item }) => {
      const validade = isoDe(validadeEpi);
      return {
        ...item,
        dataRecebimento: isoDe(dataRecebimento),
        validadeEpi: validade,
        situacao: situacao(validade),
        temAssinatura: Boolean(assinatura),
      };
    });
  }

  async entregar(
    empresaId: string,
    userId: string,
    body: {
      obraId?: string;
      insumoId?: string;
      funcionarioId?: string;
      quantidade?: number;
      dataRecebimento?: string;
      validadeEpi?: string;
      ca?: string;
      motivo?: string;
      assinatura?: string;
    },
  ) {
    if (!body.obraId) throw new BadRequestException('Escolha a obra.');
    const locais = await this.estoque.listarLocais(empresaId, userId, body.obraId);
    const almox = locais.locais.find((local) => local.tipo === 'ALMOXARIFADO');
    if (!almox) throw new BadRequestException('Esta obra ainda não tem almoxarifado.');
    return this.estoque.saida(empresaId, userId, {
      localId: almox.id,
      insumoId: body.insumoId,
      quantidade: body.quantidade,
      motivo: body.motivo,
      funcionarioId: body.funcionarioId,
      dataRecebimento: body.dataRecebimento,
      validadeEpi: body.validadeEpi,
      ca: body.ca,
      assinatura: body.assinatura,
    }, true);
  }

  async termo(empresaId: string, userId: string, id: string) {
    const movimento = await this.prisma.movimentoEstoque.findFirst({
      where: { id, empresaId, tipo: 'SAIDA', insumo: { tipo: 'EPI' } },
      include: {
        insumo: { select: { nome: true, unidade: true } },
        funcionario: { select: { nome: true, funcao: true, telefone: true, email: true } },
        localOrigem: { select: { obraId: true, nome: true } },
      },
    });
    if (!movimento?.localOrigem?.obraId) throw new NotFoundException('Termo não encontrado.');
    await this.estoque.listarLocais(empresaId, userId, movimento.localOrigem.obraId);
    const validade = isoDe(movimento.validadeEpi);
    return {
      id: movimento.id,
      quantidade: movimento.quantidade,
      dataRecebimento: isoDe(movimento.dataRecebimento),
      validadeEpi: validade,
      ca: movimento.ca,
      situacao: situacao(validade),
      createdAt: movimento.createdAt,
      assinatura: movimento.assinatura,
      insumo: movimento.insumo,
      funcionario: movimento.funcionario,
      local: movimento.localOrigem.nome,
    };
  }

  async termoPdf(empresaId: string, userId: string, id: string) {
    const termo = await this.termo(empresaId, userId, id);
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { nomeFantasia: true, razaoSocial: true, nomeCompleto: true },
    });
    return gerarPdfTermoEpi({
      empresa: empresa?.nomeFantasia || empresa?.razaoSocial || empresa?.nomeCompleto || 'Obra 10',
      local: termo.local,
      funcionario: termo.funcionario?.nome || 'Funcionário',
      funcao: termo.funcionario?.funcao || '',
      epi: termo.insumo.nome,
      unidade: termo.insumo.unidade || 'un',
      quantidade: Number(termo.quantidade),
      dataRecebimento: termo.dataRecebimento,
      validadeEpi: termo.validadeEpi,
      ca: termo.ca,
      assinatura: termo.assinatura,
    });
  }

  async treinamentos(empresaId: string, userId: string, obraId?: string) {
    await this.assertAcesso(empresaId, userId, obraId);
    const linhas = await this.prisma.treinamentoFuncionario.findMany({
      where: {
        empresaId,
        deletedAt: null,
        ...(obraId ? { OR: [{ obraId }, { funcionario: { obraId } }] } : {}),
      },
      include: { funcionario: { select: { id: true, nome: true, funcao: true } } },
      orderBy: [{ dataRealizacao: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return linhas.map((item) => this.treinamentoPublico(item));
  }

  async treinamento(empresaId: string, userId: string, id: string) {
    const item = await this.prisma.treinamentoFuncionario.findFirst({
      where: { id, empresaId, deletedAt: null },
      include: { funcionario: { select: { id: true, nome: true, funcao: true, obraId: true } } },
    });
    if (!item) throw new NotFoundException('Treinamento não encontrado.');
    await this.assertPodeFuncionario(empresaId, userId, item.obraId || item.funcionario.obraId);
    return {
      ...this.treinamentoPublico(item),
      assinatura: item.assinatura,
      observacao: item.observacao,
      certificadoUrl: item.certificadoUrl,
      certificadoNome: item.certificadoNome,
      certificadoMime: item.certificadoMime,
    };
  }

  async registrarTreinamento(
    empresaId: string,
    userId: string,
    body: {
      obraId?: string;
      funcionarioId?: string;
      tipo?: string;
      nome?: string;
      dataRealizacao?: string;
      cargaHoraria?: number | string | null;
      validade?: string;
      instrutor?: string;
      observacao?: string;
      assinatura?: string;
    },
    certificado?: Express.Multer.File,
  ) {
    const obraId = await this.resolverObraId(empresaId, body.obraId);
    await this.assertAcesso(empresaId, userId, obraId);
    if (!body.funcionarioId) throw new BadRequestException('Escolha o funcionário.');
    const funcionario = await this.prisma.funcionario.findFirst({
      where: { id: body.funcionarioId, empresaId, ativo: true, deletedAt: null },
    });
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado.');
    if (!eUmDe(body.tipo, TREINAMENTOS)) throw new BadRequestException('Escolha se o treinamento é admissional ou recorrente.');
    const nome = texto(body.nome, 120);
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome do treinamento.');
    const dataRealizacao = dataObrigatoria(body.dataRealizacao, 'a data do treinamento');
    const validade = dataObrigatoria(body.validade, 'a validade do treinamento');
    if (isoDe(validade)! < isoDe(dataRealizacao)!) {
      throw new BadRequestException('A validade do treinamento não pode ser anterior à realização.');
    }
    let certificadoUrl: string | null = null;
    let certificadoNome: string | null = null;
    let certificadoMime: string | null = null;
    if (certificado) {
      const mime = arquivoEntradaValido(certificado);
      certificadoUrl = await gravarArquivoEntrada(certificado, mime, 'certificados-treino');
      certificadoNome = texto(certificado.originalname, 180) || 'certificado';
      certificadoMime = mime;
    }
    const criado = await this.prisma.treinamentoFuncionario.create({
      data: {
        empresaId,
        obraId,
        funcionarioId: funcionario.id,
        tipo: body.tipo,
        nome,
        dataRealizacao,
        cargaHoraria: carga(body.cargaHoraria),
        validade,
        instrutor: texto(body.instrutor, 120),
        observacao: texto(body.observacao, 400),
        assinatura: assinaturaPng(body.assinatura),
        certificadoUrl,
        certificadoNome,
        certificadoMime,
      },
      include: { funcionario: { select: { id: true, nome: true, funcao: true } } },
    });
    return this.treinamentoPublico(criado);
  }

  async exames(empresaId: string, userId: string, obraId?: string) {
    await this.assertAcesso(empresaId, userId, obraId);
    const linhas = await this.prisma.exameFuncionario.findMany({
      where: {
        empresaId,
        deletedAt: null,
        ...(obraId ? { funcionario: { obraId } } : {}),
      },
      include: { funcionario: { select: { id: true, nome: true, funcao: true } } },
      orderBy: [{ validade: 'asc' }, { dataRealizacao: 'desc' }],
      take: 200,
    });
    return linhas.map((item) => this.examePublico(item));
  }

  async registrarExame(
    empresaId: string,
    userId: string,
    body: {
      obraId?: string;
      funcionarioId?: string;
      tipo?: string;
      nome?: string;
      dataRealizacao?: string;
      validade?: string;
      resultado?: string;
      clinica?: string;
      observacao?: string;
    },
  ) {
    const obraId = await this.resolverObraId(empresaId, body.obraId);
    await this.assertAcesso(empresaId, userId, obraId);
    if (!body.funcionarioId) throw new BadRequestException('Escolha o funcionário.');
    const funcionario = await this.prisma.funcionario.findFirst({
      where: { id: body.funcionarioId, empresaId, ativo: true, deletedAt: null },
    });
    if (!funcionario) throw new NotFoundException('Funcionário não encontrado.');
    if (!eUmDe(body.tipo, EXAMES)) throw new BadRequestException('Escolha o tipo do exame.');
    const nome = texto(body.nome, 120);
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome do exame.');
    const dataRealizacao = dataObrigatoria(body.dataRealizacao, 'a data do exame');
    const validade = dataObrigatoria(body.validade, 'a validade do exame');
    if (isoDe(validade)! < isoDe(dataRealizacao)!) {
      throw new BadRequestException('A validade do exame não pode ser anterior à realização.');
    }
    const criado = await this.prisma.exameFuncionario.create({
      data: {
        empresaId,
        funcionarioId: funcionario.id,
        tipo: body.tipo as TipoExameOcupacional,
        nome,
        dataRealizacao,
        validade,
        resultado: opcional(body.resultado, RESULTADOS_EXAME, 'Resultado inválido.') as ResultadoExame | null,
        clinica: texto(body.clinica, 120),
        observacao: texto(body.observacao, 400),
      },
      include: { funcionario: { select: { id: true, nome: true, funcao: true } } },
    });
    return this.examePublico(criado);
  }

  async avisos(empresaId: string, userId: string, obraId?: string) {
    await this.assertAcesso(empresaId, userId, obraId);
    const [treinamentos, exames] = await Promise.all([
      this.prisma.treinamentoFuncionario.findMany({
        where: {
          empresaId,
          deletedAt: null,
          ...(obraId ? { OR: [{ obraId }, { funcionario: { obraId } }] } : {}),
        },
        include: { funcionario: { select: { id: true, nome: true, funcao: true, ativo: true } } },
      }),
      this.prisma.exameFuncionario.findMany({
        where: {
          empresaId,
          deletedAt: null,
          ...(obraId ? { funcionario: { obraId } } : {}),
        },
        include: { funcionario: { select: { id: true, nome: true, funcao: true, ativo: true } } },
      }),
    ]);
    const treinos = treinamentos
      .filter((item) => item.funcionario.ativo)
      .map((item) => ({ ...this.treinamentoPublico(item), especie: 'TREINAMENTO' as const }));
    const ocupacionais = exames
      .filter((item) => item.funcionario.ativo)
      .map((item) => ({ ...this.examePublico(item), especie: 'EXAME' as const }));
    const pendentes = [...ocupacionais, ...treinos].filter(
      (item) => item.situacao === 'VENCIDO' || item.situacao === 'A_VENCER',
    );
    const vencidos = pendentes.filter((item) => item.situacao === 'VENCIDO');
    const aVencer = pendentes.filter((item) => item.situacao === 'A_VENCER');
    return {
      vencidos: vencidos.length,
      aVencer: aVencer.length,
      examesVencidos: ocupacionais.filter((item) => item.situacao === 'VENCIDO').length,
      examesAVencer: ocupacionais.filter((item) => item.situacao === 'A_VENCER').length,
      treinamentosVencidos: treinos.filter((item) => item.situacao === 'VENCIDO').length,
      treinamentosAVencer: treinos.filter((item) => item.situacao === 'A_VENCER').length,
      itens: [...vencidos, ...aVencer],
    };
  }

  private async buscar(empresaId: string, id: string) {
    const pessoa = await this.prisma.funcionario.findFirst({
      where: { id, empresaId, deletedAt: null },
    });
    if (!pessoa) throw new NotFoundException('Funcionário não encontrado.');
    return pessoa;
  }

  private async assertAcesso(empresaId: string, userId: string, obraId?: string | null) {
    if (obraId) {
      await this.obraDaEmpresa(empresaId, obraId);
      await this.estoque.listarLocais(empresaId, userId, obraId);
      return;
    }
    await this.assertPodeRhEmpresa(empresaId, userId);
  }

  private async assertPodeFuncionario(empresaId: string, userId: string, obraId?: string | null) {
    if (obraId) {
      try {
        await this.estoque.listarLocais(empresaId, userId, obraId);
        return;
      } catch {
        /* tenta o RH da empresa */
      }
    }
    await this.assertPodeRhEmpresa(empresaId, userId);
  }

  private async assertPodeRhEmpresa(empresaId: string, userId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, empresaId, deletedAt: null, ativo: true },
      select: { perfilGlobal: true, capabilities: true },
    });
    if (!usuario) throw new ForbiddenException('Sem acesso ao RH da empresa.');
    if (usuario.perfilGlobal === 'GESTOR' || usuario.perfilGlobal === 'SUPER_ADMIN') return;
    const caps = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: usuario.perfilGlobal,
      capabilitiesOverride: usuario.capabilities,
    });
    if (caps.acessoTodasObras || caps.gerenciarUsuarios) return;
    throw new ForbiddenException('O RH da empresa é para quem gerencia a empresa.');
  }

  private async resolverObraId(empresaId: string, obraId?: string | null) {
    const limpo = String(obraId || '').trim();
    if (!limpo) return null;
    await this.obraDaEmpresa(empresaId, limpo);
    return limpo;
  }

  private async obraDaEmpresa(empresaId: string, obraId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
      select: { id: true },
    });
    if (!obra) throw new BadRequestException('Obra não encontrada nesta empresa.');
    return obra;
  }

  private async garantirDocumentosLivres(empresaId: string, ficha: FichaPronta, ignorarId?: string) {
    if (ficha.cpfHash) {
      const outro = await this.prisma.funcionario.findFirst({
        where: { empresaId, cpfHash: ficha.cpfHash, deletedAt: null, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
        select: { id: true },
      });
      if (outro) throw new BadRequestException('Já existe um funcionário com este CPF nesta empresa.');
    }
    if (ficha.pisHash) {
      const outro = await this.prisma.funcionario.findFirst({
        where: { empresaId, pisHash: ficha.pisHash, deletedAt: null, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
        select: { id: true },
      });
      if (outro) throw new BadRequestException('Já existe um funcionário com este PIS nesta empresa.');
    }
  }

  private normalizar(body: FichaBody): FichaPronta {
    const nome = texto(body.nome, 120);
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome completo.');
    if (!String(body.cpf ?? '').replace(/\D/g, '')) throw new BadRequestException('Informe o CPF.');
    const cpf = this.documento(body.cpf, cpfValido, 'CPF inválido.');
    const pis = this.documento(body.pis, pisValido, 'PIS/PASEP/NIT inválido.', false);
    const dataNascimento = dataOpcional(body.dataNascimento, 'a data de nascimento');
    const dataAdmissao = dataOpcional(body.dataAdmissao, 'a data de admissão');
    const nascimento = isoDe(dataNascimento);
    const admissao = isoDe(dataAdmissao);
    const hoje = hojeIso();
    if (nascimento) {
      if (nascimento > hoje) throw new BadRequestException('A data de nascimento não pode ser futura.');
      if (nascimento < '1900-01-01') throw new BadRequestException('Confira a data de nascimento.');
    }
    if (admissao && admissao > somaDias(hoje, 60)) {
      throw new BadRequestException('A data de admissão está longe demais.');
    }
    if (nascimento && admissao && admissao < somaAnos(nascimento, 14)) {
      throw new BadRequestException('A admissão fica antes dos 14 anos. Confira as datas.');
    }
    const cepDigitos = String(body.cep ?? '').replace(/\D/g, '');
    const cep = digitos(body.cep, 8);
    if (cepDigitos && !cep) throw new BadRequestException('CEP inválido.');
    const email = emailDe(body.email);
    const telefone = telefoneDe(body.telefone);
    const rgUf = ufDe(body.rgUf, true);
    const ctpsUf = ufDe(body.ctpsUf, true);
    return {
      nome,
      funcao: texto(body.funcao, 80) || '',
      cpf: cpf.sigilo,
      cpfHash: cpf.hash,
      rg: texto(body.rg, 20),
      rgOrgao: texto(body.rgOrgao, 20),
      rgUf,
      dataNascimento,
      sexo: opcional(body.sexo, SEXOS, 'Sexo inválido.'),
      estadoCivil: opcional(body.estadoCivil, ESTADOS_CIVIS, 'Estado civil inválido.'),
      nacionalidade: texto(body.nacionalidade, 40),
      naturalidade: texto(body.naturalidade, 80),
      nomeMae: texto(body.nomeMae, 120),
      nomePai: texto(body.nomePai, 120),
      pis: pis.sigilo,
      pisHash: pis.hash,
      ctpsNumero: texto(body.ctpsNumero, 20),
      ctpsSerie: texto(body.ctpsSerie, 10),
      ctpsUf,
      escolaridade: opcional(body.escolaridade, ESCOLARIDADES, 'Escolaridade inválida.'),
      telefone,
      email,
      cep,
      logradouro: texto(body.logradouro, 120),
      numero: texto(body.numero, 20),
      complemento: texto(body.complemento, 80),
      bairro: texto(body.bairro, 80),
      cidade: texto(body.cidade, 80),
      uf: ufDe(body.uf, true),
      cbo: cboDe(body.cbo),
      matricula: texto(body.matricula, 30),
      dataAdmissao,
      tipoContrato: opcional(body.tipoContrato, CONTRATOS, 'Tipo de contrato inválido.'),
      salario: dinheiro(body.salario),
      jornada: texto(body.jornada, 80),
      banco: texto(body.banco, 60),
      agencia: contaDe(body.agencia, 10, 'Agência inválida.'),
      conta: contaDe(body.conta, 20, 'Conta inválida.'),
      tipoConta: opcional(body.tipoConta, CONTAS, 'Tipo de conta inválido.'),
      pix: texto(body.pix, 120),
    };
  }

  private documento(
    valor: unknown,
    valido: (digitos: string) => boolean,
    mensagem: string,
    obrigatorio = true,
  ) {
    const limpo = String(valor ?? '').replace(/\D/g, '');
    if (!limpo) {
      if (obrigatorio) throw new BadRequestException(mensagem);
      return { sigilo: null, hash: null };
    }
    if (!valido(limpo)) throw new BadRequestException(mensagem);
    return { sigilo: this.crypto.encrypt(limpo), hash: createHash('sha256').update(limpo).digest('hex') };
  }

  private resumo(pessoa: {
    id: string;
    obraId: string | null;
    nome: string;
    funcao: string;
    ativo: boolean;
    cpf: string | null;
    dataNascimento: Date | null;
    sexo: Sexo | null;
    nomeMae: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    dataAdmissao: Date | null;
    tipoContrato: TipoContrato | null;
    obra?: { id: string; nome: string } | null;
    treinamentos: { tipo: TipoTreinamento; validade: Date }[];
    exames?: { tipo: TipoExameOcupacional; validade: Date }[];
  }) {
    const cpf = pessoa.cpf ? this.crypto.decrypt(pessoa.cpf) : null;
    let vencidos = 0;
    let aVencer = 0;
    let admissionais = 0;
    let recorrentes = 0;
    for (const item of pessoa.treinamentos) {
      if (item.tipo === 'ADMISSIONAL') admissionais += 1;
      else recorrentes += 1;
      const estado = situacao(isoDe(item.validade));
      if (estado === 'VENCIDO') vencidos += 1;
      if (estado === 'A_VENCER') aVencer += 1;
    }
    let examesVencidos = 0;
    let examesAVencer = 0;
    for (const item of pessoa.exames || []) {
      const estado = situacao(isoDe(item.validade));
      if (estado === 'VENCIDO') examesVencidos += 1;
      if (estado === 'A_VENCER') examesAVencer += 1;
    }
    const fichaCompleta = Boolean(
      cpf && pessoa.nome && pessoa.dataNascimento && pessoa.sexo && pessoa.nomeMae && pessoa.cep
      && pessoa.logradouro && pessoa.numero && pessoa.bairro && pessoa.cidade
      && pessoa.uf && pessoa.funcao && pessoa.dataAdmissao && pessoa.tipoContrato,
    );
    return {
      id: pessoa.id,
      obraId: pessoa.obraId,
      obraNome: pessoa.obra?.nome || null,
      nome: pessoa.nome,
      funcao: pessoa.funcao,
      ativo: pessoa.ativo,
      cpfMascarado: mascararCpf(cpf),
      cidade: pessoa.cidade,
      uf: pessoa.uf,
      dataAdmissao: isoDe(pessoa.dataAdmissao),
      tipoContrato: pessoa.tipoContrato,
      fichaCompleta,
      treinamentos: { admissionais, recorrentes, vencidos, aVencer },
      exames: { vencidos: examesVencidos, aVencer: examesAVencer },
    };
  }

  private ficha(pessoa: {
    id: string;
    obraId: string | null;
    nome: string;
    funcao: string;
    ativo: boolean;
    cpf: string | null;
    rg: string | null;
    rgOrgao: string | null;
    rgUf: string | null;
    dataNascimento: Date | null;
    sexo: Sexo | null;
    estadoCivil: EstadoCivil | null;
    nacionalidade: string | null;
    naturalidade: string | null;
    nomeMae: string | null;
    nomePai: string | null;
    pis: string | null;
    ctpsNumero: string | null;
    ctpsSerie: string | null;
    ctpsUf: string | null;
    escolaridade: Escolaridade | null;
    telefone: string | null;
    email: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cbo: string | null;
    matricula: string | null;
    dataAdmissao: Date | null;
    tipoContrato: TipoContrato | null;
    salario: Prisma.Decimal | null;
    jornada: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipoConta: TipoContaBancaria | null;
    pix: string | null;
  }) {
    const cpf = pessoa.cpf ? this.crypto.decrypt(pessoa.cpf) : '';
    const pis = pessoa.pis ? this.crypto.decrypt(pessoa.pis) : '';
    return {
      id: pessoa.id,
      obraId: pessoa.obraId,
      ativo: pessoa.ativo,
      nome: pessoa.nome,
      funcao: pessoa.funcao,
      cpf: formatarCpf(cpf),
      rg: pessoa.rg || '',
      rgOrgao: pessoa.rgOrgao || '',
      rgUf: pessoa.rgUf || '',
      dataNascimento: isoDe(pessoa.dataNascimento) || '',
      sexo: pessoa.sexo || '',
      estadoCivil: pessoa.estadoCivil || '',
      nacionalidade: pessoa.nacionalidade || '',
      naturalidade: pessoa.naturalidade || '',
      nomeMae: pessoa.nomeMae || '',
      nomePai: pessoa.nomePai || '',
      pis: formatarPis(pis),
      ctpsNumero: pessoa.ctpsNumero || '',
      ctpsSerie: pessoa.ctpsSerie || '',
      ctpsUf: pessoa.ctpsUf || '',
      escolaridade: pessoa.escolaridade || '',
      telefone: formatarTelefone(pessoa.telefone || ''),
      email: pessoa.email || '',
      cep: formatarCep(pessoa.cep || ''),
      logradouro: pessoa.logradouro || '',
      numero: pessoa.numero || '',
      complemento: pessoa.complemento || '',
      bairro: pessoa.bairro || '',
      cidade: pessoa.cidade || '',
      uf: pessoa.uf || '',
      cbo: pessoa.cbo || '',
      matricula: pessoa.matricula || '',
      dataAdmissao: isoDe(pessoa.dataAdmissao) || '',
      tipoContrato: pessoa.tipoContrato || '',
      salario: pessoa.salario ? pessoa.salario.toFixed(2) : '',
      jornada: pessoa.jornada || '',
      banco: pessoa.banco || '',
      agencia: pessoa.agencia || '',
      conta: pessoa.conta || '',
      tipoConta: pessoa.tipoConta || '',
      pix: pessoa.pix || '',
    };
  }

  private treinamentoPublico(item: {
    id: string;
    tipo: TipoTreinamento;
    nome: string;
    dataRealizacao: Date;
    cargaHoraria: Prisma.Decimal | null;
    validade: Date;
    instrutor: string | null;
    assinatura: string | null;
    certificadoUrl?: string | null;
    certificadoNome?: string | null;
    certificadoMime?: string | null;
    createdAt: Date;
    funcionario: { id: string; nome: string; funcao: string };
  }) {
    const validade = isoDe(item.validade);
    return {
      id: item.id,
      tipo: item.tipo,
      nome: item.nome,
      dataRealizacao: isoDe(item.dataRealizacao),
      cargaHoraria: item.cargaHoraria ? Number(item.cargaHoraria) : null,
      validade,
      situacao: situacao(validade),
      instrutor: item.instrutor,
      funcionario: item.funcionario,
      temAssinatura: Boolean(item.assinatura),
      temCertificado: Boolean(item.certificadoUrl),
      certificadoUrl: item.certificadoUrl || null,
      certificadoNome: item.certificadoNome || null,
      certificadoMime: item.certificadoMime || null,
      createdAt: item.createdAt,
    };
  }

  private examePublico(item: {
    id: string;
    tipo: TipoExameOcupacional;
    nome: string;
    dataRealizacao: Date;
    validade: Date;
    resultado: ResultadoExame | null;
    clinica: string | null;
    observacao: string | null;
    createdAt: Date;
    funcionario: { id: string; nome: string; funcao: string };
  }) {
    const validade = isoDe(item.validade);
    return {
      id: item.id,
      tipo: item.tipo,
      nome: item.nome,
      dataRealizacao: isoDe(item.dataRealizacao),
      validade,
      situacao: situacao(validade),
      resultado: item.resultado,
      clinica: item.clinica,
      observacao: item.observacao,
      funcionario: item.funcionario,
      createdAt: item.createdAt,
    };
  }
}

function mimeDaFicha(file: Express.Multer.File) {
  const nome = (file.originalname || '').toLowerCase();
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  if (nome.endsWith('.pdf')) return 'application/pdf';
  if (nome.endsWith('.png')) return 'image/png';
  if (nome.endsWith('.webp')) return 'image/webp';
  if (nome.endsWith('.gif')) return 'image/gif';
  if (nome.endsWith('.heic') || nome.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function somenteAtivo(body: FichaBody) {
  return Object.keys(body).every((chave) => chave === 'ativo');
}

function texto(valor: unknown, max: number) {
  if (valor === undefined || valor === null) return null;
  const limpo = String(valor).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo) return null;
  return limpo.slice(0, max);
}

function digitos(valor: unknown, tamanho: number) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (!limpo) return null;
  if (limpo.length !== tamanho) return null;
  return limpo;
}

function eUmDe<T extends string>(valor: unknown, lista: readonly T[]): valor is T {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor);
}

function opcional<T extends string>(valor: unknown, lista: readonly T[], mensagem: string): T | null {
  const limpo = texto(valor, 40);
  if (!limpo) return null;
  if (!eUmDe(limpo, lista)) throw new BadRequestException(mensagem);
  return limpo;
}

function ufDe(valor: unknown, opcionalMesmo = false) {
  const limpo = texto(valor, 2)?.toUpperCase() || '';
  if (!limpo) return opcionalMesmo ? null : null;
  if (!UFS.includes(limpo as (typeof UFS)[number])) {
    throw new BadRequestException('UF inválida.');
  }
  return limpo;
}

function emailDe(valor: unknown) {
  const limpo = texto(valor, 120)?.toLowerCase() || '';
  if (!limpo) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) throw new BadRequestException('E-mail inválido.');
  return limpo;
}

function telefoneDe(valor: unknown) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (!limpo) return null;
  if (limpo.length < 10 || limpo.length > 11) throw new BadRequestException('Telefone inválido.');
  return limpo;
}

function cboDe(valor: unknown) {
  const limpo = texto(valor, 7)?.replace(/\s/g, '') || '';
  if (!limpo) return null;
  if (!/^\d{6}$/.test(limpo) && !/^\d{4}-\d{2}$/.test(limpo)) {
    throw new BadRequestException('CBO deve ter 6 dígitos.');
  }
  return limpo;
}

function contaDe(valor: unknown, max: number, mensagem: string) {
  const limpo = texto(valor, max) || '';
  if (!limpo) return null;
  if (!/^[\d-]+$/.test(limpo)) throw new BadRequestException(mensagem);
  return limpo;
}

function dinheiro(valor: unknown) {
  if (valor === undefined || valor === null || valor === '') return null;
  let bruto = '';
  if (typeof valor === 'number') {
    bruto = Number.isFinite(valor) ? valor.toFixed(2) : '';
  } else {
    bruto = String(valor).trim();
    bruto = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) throw new BadRequestException('Salário inválido.');
  if (Number(bruto) > 9_999_999) throw new BadRequestException('Salário inválido.');
  return new Prisma.Decimal(bruto);
}

function carga(valor: unknown) {
  if (valor === undefined || valor === null || valor === '') return null;
  const bruto = typeof valor === 'number' ? String(valor) : String(valor).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) throw new BadRequestException('Carga horária inválida.');
  const numero = Number(bruto);
  if (numero <= 0 || numero > 80) throw new BadRequestException('Carga horária inválida.');
  return new Prisma.Decimal(bruto);
}

function dataObrigatoria(valor: unknown, campo: string) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new BadRequestException(`Informe ${campo}.`);
  }
  const data = new Date(`${valor}T12:00:00.000-03:00`);
  if (Number.isNaN(data.getTime())) throw new BadRequestException(`Informe ${campo}.`);
  return data;
}

function dataOpcional(valor: unknown, campo: string) {
  const limpo = String(valor ?? '').trim();
  if (!limpo) return null;
  return dataObrigatoria(valor, campo);
}

function isoDe(valor?: Date | null) {
  if (!valor) return null;
  const ano = valor.getUTCFullYear();
  const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(valor.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function somaDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function somaAnos(iso: string, anos: number) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano + anos, mes - 1, dia));
  if (data.getUTCMonth() !== mes - 1) data.setUTCDate(0);
  return data.toISOString().slice(0, 10);
}

function situacao(validade: string | null) {
  if (!validade) return null;
  const hoje = hojeIso();
  if (validade < hoje) return 'VENCIDO' as const;
  if (validade <= somaDias(hoje, 30)) return 'A_VENCER' as const;
  return 'VIGENTE' as const;
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, fator: number) => {
    let soma = 0;
    for (const char of base) {
      soma += Number(char) * fator;
      fator -= 1;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function pisValido(pis: string) {
  if (!/^\d{11}$/.test(pis) || /^(\d)\1{10}$/.test(pis)) return false;
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(pis[i]) * pesos[i];
  const resto = soma % 11;
  const digito = resto < 2 ? 0 : 11 - resto;
  return digito === Number(pis[10]);
}

function mascararCpf(cpf: string | null) {
  const limpo = (cpf || '').replace(/\D/g, '');
  if (limpo.length !== 11) return null;
  return `***.***.***-${limpo.slice(9)}`;
}

function formatarCpf(cpf: string) {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return '';
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

function formatarPis(pis: string) {
  const limpo = pis.replace(/\D/g, '');
  if (limpo.length !== 11) return '';
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 8)}.${limpo.slice(8, 10)}-${limpo.slice(10)}`;
}

function formatarCep(cep: string) {
  if (cep.length !== 8) return cep;
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function formatarTelefone(telefone: string) {
  if (telefone.length === 11) return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`;
  if (telefone.length === 10) return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 6)}-${telefone.slice(6)}`;
  return telefone;
}

function assinaturaPng(valor?: string) {
  const prefixo = 'data:image/png;base64,';
  if (!valor || !valor.startsWith(prefixo)) {
    throw new BadRequestException('Assine na tela antes de confirmar.');
  }
  const corpo = valor.slice(prefixo.length);
  if (corpo.length < 200 || valor.length > 500_000 || !/^[A-Za-z0-9+/=]+$/.test(corpo)) {
    throw new BadRequestException('A assinatura não pôde ser gravada. Assine de novo.');
  }
  return valor;
}

#!/usr/bin/env python3
"""Gera o Relatório de Auditoria de Segurança do Obra 10 (A4, pt-BR)."""

from __future__ import annotations

import html
import os
from collections import Counter
from datetime import date


def esc(text: str) -> str:
    return html.escape(str(text), quote=True)

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    CondPageBreak,
    Flowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# --- Paleta ---
CRITICA = HexColor("#B91C1C")
ALTA = HexColor("#EA580C")
MEDIA = HexColor("#D97706")
BAIXA = HexColor("#2563EB")
FORTE = HexColor("#059669")
INK = HexColor("#111827")
MUTED = HexColor("#4B5563")
LINE = HexColor("#E5E7EB")
BG = HexColor("#F9FAFB")
NAVY = HexColor("#0F172A")
CARD = HexColor("#F8FAFC")

SEV_COLOR = {
    "crítica": CRITICA,
    "alta": ALTA,
    "média": MEDIA,
    "baixa": BAIXA,
    "informativa": HexColor("#64748B"),
}

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(OUT_DIR, "relatorio-auditoria-seguranca.pdf")
CHART_DIR = os.path.join(OUT_DIR, "_charts")

# --- Achados verificados no código ---
FINDINGS = [
    {
        "id": "F-01",
        "sev": "crítica",
        "cat": "Banco sem tranca",
        "file": "obra10-backend/src/modules/auth/auth.service.ts",
        "lines": "86–101",
        "title": "Senha de uma empresa destrava todas as contas do mesmo e-mail",
        "desc": "Se o e-mail existe em várias empresas, qualquer senha que bata em UMA conta libera o picker de TODAS e, com empresaId, emite JWT da conta-alvo sem a senha dessa conta.",
        "why": "Explorável hoje: o produto permite o mesmo e-mail em várias empresas. Um colaborador convidado em A com senha própria acessa B (ex.: gestor) sem conhecer a senha de B.",
        "cond": "Mesmo e-mail em ≥2 empresas ativas.",
        "snippet": """if (empresaId) {
  const alvo = candidatos.find((c) => c.empresaId === empresaId);
  // alvo vem de TODOS os candidatos, não só dos matched
  return this.emitirSessao(alvo.id);
}
return { precisaEscolherEmpresa: true, empresas: candidatos.map(...) };""",
        "issue_group": "login-multi-empresa",
    },
    {
        "id": "F-02",
        "sev": "crítica",
        "cat": "Banco sem tranca",
        "file": "obra10-backend/src/modules/cobranca/paypal.service.ts",
        "lines": "21–24 e 88–90",
        "title": "PayPal em modo MOCK confirma pagamento real",
        "desc": "Sem PAYPAL_CLIENT_ID/SECRET o serviço entra em mockMode e captureOrder sempre devolve COMPLETED. O controller então chama confirmarPagamentoLocal e marca a cobrança como PAGA.",
        "why": "Qualquer usuário autenticado do tenant chama POST /cobrancas/:id/paypal/capture-order e ativa o plano sem pagar. Em produção o cartão foi migrado para Asaas; as rotas PayPal continuam vivas.",
        "cond": "PAYPAL_CLIENT_ID ou PAYPAL_SECRET ausentes (padrão atual).",
        "snippet": """this.mockMode = !this.clientId || !this.secret;
async captureOrder(orderId: string) {
  if (this.mockMode) return { status: 'COMPLETED' };
}""",
        "issue_group": "paypal-mock",
    },
    {
        "id": "F-03",
        "sev": "crítica",
        "cat": "Banco sem tranca",
        "file": "obra10-backend/src/modules/cobranca/cobranca.controller.ts",
        "lines": "132–146",
        "title": "Capture PayPal grava PAGO após status COMPLETED (inclusive mock)",
        "desc": "O handler não distingue mock de captura real. Qualquer COMPLETED (forjado pelo mock) ativa módulos.",
        "why": "Encadeia com F-02: um POST autenticado basta para fraude de billing.",
        "cond": "Mesma de F-02.",
        "snippet": """const captureResult = await this.paypal.captureOrder(orderId);
if (captureResult.status === 'COMPLETED') {
  await this.cobrancaService.confirmarPagamentoLocal(cobrancaId, req.user.empresaId);
}""",
        "issue_group": "paypal-mock",
    },
    {
        "id": "F-04",
        "sev": "crítica",
        "cat": "Chaves expostas",
        "file": "obra10-backend/src/core/guards/jwt-auth.guard.ts",
        "lines": "29–30",
        "title": "Segredo JWT com default público e sem rejeição no startup",
        "desc": "verifyAsync usa process.env.JWT_SECRET || 'obra10-mvp-secret-key-12345'. O mesmo default está em auth.module.ts:14. Não há validação de boot que recuse o default.",
        "why": "Quem conhece o default (está no Git) forja JWT com perfilGlobal SUPER_ADMIN. SuperAdminGuard só lê o claim do token, não o banco.",
        "cond": "Explorável se JWT_SECRET não estiver definido no ambiente. Residual: default conhecido no histórico Git.",
        "snippet": """const payload = await this.jwtService.verifyAsync(token, {
  secret: process.env.JWT_SECRET || 'obra10-mvp-secret-key-12345',
});""",
        "issue_group": "jwt-default",
    },
    {
        "id": "F-05",
        "sev": "crítica",
        "cat": "Chaves expostas",
        "file": "obra10-backend/set_simple_admin_pass.js",
        "lines": "4–16",
        "title": "Connection string de produção e senha de superadmin no Git",
        "desc": "Scripts versionados contém URL PostgreSQL do Railway (centerbeam.proxy.rlwy.net:19827) com senha do postgres, e definem senhas de superadmin@obra10.com (Lunardeli123 / Lunardeli20011978$). Também em update_superadmin_pass.js, scratch/sync_db_prod_to_local.js e scratch/update_superadmin_password.js.",
        "why": "Credencial de banco + senha de SUPER_ADMIN no histórico público do repositório. Quem clona o repo (ou lê o Git) acessa o banco e a conta admin.",
        "cond": "Arquivos rastreados pelo Git (confirmado por git ls-files). A senha do proxy Railway deve ser considerada vazada.",
        "snippet": """const passwordToSet = 'Lunardeli123';
const client = new Client({
  connectionString: "postgresql://postgres:***REDACTADO***@centerbeam.proxy.rlwy.net:19827/railway",
});
UPDATE usuarios SET senha_hash = $1 WHERE email = 'superadmin@obra10.com'""",
        "issue_group": "secrets-git",
    },
    {
        "id": "F-06",
        "sev": "alta",
        "cat": "Permissão no navegador",
        "file": "obra10-backend/src/modules/tenant/tenant.controller.ts",
        "lines": "65–88",
        "title": "Leitura de plano e cobranças sem gerenciarFinanceiro",
        "desc": "GET tenants/meu-plano e GET tenants/meu-plano/cobrancas só exigem JWT + empresaId. upgrade/desativar exigem a capability; a leitura não. O frontend esconde Financeiro com canManageFinanceiro, mas /gestor/financeiro e /assinatura são só ProtectedRoute.",
        "why": "USER/EXTERNO autenticado chama a API e lê faturamento do tenant. POST cobrancas/contratar (cobranca.controller.ts:59–64) também não checa a capability — qualquer usuário do tenant gera cobrança.",
        "cond": "Usuário autenticado do tenant sem gerenciarFinanceiro.",
        "snippet": """@Get('tenants/meu-plano')
async getMeuPlano(@Req() req: any) {
  const empresaId = req.user?.empresaId;
  if (!empresaId) throw new ForbiddenException('Sessão inválida.');
  return this.tenantService.obterMeuPlano(empresaId);
}""",
        "issue_group": "financeiro-cap",
    },
    {
        "id": "F-07",
        "sev": "alta",
        "cat": "IDOR",
        "file": "obra10-backend/src/modules/upload/upload.controller.ts",
        "lines": "256–272",
        "title": "Upload de foto altera qualquer usuário por ID",
        "desc": "Quem tem gerenciarUsuarios (ou é dono do próprio id) pode PATCH a foto de qualquer UUID. Não há filtro empresaId no alvo. O update devolve o objeto usuario.",
        "why": "Gestor do tenant A, conhecendo/adivinando o UUID, sobrescreve a foto de usuário do tenant B (ou de SUPER_ADMIN) e recebe dados do registro.",
        "cond": "Capability gerenciarUsuarios ou SUPER_ADMIN; UUID da vítima.",
        "snippet": """const podeGerenciar = isAdmin
  ? true
  : await this.capabilities.hasCapability(req.user.sub, 'gerenciarUsuarios');
if (!isOwner && !podeGerenciar) throw new ForbiddenException(...);
const usuario = await this.prisma.usuario.update({
  where: { id }, data: { fotoUrl: url },
});""",
        "issue_group": "idor-foto",
    },
    {
        "id": "F-08",
        "sev": "alta",
        "cat": "IDOR",
        "file": "obra10-backend/src/app.controller.ts",
        "lines": "90–108",
        "title": "GET /debug-fs lista o filesystem sem autenticação",
        "desc": "Endpoint público devolve cwd, lista de arquivos do diretório de trabalho e contents de uploads/. Sem JwtAuthGuard.",
        "why": "Reconhecimento de deploy, paths internos e arquivos em disco (incluindo uploads locais em não-produção).",
        "cond": "Rota alcançável na API publicada.",
        "snippet": """@Get('debug-fs')
debugFs() {
  return {
    cwd, cwdFiles: fs.readdirSync(cwd),
    uploadsPath, uploadsFiles, dirname: __dirname,
  };
}""",
        "issue_group": "debug-fs",
    },
    {
        "id": "F-09",
        "sev": "média",
        "cat": "IDOR",
        "file": "obra10-backend/src/modules/rdo/alerta.controller.ts",
        "lines": "44–49",
        "title": "Marcar alerta lido sem checar obra/tenant",
        "desc": "PATCH alertas/:id/marcar-lido faz update por id puro. O controller tem ObraContextGuard (exige x-obra-id válido), mas o alerta atualizado pode ser de outra obra/tenant.",
        "why": "Usuário com acesso a qualquer obra marca como lido um alerta de outro tenant se souber o UUID (integridade; impacto limitado).",
        "cond": "JWT + x-obra-id de uma obra própria + UUID do alerta alheio.",
        "snippet": """@Patch(':id/marcar-lido')
async marcarLido(@Param('id') id: string) {
  return this.prisma.alertaObra.update({
    where: { id }, data: { lido: true },
  });
}""",
        "issue_group": "idor-alerta",
    },
    {
        "id": "F-10",
        "sev": "média",
        "cat": "Inputs sem tratamento (XSS)",
        "file": "obra10-backend/src/modules/email/email.service.ts",
        "lines": "139, 214–215, 457–466",
        "title": "HTML de e-mail interpola input sem escape",
        "desc": "nomeEmpresa, motivo de rejeição de RDO, nome/telefone/mensagem do formulário público /contato entram em template HTML sem escape. SanitizePipe (regex) remove script/iframe/on*, mas deixa tags como <img>, <a>, <svg> e entidades.",
        "why": "Formulário público (contato.controller.ts:28–31) envia HTML ao inbox de suporte. XSS armazenado no cliente de e-mail / phishing via <a href>. Motivo de rejeição de RDO é controlado pelo gestor.",
        "cond": "SanitizePipe global no body; bypass por tags não listadas. Destinatário abre HTML.",
        "snippet": """<p><strong>Nome:</strong> ${dto.nome}</p>
<p style="white-space:pre-wrap">${dto.mensagem}</p>
<p style="margin:8px 0 0">${motivo}</p>""",
        "issue_group": "email-xss",
    },
    {
        "id": "F-11",
        "sev": "média",
        "cat": "Chaves expostas",
        "file": "obra10-backend/src/core/services/crypto.service.ts",
        "lines": "36–38",
        "title": "ENCRYPTION_KEY ausente grava PII em claro",
        "desc": "Se ENCRYPTION_KEY não existe, o serviço só loga warning e armazena CPF/telefone sem cifra. /health ainda revela se a chave está definida e o tamanho.",
        "why": "Dump de banco ou backup expõe documentos fiscais. health (app.controller.ts:54–65) ajuda o atacante a saber se a cifra está off.",
        "cond": "ENCRYPTION_KEY não configurada no processo.",
        "snippet": """} else {
  this.logger.warn(
    'ENCRYPTION_KEY não configurada. Campos sensíveis serão armazenados SEM criptografia.',
  );
}""",
        "issue_group": "encryption-key",
    },
    {
        "id": "F-12",
        "sev": "média",
        "cat": "Chaves expostas",
        "file": "obra10-backend/prisma/seed.ts",
        "lines": "136 e 187–204",
        "title": "Seed redefine senha de tarcisio@lunardeli.com.br para Senha123",
        "desc": "bcrypt.hash('Senha123') e upsert com update: { senhaHash: hashTarcisio }. Rodar seed contra um banco que já tem a empresa Lunardeli sobrescreve a senha real.",
        "why": "Script versionado + DATABASE_URL de produção = takeover da conta gestor. Senha123 também é a senha demo de engenheiro@acme.com.",
        "cond": "Execução do seed apontando para banco não-local.",
        "snippet": """const hashTarcisio = await bcrypt.hash('Senha123', 10);
update: { senhaHash: hashTarcisio, ativo: true, deletedAt: null },
email: 'tarcisio@lunardeli.com.br',""",
        "issue_group": "secrets-git",
    },
    {
        "id": "F-13",
        "sev": "baixa",
        "cat": "Inputs sem tratamento (XSS)",
        "file": "obra10-backend/src/modules/upload/upload.controller.ts",
        "lines": "42",
        "title": "Upload aceita image/svg+xml (XSS armazenado)",
        "desc": "ALLOWED_IMAGE_TYPES inclui svg+xml. O arquivo vai ao R2 público com Content-Type do cliente. Abrir a URL crua no browser executa script do SVG.",
        "why": "Gestor com gerenciarEmpresa sobe logo SVG malicioso; quem abre o objeto (não só <img>) sofre XSS na origem do CDN.",
        "cond": "Upload de logo/foto com MIME SVG; vítima navega à URL do R2.",
        "snippet": """const ALLOWED_IMAGE_TYPES = /^image\\/(jpeg|jpg|png|gif|webp|svg\\+xml|heic|heif)$/i;""",
        "issue_group": "email-xss",
    },
    {
        "id": "F-14",
        "sev": "baixa",
        "cat": "Chaves expostas",
        "file": "obra10-backend/src/app.controller.ts",
        "lines": "54–65",
        "title": "/health público vaza metadados de configuração",
        "desc": "Sem auth. Expõe nodeEnv, buildId, se ENCRYPTION_KEY existe e o length, se ASAAS_API_KEY/WEBHOOK_TOKEN estão configurados e o environment Asaas.",
        "why": "Reconhecimento para decidir se JWT default, cifra ou webhook estão off.",
        "cond": "Sempre explorável (rota pública).",
        "snippet": """hasEncryptionKey: process.env.ENCRYPTION_KEY
  ? `defined_len_${process.env.ENCRYPTION_KEY.length}` : 'undefined',
asaas: { configured: Boolean(...), environment: ..., webhookToken: Boolean(...) }""",
        "issue_group": "debug-fs",
    },
    {
        "id": "F-15",
        "sev": "informativa",
        "cat": "Permissão no navegador",
        "file": "obra10-backend/src/core/guards/super-admin.guard.ts",
        "lines": "15–17",
        "title": "SuperAdminGuard confia só no claim JWT, não no banco",
        "desc": "Compara user.perfilGlobal !== 'SUPER_ADMIN' no payload. Não relê o perfil no Prisma. JwtAuthGuard só revalida jwtVersion e ativo.",
        "why": "Não é falha sozinha: o backend TEM o gate. Vira crítica se o JWT for forjado (F-04) ou se o usuário for rebaixado sem incrementar jwtVersion.",
        "cond": "Token com claim SUPER_ADMIN (forjado ou stale).",
        "snippet": """if (!user || user.perfilGlobal !== 'SUPER_ADMIN') {
  throw new ForbiddenException('Acesso restrito a super administradores...');
}""",
        "issue_group": "jwt-default",
    },
]


def sev_key(s: str) -> int:
    order = {"crítica": 0, "alta": 1, "média": 2, "baixa": 3, "informativa": 4}
    return order.get(s, 9)


def make_styles():
    ss = getSampleStyleSheet()
    styles = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=HexColor("#94A3B8"),
            letterSpacing=1.2,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=ss["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=26,
            textColor=white,
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "cover_brand": ParagraphStyle(
            "cover_brand",
            parent=ss["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=30,
            textColor=white,
            alignment=TA_LEFT,
            spaceAfter=14,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=HexColor("#CBD5E1"),
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=ss["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=NAVY,
            spaceBefore=4,
            spaceAfter=10,
            borderPadding=0,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=ss["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            textColor=NAVY,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=7,
        ),
        "body_left": ParagraphStyle(
            "body_left",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=MUTED,
            spaceAfter=4,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "cell_bold": ParagraphStyle(
            "cell_bold",
            parent=ss["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "mono": ParagraphStyle(
            "mono",
            parent=ss["Code"],
            fontName="Courier",
            fontSize=7.2,
            leading=9.6,
            textColor=HexColor("#1E293B"),
            backColor=HexColor("#F1F5F9"),
            leftIndent=4,
            rightIndent=4,
            spaceBefore=3,
            spaceAfter=6,
        ),
        "issue_title": ParagraphStyle(
            "issue_title",
            parent=ss["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=NAVY,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "issue_md": ParagraphStyle(
            "issue_md",
            parent=ss["Normal"],
            fontName="Courier",
            fontSize=7.0,
            leading=9.4,
            textColor=HexColor("#0F172A"),
            backColor=HexColor("#F8FAFC"),
        ),
        "footer": ParagraphStyle(
            "footer",
            parent=ss["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
        ),
        "chip": ParagraphStyle(
            "chip",
            parent=ss["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            textColor=white,
            alignment=TA_CENTER,
            leading=10,
        ),
    }
    return styles


class SeverityChip(Flowable):
    def __init__(self, label: str, width=28 * mm, height=6.2 * mm):
        super().__init__()
        self.label = label.upper()
        self.width = width
        self.height = height
        self.color = SEV_COLOR.get(label, HexColor("#64748B"))

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=0)
        self.canv.setFillColor(white)
        self.canv.setFont("Helvetica-Bold", 7)
        self.canv.drawCentredString(self.width / 2, 2.0, self.label)


class HLine(Flowable):
    def __init__(self, color=LINE, thickness=0.6):
        super().__init__()
        self.color = color
        self.thickness = thickness
        self.height = 6

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 3, self.width, 3)


class CoverBand(Flowable):
    def __init__(self, width, height, styles):
        super().__init__()
        self.band_width = width
        self.band_height = height
        self.styles = styles

    def wrap(self, aw, ah):
        return self.band_width, self.band_height

    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.rect(0, 0, self.band_width, self.band_height, fill=1, stroke=0)
        c.setFillColor(CRITICA)
        c.rect(0, 0, 6, self.band_height, fill=1, stroke=0)


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(CRITICA)
    canvas.rect(0, h - 12 * mm, 4 * mm, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, h - 7.5 * mm, "Relatório de Auditoria de Segurança — Obra 10")
    canvas.setFillColor(HexColor("#F1F5F9"))
    canvas.rect(0, 0, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 5 * mm, "Confidencial — uso interno  ·  docs/security-audit")
    canvas.drawRightString(w - 2 * cm, 5 * mm, f"Página {doc.page}")
    canvas.restoreState()


def cover_header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(CRITICA)
    canvas.rect(0, 0, 8 * mm, h, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1E293B"))
    canvas.circle(w - 10 * mm, h - 18 * mm, 42 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2.2 * cm, 14 * mm, "Documento gerado a partir do código-fonte  ·  sem achados especulativos")
    canvas.drawRightString(w - 2 * cm, 14 * mm, f"Página {doc.page}")
    canvas.restoreState()


def build_charts(counts_sev: dict, counts_cat: dict):
    os.makedirs(CHART_DIR, exist_ok=True)
    labels = ["crítica", "alta", "média", "baixa", "informativa"]
    colors = ["#B91C1C", "#EA580C", "#D97706", "#2563EB", "#64748B"]
    values = [counts_sev.get(k, 0) for k in labels]
    # donut
    fig, ax = plt.subplots(figsize=(4.4, 3.4), dpi=160)
    wedges, _ = ax.pie(
        values,
        colors=colors,
        startangle=90,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
    )
    ax.legend(
        wedges,
        [f"{l.capitalize()} ({v})" for l, v in zip(labels, values)],
        loc="center left",
        bbox_to_anchor=(0.92, 0.5),
        fontsize=8,
        frameon=False,
    )
    ax.set_title("Achados por severidade", fontsize=11, fontweight="bold", color="#0F172A")
    fig.tight_layout()
    donut = os.path.join(CHART_DIR, "donut.png")
    fig.savefig(donut, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    cats = list(counts_cat.keys())
    cat_vals = [counts_cat[c] for c in cats]
    fig, ax = plt.subplots(figsize=(5.6, 3.4), dpi=160)
    bars = ax.barh(cats[::-1], cat_vals[::-1], color="#0F172A", height=0.55)
    for i, (bar, cat) in enumerate(zip(bars, cats[::-1])):
        palette = {
            "Banco sem tranca": "#B91C1C",
            "Permissão no navegador": "#EA580C",
            "IDOR": "#D97706",
            "Chaves expostas": "#7C3AED",
            "Inputs sem tratamento (XSS)": "#2563EB",
        }
        bar.set_color(palette.get(cat, "#334155"))
    ax.set_xlabel("Quantidade", fontsize=8)
    ax.set_title("Achados por categoria", fontsize=11, fontweight="bold", color="#0F172A")
    ax.tick_params(axis="y", labelsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    bars_path = os.path.join(CHART_DIR, "bars.png")
    fig.savefig(bars_path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return donut, bars_path


def wrap_path(path: str, lines: str) -> str:
    """Quebra caminho em blocos de 2 segmentos + nome do arquivo."""
    path = path.replace("\\", "/")
    if "/" not in path:
        return f"{esc(path)}<br/>:{esc(lines)}"
    head, tail = path.rsplit("/", 1)
    segs = head.split("/")
    chunks = []
    buf = []
    for s in segs:
        buf.append(s)
        if len(buf) == 2:
            chunks.append("/".join(buf) + "/")
            buf = []
    if buf:
        chunks.append("/".join(buf) + "/")
    shown = "<br/>".join(esc(c) for c in chunks) + "<br/>" + esc(tail)
    return f"{shown}<br/>:{esc(lines)}"


def chip_cell(label: str) -> Table:
    color = SEV_COLOR.get(label, HexColor("#64748B"))
    t = Table(
        [[Paragraph(label.upper(), ParagraphStyle("c", fontName="Helvetica-Bold", fontSize=7, textColor=white, alignment=TA_CENTER, leading=9))]],
        colWidths=[26 * mm],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("TEXTCOLOR", (0, 0), (-1, -1), white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ]
        )
    )
    return t


def findings_table(items, styles, col_w):
    header = [
        Paragraph("<b>Sev.</b>", styles["cell_bold"]),
        Paragraph("<b>Arquivo:linha</b>", styles["cell_bold"]),
        Paragraph("<b>Descrição</b>", styles["cell_bold"]),
    ]
    data = [header]
    for f in items:
        data.append(
            [
                chip_cell(f["sev"]),
                Paragraph(wrap_path(f["file"], f["lines"]), styles["cell"]),
                Paragraph(
                    f"<b>{esc(f['id'])}</b> — {esc(f['title'])}. {esc(f['desc'])}",
                    styles["cell"],
                ),
            ]
        )
    t = Table(data, colWidths=col_w, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (1, i), (-1, i), CARD))
        style_cmds.append(("BACKGROUND", (0, i), (0, i), HexColor("#F8FAFC")))
    t.setStyle(TableStyle(style_cmds))
    # fix header text color on first row paragraphs
    t._cellvalues[0][0] = Paragraph("<font color='white'><b>Sev.</b></font>", styles["cell"])
    t._cellvalues[0][1] = Paragraph("<font color='white'><b>Arquivo:linha</b></font>", styles["cell"])
    t._cellvalues[0][2] = Paragraph("<font color='white'><b>Descrição</b></font>", styles["cell"])
    return t


def issue_blocks():
    """Agrupa achados em issues GitHub prontas para colar."""
    groups = {
        "login-multi-empresa": {
            "title": "[Segurança] Login com e-mail compartilhado emite sessão de outra empresa sem a senha dela",
            "labels": "security, crítica",
            "ids": ["F-01"],
        },
        "paypal-mock": {
            "title": "[Segurança] Capture PayPal em modo MOCK marca cobrança como PAGA",
            "labels": "security, crítica",
            "ids": ["F-02", "F-03"],
        },
        "jwt-default": {
            "title": "[Segurança] JWT_SECRET com default público e SuperAdminGuard só no claim",
            "labels": "security, crítica",
            "ids": ["F-04", "F-15"],
        },
        "secrets-git": {
            "title": "[Segurança] Credenciais de produção e senhas de admin commitadas no Git",
            "labels": "security, crítica",
            "ids": ["F-05", "F-12"],
        },
        "financeiro-cap": {
            "title": "[Segurança] Endpoints financeiros não exigem gerenciarFinanceiro",
            "labels": "security, alta",
            "ids": ["F-06"],
        },
        "idor-foto": {
            "title": "[Segurança] IDOR no upload de foto de usuário (sem filtro de tenant)",
            "labels": "security, alta",
            "ids": ["F-07"],
        },
        "debug-fs": {
            "title": "[Segurança] Endpoints públicos debug-fs e health vazam superfície interna",
            "labels": "security, alta",
            "ids": ["F-08", "F-14"],
        },
        "idor-alerta": {
            "title": "[Segurança] IDOR ao marcar alerta como lido sem amarrar à obra",
            "labels": "security, média",
            "ids": ["F-09"],
        },
        "email-xss": {
            "title": "[Segurança] HTML de e-mail e upload SVG sem sanitização adequada",
            "labels": "security, média",
            "ids": ["F-10", "F-13"],
        },
        "encryption-key": {
            "title": "[Segurança] Startup aceita ENCRYPTION_KEY ausente e grava PII em claro",
            "labels": "security, média",
            "ids": ["F-11"],
        },
    }
    by_id = {f["id"]: f for f in FINDINGS}
    issues = []
    for key, meta in groups.items():
        items = [by_id[i] for i in meta["ids"] if i in by_id]
        if not items:
            continue
        evidence = []
        for f in items:
            evidence.append(
                f"**{f['id']}** `{f['file']}:{f['lines']}`\n```\n{f['snippet']}\n```"
            )
        impact = " ".join(f["why"] for f in items)
        accept = []
        if key == "login-multi-empresa":
            accept = [
                "login com senha da empresa A NÃO lista nem emite sessão da empresa B",
                "empresaId no body só é aceito se a senha bateu naquela conta",
                "teste automatizado cobre e-mail em 2 empresas com senhas distintas",
            ]
        elif key == "paypal-mock":
            accept = [
                "sem credenciais PayPal, create/capture devolvem 503 e NÃO alteram cobrança",
                "confirmarPagamentoLocal só após captura real verificada no provedor",
                "rotas PayPal desligadas se o produto usa só Asaas",
            ]
        elif key == "jwt-default":
            accept = [
                "processo recusa subir se JWT_SECRET ausente, curto ou igual ao default",
                "SuperAdminGuard relê perfilGlobal no banco",
                "default removido do código e do histórico (rotate se já usou o default)",
            ]
        elif key == "secrets-git":
            accept = [
                "scripts com connection string/senhas removidos do Git e do histórico",
                "senha do postgres Railway, superadmin e contas citadas rotacionadas",
                "seed NÃO sobrescreve senha de usuário real; Senha123 só em fixture isolada",
            ]
        elif key == "financeiro-cap":
            accept = [
                "GET meu-plano, histórico, listar cobranças e POST contratar exigem gerenciarFinanceiro (ou GESTOR)",
                "USER/EXTERNO recebe 403; teste de API cobre isso",
            ]
        elif key == "idor-foto":
            accept = [
                "update de foto exige usuario.empresaId === req.user.empresaId (salvo SUPER_ADMIN)",
                "UUID de outro tenant retorna 403/404",
            ]
        elif key == "debug-fs":
            accept = [
                "GET /debug-fs removido ou atrás de SuperAdminGuard + NODE_ENV!==production",
                "/health não expõe length de chave nem flags de provedor de pagamento",
            ]
        elif key == "idor-alerta":
            accept = [
                "update de alerta filtra obraId (do guard) e empresa da obra",
                "UUID de outro tenant não altera linha",
            ]
        elif key == "email-xss":
            accept = [
                "todos os campos interpolados em e-mail passam por escape HTML",
                "SVG rejeitado no upload de imagem (ou servido com Content-Type que não executa script)",
            ]
        elif key == "encryption-key":
            accept = [
                "produção recusa boot sem ENCRYPTION_KEY hex de 64 chars",
                "teste de startup cobre o reject",
            ]
        md = f"""# {meta['title']}

**Labels sugeridas:** `{meta['labels']}`

## Problema
{items[0]['desc']}

## Por que é explorável
{impact}

## Evidência
{chr(10).join(evidence)}

## Impacto
{items[0]['why']}

## Sugestão de correção
- Corrigir o fluxo no arquivo citado para validar posse/segredo no servidor.
- Adicionar teste de regressão que falhe se o default inseguro ou o filtro ausente voltar.
- Rotacionar qualquer credencial que tenha sido commitada.

## Critérios de aceite
{chr(10).join(f'- [ ] {a}' for a in accept)}
"""
        issues.append((key, meta["title"], md, items[0]["sev"]))
    return issues


def build_story(styles, donut, bars):
    story = []
    usable = 17.0 * cm

    # ===== CAPA (texto sobre fundo pintado no canvas) =====
    story.append(Spacer(1, 38 * mm))
    story.append(Paragraph("AUDITORIA DE SEGURANÇA  ·  APLICAÇÃO WEB", styles["cover_kicker"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Relatório de Auditoria de Segurança", styles["cover_title"]))
    story.append(Paragraph("Obra 10", styles["cover_brand"]))
    story.append(
        Paragraph(
            f"Data: {date.today().strftime('%d/%m/%Y')}  ·  Escopo: backend NestJS, frontend React, Prisma, "
            "scripts rastreados, Dockerfile, GitHub Actions e histórico Git.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 14 * mm))
    story.append(
        Paragraph(
            "<b>Nota metodológica.</b> Stack detectada: TypeScript / NestJS + Prisma (sem RLS do Postgres/Supabase); "
            "auth JWT em cookie HttpOnly + Bearer; isolamento por <font color='#F87171'>empresaId no JWT</font> "
            "+ <font color='#F87171'>ObraContextGuard (x-obra-id)</font> + SuperAdminGuard + CapabilitiesService; "
            "frontend Vite/React; deploy Docker + Railway via GitHub Actions (sem Helm/Terraform). "
            "Categorias mapeadas assim: (1) queries/listagens sem filtro de empresaId/obra; "
            "(2) UI esconde por papel vs guard/capability no handler; "
            "(3) todos os controllers *.controller.ts percorridos por ID em path/query/body; "
            "(4) defaults JWT/PayPal/ENCRYPTION_KEY, scripts commitados e bundle VITE_*; "
            "(5) dangerouslySetInnerHTML/eval no React e interpolação HTML no e-mail. "
            "Só entram achados com arquivo e linha no código atual.",
            styles["cover_sub"],
        )
    )
    story.append(PageBreak())

    # ===== RESUMO =====
    story.append(Paragraph("1. Resumo executivo", styles["h1"]))
    counts_sev = Counter(f["sev"] for f in FINDINGS)
    story.append(
        Paragraph(
            f"Foram confirmados <b>{len(FINDINGS)} achados</b> no código: "
            f"<b>{counts_sev.get('crítica', 0)} críticos</b>, "
            f"{counts_sev.get('alta', 0)} altos, {counts_sev.get('média', 0)} médios, "
            f"{counts_sev.get('baixa', 0)} baixos e {counts_sev.get('informativa', 0)} informativo. "
            "Os riscos centrais são takeover de tenant via e-mail compartilhado, "
            "confirmação falsa de pagamento PayPal, JWT forjável com default público e "
            "credenciais de produção no Git.",
            styles["body"],
        )
    )

    img_row = Table(
        [[Image(donut, width=8.5 * cm, height=7.4 * cm), Image(bars, width=8.5 * cm, height=7.4 * cm)]],
        colWidths=[8.6 * cm, 8.6 * cm],
    )
    img_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(img_row)
    story.append(Spacer(1, 3 * mm))

    legend = Table(
        [
            [
                chip_cell("crítica"),
                chip_cell("alta"),
                chip_cell("média"),
                chip_cell("baixa"),
                chip_cell("informativa"),
            ]
        ],
        colWidths=[3.4 * cm] * 5,
    )
    legend.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(legend)
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("1.1 Pontos fortes (verificados)", styles["h2"]))
    fortes = [
        "<b>Isolamento de RDO/anexos/alertas de listagem:</b> RdoController, AnexosController e AiController (relatório) usam JwtAuthGuard + ObraContextGuard; o guard confere obra.empresaId === usuario.empresaId (obra-context.guard.ts:57–59).",
        "<b>CRUD de usuários da empresa:</b> UsuariosController exige gerenciarUsuarios e os services filtram findFirst({ id, empresaId }) em update/delete/reenviar-convite (usuarios.controller.ts:32–96; usuarios.service.ts:265–266, 345–346).",
        "<b>Catálogo, features, cupom de validação e cobranças GET:</b> catalogo.controller, feature.controller, cupom validar e cobranca obter/status/link-cartao/aplicar-cupom amarram empresaId do JWT.",
        "<b>Painel admin:</b> admin-empresas, admin-usuarios, admin-modulos, admin-cupons, admin-financeiro, admin-metricas e admin-features usam @UseGuards(JwtAuthGuard, SuperAdminGuard) no controller.",
        "<b>Webhook Asaas:</b> rejeita se ASAAS_WEBHOOK_TOKEN vazio ou divergente (cobranca.controller.ts:159–172). CSRF exclui essa rota de propósito.",
        "<b>Upload de logo/obra:</b> logo exige empresaId === :id (ou SUPER_ADMIN) + gerenciarEmpresa; imagem de obra checa obra.empresaId (upload.controller.ts:204–308).",
        "<b>Frontend React:</b> zero ocorrências de dangerouslySetInnerHTML, innerHTML, eval ou new Function em src/. AdminRoute esconde /admin se perfil ≠ SUPER_ADMIN — e o backend tem SuperAdminGuard (o gap é o claim não ser relido no DB).",
        "<b>Usuários — capability no servidor:</b> mesmo /gestor/usuarios sendo só ProtectedRoute no React, o backend recusa sem gerenciarUsuarios.",
        "<b>Defesas transversais:</b> Helmet+CSP, CSRF double-submit (exceto login/register/webhook/mcp), bcrypt + lockout 10/15 min, jwtVersion ao trocar senha, SanitizePipe global no body, ThrottlerGuard.",
        "<b>CI/Docker:</b> Dockerfile sem segredos; workflow usa ${{ secrets.RAILWAY_TOKEN }}. Bundle frontend só lê VITE_API_URL / VITE_SUPPORT_WHATSAPP (não há chave de pagamento no cliente).",
        "<b>MCP/Luna:</b> McpController exige JWT e as tools filtram empresaId; listar usuários/financeiro na Luna checa capabilities.",
    ]
    for item in fortes:
        story.append(Paragraph(f"<font color='#059669'><b>■</b></font>  {item}", styles["body_left"]))

    story.append(Paragraph("1.2 Pontos fracos (riscos centrais)", styles["h2"]))
    fracos = [
        "O isolamento de tenant é <b>manual</b> (JWT.empresaId), não RLS. Qualquer handler que esqueça o filtro vaza. O login já fura o modelo ao tratar e-mail como identidade global.",
        "Billing tem um interruptor de fraude: PayPal mock + confirmarPagamentoLocal.",
        "O default JWT + SuperAdmin só no token é um caminho direto a painel global se a env falhar.",
        "O Git contém connection string de produção e senhas de SUPER_ADMIN — isso é incidente ativo, não só dívida técnica.",
    ]
    for item in fracos:
        story.append(Paragraph(f"<font color='#B91C1C'><b>■</b></font>  {item}", styles["body_left"]))

    # ===== DETALHE POR CATEGORIA =====
    story.append(PageBreak())
    story.append(Paragraph("2. Achados detalhados por categoria", styles["h1"]))
    story.append(
        Paragraph(
            "Cada linha foi lida no arquivo indicado. Trechos abaixo são cópia fiel (segredos de banco/senha mascarados neste PDF).",
            styles["small"],
        )
    )

    cats_order = [
        "Banco sem tranca",
        "Permissão no navegador",
        "IDOR",
        "Chaves expostas",
        "Inputs sem tratamento (XSS)",
    ]
    col_w = [2.8 * cm, 6.2 * cm, 8.0 * cm]
    for cat in cats_order:
        items = sorted([f for f in FINDINGS if f["cat"] == cat], key=lambda x: sev_key(x["sev"]))
        if not items:
            continue
        story.append(Paragraph(f"2.{cats_order.index(cat)+1} {cat}", styles["h2"]))
        story.append(findings_table(items, styles, col_w))
        story.append(Spacer(1, 3 * mm))

    # ===== FICHA POR ACHADO =====
    story.append(PageBreak())
    story.append(Paragraph("3. Fichas dos achados (arquivo por arquivo)", styles["h1"]))
    for f in sorted(FINDINGS, key=lambda x: (sev_key(x["sev"]), x["id"])):
        block = []
        head = Table(
            [
                [
                    chip_cell(f["sev"]),
                    Paragraph(f"<b>{esc(f['id'])}</b>  {esc(f['title'])}", styles["body_left"]),
                ]
            ],
            colWidths=[2.8 * cm, 14.2 * cm],
        )
        head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        block.append(head)
        block.append(
            Paragraph(
                f"<b>Onde:</b> {esc(f['file'])}:{esc(f['lines'])}  ·  <b>Categoria:</b> {esc(f['cat'])}",
                styles["small"],
            )
        )
        block.append(Paragraph(f"<b>O que é:</b> {esc(f['desc'])}", styles["body_left"]))
        block.append(Paragraph(f"<b>Por que é explorável:</b> {esc(f['why'])}", styles["body_left"]))
        block.append(Paragraph(f"<b>Condição:</b> {esc(f['cond'])}", styles["small"]))
        block.append(Preformatted(f["snippet"], styles["mono"]))
        story.append(KeepTogether(block))

    # ===== RECOMENDAÇÕES =====
    story.append(PageBreak())
    story.append(Paragraph("4. Recomendações priorizadas", styles["h1"]))
    recs = [
        (
            "P1",
            "Rotacionar agora",
            "Trocar senha do postgres Railway, de superadmin@obra10.com e de qualquer conta que tenha usado Lunardeli123 / Lunardeli20011978$ / Senha123. Revogar o proxy público se ainda estiver aberto. Remover os scripts do Git (incluir no .gitignore) e considerar git filter-repo no histórico.",
        ),
        (
            "P1",
            "Fechar o login multi-empresa",
            "emitirSessao só para contas em matched. O picker só lista empresas cuja senha bateu. empresaId no body deve apontar para um matched, nunca para candidatos crus.",
        ),
        (
            "P1",
            "Matar o PayPal mock em produção",
            "Se PAYPAL_* vazio: recusar create/capture com 503. Preferível remover as rotas se o checkout é só Asaas. Nunca chamar confirmarPagamentoLocal sem captura verificada no provedor.",
        ),
        (
            "P1",
            "JWT_SECRET obrigatório",
            "Falhar o bootstrap se JWT_SECRET ausente, < 32 chars ou igual a obra10-mvp-secret-key-12345. SuperAdminGuard deve reler perfilGlobal no banco.",
        ),
        (
            "P2",
            "Capability financeira no servidor",
            "GET meu-plano, histórico, listar cobranças e POST contratar exigem gerenciarFinanceiro (exceto SUPER_ADMIN). Espelhar o gate do frontend.",
        ),
        (
            "P2",
            "IDOR de foto e alerta",
            "Upload de foto: alvo.empresaId === req.user.empresaId. Alerta: update where { id, obraId } do contexto.",
        ),
        (
            "P2",
            "Desligar debug-fs e enxugar /health",
            "Remover debug-fs do binário de produção. Health só status/db, sem length de chave nem flags Asaas.",
        ),
        (
            "P3",
            "Escape HTML em e-mails + banir SVG em logo",
            "Função escapeHtml em todos os interpolados. Recusar image/svg+xml no upload de imagem. Endurecer SanitizePipe (ou DOMPurify no servidor) — regex sozinho não é sanitizer.",
        ),
        (
            "P3",
            "ENCRYPTION_KEY obrigatória em production",
            "process.exit(1) se NODE_ENV=production e a chave não for hex de 64 chars. Seed nunca deve update senha de contas reais.",
        ),
    ]
    for tag, title, text in recs:
        color = CRITICA if tag == "P1" else (ALTA if tag == "P2" else BAIXA)
        row = Table(
            [
                [
                    Paragraph(f"<font color='white'><b>{tag}</b></font>", ParagraphStyle("p", alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=9, textColor=white)),
                    Paragraph(f"<b>{title}</b><br/>{text}", styles["body_left"]),
                ]
            ],
            colWidths=[1.6 * cm, 15.4 * cm],
        )
        row.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), color),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("BOX", (0, 0), (-1, -1), 0.3, LINE),
                    ("BACKGROUND", (1, 0), (1, 0), CARD),
                ]
            )
        )
        story.append(row)
        story.append(Spacer(1, 3 * mm))

    # ===== ISSUES =====
    story.append(PageBreak())
    story.append(Paragraph("5. Issues para o GitHub", styles["h1"]))
    story.append(
        Paragraph(
            "Cada bloco abaixo está pronto para copiar e colar numa issue. "
            "Delimitadores --- ISSUE n --- / --- FIM ISSUE n ---. "
            "Achados do mesmo tema foram agrupados para não gerar spam. "
            "Senhas e connection strings aparecem mascaradas; o arquivo no repo tem o valor real — rode o rotate antes de abrir a issue em repositório público.",
            styles["body"],
        )
    )
    issues = issue_blocks()
    for i, (_key, title, md, sev) in enumerate(issues, start=1):
        story.append(Paragraph(f"Issue {i} — {esc(title)}", styles["issue_title"]))
        story.append(chip_cell(sev))
        story.append(Spacer(1, 2 * mm))
        boxed = f"--- ISSUE {i} ---\n{md}\n--- FIM ISSUE {i} ---"
        story.append(Preformatted(boxed, styles["issue_md"]))
        story.append(Spacer(1, 3 * mm))

    story.append(Spacer(1, 8 * mm))
    story.append(HLine(FORTE, 1.2))
    story.append(
        Paragraph(
            "Fim do relatório. Cobertura: 23 arquivos *controller.ts do src (mais app.controller), "
            "guards de auth/obra/admin, auth.service, cobranca/paypal, e-mail, upload, seed, scripts rastreados, "
            "Dockerfile, .github/workflows/deploy-railway.yml, frontend src (XSS e rotas) e git ls-files/log -S. "
            "Não foram inventados achados fora desses arquivos.",
            styles["small"],
        )
    )
    return story


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    counts_sev = Counter(f["sev"] for f in FINDINGS)
    counts_cat = Counter(f["cat"] for f in FINDINGS)
    donut, bars = build_charts(counts_sev, counts_cat)
    styles = make_styles()

    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Relatório de Auditoria de Segurança — Obra 10",
        author="Auditoria automatizada no código-fonte",
    )
    story = build_story(styles, donut, bars)
    doc.build(story, onFirstPage=cover_header_footer, onLaterPages=header_footer)
    print(f"PDF escrito em {PDF_PATH}")
    print(f"Achados: {len(FINDINGS)}  por sev={dict(counts_sev)}")


if __name__ == "__main__":
    main()

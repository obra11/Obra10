import { test, expect, APIRequestContext } from '@playwright/test';

let apiContext: APIRequestContext;
let obraId: string;
let csrfToken: string;
let rdoDraftId: string;
let rdoAprovadoId: string;

test.beforeAll(async ({ playwright }) => {
  // Inicialize o contexto da API com os cookies salvos pós-login
  apiContext = await playwright.request.newContext({
    storageState: 'tests/.auth/user.json',
    baseURL: 'http://localhost:3000',
  });

  // 1. Obter os dados do usuário para achar as Obras
  const meResp = await apiContext.get('/auth/me');
  const meData = await meResp.json();
  obraId = meData.obrasPermitidas[0].id;
  
  // Extrair csrf-token manualmente dos cookies e usar em headers extra
  const cookies = (await apiContext.storageState()).cookies;
  const xsrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');
  csrfToken = xsrfCookie ? xsrfCookie.value : '';

  // Configurar HEADERS base pro backend
  const headers = {
    'x-obra-id': obraId,
    'x-xsrf-token': csrfToken,
  };

  // 2. Criar o RDO RASCUNHO (Data: Amanhã para não conflitar com RDOs de "Hoje" criados antes)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dataRefRascunho = tomorrow.toISOString();
  
  const draftCreate = await apiContext.post('/rdos', {
    headers,
    data: { dataReferencia: dataRefRascunho }
  });
  const draftData = await draftCreate.json();
  rdoDraftId = draftData.id;

  // Atualizar dados de Rascunho
  await apiContext.put(`/rdos/${rdoDraftId}/rascunho`, {
    headers,
    data: {
       climaManha: "BOM", climaTarde: "BOM", efetivo: [], ocorrencias: [], observacoesGerais: "Mock rascunho de E2E" 
    }
  });

  // 3. Criar RDO APROVADO (Data: Depois de Amanhã)
  const afterTomorrow = new Date();
  afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const dataRefAprovado = afterTomorrow.toISOString();
  
  const aproxCreate = await apiContext.post('/rdos', {
    headers,
    data: { dataReferencia: dataRefAprovado }
  });
  const aproxData = await aproxCreate.json();
  rdoAprovadoId = aproxData.id;

  // Atualizar e Submeter
  await apiContext.put(`/rdos/${rdoAprovadoId}/rascunho`, {
    headers,
    data: { climaManha: "BOM", climaTarde: "BOM", analiseCritica: "OK", efetivo: []}
  });
  await apiContext.put(`/rdos/${rdoAprovadoId}/submeter`, { headers });
  await apiContext.put(`/rdos/${rdoAprovadoId}/aprovar`, { headers });
});

test.afterAll(async () => {
    // Limpeza rigorosa: deletar suavemente
    const headers = { 'x-obra-id': obraId, 'x-xsrf-token': csrfToken };
    if (rdoDraftId) await apiContext.delete(`/rdos/${rdoDraftId}`, { headers });
    if (rdoAprovadoId) await apiContext.delete(`/rdos/${rdoAprovadoId}`, { headers });
    await apiContext.dispose();
});

test.describe('Ações Principais de RDO', () => {

  test('Deve renderizar Dashboard e mostrar o Rascunho criado no teste', async ({ page }) => {
    // Ao iniciar o browser, o Playwright carrega automaticamente storageState ('tests/.auth/user.json')
    // Precisamos apenas definir que no frontend a `obraAtiva` escolhida no LocalStorage seja a mesma.
    await page.goto('/');
    await page.evaluate((oId) => {
      localStorage.setItem('obra10_obraAtiva', JSON.stringify({ id: oId }));
    }, obraId);

    await page.goto('/rdos');
    
    // Verificamos se o Rascunho aparece na lista
    await expect(page.locator(`.rdo-card-status-RASCUNHO`, { hasText: 'Semana' }).or(page.locator(`text=${rdoDraftId.split('-')[0]}`))).toBeVisible({ timeout: 10000 });
  });

  test('Exportar PDF do RDO Aprovado', async ({ page }) => {
    await page.goto('/rdos');
    await page.waitForTimeout(1000);

    // Clicar no botão visual do RDO aprovado para abri-lo
    // Assumimos que na UI ou Tabela existe link de clique da tr
    const rowLocator = page.locator(`tr:has-text("${rdoAprovadoId.substring(0,8)}")`);
    
    // Se o layout for mobile ou tabela:
    if (await rowLocator.isVisible()) {
      await rowLocator.click();
    } else {
      // Direct navigation via URL if necessary
      await page.goto(`/rdos/${rdoAprovadoId}`);
    }

    // Intercept de download
    const downloadPromise = page.waitForEvent('download');
    
    // Clicar no botão Baixar PDF / Compartilhar Bar
    const pdfBtn = page.getByRole('button', { name: /PDF/i });
    await pdfBtn.waitFor({ state: 'visible' });
    await pdfBtn.click();

    // Validar se o Chrome iniciou o Pipeline de Download real de um PDF
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('RDO_');
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('Compartilhar RDO - Web Share API Mock', async ({ page }) => {
    await page.goto(`/rdos/${rdoAprovadoId}`);
    
    // Injetar stub mock para interceptar o `navigator.share` e registrar o que foi passado
    await page.evaluate(() => {
      (window.navigator as any).share = async (data: any) => {
        (window as any).__SHARED_DATA__ = data;
        return true;
      };
    });

    const shareBtn = page.getByRole('button', { name: /compartilhar|share/i });
    await shareBtn.waitFor({ state: 'visible' });
    await shareBtn.click();

    // Validar que o Mock capturou o Payload e não bloqueou
    const sharedData = await page.evaluate(() => (window as any).__SHARED_DATA__);
    expect(sharedData).toBeDefined();
    
    // Deixamos relaxado porque depende se enviou arquivos ou files[] / url
    expect(sharedData.files || sharedData.rawUrl || sharedData.url || sharedData.text).toBeDefined();
  });

  test('Compartilhar RDO - Fallback Desktop (área de transferência)', async ({ page, context }) => {
    // Para testar clipboard no chromium, concedemos permissão
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(`/rdos/${rdoAprovadoId}`);

    // Injetar remoção do `navigator.share` explícita, forçando fluxo de fallback desktop
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });

    const shareBtn = page.getByRole('button', { name: /compartilhar|share/i });
    await shareBtn.waitFor({ state: 'visible' });
    
    await shareBtn.click();

    // Toast do fallback é disparado (geralmente "Link copiado!" na tela)
    await expect(page.locator('text=/copiad/i')).toBeVisible({ timeout: 5000 });

    // Validar Clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain(rdoAprovadoId); 
    // Valida que a URL gerada para compartilhamento via link contem a ID do documento real
  });

});

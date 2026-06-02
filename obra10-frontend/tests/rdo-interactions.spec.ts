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
    baseURL: 'http://127.0.0.1:3000',
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

const formatRefDate = (isoStr: string) => {
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
});

test.describe('Ações Principais de RDO', () => {

  test('Deve renderizar Dashboard e mostrar o Rascunho criado no teste', async ({ page }) => {
    // Ao iniciar o browser, o Playwright carrega automaticamente storageState ('tests/.auth/user.json')
    // Precisamos apenas definir que no frontend a `obraAtiva` escolhida no LocalStorage seja a mesma.
    await page.goto('/');
    await page.evaluate((oId) => {
      localStorage.setItem('obra10_obraAtiva', JSON.stringify({ id: oId }));
    }, obraId);

    await page.goto(`/obras/${obraId}/rdos`);
    
    // Verificamos se o Rascunho aparece na lista buscando pela data correspondente
    const rascunhoDateText = formatRefDate(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString());
    await expect(page.locator(`text=${rascunhoDateText}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('Exportar PDF do RDO Aprovado', async ({ page }) => {
    await page.goto(`/obras/${obraId}/rdos`);
    await page.waitForTimeout(1000);

    // Clicar no botão visual do RDO aprovado para abri-lo
    // Buscamos a tr com a data do RDO aprovado (Depois de Amanhã)
    const aprovadoDateText = formatRefDate(new Date(new Date().setDate(new Date().getDate() + 2)).toISOString());
    const rowLocator = page.locator(`tr:has-text("${aprovadoDateText}")`).first();
    
    if (await rowLocator.isVisible()) {
      await rowLocator.click();
    } else {
      // Direct navigation via URL if necessary
      await page.goto(`/obras/${obraId}/rdos/${rdoAprovadoId}`);
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
    // Injetar stub mock para interceptar o `navigator.share` e registrar o que foi passado
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: async (data: any) => {
          (window as any).__SHARED_DATA__ = data;
          return true;
        },
        configurable: true,
        enumerable: true,
        writable: true
      });
      Object.defineProperty(navigator, 'canShare', {
        value: () => false,
        configurable: true,
        enumerable: true,
        writable: true
      });
    });

    await page.goto(`/obras/${obraId}/rdos/${rdoAprovadoId}`);
    await page.bringToFront();
    
    // Aguardar o carregamento e a hidratação completa do React
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const shareBtn = page.locator('#rdo-share-btn');
    await shareBtn.waitFor({ state: 'visible' });
    await shareBtn.evaluate((el: any) => el.click());

    // Esperar até que o Mock capture o Payload (evitar race condition da requisição assíncrona do PDF)
    await page.waitForFunction(() => (window as any).__SHARED_DATA__ !== undefined, { timeout: 15000 });

    // Validar que o Mock capturou o Payload e não bloqueou
    const sharedData = await page.evaluate(() => (window as any).__SHARED_DATA__);
    expect(sharedData).toBeDefined();
    
    // Deixamos relaxado porque depende se enviou arquivos ou files[] / url
    expect(sharedData.files || sharedData.rawUrl || sharedData.url || sharedData.text).toBeDefined();
  });

  test('Compartilhar RDO - Fallback Desktop (área de transferência)', async ({ page, context }) => {
    // Para testar clipboard no chromium, concedemos permissão
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Injetar remoção do `navigator.share` explícita, e mockar clipboard.writeText para evitar hangs do headless browser
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
        enumerable: true,
        writable: true
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).__COPIED_TEXT__ = text;
            return true;
          },
          readText: async () => {
            return (window as any).__COPIED_TEXT__ || '';
          }
        },
        configurable: true,
        enumerable: true,
        writable: true
      });
    });

    await page.goto(`/obras/${obraId}/rdos/${rdoAprovadoId}`);
    await page.bringToFront();
    
    // Aguardar o carregamento e a hidratação completa do React
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const shareBtn = page.locator('#rdo-share-btn');
    await shareBtn.waitFor({ state: 'visible' });
    
    await shareBtn.evaluate((el: any) => el.click());

    // Validar que o botão mudou de estado para "Copiado!"
    await expect(shareBtn).toContainText('Copiado', { timeout: 8000 });

    // Validar Clipboard content
    const clipboardText = await page.evaluate(() => (window as any).__COPIED_TEXT__);
    expect(clipboardText).toContain(rdoAprovadoId); 
    // Valida que a URL gerada para compartilhamento via link contem a ID do documento real
  });

});

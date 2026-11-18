/** Code 128 conjunto B — padrões de largura (preto começa). O último é o stop. */
const PADROES = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

export function largurasCode128(texto: string): number[] {
  if (!texto || /[^\x20-\x7e]/.test(texto)) {
    throw new Error('Código fora do Code 128.');
  }
  const valores = [104];
  for (let i = 0; i < texto.length; i++) valores.push(texto.charCodeAt(i) - 32);
  let soma = valores[0];
  for (let i = 1; i < valores.length; i++) soma += valores[i] * i;
  valores.push(soma % 103);
  valores.push(106);
  const larguras: number[] = [];
  for (const valor of valores) {
    const padrao = PADROES[valor];
    if (!padrao) throw new Error('Padrão Code 128 ausente.');
    for (const ch of padrao) larguras.push(Number(ch));
  }
  return larguras;
}

export function svgCodigoBarras(texto: string): string {
  const larguras = largurasCode128(texto);
  const modulo = 2;
  const quiet = 12;
  const altura = 72;
  const total = larguras.reduce((s, n) => s + n, 0);
  const width = (total + quiet * 2) * modulo;
  let x = quiet * modulo;
  let preto = true;
  const rects: string[] = [];
  for (const w of larguras) {
    const px = w * modulo;
    if (preto) {
      rects.push(`<rect x="${x}" y="0" width="${px}" height="${altura}" fill="#111111"/>`);
    }
    x += px;
    preto = !preto;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${altura}" viewBox="0 0 ${width} ${altura}">${rects.join('')}</svg>`;
}

function escapar(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function imprimirEtiqueta(item: {
  nome: string;
  unidade?: string | null;
  codigoBarras: string;
}) {
  const svg = svgCodigoBarras(item.codigoBarras);
  const janela = window.open('', '_blank', 'noopener,width=440,height=360');
  if (!janela) return;
  const unidade = item.unidade ? ` · ${escapar(item.unidade)}` : '';
  janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title>
<style>
  body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #111; }
  .card { border: 1px dashed #bbb; padding: 16px; width: 300px; }
  h1 { font-size: 15px; margin: 10px 0 0; line-height: 1.3; }
  p { font-family: ui-monospace, monospace; font-size: 13px; margin: 6px 0 0; letter-spacing: 0.5px; }
</style></head><body>
<div class="card">${svg}<h1>${escapar(item.nome)}</h1><p>${escapar(item.codigoBarras)}${unidade}</p></div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
  janela.document.close();
}

function asset(path) {
  return globalThis.PrumoAssets?.[path] || new URL(path, document.baseURI).href;
}

/** DWG can be large; phones need minutes, not the old 90 s wall. */
const DWG_READ_MS = 5 * 60 * 1000;

let worker;
let warmPromise;
let nextJob = 1;

function moduleUrls() {
  return {
    moduleUrl: asset('./vendor/libredwg/libredwg-web.js'),
    wasmUrl: asset('./vendor/libredwg/wasm/libredwg-web.wasm'),
  };
}

function resetWorker() {
  try { worker?.terminate(); } catch {}
  worker = null;
  warmPromise = null;
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(asset('./dwg-worker.js'));
  worker.addEventListener('error', (error) => {
    console.error(error.message);
    resetWorker();
  });
  return worker;
}

function workerRequest(payload, transfer, onProgress) {
  const id = nextJob++;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(tick);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      resetWorker();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const timer = setTimeout(() => {
      fail(new Error('A leitura excedeu 5 minutos. Em celulares, desenhos muito densos podem precisar de mais memória ou um aparelho mais recente.'));
    }, DWG_READ_MS);
    const tick = setInterval(() => {
      onProgress?.('Ainda lendo o DWG… em celulares isso pode levar alguns minutos.');
    }, 12000);
    const onError = (error) => {
      console.error(error.message);
      fail(new Error('Não foi possível iniciar o leitor DWG. O aparelho pode estar sem memória ou o navegador precisa ser atualizado.'));
    };
    const onMessage = ({ data }) => {
      if (data?.id != null && data.id !== id) return;
      if (data?.progress) {
        onProgress?.(data.progress);
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      if (data?.error) reject(new Error(data.error));
      else resolve(data);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ ...payload, id }, transfer);
  });
}

/** Preload LibreDWG WASM so the first/next DWG skips cold start. */
export function warmDwgEngine() {
  if (warmPromise) return warmPromise;
  warmPromise = workerRequest({ type: 'warm', ...moduleUrls() }, undefined, null)
    .then(() => true)
    .catch((error) => {
      warmPromise = null;
      console.error(error);
      return false;
    });
  return warmPromise;
}

export async function readDwg(file, onProgress) {
  onProgress?.('Lendo DWG no dispositivo…');
  const buffer = await file.arrayBuffer();
  // The signature check also avoids spending WASM memory on accidental uploads.
  if (!/^AC10\d\d/.test(new TextDecoder().decode(buffer.slice(0, 6)))) {
    throw new Error('O arquivo não possui uma assinatura DWG suportada (AutoCAD R13 ou posterior).');
  }
  const { cachedDrawingFromBuffer } = await import(asset('./local-library.js'));
  return cachedDrawingFromBuffer(file, buffer, () => parseDwgBuffer(buffer, onProgress));
}

async function parseDwgBuffer(buffer, onProgress) {
  // Best-effort warm; parse still loads the engine if idle preload did not finish.
  try { await warmDwgEngine(); } catch {}
  onProgress?.('Interpretando o DWG…');
  return workerRequest(
    { type: 'parse', buffer, ...moduleUrls() },
    [buffer],
    onProgress
  );
}

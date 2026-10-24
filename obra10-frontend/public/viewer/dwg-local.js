function asset(path) {
  return globalThis.PrumoAssets?.[path] || new URL(path, document.baseURI).href;
}

export async function readDwg(file){const {cachedDrawing}=await import(asset('./local-library.js'));return cachedDrawing(file,()=>parseDwg(file));}
async function parseDwg(file) {
  const buffer = await file.arrayBuffer();
  // The signature check also avoids spending WASM memory on accidental uploads.
  if (!/^AC10\d\d/.test(new TextDecoder().decode(buffer.slice(0, 6)))) {
    throw new Error('O arquivo não possui uma assinatura DWG suportada (AutoCAD R13 ou posterior).');
  }
  const worker = new Worker(asset('./dwg-worker.js'));
  const result = await new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('A leitura excedeu 90 segundos. Tente um desenho menor.')); }, 90000);
    worker.onerror = (error) => { console.error(error.message); cleanup(); reject(new Error('Não foi possível iniciar o leitor DWG. O aparelho pode estar sem memória ou o navegador precisa ser atualizado.')); };
    worker.onmessage = ({ data }) => { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data); };
    worker.postMessage({ buffer, moduleUrl: asset('./vendor/libredwg/dist/libredwg-web.js'), wasmUrl: asset('./vendor/libredwg/wasm/libredwg-web.wasm') }, [buffer]);
  });
  return result;
}

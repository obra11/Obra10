function asset(path) {
  return globalThis.PrumoAssets?.[path] || new URL(path, document.baseURI).href;
}

export async function readDwg(file) {
  const buffer = await file.arrayBuffer();
  if (!/^AC10\d\d/.test(new TextDecoder().decode(buffer.slice(0, 6)))) {
    throw new Error('O arquivo não possui uma assinatura DWG suportada (AutoCAD R13 ou posterior).');
  }
  const worker = new Worker(asset('./dwg-worker.js'));
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('A leitura excedeu 90 segundos. Tente um desenho menor.'));
    }, 90000);
    worker.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível iniciar o leitor DWG. O navegador pode estar sem memória ou precisa ser atualizado.'));
    };
    worker.onmessage = ({ data }) => {
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve(data);
    };
    worker.postMessage({
      buffer,
      moduleUrl: asset('./vendor/libredwg/dist/libredwg-web.js'),
      wasmUrl: asset('./vendor/libredwg/wasm/libredwg-web.wasm'),
    }, [buffer]);
  });
}

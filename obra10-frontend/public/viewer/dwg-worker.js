// Persistent DWG worker: WASM stays warm across opens so phones skip cold start.
let engine;

async function ensureEngine(moduleUrl, wasmUrl) {
  if (engine?.cad) return engine;
  const { LibreDwg, Dwg_File_Type, createModule } = await import(moduleUrl);
  const wasm = await createModule({ locateFile: () => wasmUrl });
  const cad = LibreDwg.createByWasmInstance(wasm);
  engine = { cad, Dwg_File_Type };
  return engine;
}

async function parseDwg(data) {
  const { cad, Dwg_File_Type } = await ensureEngine(data.moduleUrl, data.wasmUrl);
  let pointer;
  try {
    self.postMessage({ id: data.id, progress: 'Decodificando o arquivo DWG…' });
    pointer = cad.dwg_read_data(data.buffer, Dwg_File_Type.DWG);
    if (!pointer) throw new Error('DWG inválido ou versão não suportada.');
    self.postMessage({ id: data.id, progress: 'Convertendo geometria do desenho…' });
    const { database, stats } = cad.convertEx(pointer);
    // Preserve authored DRAWORDER. The high-level converter omits SORTENTSTABLE.
    database.drawOrders = [];
    for (const table of cad.dwg_getall_object_by_type(pointer, 714)) {
      const field = name => cad.dwg_dynapi_entity_data(table, name);
      const count = field('num_ents');
      if (!Number.isInteger(count) || count < 0 || count > 1000000) {
        throw new Error('Tabela de ordem de desenho inválida.');
      }
      const entities = cad.dwg_ptr_to_object_ref_ptr_array(field('ents'), count);
      const order = cad.dwg_ptr_to_object_ref_ptr_array(field('sort_ents'), count);
      const entries = {};
      for (let i = 0; i < count; i++) {
        const handle = cad.dwg_ref_get_id(entities[i]);
        const sort = cad.dwg_ref_get_handle_value(order[i]);
        if (handle && sort != null) entries[handle.toUpperCase()] = sort.toString(16).toUpperCase();
      }
      database.drawOrders.push({
        blockHandle: cad.dwg_ref_get_id(field('block_owner')),
        entries,
      });
    }
    if (!database.entities.length) {
      throw new Error('Não foi encontrada geometria no espaço de modelo deste DWG.');
    }
    self.postMessage({ id: data.id, progress: 'Finalizando leitura…' });
    self.postMessage({
      id: data.id,
      database,
      unknown: stats.unknownEntityCount,
      entities: database.entities.length,
    });
  } finally {
    if (pointer) cad.dwg_free(pointer);
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data?.type === 'warm') {
      self.postMessage({ id: data.id, progress: 'Preparando motor DWG…' });
      await ensureEngine(data.moduleUrl, data.wasmUrl);
      self.postMessage({ id: data.id, ready: true });
      return;
    }
    if (data?.type === 'parse' || data?.buffer) {
      if (!engine?.cad) self.postMessage({ id: data.id, progress: 'Carregando motor DWG…' });
      await parseDwg(data);
      return;
    }
    throw new Error('Pedido inválido ao leitor DWG.');
  } catch (error) {
    self.postMessage({ id: data?.id, error: error.message || 'Não foi possível ler este DWG.' });
  }
};

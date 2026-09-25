function chooseDrawingSpace(database) {
  const blocks = database.tables?.BLOCK_RECORD?.entries || [];
  const nameOf = (block) => String(block?.name || '').toUpperCase();
  const countOf = (block) => Array.isArray(block?.entities) ? block.entities.length : 0;
  const layoutHandles = new Set((database.objects?.LAYOUT || [])
    .map((layout) => String(layout.paperSpaceTableId || '').toUpperCase())
    .filter(Boolean));
  const ranked = blocks.map((block) => {
    const name = nameOf(block);
    const count = countOf(block);
    let kind = '';
    if (name === '*MODEL_SPACE' || name === 'MODEL_SPACE') kind = 'model';
    else if (name.startsWith('*PAPER_SPACE') || name.startsWith('PAPER_SPACE')) kind = 'paper';
    else if (count && (layoutHandles.has(String(block.handle || '').toUpperCase()) || block.layout)) kind = 'paper';
    return { block, count, kind };
  }).filter((item) => item.count > 0 && item.kind);
  const model = ranked.filter((item) => item.kind === 'model').sort((a, b) => b.count - a.count)[0];
  const paper = ranked.filter((item) => item.kind === 'paper').sort((a, b) => b.count - a.count)[0];
  if (model) return { entities: model.block.entities, name: 'model' };
  if (paper) return { entities: paper.block.entities, name: 'paper' };
  if (database.entities?.length) return { entities: database.entities, name: 'model' };
  const richest = blocks.filter((block) => countOf(block) > 0).sort((a, b) => countOf(b) - countOf(a))[0];
  return richest ? { entities: richest.entities, name: 'block' } : null;
}

// DWG parsing stays in a disposable worker so it cannot freeze the viewer.
self.onmessage = async ({ data }) => {
  let cad, pointer;
  try {
    const { LibreDwg, Dwg_File_Type, createModule } = await import(data.moduleUrl);
    const wasm = await createModule({ locateFile: () => data.wasmUrl });
    cad = LibreDwg.createByWasmInstance(wasm);
    pointer = cad.dwg_read_data(data.buffer, Dwg_File_Type.DWG);
    if (!pointer) throw new Error('DWG inválido ou versão não suportada.');
    const { database, stats } = cad.convertEx(pointer);
    // Preserve authored DRAWORDER. The high-level converter omits SORTENTSTABLE.
    database.drawOrders = [];
    try {
      for (const table of cad.dwg_getall_object_by_type(pointer, 714)) {
        const field = name => cad.dwg_dynapi_entity_data(table, name);
        const count = field('num_ents');
        if (!Number.isInteger(count) || count < 0 || count > 1000000) continue;
        const entities = cad.dwg_ptr_to_object_ref_ptr_array(field('ents'), count);
        const order = cad.dwg_ptr_to_object_ref_ptr_array(field('sort_ents'), count);
        const entries = {};
        for (let i = 0; i < count; i++) {
          const handle = cad.dwg_ref_get_id(entities[i]);
          const sort = cad.dwg_ref_get_handle_value(order[i]);
          if (handle && sort != null) entries[handle.toUpperCase()] = sort.toString(16).toUpperCase();
        }
        database.drawOrders.push({ blockHandle: cad.dwg_ref_get_id(field('block_owner')), entries });
      }
    } catch { database.drawOrders = []; }
    const space = chooseDrawingSpace(database);
    const preview = database.thumbnailImage?.length ? new Uint8Array(database.thumbnailImage) : null;
    delete database.thumbnailImage;
    if (space) {
      database.entities = space.entities;
      self.postMessage({ database, unknown: stats.unknownEntityCount, entities: space.entities.length, space: space.name });
    } else if (preview) {
      self.postMessage({ preview, space: 'preview' }, [preview.buffer]);
    } else {
      throw new Error('Não foi encontrada geometria no modelo nem na prancha deste DWG.');
    }
  } catch (error) {
    self.postMessage({ error: error.message || 'Não foi possível ler este DWG.' });
  } finally {
    if (cad && pointer) cad.dwg_free(pointer);
    self.close();
  }
};

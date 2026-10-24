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
    for (const table of cad.dwg_getall_object_by_type(pointer, 714)) {
      const field = name => cad.dwg_dynapi_entity_data(table, name);
      const count = field('num_ents');
      if (!Number.isInteger(count) || count < 0 || count > 1000000) throw new Error('Tabela de ordem de desenho inválida.');
      const entities = cad.dwg_ptr_to_object_ref_ptr_array(field('ents'), count);
      const order = cad.dwg_ptr_to_object_ref_ptr_array(field('sort_ents'), count);
      const entries = {};
      for (let i=0;i<count;i++) {
        const handle = cad.dwg_ref_get_id(entities[i]);
        const sort = cad.dwg_ref_get_handle_value(order[i]);
        if (handle && sort != null) entries[handle.toUpperCase()] = sort.toString(16).toUpperCase();
      }
      database.drawOrders.push({blockHandle:cad.dwg_ref_get_id(field('block_owner')),entries});
    }
    if (!database.entities.length) throw new Error('Não foi encontrada geometria no espaço de modelo deste DWG.');
    self.postMessage({ database, unknown: stats.unknownEntityCount, entities: database.entities.length });
  } catch (error) {
    self.postMessage({ error: error.message || 'Não foi possível ler este DWG.' });
  } finally {
    if (cad && pointer) cad.dwg_free(pointer);
    self.close();
  }
};

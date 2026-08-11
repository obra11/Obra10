export interface OfflineAttachment {
  id: string;              // ID único local (uuid v4)
  rdoId: string;           // ID real do RDO ou ID temporário local
  tipo: 'foto' | 'video' | 'anexo';
  nomeArquivo: string;
  mimeType: string;
  dados: ArrayBuffer;      // conteúdo binário do arquivo
  previewUrl?: string;     // blob URL para exibição local
  tentativas: number;      // contador de tentativas de upload
  criadoEm: string;        // ISO timestamp
  legenda?: string;        // legenda/descrição opcional
}

/** Rascunho do formulário RDO persistido no aparelho (IndexedDB). */
export interface OfflineRdoDraft {
  /** Chave estável: `${obraId}:${rdoId}` ou `${obraId}:draft` para novo. */
  localKey: string;
  obraId: string;
  rdoId: string | null;
  tempId: string;
  dadosExtras: Record<string, any>;
  aprovadorId?: string;
  /** true = usuário pediu salvar e ainda precisa ir para o servidor */
  pendingSync: boolean;
  updatedAt: string;
  rdoNumberStr?: string;
  nomeObra?: string;
}

const DB_NAME = 'Obra10OfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'offline_attachments';
const DRAFT_STORE = 'offline_rdo_drafts';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function offlineDraftKey(obraId: string, rdoId: string | null | undefined): string {
  return `${obraId}:${rdoId || 'draft'}`;
}

function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        const draftStore = db.createObjectStore(DRAFT_STORE, { keyPath: 'localKey' });
        draftStore.createIndex('by_obra', 'obraId', { unique: false });
        draftStore.createIndex('by_pending', 'pendingSync', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineAttachment(item: OfflineAttachment): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineAttachments(rdoId: string): Promise<OfflineAttachment[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as OfflineAttachment[];
      resolve(all.filter((item) => item.rdoId === rdoId));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineAttachmentsByTempId(tempId: string): Promise<OfflineAttachment[]> {
  return getOfflineAttachments(tempId);
}

export async function updateRdoId(tempId: string, rdoIdReal: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = async () => {
      const all = request.result as OfflineAttachment[];
      const tempAttachments = all.filter((item) => item.rdoId === tempId);
      
      for (const item of tempAttachments) {
        item.rdoId = rdoIdReal;
        store.put(item);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineAttachment(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineAttachmentsForRdo(rdoId: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as OfflineAttachment[];
      const targets = all.filter((item) => item.rdoId === rdoId);
      for (const item of targets) {
        store.delete(item.id);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function incrementarTentativa(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as OfflineAttachment;
      if (item) {
        item.tentativas = (item.tentativas || 0) + 1;
        store.put(item);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateOfflineAttachmentLegenda(id: string, legenda: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as OfflineAttachment;
      if (item) {
        item.legenda = legenda;
        store.put(item);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── Rascunhos do formulário RDO ───────────────────────────────────────────────

export async function saveOfflineRdoDraft(draft: OfflineRdoDraft): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, 'readwrite');
    const store = tx.objectStore(DRAFT_STORE);
    const request = store.put({
      ...draft,
      updatedAt: draft.updatedAt || new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineRdoDraft(localKey: string): Promise<OfflineRdoDraft | null> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, 'readonly');
    const store = tx.objectStore(DRAFT_STORE);
    const request = store.get(localKey);
    request.onsuccess = () => resolve((request.result as OfflineRdoDraft) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineRdoDraft(localKey: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, 'readwrite');
    const store = tx.objectStore(DRAFT_STORE);
    const request = store.delete(localKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOfflineRdoDrafts(): Promise<OfflineRdoDraft[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, 'readonly');
    const store = tx.objectStore(DRAFT_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = (request.result as OfflineRdoDraft[]) || [];
      resolve(all.filter((d) => d.pendingSync));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineRdoDraftsForObra(obraId: string): Promise<OfflineRdoDraft[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, 'readonly');
    const store = tx.objectStore(DRAFT_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = (request.result as OfflineRdoDraft[]) || [];
      resolve(all.filter((d) => d.obraId === obraId));
    };
    request.onerror = () => reject(request.error);
  });
}

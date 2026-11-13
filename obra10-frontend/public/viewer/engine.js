import { markup } from './viewer-tools.js';

const VIEWER_BASE = new URL('./', import.meta.url);
const VIEWER_REV = new URL(import.meta.url).searchParams.get('v') || '';

function asset(path) {
  const rel = String(path).replace(/^\.\//, '');
  const url = new URL(rel, VIEWER_BASE);
  if (VIEWER_REV) url.searchParams.set('v', VIEWER_REV);
  return url.href;
}

globalThis.PrumoAssets = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    return asset(prop);
  },
});

const PDF_LIMIT = 100 * 1024 * 1024;
const DWG_LIMIT = 500 * 1024 * 1024;
const IFC_LIMIT = 1024 * 1024 * 1024;
const WORD_LIMIT = 100 * 1024 * 1024;
const IFC_PALETTE = ['#e0c46d', '#7dcea0', '#85c1e9', '#f0b27a', '#d7bde2', '#f1948a', '#e74c3c', '#2e86de', '#27ae60', '#8e44ad', '#95a5a6', '#f5f5f5'];
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico', 'tif', 'tiff', 'heic', 'heif']);
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz', 'tbz2', 'xz', 'txz', 'lzma', 'cab', 'cbz', 'cbr', 'zst', 'tzst']);
const VIEW_EXT = new Set(['dwg', 'ifc', 'skp', 'pdf', 'svg', 'doc', 'docx', 'txt', ...IMAGE_EXT, ...ARCHIVE_EXT]);

function ensureStyle() {
  if (!document.getElementById('obra10-viewer-tools')) {
    const link = document.createElement('link');
    link.id = 'obra10-viewer-tools';
    link.rel = 'stylesheet';
    link.href = asset('./viewer-tools.css');
    document.head.appendChild(link);
  }
  let style = document.getElementById('obra10-viewer-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'obra10-viewer-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    .obra10-stage { position:absolute; inset:0; min-height:0; }
    .obra10-stage #pdf-measure { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:3; }
    .obra10-stage #ifc-add, .obra10-stage #ifc-pan, .obra10-stage #ifc-focus, .obra10-stage #ifc-cut,
    .obra10-stage #ifc-measure, .obra10-stage #ifc-walk, .obra10-stage #ifc-views, .obra10-stage #ifc-storeys,
    .obra10-stage #ifc-capture, .obra10-stage #ifc-show-hidden { background:#E5192C; border-color:#c41426; color:#fff; }
    .obra10-stage #ifc-walk-pad i { position:absolute; left:50%; top:50%; width:36px; height:36px; margin:-18px 0 0 -18px; border-radius:50%; background:#E5192C; pointer-events:none; }
    .obra10-stage #drawing { position:absolute; inset:0; overflow:hidden; }
    .obra10-stage #plan { position:absolute; left:0; top:0; transform-origin:0 0; will-change:transform; user-select:none; pointer-events:none; }
    .obra10-stage #word { position:absolute; inset:0; background:#e9eef5; }
    .obra10-stage #archive-dialog { max-width:540px; width:90%; max-height:85dvh; border:1px solid #536b48; border-radius:18px; background:#102c21; color:#edf2f6; padding:20px; }
    .obra10-stage #archive-dialog::backdrop { background:#030b16b8; }
    .obra10-stage #archive-list { display:flex; flex-direction:column; gap:6px; max-height:50dvh; overflow:auto; margin-top:12px; }
    .obra10-stage #archive-list button { text-align:left; }
  `;
}

function ifcText(value) {
  const text = typeof value === 'string' ? value : value?.value;
  return typeof text === 'string' ? text.trim() : '';
}

function ifcTypeName(code) {
  const types = { IFCWALL: 'Parede', IFCWALLSTANDARDCASE: 'Parede', IFCSLAB: 'Laje', IFCDOOR: 'Porta', IFCWINDOW: 'Janela', IFCCOLUMN: 'Pilar', IFCBEAM: 'Viga', IFCROOF: 'Telhado', IFCSTAIR: 'Escada', IFCSTAIRFLIGHT: 'Lance de escada', IFCRAILING: 'Guarda-corpo', IFCCOVERING: 'Revestimento', IFCPLATE: 'Placa', IFCMEMBER: 'Barra', IFCFOOTING: 'Fundação', IFCPILE: 'Estaca', IFCCURTAINWALL: 'Parede cortina', IFCSPACE: 'Ambiente', IFCBUILDINGELEMENTPROXY: 'Elemento', IFCOPENINGELEMENT: 'Abertura', IFCFURNISHINGELEMENT: 'Mobiliário', IFCFLOWSEGMENT: 'Trecho', IFCFLOWFITTING: 'Conexão', IFCFLOWTERMINAL: 'Terminal', IFCSITE: 'Terreno', IFCBUILDING: 'Edificação', IFCBUILDINGSTOREY: 'Pavimento', IFCPROJECT: 'Projeto' };
  const key = String(code || '').toUpperCase();
  return types[key.startsWith('IFC') || !key ? key : 'IFC' + key] || key.replace(/^IFC/, '');
}

function ifcLengthScale(api, modelID) {
  const prefix = { MILLI: 1e-3, CENTI: 1e-2, DECI: 1e-1, DECA: 10, HECTO: 100, KILO: 1e3, MICRO: 1e-6 };
  let ids;
  try {
    ids = api.GetLineIDsWithType(modelID, 180925521);
    for (let i = 0; i < ids.size(); i++) {
      const assignment = api.GetLine(modelID, ids.get(i), true);
      for (const ref of assignment?.Units || []) {
        const unit = ref?.UnitType ? ref : api.GetLine(modelID, ref?.value, true);
        const kind = unit?.UnitType?.value || unit?.UnitType;
        if (kind !== 'LENGTHUNIT') continue;
        const code = api.GetNameFromTypeCode(unit.type) || '';
        if (code === 'IFCSIUNIT') return prefix[unit.Prefix?.value || unit.Prefix] ?? 1;
      }
    }
  } catch { /* unidade padrão em metros */ }
  finally { try { ids?.delete(); } catch { /* wasm já liberou */ } }
  return 1;
}

function ifcElementLabel(api, modelID, expressID) {
  try {
    const line = api.GetLine(modelID, expressID);
    const name = ifcText(line?.Name) || ifcText(line?.Tag) || ifcText(line?.LongName);
    let code = '';
    try { code = api.GetNameFromTypeCode(line?.type) || ''; } catch { /* tipo desconhecido */ }
    const type = ifcTypeName(code);
    return { name: name || type || 'Elemento', type: name ? type : '' };
  } catch { return { name: 'Elemento', type: '' }; }
}

function readIfcStoreys(api, modelID) {
  const ref = (value) => value == null ? null : typeof value === 'number' ? value : typeof value.value === 'number' ? value.value : typeof value.expressID === 'number' ? value.expressID : null;
  const refs = (value) => {
    if (value == null) return [];
    if (typeof value.size === 'function' && typeof value.get === 'function') {
      const out = [];
      for (let i = 0; i < value.size(); i++) {
        const id = ref(value.get(i));
        if (id != null) out.push(id);
      }
      return out;
    }
    return (Array.isArray(value) ? value : [value]).map(ref).filter((id) => id != null);
  };
  const lines = (type) => {
    const ids = api.GetLineIDsWithType(modelID, type);
    const out = [];
    try {
      for (let i = 0; i < ids.size(); i++) {
        try { out.push(api.GetLine(modelID, ids.get(i))); } catch { /* linha ilegível */ }
      }
    } finally { try { ids.delete(); } catch { /* wasm já liberou */ } }
    return out;
  };
  const storeyLines = lines(3124254112);
  if (!storeyLines.length) return null;
  const storeySet = new Set(storeyLines.map((line) => line.expressID));
  const parent = new Map();
  for (const line of lines(160246688)) {
    const from = ref(line.RelatingObject);
    if (from == null) continue;
    for (const child of refs(line.RelatedObjects)) parent.set(child, from);
  }
  const owner = (id) => {
    const seen = new Set();
    while (id != null && !seen.has(id)) {
      if (storeySet.has(id)) return id;
      seen.add(id);
      id = parent.get(id) ?? null;
    }
    return null;
  };
  const members = new Map([...storeySet].map((id) => [id, []]));
  const assign = (element, storey) => {
    if (element == null || storey == null || !members.has(storey)) return;
    const list = members.get(storey);
    if (!list.includes(element)) list.push(element);
  };
  for (const line of lines(3242617779)) {
    const storey = owner(ref(line.RelatingStructure));
    for (const element of refs(line.RelatedElements)) assign(element, storey);
  }
  for (const [child, from] of parent) assign(child, owner(from));
  const storeys = storeyLines.map((line) => {
    const elevation = Number(line.Elevation?.value ?? line.Elevation);
    return { id: line.expressID, name: ifcText(line.Name) || ifcText(line.LongName) || '', elevation: Number.isFinite(elevation) ? elevation : null };
  }).sort((a, b) => a.elevation == null ? 1 : b.elevation == null ? -1 : a.elevation - b.elevation || a.id - b.id);
  const nameCount = new Map();
  for (const storey of storeys) if (storey.name) nameCount.set(storey.name, (nameCount.get(storey.name) || 0) + 1);
  const seen = new Map();
  const storeyOf = {};
  storeys.forEach((storey, index) => {
    if (!storey.name) storey.label = storeys.length > 1 ? 'Pavimento ' + (index + 1) : 'Pavimento';
    else if (nameCount.get(storey.name) > 1) {
      const n = (seen.get(storey.name) || 0) + 1;
      seen.set(storey.name, n);
      storey.label = storey.name + ' ' + n;
    } else storey.label = storey.name;
    for (const element of members.get(storey.id) || []) storeyOf[element] = storey.id;
  });
  return { storeys: storeys.map(({ id, label, elevation }) => ({ id, label, elevation })), storeyOf };
}

export function mountViewer(host, hooks = {}) {
  ensureStyle();
  host.replaceChildren();
  const stage = document.createElement('div');
  stage.className = 'obra10-stage prumo-engine';
  stage.innerHTML = `
    <div id="pdf" hidden><canvas aria-label="Página PDF"></canvas><svg id="pdf-measure" aria-hidden="true"></svg></div>
    <canvas id="cad" hidden aria-label="Desenho CAD vetorial"></canvas>
    <div id="drawing" hidden><img id="plan" alt="Desenho"></div>
    <div id="word" hidden></div>
    <input id="pdf-page" type="number" hidden>
    <span id="pdf-total" hidden></span>
    ${markup}
    <button type="button" id="ifc-cut-handle" hidden role="slider" aria-label="Posição do corte IFC" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">↕ Corte · 50%</button>
    <dialog id="archive-dialog">
      <div class="layer-heading"><h2 id="archive-title">Compactado</h2><button type="button" id="archive-back" hidden>Voltar</button><button type="button" id="archive-close">Fechar</button></div>
      <p>Toque um arquivo para abrir. Imagens, textos, DWG, IFC, SKP, PDF, Word, SVG e outros compactados.</p>
      <div id="archive-list"></div>
    </dialog>
  `;
  host.appendChild(stage);

  const $ = (id) => stage.querySelector('#' + id) || document.getElementById(id);
  let kind = 'empty';
  let pdfViewer = null;
  let THREE = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let group = null;
  let ifcApi = null;
  let IfcMeshBuilder = null;
  let buildSkpGroup = null;
  let openskpBuildScene = null;
  let ifcNavigation = null;
  let ifcTools = null;
  let ifcWalk = null;
  let disposeIfcGroup = null;
  let originAxes = null;
  let ifcNeedsRender = false;
  let ifcPick = null;
  let alive = true;
  let wordViewer = null;
  let cadImages = null;
  let imageUrl = null;
  let imageScale = 1;
  let imageX = 0;
  let imageY = 0;
  let imageWidth = 1000;
  let imageHeight = 700;
  let imageTurns = 0;
  const imagePointers = new Map();
  const archiveStack = [];
  let fromArchiveOpen = false;
  const modelIds = new WeakMap();

  function status(message, error = false) {
    hooks.onStatus?.({ message, error });
  }

  function setKind(next) {
    kind = next;
    ifcWalk?.stop();
    $('pdf').hidden = next !== 'pdf';
    $('cad').hidden = next !== 'dwg';
    $('three').hidden = next !== 'ifc';
    $('ifc-tools').hidden = next !== 'ifc';
    if ($('drawing')) $('drawing').hidden = next !== 'image';
    if ($('word')) $('word').hidden = next !== 'word';
    if ($('ifc-tab')) $('ifc-tab').hidden = next !== 'ifc';
    if ($('ifc-info')) $('ifc-info').hidden = next !== 'ifc' || !group;
    if (next !== 'ifc' && $('ifc-cut-handle')) $('ifc-cut-handle').hidden = true;
    ifcTools?.activate(next === 'ifc');
    if (next === 'ifc' && group) ifcTools?.setModel(group);
    if (controls) controls.enabled = next === 'ifc' && !ifcWalk?.walking;
    publishFederation();
    hooks.onKind?.(next);
  }

  async function ensurePdf() {
    if (pdfViewer) return pdfViewer;
    const { PdfViewer } = await import(asset('./pdf-view.js'));
    pdfViewer = new PdfViewer(
      $('pdf'),
      (state) => hooks.onPdfState?.(state),
      (error) => status(error?.message || 'Falha ao desenhar o PDF.', true),
    );
    return pdfViewer;
  }

  function federationModels() {
    return group ? [...group.children].filter((child) => child.userData?.ifcModel) : [];
  }

  function formatCubicMeters(volume) {
    const value = Number(volume);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value >= 1) return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' m³';
    return (value * 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' cm³';
  }

  function closeIfcHandle(root) {
    if (!root || !ifcApi) return;
    const models = root.userData?.ifcModel ? [root] : [...root.children || []].filter((child) => child.userData?.ifcModel);
    for (const model of models) {
      const id = model.userData?.ifcModelID;
      if (id >= 0) {
        try { ifcApi.CloseModel(id); } catch { /* modelo já fechado */ }
        model.userData.ifcModelID = -1;
      }
    }
  }

  function readSkpElementProps(hit, model) {
    const id = hit?.object?.userData?.ifcIds?.[hit.instanceId ?? 0];
    const entry = model?.userData?.skpElements?.get?.(id);
    const meta = entry?.meta || {};
    const groups = [];
    const ident = [];
    if (entry?.name) ident.push({ name: 'Nome', value: entry.name });
    if (meta.definitionName) ident.push({ name: 'Definição', value: String(meta.definitionName) });
    if (meta.layer) ident.push({ name: 'Camada', value: String(meta.layer) });
    if (meta.guid) ident.push({ name: 'GUID', value: String(meta.guid) });
    if (meta.path) ident.push({ name: 'Caminho', value: String(meta.path) });
    const data = hit?.object?.userData;
    const index = hit?.instanceId;
    const volume = index != null && data?.ifcVolumes ? data.ifcVolumes[index] : entry?.volume;
    const vol = formatCubicMeters(volume);
    if (vol) ident.push({ name: 'Volume (malha)', value: vol });
    if (model?.userData?.fileName) ident.push({ name: 'Arquivo', value: model.userData.fileName });
    if (ident.length) groups.push({ title: 'Identificação', rows: ident });
    const dyn = Object.entries(meta.properties || {}).map(([name, value]) => ({ name, value: String(value ?? '') })).filter((row) => row.value);
    if (dyn.length) groups.push({ title: 'Dynamic Components', rows: dyn });
    return groups;
  }

  function readIfcElementProps(hit) {
    let model = hit?.object;
    while (model && model.parent && !(model.userData?.ifcModel || model.userData?.skpModel)) model = model.parent;
    if (model?.userData?.skpModel) return readSkpElementProps(hit, model);
    const data = hit?.object?.userData;
    const index = hit?.instanceId;
    const name = index != null && data?.ifcNames ? data.ifcNames[index] : data?.ifcName;
    const type = index != null && data?.ifcTypes ? data.ifcTypes[index] : data?.ifcType;
    const volume = index != null && data?.ifcVolumes ? data.ifcVolumes[index] : data?.ifcVolume;
    const rows = [];
    if (name) rows.push({ name: 'Nome', value: name });
    if (type) rows.push({ name: 'Tipo', value: type });
    const vol = formatCubicMeters(volume);
    if (vol) rows.push({ name: 'Volume (malha)', value: vol });
    if (model?.userData?.fileName) rows.push({ name: 'Arquivo', value: model.userData.fileName });
    return rows.length ? [{ title: 'Identificação', rows }] : [];
  }

  function bindElementReader() {
    if (!ifcTools) return;
    ifcTools.ifcApi = ifcApi || null;
    ifcTools.readIfcElement = (hit) => readIfcElementProps(hit);
  }

  function visibleFederationBounds() {
    const box = new THREE.Box3();
    for (const model of federationModels()) if (model.visible) box.union(new THREE.Box3().setFromObject(model));
    return box;
  }

  function renderIfcInfo() {
    const bar = $('ifc-info');
    if (!bar) return;
    const models = kind === 'ifc' && group ? federationModels() : [];
    if (!models.length) {
      bar.hidden = true;
      return;
    }
    const pick = $('ifc-info-pick');
    const origin = $('ifc-info-origin');
    const distances = models.map((model) => Number.isFinite(model.userData.originDistance) ? model.userData.originDistance : null).filter((value) => value != null);
    if (pick) {
      const label = [ifcPick?.name, ifcPick?.type, formatCubicMeters(ifcPick?.volume)].filter(Boolean).join(' · ');
      pick.textContent = label;
      pick.hidden = !label;
    }
    if (origin) {
      const bits = [];
      if (distances.length) bits.push(Math.max(...distances).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m');
      bits.push('Origem 0, 0, 0');
      origin.textContent = bits.join(' · ');
    }
    bar.hidden = false;
  }

  function setIfcModelColor(model, color) {
    model.userData.color = color || null;
    model.traverse((object) => {
      if (object.userData?.prumoSection) return;
      for (const material of [].concat(object.material || [])) {
        if (!material.color) continue;
        material.userData.prumoOriginal ??= material.color.clone();
        if (color) material.color.set(color);
        else material.color.copy(material.userData.prumoOriginal);
      }
    });
    ifcNeedsRender = true;
  }

  function paintIfcSwatch(model, swatch) {
    const color = model.userData.color;
    swatch.style.background = color || 'conic-gradient(#e0c46d,#7dcea0,#85c1e9,#f1948a,#e0c46d)';
    swatch.title = color ? 'Cor deste IFC: ' + color : 'Cores do arquivo';
  }

  function ifcColorPicker(model, swatch, row) {
    const open = row.nextElementSibling?.classList.contains('ifc-colors');
    for (const panel of stage.querySelectorAll('#ifc-model-list .ifc-colors')) panel.remove();
    for (const button of stage.querySelectorAll('#ifc-model-list .ifc-swatch')) button.setAttribute('aria-expanded', 'false');
    if (open) return;
    const panel = document.createElement('div');
    panel.className = 'ifc-colors';
    const choose = (color) => {
      setIfcModelColor(model, color);
      paintIfcSwatch(model, swatch);
      panel.remove();
      swatch.setAttribute('aria-expanded', 'false');
      publishFederation();
    };
    const original = document.createElement('button');
    original.type = 'button';
    original.className = 'ifc-color-original';
    original.textContent = 'Original';
    original.onclick = () => choose(null);
    panel.append(original);
    for (const color of IFC_PALETTE) {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.background = color;
      button.onclick = () => choose(color);
      panel.append(button);
    }
    const other = document.createElement('label');
    other.className = 'ifc-color-other';
    other.textContent = 'Outra';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = model.userData.color || '#e0c46d';
    input.onchange = () => choose(input.value);
    other.append(input);
    panel.append(other);
    row.after(panel);
    swatch.setAttribute('aria-expanded', 'true');
  }

  function publishFederation() {
    const models = federationModels();
    const panel = $('ifc-models');
    if (panel) panel.hidden = kind !== 'ifc' || models.length < 2;
    const list = $('ifc-model-list');
    if (list) {
      list.replaceChildren();
      models.forEach((model) => {
        const row = document.createElement('div');
        row.className = 'ifc-model';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = model.visible;
        check.setAttribute('aria-label', 'Mostrar ' + model.userData.fileName);
        check.onchange = () => {
          model.visible = check.checked;
          ifcNavigation?.setModel(group);
          if (ifcTools?.group === group) {
            const box = visibleFederationBounds();
            if (!box.isEmpty()) ifcTools.bounds = box;
            if (ifcTools.state?.cut) ifcTools.applyCut();
          }
          ifcNeedsRender = true;
          publishFederation();
        };
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'ifc-swatch';
        swatch.setAttribute('aria-label', 'Cor de ' + model.userData.fileName);
        paintIfcSwatch(model, swatch);
        swatch.onclick = () => ifcColorPicker(model, swatch, row);
        const name = document.createElement('span');
        name.className = 'ifc-model-name';
        name.textContent = (model.userData.skpModel ? 'SKP · ' : 'IFC · ') + model.userData.fileName;
        name.title = model.userData.fileName;
        const distance = document.createElement('small');
        const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
        model.userData.originDistance = center.length();
        distance.textContent = center.length().toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remover';
        remove.onclick = () => removeIfc(modelIds.get(model));
        row.append(check, swatch, name, distance, remove);
        list.append(row);
      });
    }
    renderIfcInfo();
    hooks.onIfcModels?.(models.map((model) => ({
      id: modelIds.get(model),
      name: model.userData.fileName,
      visible: model.visible,
      color: model.userData.color || null,
      distance: model.userData.originDistance || 0,
    })));
    ifcNeedsRender = true;
  }

  function resize() {
    ifcNeedsRender = true;
    ifcTools?.draw?.();
    if (pdfViewer && kind === 'pdf') pdfViewer.render().catch((e) => status(e.message, true));
    if (kind === 'word' && wordViewer?.current?.fitted) wordViewer.fit();
    if (kind === 'image') fitImage();
    if (kind === 'dwg' && dwgMode === 'preview') drawDwgPreview();
    else if (cadRenderer && kind === 'dwg') cadRenderer.resize();
    if (renderer && camera) {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
  }

  function fit3d() {
    if (!camera || !controls || !group) return;
    ifcWalk?.stop();
    ifcNavigation?.setModel(group);
    const box = visibleFederationBounds();
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    const angle = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const distance = (radius / Math.sin(angle)) * 1.2;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance));
    camera.near = Math.max(distance / 10000, 0.001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();
    ifcNeedsRender = true;
  }

  async function init3d() {
    if (renderer) return;
    THREE = await import(asset('./vendor/three.module.js'));
    const { OrbitControls } = await import(asset('./vendor/OrbitControls.js'));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    renderer = new THREE.WebGLRenderer({
      antialias: !(matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 1),
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor('#172334');
    $('three').appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const { IfcNavigation } = await import(asset('./ifc-navigation.js'));
    ifcNavigation = new IfcNavigation(THREE, camera, controls, renderer.domElement, (text) => {
      $('ifc-hint').textContent = text;
      $('ifc-focus').setAttribute('aria-pressed', String(!!ifcNavigation?.focusArmed));
    });
    const { IfcTools } = await import(asset('./ifc-tools.js'));
    ifcTools = new IfcTools(THREE, renderer, camera, controls, ifcNavigation, () => { ifcNeedsRender = true; });
    ifcTools.onInfo = (info) => { ifcPick = info; renderIfcInfo(); };
    const { IfcWalk } = await import(asset('./ifc-walk.js'));
    ifcWalk = new IfcWalk(THREE, camera, controls, renderer.domElement, ifcTools, ifcNavigation, () => {
      ifcNeedsRender = true;
    });
    const walkUi = ifcWalk.ui.bind(ifcWalk);
    ifcWalk.ui = function ui() {
      walkUi();
      hooks.onWalk?.({ active: !!this.walking, placing: !!this.placing, through: !!this.through });
    };
    bindElementReader();
    $('ifc-focus').onclick = () => {
      const pressed = $('ifc-focus').getAttribute('aria-pressed') === 'true';
      ifcNavigation.armFocus(!pressed);
      $('ifc-focus').setAttribute('aria-pressed', String(!pressed));
    };
    $('ifc-add').onclick = () => $('ifc-add-file').click();
    $('ifc-add-file').onchange = async (event) => {
      const files = [...event.target.files || []];
      event.target.value = '';
      for (const file of files) {
        try { await addIfc(file, file.name + ':' + file.size + ':' + file.lastModified); }
        catch (error) { status(error.message, true); }
      }
    };
    controls.addEventListener('change', () => { ifcNeedsRender = true; });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x708090, 1.15));
    const light = new THREE.DirectionalLight(0xffffff, 0.85);
    light.position.set(5, 10, 8);
    scene.add(light);
    originAxes = new THREE.AxesHelper(1);
    originAxes.raycast = () => {};
    originAxes.visible = false;
    scene.add(originAxes);
    resize();
    renderer.setAnimationLoop(() => {
      if (!alive || kind !== 'ifc') return;
      const changed = ifcWalk?.walking ? ifcWalk.step() : ifcTools?.cutDrag ? false : controls.update();
      if (changed || ifcNeedsRender) {
        renderer.render(scene, camera);
        ifcTools?.grabFrame?.();
        ifcNeedsRender = false;
      }
    });
  }

  async function ensureIfc() {
    await init3d();
    if (!ifcApi) {
      const { IfcAPI } = await import(asset('./vendor/web-ifc-api.js'));
      const api = new IfcAPI();
      await api.Init(() => asset('./vendor/web-ifc.wasm'), true);
      ifcApi = api;
    }
    bindElementReader();
    if (!IfcMeshBuilder) {
      const mod = await import(asset('./ifc-meshes.js'));
      IfcMeshBuilder = mod.IfcMeshBuilder;
      disposeIfcGroup = mod.disposeIfcGroup;
    }
  }

  async function ensureSkp() {
    await init3d();
    bindElementReader();
    if (!buildSkpGroup) {
      const mod = await import(asset('./skp-meshes.js'));
      buildSkpGroup = mod.buildSkpGroup;
      disposeIfcGroup ||= mod.disposeSkpGroup;
    }
    if (!openskpBuildScene) {
      const mod = await import(asset('./vendor/openskp.mjs'));
      openskpBuildScene = mod.buildScene;
      if (typeof openskpBuildScene !== 'function') throw new Error('Leitor SKP indisponível.');
    }
    if (!disposeIfcGroup) {
      const mod = await import(asset('./ifc-meshes.js'));
      disposeIfcGroup = mod.disposeIfcGroup;
    }
  }

  function ensureFederation() {
    if (group) return group;
    group = new THREE.Group();
    group.name = 'ifc-federation';
    group.position.set(0, 0, 0);
    group.matrixAutoUpdate = false;
    group.updateMatrix();
    scene.add(group);
    return group;
  }

  async function loadIfcModel(file) {
    const data = new Uint8Array(await file.arrayBuffer());
    const id = ifcApi.OpenModel(data, { COORDINATE_TO_ORIGIN: false });
    if (id < 0) throw new Error('Arquivo IFC inválido.');
    const builder = new IfcMeshBuilder(THREE);
    let model;
    try {
      ifcApi.StreamAllMeshes(id, (flat) => {
        const expressID = flat.expressID;
        for (let i = 0; i < flat.geometries.size(); i++) builder.add(ifcApi, id, flat.geometries.get(i), expressID);
      });
      const meter = ifcLengthScale(ifcApi, id);
      const labels = new Map();
      for (const expressID of builder.elementIds) {
        const label = ifcElementLabel(ifcApi, id, expressID);
        label.volume = builder.volumes.get(expressID) || 0;
        labels.set(expressID, label);
      }
      model = builder.build(labels);
      if (!model.children.length) throw new Error(file.name + ' não contém geometria 3D compatível.');
      model.name = file.name;
      model.userData.ifcModel = true;
      model.userData.fileName = file.name;
      model.userData.bytes = file.size;
      model.userData.ifcModelID = id;
      model.userData.lengthScale = meter;
      try {
        const spatial = readIfcStoreys(ifcApi, id);
        if (spatial) {
          model.userData.storeys = spatial.storeys;
          model.userData.storeyOf = spatial.storeyOf;
        }
      } catch { /* pavimentos opcionais */ }
      model.quaternion.identity();
      model.scale.set(1, 1, 1);
      model.updateMatrix();
      model.matrixAutoUpdate = false;
      return model;
    } catch (error) {
      if (id >= 0) try { ifcApi.CloseModel(id); } catch { /* wasm já fechou */ }
      if (model) disposeIfcGroup(model);
      else builder.dispose();
      throw error;
    }
  }

  async function loadSkpModel(file) {
    await ensureSkp();
    const buffer = await file.arrayBuffer();
    let sceneData;
    try {
      sceneData = openskpBuildScene(buffer);
    } catch (error) {
      throw new Error('Arquivo SKP inválido ou não suportado.' + (error?.message ? ' ' + error.message : ''));
    }
    const model = buildSkpGroup(THREE, sceneData);
    if (!model.children.length) {
      disposeIfcGroup?.(model);
      throw new Error(file.name + ' não contém geometria 3D compatível.');
    }
    model.name = file.name;
    model.userData.ifcModel = true;
    model.userData.skpModel = true;
    model.userData.fileName = file.name;
    model.userData.bytes = file.size;
    model.userData.lengthScale = 1;
    model.quaternion.identity();
    model.scale.set(1, 1, 1);
    model.updateMatrix();
    model.matrixAutoUpdate = false;
    return model;
  }

  async function addIfc(file, modelId) {
    const isSkp = /\.skp$/i.test(file.name);
    if (file.size > IFC_LIMIT) throw new Error('O limite para IFC/SKP é 1 GB.');
    const existing = federationModels().find((model) => modelIds.get(model) === modelId);
    if (existing) {
      setKind('ifc');
      return modelId;
    }
    const model = isSkp ? await loadSkpModel(file) : (await ensureIfc(), await loadIfcModel(file));
    const root = ensureFederation();
    const before = federationModels()[0];
    root.add(model);
    model.updateMatrixWorld(true);
    modelIds.set(model, modelId);
    if (before) {
      const firstBox = new THREE.Box3().setFromObject(before);
      const nextBox = new THREE.Box3().setFromObject(model);
      if (!firstBox.isEmpty() && !nextBox.isEmpty() && !firstBox.intersectsBox(nextBox)) {
        const gap = firstBox.clampPoint(nextBox.getCenter(new THREE.Vector3()), new THREE.Vector3()).distanceTo(nextBox.getCenter(new THREE.Vector3()));
        if (gap > 1000) status(file.name + ' ficou a mais de 1 km do primeiro modelo. A origem não foi movida.', true);
      }
    }
    camera.up.set(0, 1, 0);
    ifcTools.setModel(root);
    ifcTools.resetTab?.();
    setKind('ifc');
    resize();
    fit3d();
    publishFederation();
    return modelId;
  }

  function showIfc() {
    if (!federationModels().length) return false;
    setKind('ifc');
    resize();
    ifcNeedsRender = true;
    return true;
  }

  function setIfcVisible(modelId, visible) {
    const model = federationModels().find((item) => modelIds.get(item) === modelId);
    if (!model) return;
    model.visible = !!visible;
    ifcNeedsRender = true;
    publishFederation();
  }

  function setIfcColor(modelId, color) {
    const model = federationModels().find((item) => modelIds.get(item) === modelId);
    if (!model) return;
    setIfcModelColor(model, color);
    publishFederation();
  }

  function removeIfc(modelId) {
    const model = federationModels().find((item) => modelIds.get(item) === modelId);
    if (!model || !group) return;
    closeIfcHandle(model);
    group.remove(model);
    disposeIfcGroup?.(model);
    ifcNeedsRender = true;
    if (!federationModels().length) {
      scene.remove(group);
      group = null;
      ifcTools?.setModel(null);
      ifcWalk?.stop();
      setKind('empty');
      publishFederation();
      return;
    }
    ifcTools?.setModel(group);
    fit3d();
    publishFederation();
  }

  function clear3d() {
    ifcWalk?.stop();
    ifcPick = null;
    ifcTools?.setModel(null);
    if (group) {
      closeIfcHandle(group);
      disposeIfcGroup?.(group);
      scene?.remove(group);
      group = null;
    }
    publishFederation();
  }

  let cadRenderer = null;
  let measureTool = null;
  let cadSource = null;
  let cadKey = '';
  let quarterTurns = 0;
  let originalLayers = new Map();
  let cadBound = false;
  let lastDwgZoom = 0;
  let dwgMode = '';
  let dwgPreview = null;
  const cadPointers = new Map();

  function publishDwg(extra = {}) {
    const zoom = Math.round(cadRenderer?.getZoomPercent?.() || lastDwgZoom || 100);
    lastDwgZoom = zoom;
    hooks.onDwgState?.({ zoom, measuring: !!measureTool?.active, ...extra });
  }

  function layerEntries() {
    const layers = Object.values(cadRenderer?.getDocument()?.layers || {});
    return [...new Map(layers.map((layer) => [layer.name.toLowerCase(), layer])).values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }

  function refreshLayerView() {
    cadRenderer?.refreshLayers();
    measureTool?.refreshSegments?.();
  }

  function renderLayers() {
    const query = ($('layer-search').value || '').toLowerCase();
    const list = $('layer-list');
    list.replaceChildren();
    for (const layer of layerEntries()) {
      if (!layer.name.toLowerCase().includes(query)) continue;
      const row = document.createElement('label');
      const check = document.createElement('input');
      const name = document.createElement('span');
      check.type = 'checkbox';
      check.checked = layer.isVisible !== false && !layer.isFrozen;
      name.textContent = layer.name;
      check.onchange = () => {
        cadRenderer.setLayerVisibility(layer.name, check.checked);
        refreshLayerView();
      };
      row.append(check, name);
      list.append(row);
    }
  }

  function setupLayers() {
    originalLayers = new Map(layerEntries().map((layer) => [layer.name, { isVisible: layer.isVisible, isFrozen: layer.isFrozen }]));
    $('layer-search').value = '';
    renderLayers();
  }

  function showDimensionLayers() {
    const doc = cadRenderer.getDocument();
    const names = new Set();
    const seen = new Set();
    const visit = (entities, inherited = '0', inside = false) => {
      for (const entity of entities) {
        const layer = entity.layer === '0' ? inherited : entity.layer;
        const dimension = inside || entity.type === 'DIMENSION';
        if (dimension && layer) names.add(layer);
        if (entity.kind === 'insert') {
          const key = entity.blockName || entity.name;
          const token = key + '|' + layer + '|' + dimension;
          if (seen.has(token)) continue;
          seen.add(token);
          const block = doc.blocks[key] || doc.blocks[key?.toLowerCase()];
          if (block) visit(block.entities, layer, dimension);
        }
      }
    };
    visit(doc.entities);
    for (const layer of layerEntries()) {
      if (names.has(layer.name)) cadRenderer.setLayerVisibility(layer.name, true);
    }
    renderLayers();
    refreshLayerView();
  }

  function bindCad() {
    if (cadBound) return;
    cadBound = true;
    const viewport = $('cad');
    $('layers-close').onclick = () => $('layers-dialog').close();
    $('layer-search').oninput = renderLayers;
    $('layers-all').onclick = () => {
      for (const layer of layerEntries()) cadRenderer.setLayerVisibility(layer.name, true);
      renderLayers();
      refreshLayerView();
    };
    $('layers-original').onclick = () => {
      for (const layer of layerEntries()) {
        const saved = originalLayers.get(layer.name);
        cadRenderer.setLayerVisibility(layer.name, saved?.isVisible, saved?.isFrozen);
      }
      renderLayers();
      refreshLayerView();
    };
    $('layers-dimensions').onclick = showDimensionLayers;
    if ($('fonts-open')) {
      $('fonts-open').onclick = () => $('font-files').click();
      $('font-files').onchange = async (event) => {
        try {
          const { importFonts } = await import(asset('./local-fonts.js'));
          const count = await importFonts(event.target.files);
          cadRenderer?.fontCaps?.clear?.();
          cadRenderer?.textMetrics?.clear?.();
          cadRenderer?.wrapCache?.clear?.();
          cadRenderer?.render?.();
          $('font-report').textContent = count + ' fonte(s) importada(s). Fontes com o mesmo nome do DWG serão usadas automaticamente. SHX ainda não é suportado.';
        } catch (error) {
          $('font-report').textContent = error.message;
        } finally {
          event.target.value = '';
        }
      };
    }
    if ($('images-open')) {
      $('images-open').onclick = () => $('image-files').click();
      $('image-files').onchange = async (event) => {
        try {
          const files = [...event.target.files];
          const count = await cadImages?.link?.(files);
          cadRenderer?.setDocument?.(cadRenderer.getSourceDocument());
          status(count ? count + ' imagem(ns) vinculada(s).' : 'Nenhum nome corresponde às imagens referenciadas no DWG.', !count);
        } catch (error) {
          status(error.message, true);
        } finally {
          event.target.value = '';
        }
      };
    }
    viewport.addEventListener('wheel', (event) => {
      if (kind !== 'dwg' || !cadRenderer) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      cadRenderer.zoom(Math.exp(-event.deltaY * 0.001), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }, { passive: false });
    viewport.addEventListener('pointerdown', (event) => {
      if (kind !== 'dwg' || event.target.closest?.('button,select,input')) return;
      viewport.setPointerCapture(event.pointerId);
      cadPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!cadPointers.has(event.pointerId) || kind !== 'dwg' || !cadRenderer) return;
      const old = [...cadPointers.values()];
      const previous = cadPointers.get(event.pointerId);
      cadPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const next = [...cadPointers.values()];
      if (old.length === 1) cadRenderer.panByScreenDelta(event.clientX - previous.x, event.clientY - previous.y);
      else if (old.length === 2) {
        const distance = (points) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const rect = viewport.getBoundingClientRect();
        if (distance(old) > 0) {
          cadRenderer.zoom(distance(next) / distance(old), {
            x: (old[0].x + old[1].x) / 2 - rect.left,
            y: (old[0].y + old[1].y) / 2 - rect.top,
          });
        }
        cadRenderer.panByScreenDelta((next[0].x + next[1].x - old[0].x - old[1].x) / 2, (next[0].y + next[1].y - old[0].y - old[1].y) / 2);
      }
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      viewport.addEventListener(eventName, (event) => cadPointers.delete(event.pointerId));
    }
    viewport.addEventListener('dblclick', (event) => {
      if (event.target.closest?.('button,select,input') || measureTool?.active) return;
      cadRenderer?.fitToView(0.9);
    });
  }

  function previewBlob(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (data[0] === 0x42 && data[1] === 0x4d) return new Blob([data], { type: 'image/bmp' });
    if (data[0] === 0x89 && data[1] === 0x50) return new Blob([data], { type: 'image/png' });
    if (data[0] === 0xff && data[1] === 0xd8) return new Blob([data], { type: 'image/jpeg' });
    const header = data.length >= 4 ? new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true) : 0;
    if (header === 40 || header === 108 || header === 124) {
      const bmp = new Uint8Array(14 + data.length);
      bmp[0] = 66;
      bmp[1] = 77;
      const view = new DataView(bmp.buffer);
      view.setUint32(2, bmp.length, true);
      view.setUint32(10, 14 + header, true);
      bmp.set(data, 14);
      return new Blob([bmp], { type: 'image/bmp' });
    }
    return new Blob([data], { type: 'image/bmp' });
  }

  function drawDwgPreview() {
    if (!dwgPreview) return;
    const canvas = $('cad');
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#172334';
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / dwgPreview.width, height / dwgPreview.height) * 0.96;
    ctx.drawImage(dwgPreview, (width - dwgPreview.width * scale) / 2, (height - dwgPreview.height * scale) / 2, dwgPreview.width * scale, dwgPreview.height * scale);
  }

  function clearDwgPreview() {
    if (dwgPreview?.src) URL.revokeObjectURL(dwgPreview.src);
    dwgPreview = null;
  }

  async function showDwgPreview(bytes) {
    clearDwgPreview();
    dwgMode = 'preview';
    cadSource = null;
    cadKey = '';
    setKind('dwg');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const url = URL.createObjectURL(previewBlob(bytes));
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('A prévia embutida neste DWG não pôde ser exibida.'));
    });
    dwgPreview = image;
    drawDwgPreview();
  }

  async function openDwg(file) {
    const key = file.name + ':' + file.size + ':' + file.lastModified;
    if (cadKey === key && dwgMode === 'vector' && cadRenderer?.getDocument()) {
      setKind('dwg');
      cadRenderer.resize();
      publishDwg();
      status('');
      return;
    }
    const { readDwg } = await import(asset('./dwg-read.js'));
    const result = await readDwg(file, (message) => status(message));
    if (result.preview) {
      await showDwgPreview(result.preview);
      cadKey = key;
      status('Este DWG não trouxe vetores do modelo. A imagem é a prévia salva dentro do arquivo.');
      return;
    }
    clearDwgPreview();
    dwgMode = 'vector';
    const { CrispCadRenderer, prepareDrawing } = await import(asset('./cad-view.js'));
    const prepared = prepareDrawing(result.database, file.name);
    try {
      const { attachCadImages } = await import(asset('./cad-images.js'));
      cadImages?.dispose?.();
      cadImages = await attachCadImages(result.database, prepared);
    } catch { /* imagens OLE opcionais */ }
    setKind('dwg');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!cadRenderer) {
      cadRenderer = new CrispCadRenderer($('cad'), {
        contrastMode: 'preserve',
        background: '#172334',
        foreground: '#ffffff',
        showPageBounds: false,
        fitMode: 'extents',
      });
      cadRenderer.onViewChange = (event) => {
        const zoom = Math.round(event.zoomPercent);
        if (zoom !== lastDwgZoom) {
          lastDwgZoom = zoom;
          hooks.onDwgState?.({ zoom, measuring: !!measureTool?.active });
        }
        measureTool?.draw?.();
      };
      bindCad();
      const { DwgMeasure } = await import(asset('./measure.js'));
      measureTool = new DwgMeasure($('cad'), cadRenderer);
      const applyMeasure = measureTool.update.bind(measureTool);
      measureTool.update = () => {
        applyMeasure();
        publishDwg();
      };
    }
    quarterTurns = 0;
    cadSource = prepared.document;
    cadKey = key;
    cadRenderer.resize();
    try {
      cadRenderer.setDocument(prepared.document);
      setupLayers();
      measureTool?.reset?.();
    } catch {
      try { cadRenderer.fitToView(0.9); } catch { /* mantém o trecho já desenhado */ }
      status('A prancha abriu. Alguns elementos sem tipo foram ignorados.');
      publishDwg();
      return;
    }
    const partial = result.unknown > 0 || Object.values(cadRenderer.getStats?.().unsupported || {}).some((count) => count > 0);
    const fonts = prepared.substitutedFonts || [];
    const fontNote = fonts.length ? ' Fontes SHX substituídas por Arial: ' + fonts.join(', ') + '.' : '';
    status((partial ? 'Prévia parcial: alguns elementos deste DWG não são suportados. ' : '') + 'Desenho vetorial aberto no aparelho.' + fontNote);
    publishDwg();
  }

  async function openPdf(file) {
    const viewer = await ensurePdf();
    setKind('pdf');
    await viewer.open(file);
  }

  function paintImage() {
    const plan = $('plan');
    if (!plan) return;
    const turn = imageTurns % 4;
    plan.style.transform = `translate(${imageX}px,${imageY}px) scale(${imageScale}) translate(${turn === 1 ? imageHeight : turn === 2 ? imageWidth : 0}px,${turn === 2 ? imageHeight : turn === 3 ? imageWidth : 0}px) rotate(${turn * 90}deg)`;
    hooks.onDwgState?.({ zoom: Math.round(imageScale * 100), measuring: false });
  }

  function fitImage() {
    const fitWidth = imageTurns % 2 ? imageHeight : imageWidth;
    const fitHeight = imageTurns % 2 ? imageWidth : imageHeight;
    imageScale = Math.max(0.01, Math.min((stage.clientWidth - 48) / fitWidth, (stage.clientHeight - 48) / fitHeight));
    imageX = (stage.clientWidth - fitWidth * imageScale) / 2;
    imageY = (stage.clientHeight - fitHeight * imageScale) / 2;
    paintImage();
  }

  function bindImage() {
    const viewport = $('drawing');
    if (!viewport || viewport.dataset.bound) return;
    viewport.dataset.bound = '1';
    viewport.addEventListener('wheel', (event) => {
      if (kind !== 'image') return;
      event.preventDefault();
      const next = Math.max(0.01, Math.min(100, imageScale * Math.exp(-event.deltaY * 0.001)));
      const rect = viewport.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      imageX = cx - (cx - imageX) * next / imageScale;
      imageY = cy - (cy - imageY) * next / imageScale;
      imageScale = next;
      paintImage();
    }, { passive: false });
    viewport.addEventListener('pointerdown', (event) => {
      if (kind !== 'image') return;
      viewport.setPointerCapture(event.pointerId);
      imagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!imagePointers.has(event.pointerId) || kind !== 'image') return;
      const old = imagePointers.get(event.pointerId);
      imagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pts = [...imagePointers.values()];
      if (pts.length === 1) {
        imageX += event.clientX - old.x;
        imageY += event.clientY - old.y;
      }
      paintImage();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      viewport.addEventListener(name, (event) => imagePointers.delete(event.pointerId));
    }
    viewport.addEventListener('dblclick', () => { if (kind === 'image') fitImage(); });
  }

  function probeImage(source) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => resolve(probe);
      probe.onerror = () => reject(new Error('Não foi possível abrir esta imagem.'));
      probe.src = source;
    });
  }

  async function prepareSVG(file) {
    let text = await file.text();
    text = text.replace(/^\uFEFF/, '').trim();
    if (!/<svg[\s>]/i.test(text)) throw new Error('Não foi possível ler o desenho SVG.');
    const open = text.match(/<svg\b[^>]*>/i)?.[0] || '';
    if (open && !/\sxmlns\s*=/.test(open)) text = text.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    const blobURL = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    try {
      const probe = await probeImage(blobURL);
      return { url: blobURL, probe, width: probe.naturalWidth, height: probe.naturalHeight };
    } catch (error) {
      URL.revokeObjectURL(blobURL);
      throw error;
    }
  }

  async function showImageSource(source) {
    bindImage();
    const probe = source?.probe || await probeImage(typeof source === 'string' ? source : source.url);
    const url = typeof source === 'string' ? source : source.url;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = url.startsWith('blob:') ? url : null;
    const plan = $('plan');
    plan.src = url;
    imageTurns = 0;
    imageWidth = probe.naturalWidth || source.width || 1000;
    imageHeight = probe.naturalHeight || source.height || 700;
    plan.style.width = imageWidth + 'px';
    plan.style.height = imageHeight + 'px';
    setKind('image');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    fitImage();
  }

  async function openWord(file) {
    if (!wordViewer) {
      const { WordViewer } = await import(asset('./word-view.js'));
      wordViewer = new WordViewer($('word'), (value) => {
        if (kind === 'word') hooks.onPdfState?.({ page: wordViewer.current?.pageNumber || 1, pages: wordViewer.current?.pages?.length || 1, zoom: value, matches: wordViewer.current?.matches?.length || 0, match: (wordViewer.current?.matchIndex ?? -1) + 1 });
      });
    }
    if (wordViewer.current) wordViewer.dispose(wordViewer.current);
    setKind('word');
    await wordViewer.open(file);
  }

  function archiveSize(size) {
    if (!size) return '';
    if (size >= 1048576) return ' · ' + (size / 1048576).toFixed(1) + ' MB';
    if (size >= 1024) return ' · ' + Math.max(1, Math.round(size / 1024)) + ' KB';
    return ' · ' + size + ' B';
  }

  function renderArchive(session) {
    const dialog = $('archive-dialog');
    const list = $('archive-list');
    const back = $('archive-back');
    $('archive-title').textContent = session.name;
    if (back) back.hidden = archiveStack.length < 2;
    list.replaceChildren();
    for (const entry of session.entries) {
      const button = document.createElement('button');
      const ext = entry.path.split('.').pop().toLowerCase();
      const known = VIEW_EXT.has(ext);
      button.type = 'button';
      button.textContent = entry.path + (known ? '' : ' · não abre aqui') + archiveSize(entry.size);
      button.onclick = async () => {
        if (!known) {
          status('Este item não abre aqui. Escolha uma imagem, DWG, IFC, SKP, PDF, Word, TXT, SVG ou outro compactado.', true);
          return;
        }
        dialog.close();
        status('Abrindo ' + (entry.path.split('/').pop()) + '…');
        try {
          const blob = await entry.blob();
          fromArchiveOpen = true;
          await openFile(new File([blob], entry.path.split('/').pop() || 'arquivo', { type: blob.type || 'application/octet-stream' }));
        } catch (error) {
          fromArchiveOpen = false;
          status(error.message, true);
        }
      };
      list.append(button);
    }
    dialog.showModal();
  }

  async function openArchive(file) {
    const { readArchive } = await import(asset('./archive-view.js'));
    const session = await readArchive(file);
    session.name = file.name;
    session.file = file;
    archiveStack.push(session);
    if ($('archive-close') && !$('archive-close').dataset.bound) {
      $('archive-close').dataset.bound = '1';
      $('archive-close').onclick = () => $('archive-dialog').close();
      $('archive-back').onclick = () => {
        const current = archiveStack.pop();
        current?.close?.().catch(() => {});
        if (archiveStack.length) renderArchive(archiveStack[archiveStack.length - 1]);
        else $('archive-dialog').close();
      };
    }
    renderArchive(session);
  }

  async function openFile(file) {
    const nested = fromArchiveOpen;
    fromArchiveOpen = false;
    if (!nested) {
      while (archiveStack.length) {
        const session = archiveStack.pop();
        session.close?.().catch(() => {});
      }
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      const url = URL.createObjectURL(file);
      try { await showImageSource(url); }
      catch (error) {
        URL.revokeObjectURL(url);
        throw new Error(ext === 'heic' || ext === 'heif' || ext === 'tif' || ext === 'tiff'
          ? 'Este aparelho não abre esta foto. Salve como JPG ou PNG.'
          : (error.message || 'Não foi possível abrir esta imagem.'));
      }
      return 'image';
    }
    if (ARCHIVE_EXT.has(ext)) {
      if (file.size > PDF_LIMIT) throw new Error('O limite para este formato é 100 MB.');
      await openArchive(file);
      return 'archive';
    }
    if (ext === 'doc' || ext === 'docx' || ext === 'txt') {
      if (file.size > WORD_LIMIT) throw new Error('O limite para Word/TXT é 100 MB.');
      await openWord(file);
      return 'word';
    }
    if (ext === 'pdf') {
      if (file.size > PDF_LIMIT) throw new Error('O limite para PDF é 100 MB.');
      await openPdf(file);
      return 'pdf';
    }
    if (ext === 'ifc' || ext === 'skp') {
      if (file.size > IFC_LIMIT) throw new Error('O limite para IFC/SKP é 1 GB.');
      await addIfc(file, file.name + ':' + file.size + ':' + file.lastModified);
      return 'ifc';
    }
    if (ext === 'svg') {
      const prepared = await prepareSVG(file);
      try { await showImageSource(prepared); }
      catch (error) {
        if (prepared.url.startsWith('blob:')) URL.revokeObjectURL(prepared.url);
        throw error;
      }
      return 'image';
    }
    if (ext === 'dwg') {
      if (file.size > DWG_LIMIT) throw new Error('O limite para DWG é 500 MB.');
      await openDwg(file);
      return 'dwg';
    }
    throw new Error('Este visualizador abre PDF, DWG, IFC, SKP, Word, TXT, SVG, imagem ou compactado.');
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  import(asset('./dwg-read.js')).then((mod) => mod.warmDwgEngine?.()).catch(() => {});

  return {
    getKind: () => kind,
    addIfc,
    showIfc,
    setIfcVisible,
    setIfcColor,
    removeIfc,
    toggleWalk() {
      if (ifcWalk?.walking || ifcWalk?.placing || ifcWalk?.active) ifcWalk.stop();
      else ifcWalk?.start?.();
      return !!ifcWalk?.walking;
    },
    async open(file) {
      return openFile(file);
    },
    zoom(factor) {
      if (kind === 'pdf') pdfViewer?.zoom(factor);
      else if (kind === 'dwg') cadRenderer?.zoom(factor, { x: $('cad').clientWidth / 2, y: $('cad').clientHeight / 2 });
      else if (kind === 'word') wordViewer?.zoom(factor, true);
      else if (kind === 'image') {
        const next = Math.max(0.01, Math.min(100, imageScale * factor));
        const cx = stage.clientWidth / 2;
        const cy = stage.clientHeight / 2;
        imageX = cx - (cx - imageX) * next / imageScale;
        imageY = cy - (cy - imageY) * next / imageScale;
        imageScale = next;
        paintImage();
      }
      else if (kind === 'ifc') {
        if (ifcWalk?.walking) ifcWalk.nudge(factor > 1 ? 0.5 : -0.5);
        else ifcNavigation?.zoom(factor);
      }
    },
    async fit() {
      if (kind === 'pdf') await pdfViewer?.fit();
      else if (kind === 'dwg') cadRenderer?.fitToView(0.9);
      else if (kind === 'word') wordViewer?.fit();
      else if (kind === 'image') fitImage();
      else if (kind === 'ifc') fit3d();
    },
    async rotate() {
      if (kind === 'pdf') await pdfViewer?.rotate();
      else if (kind === 'word') wordViewer?.rotate();
      else if (kind === 'image') {
        imageTurns = (imageTurns + 1) % 4;
        fitImage();
      }
      else if (kind === 'dwg' && cadRenderer && cadSource) {
        const { rotatedDocument } = await import(asset('./cad-view.js'));
        quarterTurns = (quarterTurns + 1) % 4;
        measureTool?.reset?.();
        cadRenderer.setDocument(rotatedDocument(cadSource, quarterTurns));
        renderLayers();
        publishDwg({ measuring: false });
      }
    },
    openLayers() {
      if (kind !== 'dwg' || !cadRenderer) return;
      renderLayers();
      $('layers-dialog').showModal();
    },
    toggleBackground() {
      if (kind !== 'dwg' || !cadRenderer) return;
      const light = cadRenderer.getOptions?.().background === '#e9edf1';
      cadRenderer.setOptions?.({
        background: light ? '#172334' : '#e9edf1',
        foreground: light ? '#ffffff' : '#111111',
      });
    },
    async go(page) {
      if (kind === 'pdf') await pdfViewer?.go(page);
      else if (kind === 'word') wordViewer?.go(page);
    },
    async search(query) {
      if (kind === 'pdf') return pdfViewer?.search(query);
      if (kind === 'word') return wordViewer?.search(query) || [];
      return [];
    },
    async nextMatch(direction) {
      if (kind === 'pdf') await pdfViewer?.nextMatch(direction);
      else if (kind === 'word') wordViewer?.nextMatch(direction);
    },
    setMeasureScale(info) {
      pdfViewer?.setScaleInfo(info || null);
    },
    toggleMeasure() {
      if (kind === 'pdf' && pdfViewer) return pdfViewer.toggleMeasure();
      if (kind === 'dwg' && measureTool) {
        $('measure').click();
        publishDwg();
        return !!measureTool.active;
      }
      return false;
    },
    blank() {
      setKind('empty');
    },
    resize,
    destroy() {
      alive = false;
      observer.disconnect();
      renderer?.setAnimationLoop(null);
      try { ifcWalk?.stop(); } catch { /* caminhar já encerrado */ }
      try { measureTool?.reset?.(); cadRenderer?.destroy?.(); clearDwgPreview(); } catch { /* leitor DWG já liberado */ }
      try { clear3d(); } catch { /* a cena pode já ter saído da página */ }
      try { wordViewer?.dispose?.(wordViewer.current); } catch { /* Word já fechado */ }
      try { cadImages?.dispose?.(); } catch { /* imagens CAD já liberadas */ }
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      while (archiveStack.length) archiveStack.pop()?.close?.().catch(() => {});
      pdfViewer?.close().catch(() => {});
      try { renderer?.dispose(); } catch { /* renderer já liberado */ }
      ifcApi = null;
      host.replaceChildren();
    },
  };
}

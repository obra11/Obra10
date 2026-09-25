const VIEWER_BASE = new URL('./', import.meta.url);

function asset(path) {
  const rel = String(path).replace(/^\.\//, '');
  return new URL(rel, VIEWER_BASE).href;
}

globalThis.PrumoAssets = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return asset(prop);
    },
  },
);

const PDF_LIMIT = 100 * 1024 * 1024;
const DWG_LIMIT = 100 * 1024 * 1024;
const IFC_LIMIT = 300 * 1024 * 1024;

function ensureStyle() {
  let style = document.getElementById('obra10-viewer-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'obra10-viewer-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    .obra10-stage { position:absolute; inset:0; background:#1B1B1B; overflow:hidden; color:#fff; font-family:Inter,system-ui,sans-serif; }
    .obra10-stage .layer { position:absolute; inset:0; }
    .obra10-stage [hidden] { display: none !important; }
    .obra10-stage #pdf, .obra10-stage #cad { touch-action:none; }
    .obra10-stage #cad { background:#172334; }
    .obra10-stage #cad-canvas { display:block; width:100%; height:100%; }
    .obra10-stage #measure-overlay { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:2; }
    .obra10-stage #measure-panel { position:absolute; z-index:3; top:12px; left:12px; right:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; margin:auto; max-width:720px; padding:10px 14px; background:#102d3ef2; border:1px solid #4ba6ad; border-radius:12px; }
    .obra10-stage #measure-result { font-size:13px; color:#8bf5e8; }
    .obra10-stage #measure-panel small { display:block; font-size:10px; color:#a7bfce; margin-top:4px; }
    .obra10-stage #measure-clear { font-size:12px; padding:8px 10px; border-radius:8px; border:0; background:#E5192C; color:#fff; font-weight:700; }
    .obra10-stage .measure-units { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:11px; margin-top:6px; color:#d4fff7; }
    .obra10-stage #measure-unit, .obra10-stage #measure-scale, .obra10-stage #measure-scale-custom, .obra10-stage #measure-known, .obra10-stage #measure-known-unit { background:#11283b; color:#fff; border:1px solid #548594; border-radius:6px; padding:4px 6px; font-size:12px; }
    .obra10-stage #measure-scale-custom, .obra10-stage #measure-known { width:80px; }
    .obra10-stage #measure-calibrate { font-size:11px; padding:6px 10px; border-radius:8px; border:0; background:#4ba6ad; color:#102d3e; font-weight:700; }
    .obra10-stage #measure-loupe { position:absolute; z-index:4; top:188px; left:16px; width:154px; border:2px solid #63f0e5; border-radius:14px; overflow:hidden; background:#102539; pointer-events:none; }
    .obra10-stage #measure-loupe canvas { display:block; width:150px; height:150px; }
    .obra10-stage #measure-target { display:block; font-size:10px; text-align:center; padding:6px; color:#d4fff7; }
    .obra10-stage.measuring, .obra10-stage #cad.measuring { cursor:crosshair; }
    .obra10-stage #layers-dialog { width:min(420px, calc(100vw - 24px)); max-height:min(70vh, 560px); border:0; border-radius:16px; padding:0; color:#1B1B1B; background:#fff; }
    .obra10-stage #layers-dialog::backdrop { background:rgba(0,0,0,.45); }
    .obra10-stage .layer-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 14px 8px; }
    .obra10-stage .layer-heading h2 { margin:0; font-size:16px; }
    .obra10-stage .layer-heading button, .obra10-stage .layer-actions button { border:1px solid #e6e8ec; background:#fff; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:700; }
    .obra10-stage #layer-search { display:block; width:calc(100% - 28px); margin:0 14px 8px; border:1px solid #e6e8ec; border-radius:8px; padding:8px 10px; }
    .obra10-stage .layer-actions { display:flex; flex-wrap:wrap; gap:6px; padding:0 14px 8px; }
    .obra10-stage #layer-list { overflow:auto; max-height:360px; padding:0 14px 14px; display:flex; flex-direction:column; gap:4px; }
    .obra10-stage #layer-list label { display:flex; align-items:center; gap:8px; font-size:13px; }
    .obra10-stage #pdf-measure { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:3; }
    .obra10-stage #three { touch-action:none; }
    .obra10-stage #three canvas { display:block; }
    .obra10-stage #ifc-tools { position:absolute; left:8px; right:8px; bottom:8px; z-index:5; display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:8px; border-radius:12px; background:rgba(27,27,27,.88); border:1px solid rgba(255,255,255,.12); }
    .obra10-stage #ifc-tools button, .obra10-stage #ifc-tools select { background:#E5192C; color:#fff; border:0; border-radius:8px; padding:8px 10px; font-size:13px; font-weight:600; }
    .obra10-stage #ifc-tools button[aria-pressed="true"] { outline:2px solid #fff; }
    .obra10-stage #ifc-tools small, .obra10-stage #ifc-tools strong { color:#fff; font-size:12px; }
    .obra10-stage #ifc-cut-controls, .obra10-stage #ifc-measure-info { display:flex; flex-wrap:wrap; gap:6px; align-items:center; width:100%; }
    .obra10-stage #ifc-cut-overlay, .obra10-stage #ifc-measure-overlay { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4; }
    .obra10-stage #ifc-cut-handle { position:absolute; z-index:6; transform:translate(-50%,-50%); background:#E5192C; color:#fff; border:0; border-radius:999px; padding:8px 12px; font-size:12px; font-weight:700; }
  `;
}

export function mountViewer(host, hooks = {}) {
  ensureStyle();
  host.replaceChildren();
  const stage = document.createElement('div');
  stage.className = 'obra10-stage';
  stage.innerHTML = `
    <div id="pdf" class="layer" hidden><canvas aria-label="Página PDF"></canvas><svg id="pdf-measure" aria-hidden="true"></svg></div>
    <div id="cad" class="layer" hidden>
      <canvas id="cad-canvas" aria-label="Desenho CAD vetorial"></canvas>
      <svg id="measure-overlay" aria-hidden="true"></svg>
      <div id="measure-panel" hidden>
        <div>
          <strong id="measure-result"></strong>
          <small id="measure-hint">Arraste uma ponta para ajustar. Dois dedos navegam.</small>
          <label class="measure-units">Unidade do DWG:
            <select id="measure-unit">
              <option value="">Confirmar unidade…</option>
              <option value="4">Milímetros</option>
              <option value="5">Centímetros</option>
              <option value="6">Metros</option>
              <option value="1">Polegadas</option>
              <option value="2">Pés</option>
              <option value="7">Quilômetros</option>
              <option value="10">Jardas</option>
              <option value="14">Decímetros</option>
            </select>
          </label>
          <label class="measure-units">Escala:
            <select id="measure-scale">
              <option value="1">1:1 — cotas do modelo</option>
              <option value="20">1:20</option>
              <option value="25">1:25</option>
              <option value="50">1:50</option>
              <option value="75">1:75 — só prancha em papel</option>
              <option value="100">1:100</option>
              <option value="125">1:125</option>
              <option value="200">1:200</option>
              <option value="250">1:250</option>
              <option value="500">1:500</option>
              <option value="custom">Fator…</option>
            </select>
            <input id="measure-scale-custom" type="number" min="0.0001" step="any" placeholder="1,52" hidden>
          </label>
          <label class="measure-units" id="measure-calibrate-row" hidden>
            Esta cota mede
            <input id="measure-known" type="text" inputmode="decimal" placeholder="365,5">
            <select id="measure-known-unit">
              <option value="cm">cm</option>
              <option value="m">m</option>
              <option value="mm">mm</option>
            </select>
            <button id="measure-calibrate" type="button">Calibrar</button>
          </label>
        </div>
        <button id="measure-clear" type="button">Limpar</button>
      </div>
      <div id="measure-loupe" hidden><canvas width="300" height="300"></canvas><span id="measure-target"></span></div>
      <button id="measure" type="button" hidden aria-pressed="false">Medir</button>
    </div>
    <dialog id="layers-dialog">
      <div class="layer-heading"><h2>Layers do desenho</h2><button id="layers-close" type="button" aria-label="Fechar layers">Fechar</button></div>
      <input id="layer-search" type="search" placeholder="Buscar layer…" aria-label="Buscar layer">
      <div class="layer-actions">
        <button id="layers-all" type="button">Mostrar todas</button>
        <button id="layers-original" type="button">Estado original</button>
        <button id="layers-dimensions" type="button">Mostrar cotas</button>
      </div>
      <div id="layer-list"></div>
    </dialog>
    <div id="three" class="layer" hidden></div>
    <svg id="ifc-cut-overlay" aria-hidden="true"></svg>
    <button id="ifc-cut-handle" hidden type="button" role="slider" aria-label="Posição do corte IFC" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">Corte</button>
    <svg id="ifc-measure-overlay" aria-hidden="true"></svg>
    <div id="ifc-tools" hidden>
      <button id="ifc-pan" type="button" aria-pressed="false">Mover</button>
      <button id="ifc-focus" type="button" aria-pressed="false">Focar ponto</button>
      <button id="ifc-cut" type="button" aria-pressed="false">Corte</button>
      <button id="ifc-measure" type="button" aria-pressed="false">Medir</button>
      <div id="ifc-cut-controls" hidden>
        <label>Direção
          <select id="ifc-cut-axis">
            <option value="y">Horizontal</option>
            <option value="x">Lateral</option>
            <option value="z">Frontal</option>
          </select>
        </label>
        <input id="ifc-cut-position" type="range" min="0" max="100" value="50" aria-label="Posição do corte">
        <span id="ifc-cut-value">50%</span>
        <label><input id="ifc-cut-reverse" type="checkbox"> Inverter</label>
      </div>
      <div id="ifc-measure-info" hidden>
        <strong id="ifc-measure-result"></strong>
        <button id="ifc-measure-clear" type="button">Limpar</button>
      </div>
      <small id="ifc-hint">Arraste para orbitar. Dois dedos aproximam e deslocam.</small>
    </div>
  `;
  host.appendChild(stage);

  const $ = (id) => stage.querySelector('#' + id);
  let kind = 'empty';
  let pdfViewer = null;
  let THREE = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let group = null;
  let ifcRoot = null;
  let originLocked = false;
  const ifcModels = new Map();
  let ifcApi = null;
  let ifcNavigation = null;
  let ifcTools = null;
  let disposeIfcGroup = null;
  let ifcNeedsRender = false;
  let alive = true;

  function status(message, error = false) {
    hooks.onStatus?.({ message, error });
  }

  function setKind(next) {
    kind = next;
    $('pdf').hidden = next !== 'pdf';
    $('cad').hidden = next !== 'dwg';
    $('three').hidden = next !== 'ifc';
    $('ifc-tools').hidden = next !== 'ifc';
    $('ifc-cut-overlay').style.visibility = next === 'ifc' ? 'visible' : 'hidden';
    $('ifc-measure-overlay').style.visibility = next === 'ifc' ? 'visible' : 'hidden';
    if (next !== 'ifc') $('ifc-cut-handle').hidden = true;
    ifcTools?.activate(next === 'ifc');
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

  function resize() {
    ifcNeedsRender = true;
    ifcTools?.draw();
    if (pdfViewer && kind === 'pdf') pdfViewer.render().catch((e) => status(e.message, true));
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
    if (!camera || !controls || !ifcModels.size) return;
    const box = new THREE.Box3();
    let any = false;
    for (const model of ifcModels.values()) {
      if (!model.group.visible) continue;
      const part = new THREE.Box3().setFromObject(model.group);
      if (part.isEmpty()) continue;
      box.union(part);
      any = true;
    }
    if (!any || box.isEmpty()) return;
    ifcNavigation?.setModel(ifcRoot);
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
    scene.background = new THREE.Color('#1B1B1B');
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    $('three').appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const { IfcNavigation } = await import(asset('./ifc-navigation.js'));
    ifcNavigation = new IfcNavigation(THREE, camera, controls, renderer.domElement, (text) => {
      $('ifc-hint').textContent = text;
      $('ifc-focus').setAttribute('aria-pressed', String(!!ifcNavigation?.focusArmed));
    });
    const { IfcTools } = await import(asset('./ifc-tools.js'));
    ifcTools = new IfcTools(THREE, renderer, camera, controls, ifcNavigation, () => {
      ifcNeedsRender = true;
    }, stage);
    $('ifc-pan').onclick = () => {
      const pressed = $('ifc-pan').getAttribute('aria-pressed') === 'true';
      ifcNavigation.setPan(!pressed);
      $('ifc-pan').setAttribute('aria-pressed', String(!pressed));
    };
    $('ifc-focus').onclick = () => {
      const pressed = $('ifc-focus').getAttribute('aria-pressed') === 'true';
      ifcNavigation.armFocus(!pressed);
      $('ifc-focus').setAttribute('aria-pressed', String(!pressed));
    };
    controls.addEventListener('change', () => {
      ifcNeedsRender = true;
    });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x708090, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(5, 10, 8);
    scene.add(light);
    resize();
    renderer.setAnimationLoop(() => {
      if (!alive || kind !== 'ifc') return;
      const changed = ifcTools?.cutDrag ? false : controls.update();
      if (changed || ifcNeedsRender) {
        renderer.render(scene, camera);
        ifcNeedsRender = false;
      }
    });
  }

  function clear3d() {
    for (const model of ifcModels.values()) disposeIfcGroup?.(model.group);
    ifcModels.clear();
    if (ifcRoot) {
      scene?.remove(ifcRoot);
      ifcRoot = null;
    }
    group = null;
    originLocked = false;
    ifcTools?.setModel(null);
  }

  function ensureIfcRoot() {
    if (ifcRoot) return ifcRoot;
    ifcRoot = new THREE.Group();
    ifcRoot.name = 'ifc-root';
    scene.add(ifcRoot);
    group = ifcRoot;
    return ifcRoot;
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
    measureTool?.refreshSegments();
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
    viewport.addEventListener('wheel', (event) => {
      if (kind !== 'dwg' || !cadRenderer) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      cadRenderer.zoom(Math.exp(-event.deltaY * 0.001), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }, { passive: false });
    viewport.addEventListener('pointerdown', (event) => {
      if (kind !== 'dwg' || event.target.closest('button,select,input')) return;
      viewport.setPointerCapture(event.pointerId);
      cadPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!cadPointers.has(event.pointerId) || kind !== 'dwg' || !cadRenderer) return;
      const old = [...cadPointers.values()];
      const previous = cadPointers.get(event.pointerId);
      cadPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const next = [...cadPointers.values()];
      if (old.length === 1) {
        cadRenderer.panByScreenDelta(event.clientX - previous.x, event.clientY - previous.y);
      } else if (old.length === 2) {
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
      if (event.target.closest('button,select,input') || measureTool?.active) return;
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
    const canvas = $('cad-canvas');
    const width = Math.max(1, $('cad').clientWidth);
    const height = Math.max(1, $('cad').clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#172334';
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / dwgPreview.width, height / dwgPreview.height) * 0.96;
    const dw = dwgPreview.width * scale;
    const dh = dwgPreview.height * scale;
    ctx.drawImage(dwgPreview, (width - dw) / 2, (height - dh) / 2, dw, dh);
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
    const result = await readDwg(file);
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
    setKind('dwg');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!cadRenderer) {
      cadRenderer = new CrispCadRenderer($('cad-canvas'), {
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
        measureTool?.draw();
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
      measureTool?.reset();
    } catch (error) {
      try { cadRenderer.fitToView(0.9); } catch { /* mantém o trecho já desenhado */ }
      status('A prancha abriu. Alguns elementos sem tipo foram ignorados.');
      publishDwg();
      return;
    }
    const partial = result.unknown > 0 || Object.values(cadRenderer.getStats().unsupported || {}).some((count) => count > 0);
    const fonts = prepared.substitutedFonts || [];
    const fontNote = fonts.length ? ' Fontes SHX substituídas por Arial: ' + fonts.join(', ') + '.' : '';
    const opened = result.space === 'paper'
      ? 'Prancha aberta a partir do espaço de papel.'
      : 'Desenho vetorial aberto no aparelho.';
    status((partial ? 'Prévia parcial: alguns elementos deste DWG não são suportados. ' + opened : opened) + fontNote);
    publishDwg();
  }

  async function openPdf(file) {
    const viewer = await ensurePdf();
    setKind('pdf');
    await viewer.open(file);
  }

  async function addIfc(file, modelId) {
    if (file.size > IFC_LIMIT) throw new Error('O limite para IFC é 300 MB.');
    if (ifcModels.has(modelId)) {
      setKind('ifc');
      return modelId;
    }
    await init3d();
    if (!ifcApi) {
      const { IfcAPI } = await import(asset('./vendor/web-ifc-api.js'));
      const api = new IfcAPI();
      await api.Init(() => asset('./vendor/web-ifc.wasm'), true);
      ifcApi = api;
    }
    const { IfcMeshBuilder, disposeIfcGroup: dispose } = await import(asset('./ifc-meshes.js'));
    disposeIfcGroup = dispose;
    const builder = new IfcMeshBuilder(THREE);
    let id = -1;
    let next = null;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      id = ifcApi.OpenModel(data, { COORDINATE_TO_ORIGIN: false });
      if (id < 0) throw new Error('Arquivo IFC inválido.');
      ifcApi.StreamAllMeshes(id, (flat) => {
        for (let i = 0; i < flat.geometries.size(); i++) builder.add(ifcApi, id, flat.geometries.get(i));
      });
      next = builder.build();
      if (!next.children.length) throw new Error('Este IFC não contém geometria 3D compatível.');
      next.name = file.name;
      const root = ensureIfcRoot();
      root.add(next);
      if (!originLocked) {
        const box = new THREE.Box3().setFromObject(next);
        if (!box.isEmpty()) {
          root.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
          originLocked = true;
        }
      }
      ifcModels.set(modelId, { name: file.name, group: next });
      camera.up.set(0, 1, 0);
      ifcTools.setModel(root);
      setKind('ifc');
      resize();
      fit3d();
      return modelId;
    } catch (error) {
      if (next) dispose(next);
      else builder.dispose();
      throw error;
    } finally {
      if (id >= 0) ifcApi.CloseModel(id);
    }
  }

  function showIfc() {
    if (!ifcModels.size) return false;
    setKind('ifc');
    resize();
    ifcNeedsRender = true;
    return true;
  }

  function setIfcVisible(modelId, visible) {
    const model = ifcModels.get(modelId);
    if (!model) return;
    model.group.visible = !!visible;
    ifcNeedsRender = true;
  }

  function removeIfc(modelId) {
    const model = ifcModels.get(modelId);
    if (!model) return;
    ifcRoot?.remove(model.group);
    disposeIfcGroup?.(model.group);
    ifcModels.delete(modelId);
    ifcNeedsRender = true;
    if (!ifcModels.size) {
      originLocked = false;
      if (ifcRoot) ifcRoot.position.set(0, 0, 0);
      ifcTools?.setModel(null);
      setKind('empty');
      return;
    }
    ifcTools?.setModel(ifcRoot);
    fit3d();
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);

  return {
    getKind: () => kind,
    addIfc,
    showIfc,
    setIfcVisible,
    removeIfc,
    async open(file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'pdf') {
        if (file.size > PDF_LIMIT) throw new Error('O limite para PDF é 100 MB.');
        await openPdf(file);
        return 'pdf';
      }
      if (ext === 'dwg') {
        if (file.size > DWG_LIMIT) throw new Error('O limite para DWG é 100 MB.');
        await openDwg(file);
        return 'dwg';
      }
      if (ext === 'ifc') {
        await addIfc(file, file.name + ':' + file.size + ':' + file.lastModified);
        return 'ifc';
      }
      throw new Error('Este visualizador abre PDF, DWG e IFC.');
    },
    zoom(factor) {
      if (kind === 'pdf') pdfViewer?.zoom(factor);
      else if (kind === 'dwg') cadRenderer?.zoom(factor, { x: $('cad').clientWidth / 2, y: $('cad').clientHeight / 2 });
      else if (kind === 'ifc') ifcNavigation?.zoom(factor);
    },
    async fit() {
      if (kind === 'pdf') await pdfViewer?.fit();
      else if (kind === 'dwg') cadRenderer?.fitToView(0.9);
      else if (kind === 'ifc') fit3d();
    },
    async rotate() {
      if (kind === 'pdf') await pdfViewer?.rotate();
      else if (kind === 'dwg' && cadRenderer && cadSource) {
        const { rotatedDocument } = await import(asset('./cad-view.js'));
        quarterTurns = (quarterTurns + 1) % 4;
        measureTool?.reset();
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
      const light = cadRenderer.getOptions().background === '#e9edf1';
      cadRenderer.setOptions({
        background: light ? '#172334' : '#e9edf1',
        foreground: light ? '#ffffff' : '#111111',
      });
      $('cad').style.background = light ? '#172334' : '#e9edf1';
    },
    async go(page) {
      if (kind === 'pdf') await pdfViewer?.go(page);
    },
    async search(query) {
      if (kind === 'pdf') return pdfViewer?.search(query);
      return [];
    },
    async nextMatch(direction) {
      if (kind === 'pdf') await pdfViewer?.nextMatch(direction);
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
      try { measureTool?.reset(); cadRenderer?.destroy(); clearDwgPreview(); } catch { /* leitor DWG já liberado */ }
      try { clear3d(); } catch { /* a cena pode já ter saído da página */ }
      pdfViewer?.close().catch(() => {});
      try { renderer?.dispose(); } catch { /* renderer já liberado */ }
      ifcApi = null;
      host.replaceChildren();
    },
  };
}

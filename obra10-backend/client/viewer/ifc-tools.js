export class IfcTools {
  constructor(T, renderer, camera, controls, navigation, onChange, root) {
    Object.assign(this, { T, renderer, camera, controls, navigation, onChange });
    this.ray = new T.Raycaster();
    this.active = false;
    this.measuring = false;
    this.leveling = false;
    this.hiding = false;
    this.hidden = [];
    const scope = root || document;
    this.$ = (id) => (scope.querySelector ? scope.querySelector('#' + id) : null);
    this.overlay = this.$('ifc-measure-overlay');
    this.cutOverlay = this.$('ifc-cut-overlay');
    this.cutHandle = this.$('ifc-cut-handle');
    if (!this.overlay || !this.cutHandle) return;
    this.bindCutDrag();
    this.bindButtons();
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || !(this.measuring || this.leveling || this.hiding)) return;
      if (this.editing != null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.down = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }, true);
    canvas.addEventListener('pointermove', (e) => {
      if (this.active && (this.measuring || this.leveling || this.hiding) && this.editing == null) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    canvas.addEventListener('pointerup', (e) => {
      if (!this.active || this.editing != null) return;
      if (!(this.measuring || this.leveling || this.hiding)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.down?.id === e.pointerId && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 15) {
        this.pick(e.clientX, e.clientY);
      }
      this.down = null;
    }, true);
    canvas.addEventListener('pointercancel', () => { this.down = null; });
    canvas.addEventListener('dblclick', (e) => {
      if (this.active && (this.measuring || this.leveling || this.hiding)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    this.overlay.addEventListener('pointerdown', (e) => this.beginEndDrag(e));
    this.overlay.addEventListener('pointermove', (e) => this.moveEndDrag(e));
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.overlay.addEventListener(name, (e) => this.endEndDrag(e));
    }
    controls.addEventListener('change', () => this.draw());
    navigation.hitVisible = (hit) => this.isVisible(hit.point);
  }

  bindButtons() {
    this.$('ifc-cut').onclick = () => {
      if (!this.state) return;
      this.state.cut = !this.state.cut;
      this.applyCut();
    };
    for (const id of ['ifc-cut-axis', 'ifc-cut-position', 'ifc-cut-reverse']) {
      this.$(id)?.addEventListener('input', () => {
        if (!this.state) return;
        this.state.axis = this.$('ifc-cut-axis').value;
        this.state.position = Number(this.$('ifc-cut-position').value);
        this.state.reverse = this.$('ifc-cut-reverse').checked;
        this.applyCut();
      });
    }
    this.$('ifc-cut-face')?.addEventListener('click', () => this.setCutAxis('y'));
    this.$('ifc-cut-side')?.addEventListener('click', () => this.setCutAxis('x'));
    this.$('ifc-cut-rotate')?.addEventListener('click', () => {
      if (!this.state) return;
      const order = ['y', 'x', 'z'];
      this.setCutAxis(order[(order.indexOf(this.state.axis) + 1) % 3]);
    });
    this.$('ifc-measure').onclick = () => {
      this.measuring = !this.measuring;
      this.leveling = false;
      this.hiding = false;
      navigationSafe(this);
      this.sync();
    };
    this.$('ifc-measure-clear')?.addEventListener('click', () => {
      if (this.state) {
        this.state.points = [];
        this.state.square = false;
        this.state.levelEnds = [];
      }
      this.draw();
    });
    this.$('ifc-measure-level')?.addEventListener('click', () => {
      this.leveling = !this.leveling;
      this.measuring = false;
      this.hiding = false;
      navigationSafe(this);
      this.sync();
    });
    this.$('ifc-views')?.addEventListener('click', () => {
      const panel = this.$('ifc-views-panel');
      if (panel) panel.hidden = !panel.hidden;
    });
    this.$('ifc-view-top')?.addEventListener('click', () => this.setView('top'));
    this.$('ifc-view-front')?.addEventListener('click', () => this.setView('front'));
    this.$('ifc-view-iso')?.addEventListener('click', () => this.setView('iso'));
    this.$('ifc-view-ortho')?.addEventListener('click', () => this.setView('ortho'));
    this.$('ifc-hide')?.addEventListener('click', () => {
      this.hiding = !this.hiding;
      this.measuring = false;
      this.leveling = false;
      navigationSafe(this);
      this.sync();
    });
    this.$('ifc-hide-clear')?.addEventListener('click', () => this.restoreHidden());
  }

  setCutAxis(axis) {
    if (!this.state) return;
    this.state.cut = true;
    this.state.axis = axis;
    if (this.$('ifc-cut-axis')) this.$('ifc-cut-axis').value = axis;
    this.applyCut();
  }

  setView(name) {
    if (!this.bounds || !this.camera || !this.controls) return;
    const center = this.bounds.getCenter(new this.T.Vector3());
    const size = this.bounds.getSize(new this.T.Vector3());
    const radius = Math.max(size.length() / 2, 1);
    const distance = radius * 2.2;
    const dirs = {
      top: new this.T.Vector3(0, 1, 0.0001),
      front: new this.T.Vector3(0, 0.15, 1),
      iso: new this.T.Vector3(1, 0.8, 1),
    };
    if (name === 'ortho') {
      this.camera.fov = this.camera.fov < 20 ? 45 : 8;
      this.camera.updateProjectionMatrix();
    } else {
      if (this.camera.fov < 20) {
        this.camera.fov = 45;
        this.camera.updateProjectionMatrix();
      }
      this.controls.target.copy(center);
      this.camera.position.copy(center).add(dirs[name].normalize().multiplyScalar(distance));
      this.controls.update();
    }
    const panel = this.$('ifc-views-panel');
    if (panel) panel.hidden = true;
    this.onChange();
  }

  setModel(group) {
    this.finishCutDrag();
    this.restoreHidden();
    this.group = group;
    this.measuring = false;
    this.leveling = false;
    this.hiding = false;
    this.down = null;
    this.editing = null;
    if (group) {
      this.bounds = new this.T.Box3().setFromObject(group);
      this.state = group.userData.prumoTools ??= {
        cut: false, axis: 'y', position: 50, reverse: false, points: [], square: false, levelEnds: [],
      };
    } else this.state = null;
    this.applyCut();
  }

  activate(active) {
    if (!active) this.finishCutDrag();
    this.active = active;
    if (!active) {
      this.measuring = false;
      this.leveling = false;
      this.hiding = false;
      this.down = null;
      this.editing = null;
    }
    this.applyCut();
  }

  isVisible(point) {
    return this.renderer.clippingPlanes.every((p) => p.distanceToPoint(point) >= -1e-7);
  }

  applyCut() {
    const s = this.state;
    if (this.active && s?.cut) {
      const normal = new this.T.Vector3();
      normal[s.axis] = s.reverse ? 1 : -1;
      const value = this.bounds.min[s.axis] + (this.bounds.max[s.axis] - this.bounds.min[s.axis]) * s.position / 100;
      this.renderer.clippingPlanes = [new this.T.Plane(normal, -normal[s.axis] * value)];
    } else this.renderer.clippingPlanes = [];
    this.sync();
    this.onChange();
  }

  sync() {
    if (!this.$('ifc-cut')) return;
    if (this.hiding) this.$('ifc-hint').textContent = 'Toque na peça para ocultar. Use Mostrar para restaurar.';
    else if (this.leveling) this.$('ifc-hint').textContent = 'Toque numa face para o nível. Arraste as pontas para outra face.';
    else if (this.measuring) this.$('ifc-hint').textContent = 'Toque em duas superfícies. Perto da perpendicular aparece o esquadro.';
    else if (this.state?.cut) this.$('ifc-hint').textContent = 'Arraste a alça ou o plano para posicionar o corte.';
    else this.navigation.armFocus(false);
    this.$('ifc-cut').setAttribute('aria-pressed', String(!!this.state?.cut));
    this.$('ifc-measure').setAttribute('aria-pressed', String(this.measuring));
    this.$('ifc-measure-level')?.setAttribute('aria-pressed', String(this.leveling));
    this.$('ifc-hide')?.setAttribute('aria-pressed', String(this.hiding));
    this.$('ifc-cut-controls').hidden = !this.state?.cut;
    if (this.state) {
      this.$('ifc-cut-axis').value = this.state.axis;
      this.$('ifc-cut-position').value = this.state.position;
      this.$('ifc-cut-reverse').checked = this.state.reverse;
      this.$('ifc-cut-value').textContent = Math.round(this.state.position) + '%';
    }
    const hiddenList = this.$('ifc-hidden');
    if (hiddenList) {
      hiddenList.hidden = !this.hidden.length;
      const count = this.$('ifc-hidden-count');
      if (count) count.textContent = this.hidden.length ? this.hidden.length + ' peça(s) oculta(s)' : '';
    }
    this.draw();
  }

  bindCutDrag() {
    const start = (e) => {
      if (!this.active || !this.state?.cut || this.cutDrag || e.button > 0) return;
      if (e.currentTarget === this.cutOverlay && (this.measuring || this.leveling || this.hiding)) return;
      e.preventDefault();
      e.stopPropagation();
      this.cutDrag = {
        id: e.pointerId, x: e.clientX, y: e.clientY, position: this.state.position,
        axis: { ...this.cutScreenAxis }, enabled: this.controls.enabled, element: e.currentTarget,
      };
      this.controls.enabled = false;
      this.navigation.armFocus(false);
      e.currentTarget.setPointerCapture(e.pointerId);
      this.cutHandle.classList.add('dragging');
    };
    const move = (e) => {
      const drag = this.cutDrag;
      if (!drag || drag.id !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y } = drag.axis;
      const length = x * x + y * y;
      this.cutPending = Math.max(0, Math.min(100, drag.position + 100 * ((e.clientX - drag.x) * x + (e.clientY - drag.y) * y) / Math.max(1, length)));
      if (!this.cutFrame) {
        this.cutFrame = requestAnimationFrame(() => {
          this.cutFrame = 0;
          if (this.cutDrag && this.state) {
            this.state.position = this.cutPending;
            this.applyCut();
          }
        });
      }
    };
    for (const element of [this.cutHandle, this.cutOverlay]) {
      element.addEventListener('pointerdown', start);
      element.addEventListener('pointermove', move);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        element.addEventListener(name, (e) => {
          if (this.cutDrag?.id === e.pointerId) {
            e.stopPropagation();
            this.finishCutDrag();
          }
        });
      }
      element.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); });
    }
    this.cutHandle.addEventListener('keydown', (e) => {
      if (!this.state) return;
      let next = this.state.position;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 100;
      else if (['ArrowUp', 'ArrowRight'].includes(e.key)) next += e.shiftKey ? 10 : 2;
      else if (['ArrowDown', 'ArrowLeft'].includes(e.key)) next -= e.shiftKey ? 10 : 2;
      else return;
      e.preventDefault();
      this.state.position = Math.max(0, Math.min(100, next));
      this.applyCut();
    });
  }

  finishCutDrag() {
    const drag = this.cutDrag;
    if (!drag) return;
    if (this.cutFrame) {
      cancelAnimationFrame(this.cutFrame);
      this.cutFrame = 0;
      if (this.state && Number.isFinite(this.cutPending)) {
        this.state.position = this.cutPending;
        this.applyCut();
      }
    }
    this.cutDrag = null;
    this.cutPending = null;
    this.controls.enabled = drag.enabled;
    this.cutHandle.classList.remove('dragging');
    if (drag.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id);
  }

  drawCut() {
    const visible = this.active && this.state?.cut && this.bounds;
    this.cutHandle.hidden = !visible;
    this.cutOverlay.replaceChildren();
    if (!visible) return;
    const s = this.state;
    const r = this.renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.camera.updateMatrixWorld();
    this.cutOverlay.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const center = this.bounds.getCenter(new this.T.Vector3());
    const axis = s.axis;
    const others = ['x', 'y', 'z'].filter((a) => a !== axis);
    center[axis] = this.bounds.min[axis] + (this.bounds.max[axis] - this.bounds.min[axis]) * s.position / 100;
    const screen = (p) => {
      const v = p.clone().project(this.camera);
      return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2, z: v.z };
    };
    const middle = screen(center);
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((pair) => {
      const v = center.clone();
      others.forEach((a, i) => { v[a] = pair[i] ? this.bounds.max[a] : this.bounds.min[a]; });
      return screen(v);
    });
    const add = (tag, attrs) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      this.cutOverlay.append(el);
      return el;
    };
    if (corners.every((p) => p.z >= -1 && p.z <= 1 && Number.isFinite(p.x + p.y))) {
      const plane = add('polygon', { points: corners.map((p) => p.x + ',' + p.y).join(' '), fill: '#edce7220', stroke: '#edce72', 'stroke-width': 1.5, 'stroke-dasharray': '7 5' });
      plane.style.pointerEvents = (this.measuring || this.leveling || this.hiding) ? 'none' : 'all';
      plane.style.cursor = 'grab';
    }
    const low = center.clone();
    const high = center.clone();
    low[axis] = this.bounds.min[axis];
    high[axis] = this.bounds.max[axis];
    const a = screen(low);
    const b = screen(high);
    let direction = { x: b.x - a.x, y: b.y - a.y };
    if (!Number.isFinite(direction.x + direction.y) || Math.hypot(direction.x, direction.y) < 40 || a.z < -1 || b.z < -1) {
      direction = { x: 0, y: -Math.max(180, r.height * 0.5) };
    } else add('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#edce7280', 'stroke-width': 1, 'stroke-dasharray': '3 5' });
    this.cutScreenAxis = direction;
    const x = Number.isFinite(middle.x) ? Math.max(65, Math.min(r.width - 65, middle.x)) : r.width / 2;
    const y = Number.isFinite(middle.y) ? Math.max(150, Math.min(r.height - 30, middle.y)) : r.height / 2;
    this.cutHandle.style.left = x + 'px';
    this.cutHandle.style.top = y + 'px';
    this.cutHandle.textContent = '↕ Corte · ' + Math.round(s.position) + '%';
    this.cutHandle.setAttribute('aria-valuenow', String(Math.round(s.position)));
    this.cutHandle.setAttribute('aria-valuetext', Math.round(s.position) + '% · arraste para posicionar');
  }

  intersect(x, y) {
    if (!this.group) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this.group.updateMatrixWorld(true);
    this.ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: 1 - (y - r.top) / r.height * 2 }, this.camera);
    return this.ray.intersectObject(this.group, true).find((h) => this.isVisible(h.point)) || null;
  }

  worldVertex(hit, index) {
    const positions = hit.object.geometry.attributes.position;
    const vertex = new this.T.Vector3().fromBufferAttribute(positions, index);
    if (hit.object.isInstancedMesh && hit.instanceId !== undefined) {
      const matrix = new this.T.Matrix4();
      hit.object.getMatrixAt(hit.instanceId, matrix);
      vertex.applyMatrix4(matrix);
    }
    return vertex.applyMatrix4(hit.object.matrixWorld);
  }

  faceNormal(hit) {
    if (!hit.face) return hit.face?.normal || new this.T.Vector3(0, 1, 0);
    const normal = hit.face.normal.clone();
    const normalMatrix = new this.T.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    return normal.applyMatrix3(normalMatrix).normalize();
  }

  snapFeature(hit, from, clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const screenOf = (point) => {
      const projected = point.clone().project(this.camera);
      return { x: r.left + (projected.x + 1) * r.width / 2, y: r.top + (1 - projected.y) * r.height / 2, z: projected.z };
    };
    let point = hit.point.clone();
    let best = 16;
    if (hit.face) {
      const positions = hit.object.geometry.attributes.position;
      for (const index of [hit.face.a, hit.face.b, hit.face.c]) {
        const vertex = this.worldVertex(hit, index);
        if (!this.isVisible(vertex)) continue;
        const projected = screenOf(vertex);
        const d = Math.hypot(projected.x - clientX, projected.y - clientY);
        if (d < best) {
          point = vertex;
          best = d;
        }
      }
    }
    let square = false;
    if (from && hit.face) {
      const plane = new this.T.Plane().setFromNormalAndCoplanarPoint(this.faceNormal(hit), hit.point);
      const foot = new this.T.Vector3();
      plane.projectPoint(from, foot);
      if (this.isVisible(foot)) {
        const at = screenOf(foot);
        if (at.z >= -1 && at.z <= 1 && Math.hypot(at.x - clientX, at.y - clientY) < 28) {
          point = foot;
          square = true;
        }
      }
    }
    return { point, square };
  }

  pick(x, y) {
    const hit = this.intersect(x, y);
    if (!hit) {
      if (this.$('ifc-measure-result')) this.$('ifc-measure-result').textContent = 'Toque em uma superfície visível do modelo.';
      return;
    }
    if (this.hiding) {
      hit.object.visible = false;
      this.hidden.push(hit.object);
      this.sync();
      this.onChange();
      return;
    }
    if (this.leveling) {
      if (!this.state.levelEnds.length) {
        const origin = hit.point.clone();
        const tangent = new this.T.Vector3(1, 0, 0);
        if (Math.abs(this.faceNormal(hit).dot(tangent)) > 0.9) tangent.set(0, 0, 1);
        this.state.levelEnds = [
          origin.toArray(),
          origin.clone().addScaledVector(tangent, 0.8).toArray(),
          origin.clone().addScaledVector(tangent, -0.8).toArray(),
        ];
      } else {
        this.state.levelEnds[this.editing >= 10 ? this.editing - 10 : 1] = hit.point.toArray();
      }
      this.draw();
      return;
    }
    const from = this.state.points.length === 1 ? new this.T.Vector3().fromArray(this.state.points[0]) : null;
    const snapped = this.snapFeature(hit, from, x, y);
    if (this.state.points.length === 2) {
      this.state.points = [];
      this.state.square = false;
    }
    this.state.points.push(snapped.point.toArray());
    this.state.square = this.state.points.length === 2 && snapped.square;
    this.draw();
  }

  beginEndDrag(e) {
    const handle = e.target?.closest?.('[data-end]');
    if (!handle || !this.active) return;
    e.preventDefault();
    e.stopPropagation();
    this.editing = Number(handle.dataset.end);
    this.overlay.setPointerCapture(e.pointerId);
    this.controls.enabled = false;
  }

  moveEndDrag(e) {
    if (this.editing == null) return;
    e.preventDefault();
    const hit = this.intersect(e.clientX, e.clientY);
    if (!hit) return;
    if (this.editing >= 10) {
      this.state.levelEnds[this.editing - 10] = hit.point.toArray();
    } else {
      const other = this.state.points[this.editing ? 0 : 1];
      const from = other ? new this.T.Vector3().fromArray(other) : null;
      const snapped = this.snapFeature(hit, from, e.clientX, e.clientY);
      this.state.points[this.editing] = snapped.point.toArray();
      this.state.square = !!snapped.square;
    }
    this.draw();
  }

  endEndDrag(e) {
    if (this.editing == null) return;
    if (this.overlay.hasPointerCapture(e.pointerId)) this.overlay.releasePointerCapture(e.pointerId);
    this.editing = null;
    this.controls.enabled = true;
    this.draw();
  }

  restoreHidden() {
    for (const object of this.hidden) object.visible = true;
    this.hidden = [];
    this.hiding = false;
    this.sync();
    this.onChange();
  }

  draw() {
    if (!this.overlay || !this.$('ifc-measure-info')) return;
    this.drawCut();
    this.overlay.replaceChildren();
    const points = this.state?.points || [];
    const level = this.state?.levelEnds || [];
    this.$('ifc-measure-info').hidden = !this.active || (!this.measuring && !this.leveling && !points.length && !level.length);
    if (!this.active) return;
    const result = this.$('ifc-measure-result');
    if (this.leveling || level.length) {
      if (level.length === 3) {
        const a = new this.T.Vector3().fromArray(level[1]);
        const b = new this.T.Vector3().fromArray(level[2]);
        result.textContent = (Math.abs(a.y - b.y) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' cm · desnível';
      } else result.textContent = 'Toque numa face para o nível. Arraste as pontas.';
    } else {
      result.textContent = points.length === 2
        ? (new this.T.Vector3().fromArray(points[0]).distanceTo(new this.T.Vector3().fromArray(points[1])) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' cm · distância 3D' + (this.state?.square ? ' · esquadro' : '')
        : points.length ? 'Toque no segundo ponto. Perto da perpendicular trava o esquadro.' : 'Toque em dois pontos do modelo · resultado em cm.';
    }
    const r = this.renderer.domElement.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this.overlay.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    this.overlay.style.pointerEvents = 'none';
    const add = (tag, attrs) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      this.overlay.append(el);
      return el;
    };
    const screen = (p) => ({ x: (p.x + 1) * r.width / 2, y: (1 - p.y) * r.height / 2 });
    const drawPoints = (list, prefix, stroke) => {
      const projected = list.map((p) => new this.T.Vector3().fromArray(p).project(this.camera));
      if (projected.length >= 2 && projected.every((p) => p.z >= -1 && p.z <= 1)) {
        const a = screen(projected[prefix === 10 ? 1 : 0]);
        const b = screen(projected[prefix === 10 ? 2 : 1]);
        add('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
        if (this.state?.square && prefix === 0) {
          add('text', { x: (a.x + b.x) / 2 + 8, y: (a.y + b.y) / 2 - 8, fill: '#63f0e5', 'font-size': '16', 'font-weight': '700' }).textContent = '⊥';
        }
      }
      projected.forEach((p, i) => {
        if (prefix === 10 && i === 0) return;
        if (p.z < -1 || p.z > 1 || !this.isVisible(new this.T.Vector3().fromArray(list[i]))) return;
        const at = screen(p);
        const circle = add('circle', { cx: at.x, cy: at.y, r: 8, fill: stroke, stroke: '#173c2d', 'stroke-width': 2, 'data-end': String(prefix + i) });
        circle.style.pointerEvents = 'all';
        circle.style.cursor = 'grab';
      });
    };
    if (points.length) drawPoints(points, 0, '#ffe18b');
    if (level.length === 3) {
      const projected = level.map((p) => new this.T.Vector3().fromArray(p).project(this.camera));
      if (projected.every((p) => p.z >= -1 && p.z <= 1)) {
        const o = screen(projected[0]);
        const a = screen(projected[1]);
        const b = screen(projected[2]);
        add('line', { x1: o.x, y1: o.y, x2: a.x, y2: a.y, stroke: '#63f0e5', 'stroke-width': 2 });
        add('line', { x1: o.x, y1: o.y, x2: b.x, y2: b.y, stroke: '#63f0e5', 'stroke-width': 2 });
      }
      drawPoints(level, 10, '#63f0e5');
    }
  }
}

function navigationSafe(tools) {
  tools.navigation.armFocus(false);
}

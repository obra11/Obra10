export class IfcWalk {
  constructor(THREE, camera, controls, canvas, tools, navigation, onChange, root, onState) {
    Object.assign(this, { THREE, camera, controls, canvas, tools, navigation, onChange, onState });
    const scope = root || document;
    this.$ = (id) => (scope.querySelector ? scope.querySelector('#' + id) : null);
    this.ray = new THREE.Raycaster();
    this.walking = false;
    this.placing = false;
    this.through = false;
    this.eye = 1.6;
    this.speed = 2.4;
    this.runMul = 2.2;
    this.keys = {};
    this.pad = { x: 0, y: 0 };
    this.lookDrag = null;
    this.padDrag = null;
    this.yaw = 0;
    this.pitch = 0;
    this.last = 0;
    this.target = null;
    this.saved = null;
    this.bind();
  }

  group() {
    return this.tools?.group || this.navigation?.group || null;
  }

  bind() {
    const btn = this.$('ifc-walk');
    const exit = this.$('ifc-walk-exit');
    const through = this.$('ifc-walk-through');
    const pad = this.$('ifc-walk-pad');
    if (btn) btn.onclick = () => this.toggle();
    if (exit) exit.onclick = () => this.stop();
    if (through) {
      through.onclick = () => {
        this.through = !this.through;
        through.setAttribute('aria-pressed', String(this.through));
        through.textContent = this.through ? 'Atravessar ligado' : 'Atravessar';
        this.hint();
        this.onState?.({ active: this.walking, placing: this.placing, through: this.through });
      };
    }
    if (pad) {
      const start = (event) => {
        if (!this.walking || event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.padDrag = { id: event.pointerId };
        pad.setPointerCapture(event.pointerId);
        this.updatePad(event);
      };
      pad.addEventListener('pointerdown', start);
      pad.addEventListener('pointermove', (event) => {
        if (this.padDrag?.id === event.pointerId) this.updatePad(event);
      });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        pad.addEventListener(name, (event) => {
          if (this.padDrag?.id !== event.pointerId) return;
          this.padDrag = null;
          this.pad.x = 0;
          this.pad.y = 0;
          this.syncPad();
        });
      }
    }
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.walking && !this.placing) return;
      if (event.button > 0 || event.target.closest?.('button,select,input,#ifc-walk-pad,#ifc-tools')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.lookDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    }, true);
    this.canvas.addEventListener('pointermove', (event) => {
      if (this.lookDrag?.id !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const dx = event.clientX - this.lookDrag.x;
      const dy = event.clientY - this.lookDrag.y;
      if (Math.hypot(dx, dy) > 4) this.lookDrag.moved = true;
      if (this.walking) {
        this.yaw -= dx * 0.005;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy * 0.005));
        this.applyLook();
        this.lookDrag.x = event.clientX;
        this.lookDrag.y = event.clientY;
        this.onChange?.();
      }
    }, true);
    this.canvas.addEventListener('pointerup', (event) => {
      if (this.lookDrag?.id !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const drag = this.lookDrag;
      this.lookDrag = null;
      if (!drag.moved) this.tapFloor(event.clientX, event.clientY);
    }, true);
    window.addEventListener('keydown', (event) => {
      if (!this.walking) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.stop();
        return;
      }
      this.keys[event.code] = true;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
    });
    for (const id of ['ifc-pan', 'ifc-focus', 'ifc-cut', 'ifc-measure', 'ifc-measure-level', 'ifc-views', 'ifc-hide']) {
      this.$(id)?.addEventListener('click', () => {
        if (this.walking || this.placing) this.stop();
      });
    }
  }

  updatePad(event) {
    const pad = this.$('ifc-walk-pad');
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = (event.clientY - rect.top) / rect.height * 2 - 1;
    const len = Math.hypot(x, y);
    const scale = len > 1 ? 1 / len : 1;
    this.pad.x = x * scale;
    this.pad.y = -y * scale;
    this.syncPad();
  }

  syncPad() {
    const knob = this.$('ifc-walk-knob');
    if (!knob) return;
    knob.style.transform = `translate(${this.pad.x * 22}px, ${-this.pad.y * 22}px)`;
  }

  toggle() {
    if (this.walking || this.placing) this.stop();
    else this.begin();
  }

  begin() {
    const group = this.group();
    if (!group) return;
    this.tools?.activate?.(true);
    this.navigation?.armFocus?.(false);
    this.saved = {
      enabled: this.controls.enabled,
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      up: this.camera.up.clone(),
    };
    const box = new this.THREE.Box3().setFromObject(group);
    const inside = !box.isEmpty() && box.containsPoint(this.camera.position);
    if (inside) {
      this.enter(this.camera.position.clone());
    } else {
      this.placing = true;
      this.walking = false;
      this.controls.enabled = false;
      this.sync();
      this.hint();
    }
  }

  enter(from) {
    const group = this.group();
    if (!group) return;
    const origin = from.clone();
    const floor = this.groundAt(origin) ?? origin;
    this.camera.position.set(floor.x, floor.y + this.eye, floor.z);
    const dir = this.controls.target.clone().sub(this.camera.position);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = 0;
    this.applyLook();
    this.walking = true;
    this.placing = false;
    this.target = null;
    this.last = performance.now();
    this.controls.enabled = false;
    this.sync();
    this.hint();
    this.onChange?.();
  }

  stop() {
    const was = this.walking || this.placing;
    this.walking = false;
    this.placing = false;
    this.target = null;
    this.lookDrag = null;
    this.padDrag = null;
    this.pad.x = 0;
    this.pad.y = 0;
    this.keys = {};
    this.syncPad();
    if (this.saved) {
      this.controls.enabled = this.saved.enabled;
      if (!was) {
        this.camera.position.copy(this.saved.position);
        this.controls.target.copy(this.saved.target);
      } else {
        const look = new this.THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.controls.target.copy(this.camera.position).addScaledVector(look, 4);
      }
      this.camera.up.copy(this.saved.up);
      this.controls.update();
      this.saved = null;
    } else {
      this.controls.enabled = true;
    }
    this.sync();
    this.onChange?.();
  }

  applyLook() {
    const q = new this.THREE.Quaternion().setFromEuler(new this.THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
    this.camera.up.set(0, 1, 0);
    const look = new this.THREE.Vector3(0, 0, -1).applyQuaternion(q);
    this.controls.target.copy(this.camera.position).add(look);
  }

  tapFloor(x, y) {
    const hit = this.hit(x, y);
    if (!hit) {
      this.hint('Toque no piso para caminhar.');
      return;
    }
    if (this.placing && !this.walking) {
      this.enter(hit.point);
      return;
    }
    this.target = hit.point.clone();
  }

  hit(clientX, clientY) {
    const group = this.group();
    if (!group) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    group.updateMatrixWorld(true);
    this.ray.setFromCamera({
      x: (clientX - rect.left) / rect.width * 2 - 1,
      y: 1 - (clientY - rect.top) / rect.height * 2,
    }, this.camera);
    return this.ray.intersectObject(group, true).find((item) => !this.tools?.isVisible || this.tools.isVisible(item.point)) || null;
  }

  groundAt(point) {
    const group = this.group();
    if (!group) return null;
    group.updateMatrixWorld(true);
    const origin = point.clone();
    origin.y += 8;
    this.ray.set(origin, new this.THREE.Vector3(0, -1, 0));
    this.ray.far = 40;
    const hit = this.ray.intersectObject(group, true).find((item) => !this.tools?.isVisible || this.tools.isVisible(item.point));
    this.ray.far = Infinity;
    return hit ? hit.point : null;
  }

  blocked(from, direction, distance) {
    if (this.through) return false;
    const group = this.group();
    if (!group || direction.lengthSq() < 1e-8) return false;
    group.updateMatrixWorld(true);
    const dir = direction.clone().normalize();
    for (const lift of [0.35, 0.95, 1.45]) {
      const origin = from.clone();
      origin.y = from.y - this.eye + lift;
      this.ray.set(origin, dir);
      this.ray.far = distance + 0.28;
      const hit = this.ray.intersectObject(group, true)[0];
      this.ray.far = Infinity;
      if (hit && hit.distance < distance + 0.22) return true;
    }
    return false;
  }

  step() {
    if (!this.walking) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.keys.KeyQ) this.yaw += 1.4 * dt;
    if (this.keys.KeyE) this.yaw -= 1.4 * dt;
    this.applyLook();
    const forward = new this.THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-1);
    const right = new this.THREE.Vector3(forward.z, 0, -forward.x);
    let mx = this.pad.x;
    let my = this.pad.y;
    if (this.keys.KeyW || this.keys.ArrowUp) my += 1;
    if (this.keys.KeyS || this.keys.ArrowDown) my -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.target) {
      const to = this.target.clone().sub(this.camera.position);
      to.y = 0;
      const dist = to.length();
      if (dist < 0.18) this.target = null;
      else {
        to.normalize();
        my += 1;
        forward.copy(to);
        right.set(forward.z, 0, -forward.x);
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const run = this.keys.ShiftLeft || this.keys.ShiftRight;
    const step = this.speed * (run ? this.runMul : 1) * dt;
    const wish = forward.multiplyScalar(my).add(right.multiplyScalar(mx));
    if (wish.lengthSq() > 1e-8) {
      wish.normalize().multiplyScalar(step);
      const next = this.camera.position.clone();
      const lateral = new this.THREE.Vector3(wish.x, 0, 0);
      const depth = new this.THREE.Vector3(0, 0, wish.z);
      if (!this.blocked(next, lateral, Math.abs(wish.x))) next.add(lateral);
      if (!this.blocked(next, depth, Math.abs(wish.z))) next.add(depth);
      const floor = this.groundAt(next);
      if (floor) next.y = floor.y + this.eye;
      this.camera.position.copy(next);
      this.applyLook();
    }
    this.onChange?.();
  }

  sync() {
    const btn = this.$('ifc-walk');
    const pad = this.$('ifc-walk-pad');
    const info = this.$('ifc-walk-info');
    if (btn) btn.setAttribute('aria-pressed', String(this.walking || this.placing));
    if (pad) pad.hidden = !this.walking;
    if (info) info.hidden = !(this.walking || this.placing);
    this.onState?.({ active: this.walking, placing: this.placing, through: this.through });
  }

  hint(text) {
    const node = this.$('ifc-hint');
    if (!node) return;
    node.textContent = text || (this.placing
      ? 'Toque no piso para começar a caminhar.'
      : this.walking
        ? (this.through ? 'Atravessar ligado. Esc ou Sair volta à órbita.' : 'Arraste para olhar. O círculo anda. Esc ou Sair volta à órbita.')
        : 'Arraste para orbitar. Dois dedos aproximam e deslocam.');
  }
}

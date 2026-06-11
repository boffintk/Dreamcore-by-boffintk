// player.js — First-person player controller

class Player {
  constructor(canvas) {
    this.canvas = canvas;

    // Position & rotation
    this.x   = 0;
    this.y   = 1.7;  // eye height
    this.z   = 0;
    this.yaw   = 0;   // horizontal look (radians)
    this.pitch = 0;   // vertical look

    // Movement
    this.speed      = 0.05;
    this.sprintMult = 1.8;
    this.isSprinting = false;

    // Keys
    this.keys = {};

    // Joystick state (mobile)
    this.joystickDelta = { x: 0, y: 0 };

    // Mouse look state
    this.isPointerLocked = false;
    this.lastTouchX = null;
    this.lastTouchY = null;

    // Items collected
    this.itemsCollected = 0;
    this.totalItems = 3;

    this._bindKeyboard();
    this._bindPointerLock();
    this._bindJoystick();
    this._bindTouchCamera();
    this._bindMobileButtons();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'shift') this.isSprinting = true;
      if (e.key.toLowerCase() === 'e' && window.gameInstance)
        window.gameInstance.tryInteract();
    });
    document.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.key.toLowerCase() === 'shift') this.isSprinting = false;
    });
  }

  // ── Pointer lock (desktop mouse look) ────────────────────────────────────
  _bindPointerLock() {
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) this.canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', e => {
      if (!this.isPointerLocked) return;
      this.yaw   += e.movementX * 0.0018;
      this.pitch -= e.movementY * 0.0018;
      this.pitch  = Math.max(-1.3, Math.min(1.3, this.pitch));
    });
  }

  // ── Joystick (mobile) ─────────────────────────────────────────────────────
  _bindJoystick() {
    const base  = document.getElementById('joystick-base');
    const thumb = document.getElementById('joystick-thumb');
    if (!base) return;

    const R = 32; // max thumb travel radius
    let touching = false;
    let originX, originY;

    const onStart = e => {
      e.preventDefault();
      touching = true;
      const t = e.touches ? e.touches[0] : e;
      const rect = base.getBoundingClientRect();
      originX = rect.left + rect.width  / 2;
      originY = rect.top  + rect.height / 2;
    };
    const onMove = e => {
      if (!touching) return;
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      let dx = t.clientX - originX;
      let dy = t.clientY - originY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > R) { dx = dx/dist*R; dy = dy/dist*R; }
      thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joystickDelta.x = dx / R;
      this.joystickDelta.y = dy / R;
    };
    const onEnd = () => {
      touching = false;
      thumb.style.transform = 'translate(-50%, -50%)';
      this.joystickDelta.x = 0;
      this.joystickDelta.y = 0;
    };

    base.addEventListener('touchstart', onStart, { passive: false });
    base.addEventListener('touchmove',  onMove,  { passive: false });
    base.addEventListener('touchend',   onEnd);
    base.addEventListener('touchcancel',onEnd);
  }

  // ── Touch camera (right side of screen, not joystick area) ───────────────
  _bindTouchCamera() {
    this.canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (t.clientX < window.innerWidth / 2) return; // joystick side
      this.lastTouchX = t.clientX;
      this.lastTouchY = t.clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      // Find the right-side touch
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX < window.innerWidth / 2) continue;
        if (this.lastTouchX !== null) {
          const dx = t.clientX - this.lastTouchX;
          const dy = t.clientY - this.lastTouchY;
          this.yaw   += dx * 0.003;
          this.pitch -= dy * 0.003;
          this.pitch  = Math.max(-1.3, Math.min(1.3, this.pitch));
        }
        this.lastTouchX = t.clientX;
        this.lastTouchY = t.clientY;
        break;
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => {
      this.lastTouchX = null;
      this.lastTouchY = null;
    }, { passive: true });
  }

  // ── Mobile action buttons ─────────────────────────────────────────────────
  _bindMobileButtons() {
    const btnE = document.getElementById('btn-interact');
    const btnJ = document.getElementById('btn-jump');
    if (btnE) btnE.addEventListener('touchstart', e => {
      e.preventDefault();
      if (window.gameInstance) window.gameInstance.tryInteract();
    }, { passive: false });
    if (btnJ) btnJ.addEventListener('touchstart', e => {
      e.preventDefault();
      this.keys['jump'] = true;
    }, { passive: false });
    if (btnJ) btnJ.addEventListener('touchend', () => { this.keys['jump'] = false; });
  }

  // ── Update (called each frame) ────────────────────────────────────────────
  update(world) {
    const speed = this.speed * (this.isSprinting ? this.sprintMult : 1);

    // Movement from keyboard
    let moveX = 0, moveZ = 0;
    if (this.keys['w'] || this.keys['arrowup'])    moveZ -= 1;
    if (this.keys['s'] || this.keys['arrowdown'])  moveZ += 1;
    if (this.keys['a'] || this.keys['arrowleft'])  moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

    // Add joystick input
    moveX += this.joystickDelta.x;
    moveZ += this.joystickDelta.y;

    // Normalize diagonal
    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    if (len > 1) { moveX /= len; moveZ /= len; }

    // Apply yaw rotation to movement
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const nx = moveX * cos - moveZ * sin;
    const nz = moveX * sin + moveZ * cos;

    // Tentative new position
    const nx_ = this.x + nx * speed;
    const nz_ = this.z + nz * speed;

    // Simple world-bounds collision
    const bounds = world ? world.bounds : 48;
    this.x = Math.max(-bounds, Math.min(bounds, nx_));
    this.z = Math.max(-bounds, Math.min(bounds, nz_));

    // Keep on ground
    this.y = 1.7;

    // Update compass
    const deg = (this.yaw * 180 / Math.PI + 360) % 360;
    updateCompass(deg);
  }

  // ── Serialise for save ────────────────────────────────────────────────────
  toSave() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw,
             itemsCollected: this.itemsCollected };
  }
  fromSave(data) {
    if (!data) return;
    this.x = data.x ?? 0;
    this.y = data.y ?? 1.7;
    this.z = data.z ?? 0;
    this.yaw = data.yaw ?? 0;
    this.itemsCollected = data.itemsCollected ?? 0;
  }
}

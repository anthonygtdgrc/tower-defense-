// Keyboard/mouse input for AZERTY (ZQSD) controls + camera look + build hotkeys.
export class InputManager {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { dx: 0, dy: 0, x: 0, y: 0, leftDown: false, rightDown: false, wheel: 0, leftJustPressed: false, rightJustPressed: false };
    this.pointerLocked = false;
    this._lastTapTime = { KeyZ: 0, KeyQ: 0, KeyS: 0, KeyD: 0 };
    this.doubleTapDash = null;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    domElement.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    domElement.addEventListener('wheel', (e) => this._onWheel(e), { passive: true });
    domElement.addEventListener('click', () => {
      if (!this.pointerLocked && this.allowPointerLock) domElement.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === domElement;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    this.allowPointerLock = true;
  }

  _onKeyDown(e) {
    if (!this.keys.has(e.code)) this.justPressed.add(e.code);
    this.keys.add(e.code);
    if (['KeyZ', 'KeyQ', 'KeyS', 'KeyD'].includes(e.code)) {
      const now = performance.now();
      const last = this._lastTapTime[e.code] || 0;
      if (now - last < 300) {
        this.doubleTapDash = e.code;
      }
      this._lastTapTime[e.code] = now;
    }
  }
  _onKeyUp(e) { this.keys.delete(e.code); }
  _onMouseDown(e) {
    if (e.button === 0) { this.mouse.leftDown = true; this.mouse.leftJustPressed = true; }
    if (e.button === 2) { this.mouse.rightDown = true; this.mouse.rightJustPressed = true; }
  }
  _onMouseUp(e) {
    if (e.button === 0) this.mouse.leftDown = false;
    if (e.button === 2) this.mouse.rightDown = false;
  }
  _onMouseMove(e) {
    if (this.pointerLocked) {
      // Clamp per-event deltas: guards against OS-level cursor-warp spikes
      // (and huge synthetic jumps from automated input) causing a camera snap.
      const MAX_DELTA = 80;
      this.mouse.dx += Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementX || 0));
      this.mouse.dy += Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementY || 0));
    }
    const rect = this.dom.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  _onWheel(e) { this.mouse.wheel += e.deltaY; }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.justPressed.has(code); }

  consumeFrame() {
    this.justPressed.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this.mouse.leftJustPressed = false;
    this.mouse.rightJustPressed = false;
    this.doubleTapDash = null;
  }

  get moveVector() {
    let x = 0, z = 0;
    if (this.isDown('KeyZ')) z -= 1;
    if (this.isDown('KeyS')) z += 1;
    if (this.isDown('KeyQ')) x -= 1;
    if (this.isDown('KeyD')) x += 1;
    return { x, z };
  }
}

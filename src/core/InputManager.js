// Keyboard/mouse input for AZERTY (ZQSD) controls + camera look + build hotkeys.
//
// KeyboardEvent.code names a key by its PHYSICAL position, always using the
// US-QWERTY reference layout — it is not affected by the keyboard's actual
// layout. On real AZERTY hardware the key printed "Z" sits where QWERTY has
// "W", and the key printed "Q" sits where QWERTY has "A" (S and D are in the
// same spot on both layouts). So to react to the AZERTY-labelled Z/Q keys we
// must check codes 'KeyW'/'KeyA', not 'KeyZ'/'KeyQ' — checking the latter
// actually catches whatever is physically where W/A are on the *layout in
// use*, which on AZERTY is nothing a ZQSD player would press for movement.
const MOVE_CODES = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' };

export class InputManager {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.justPressed = new Set();
    this.keysChar = new Set();
    this.justPressedChar = new Set();
    this.mouse = { dx: 0, dy: 0, x: 0, y: 0, leftDown: false, rightDown: false, wheel: 0, leftJustPressed: false, rightJustPressed: false };
    this.pointerLocked = false;
    this._lastTapTime = {};
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
    // Letter-label tracking (event.key), separate from the physical-position
    // tracking above (event.code): used for bindings like the A/E/R/F
    // abilities, which should follow whatever the keycap actually reads
    // regardless of physical position — unlike ZQSD movement, these aren't
    // meant to be "the same finger position as an English layout".
    if (e.key && e.key.length === 1) {
      const char = e.key.toLowerCase();
      if (!this.keysChar.has(char)) this.justPressedChar.add(char);
      this.keysChar.add(char);
    }
    if (Object.values(MOVE_CODES).includes(e.code)) {
      const now = performance.now();
      const last = this._lastTapTime[e.code] || 0;
      if (now - last < 300) {
        this.doubleTapDash = e.code;
      }
      this._lastTapTime[e.code] = now;
    }
  }
  _onKeyUp(e) {
    this.keys.delete(e.code);
    if (e.key && e.key.length === 1) this.keysChar.delete(e.key.toLowerCase());
  }
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
  // Label-based: fires for whatever the keycap actually reads (e.g. 'a'),
  // independent of physical position/layout. Use for A/E/R/F-style bindings.
  wasPressedKey(char) { return this.justPressedChar.has(char.toLowerCase()); }

  consumeFrame() {
    this.justPressed.clear();
    this.justPressedChar.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this.mouse.leftJustPressed = false;
    this.mouse.rightJustPressed = false;
    this.doubleTapDash = null;
  }

  get moveVector() {
    let x = 0, z = 0;
    if (this.isDown(MOVE_CODES.forward)) z -= 1;
    if (this.isDown(MOVE_CODES.back)) z += 1;
    if (this.isDown(MOVE_CODES.left)) x -= 1;
    if (this.isDown(MOVE_CODES.right)) x += 1;
    return { x, z };
  }
}

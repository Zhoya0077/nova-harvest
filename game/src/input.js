// Keyboard and mouse state. Everything is polled, nothing is dispatched: the game loop asks
// "is left held?" and "was Enter pressed since the last frame?" and never sees a DOM event itself.

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const UP_KEYS = ['ArrowUp', 'KeyW'];
const DOWN_KEYS = ['ArrowDown', 'KeyS'];

/** Codes the page must not scroll or scroll-into-view on while the game has focus. */
const SWALLOW = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Space', 'Enter', 'KeyP', 'Escape', 'KeyM', 'KeyR',
  'Digit1', 'Digit2', 'Numpad1', 'Numpad2',
]);

/** True when a keyboard event came from a text field rather than the game. */
function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
}

/**
 * Attach the listeners and hand back a small state object.
 * `held` is live (a Set of KeyboardEvent.code), `pressed` holds the codes that went down since the
 * last `endFrame()`, and `pointer` tracks the mouse in the canvas' 1280x800 space.
 */
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();

  const pointer = {
    x: 640,
    y: 400,
    inside: false,
    down: false,
    moved: false,
    /** Seconds since the mouse last moved; the skimmer ignores a stale cursor. */
    idle: 99,
  };

  /** Map a client-space point into the canvas' internal pixels. */
  function toCanvas(event) {
    const box = canvas.getBoundingClientRect();
    const w = box.width || 1;
    const h = box.height || 1;
    return {
      x: ((event.clientX - box.left) / w) * canvas.width,
      y: ((event.clientY - box.top) / h) * canvas.height,
    };
  }

  function onKeyDown(event) {
    if (isTypingTarget(event.target)) return;
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerMove(event) {
    const at = toCanvas(event);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.inside = true;
    pointer.moved = true;
    pointer.idle = 0;
  }

  function onPointerDown(event) {
    const at = toCanvas(event);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.inside = true;
    pointer.down = true;
    pointer.idle = 0;
    pressed.add('Pointer');
    // A click on the canvas also hands keyboard focus back to the page.
    if (typeof canvas.focus === 'function') canvas.focus({ preventScroll: true });
  }

  function onPointerUp() {
    pointer.down = false;
  }

  function onPointerLeave() {
    pointer.inside = false;
    pointer.down = false;
  }

  /** Losing focus mid-stride must not leave a key stuck down. */
  function onBlur() {
    held.clear();
    pointer.down = false;
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const api = {
    held,
    pointer,

    /** Any of the named codes down right now. */
    isDown(...codes) {
      return codes.some((code) => held.has(code));
    },

    /** Any of the named codes went down since the last frame; consumes the edge. */
    consume(...codes) {
      for (const code of codes) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return true;
        }
      }
      return false;
    },

    /** -1, 0 or 1 from arrows / WASD, for the keyboard steering fallback. */
    axisX() {
      const left = api.isDown(...LEFT_KEYS) ? 1 : 0;
      const right = api.isDown(...RIGHT_KEYS) ? 1 : 0;
      return right - left;
    },

    axisY() {
      const up = api.isDown(...UP_KEYS) ? 1 : 0;
      const down = api.isDown(...DOWN_KEYS) ? 1 : 0;
      return down - up;
    },

    /** True while any steering key is held, so the mouse can yield to the keyboard. */
    steeringKeys() {
      return api.isDown(...LEFT_KEYS, ...RIGHT_KEYS, ...UP_KEYS, ...DOWN_KEYS);
    },

    /** Called once per rendered frame: ages the pointer, drops the pressed edges. */
    endFrame(dt) {
      pointer.moved = false;
      pointer.idle = Math.min(99, pointer.idle + dt);
      pressed.clear();
    },

    /** A pointer click or a named key: the usual "click or press Enter" test. */
    tapped(...codes) {
      return api.consume('Pointer', ...codes);
    },
  };

  return api;
}

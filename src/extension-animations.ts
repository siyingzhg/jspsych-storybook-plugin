import { JsPsych, JsPsychExtension, JsPsychExtensionInfo } from "jspsych";

import { version } from "../package.json";

type BuiltInAnimationType = "wiggle" | "loom" | "translate" | "fadeIn" | "fadeOut" | "bounce" | "shake";

/** [percent through the animation (0-100), value at that point] */
type Keyframe = [number, number];

/**
 * Per-property keyframe tables for a custom animation. Any `animations[]` entry whose
 * `type` isn't one of the 7 built-ins is treated as custom: the extension interpolates
 * each property given here, exactly like the built-ins do internally, so a custom
 * animation gets the same easing and works in both render modes for free.
 */
interface CustomKeyframes {
  rotate?: Keyframe[];
  scale?: Keyframe[];
  translateX?: Keyframe[];
  translateY?: Keyframe[];
  opacity?: Keyframe[];
}

interface AnimationSpec {
  image_id: string;
  type: BuiltInAnimationType | string;
  time_onset?: number;
  duration?: number;
  x?: number;
  y?: number;
  /** Per-property keyframe tables for a custom (non-built-in) animation type. */
  keyframes?: CustomKeyframes;
  /** For a custom animation: hold the final computed value once finished, instead of reverting to identity. */
  holds_final_state?: boolean;
}

interface AnimationsParams {
  animations?: AnimationSpec[];
  /**
   * 'dom': each image is its own element, found via a `data-image-id` attribute, and
   * this extension writes directly to its style.
   * 'canvas': there's no per-image element, so this extension only tracks the math.
   * The canvas's own draw loop must call `getImageTransform(image_id)` every frame
   * and apply the result itself.
   */
  render_mode?: "dom" | "canvas";
}

interface Transform {
  rotate: number;
  scale: number;
  translateX: number;
  translateY: number;
  opacity: number;
}

const IDENTITY: Transform = { rotate: 0, scale: 1, translateX: 0, translateY: 0, opacity: 1 };

const WIGGLE_ROTATE: Keyframe[] = [[0, 0], [15, -12], [30, 12], [45, -8], [60, 8], [75, -4], [90, 4], [100, 0]];
const LOOM_SCALE: Keyframe[] = [[0, 1], [50, 1.6], [100, 1]];
const BOUNCE_Y: Keyframe[] = [[0, 0], [25, -60], [50, 0], [65, -30], [80, 0], [90, -12], [100, 0]];
const SHAKE_X: Keyframe[] = [[0, 0], [15, -18], [30, 18], [45, -14], [60, 14], [75, -8], [88, 8], [100, 0]];
const FADE_IN: Keyframe[] = [[0, 0], [100, 1]];
const FADE_OUT: Keyframe[] = [[0, 1], [100, 0]];

/** Approximates CSS's `ease-in-out` timing function within a keyframe segment. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function interpolate(phasePct: number, frames: Keyframe[]): number {
  for (let i = 0; i < frames.length - 1; i++) {
    const [p0, v0] = frames[i];
    const [p1, v1] = frames[i + 1];
    if (phasePct >= p0 && phasePct <= p1) {
      const segmentT = p1 === p0 ? 0 : (phasePct - p0) / (p1 - p0);
      return v0 + (v1 - v0) * ease(segmentT);
    }
  }
  return frames[frames.length - 1][1];
}

function computeTransform(spec: AnimationSpec, phasePct: number): Partial<Transform> {
  switch (spec.type) {
    case "wiggle":
      return { rotate: interpolate(phasePct, WIGGLE_ROTATE) };
    case "loom":
      return { scale: interpolate(phasePct, LOOM_SCALE) };
    case "bounce":
      return { translateY: interpolate(phasePct, BOUNCE_Y) };
    case "shake":
      return { translateX: interpolate(phasePct, SHAKE_X) };
    case "fadeIn":
      return { opacity: interpolate(phasePct, FADE_IN) };
    case "fadeOut":
      return { opacity: interpolate(phasePct, FADE_OUT) };
    case "translate": {
      const x = spec.x ?? 0;
      const y = spec.y ?? 0;
      if (phasePct <= 50) {
        const t = ease(phasePct / 50);
        return { translateX: x * t, translateY: y * t };
      }
      const t = ease((phasePct - 50) / 50);
      return { translateX: x * (1 - t), translateY: y * (1 - t) };
    }
    default: {
      if (!spec.keyframes) return {};
      const result: Partial<Transform> = {};
      for (const key of ["rotate", "scale", "translateX", "translateY", "opacity"] as const) {
        const frames = spec.keyframes[key];
        if (frames) result[key] = interpolate(phasePct, frames);
      }
      return result;
    }
  }
}

/** Built-in animation types that hold their final value once finished, instead of reverting to identity. */
const HOLDS_FINAL_STATE: string[] = ["fadeIn", "fadeOut"];

function holdsFinalState(spec: AnimationSpec): boolean {
  if (HOLDS_FINAL_STATE.includes(spec.type)) return true;
  return spec.keyframes != null && spec.holds_final_state === true;
}

function transformToCssString(t: Transform): string {
  return `rotate(${t.rotate}deg) scale(${t.scale}) translate(${t.translateX}px, ${t.translateY}px)`;
}

interface ActiveAnimation {
  spec: AnimationSpec;
  startTime: number;
}

/**
 * **extension-animations**
 *
 * Drives the storybook plugin's `animations` parameter for either DOM-rendered images
 * (each image is its own element, located via `data-image-id`) or canvas-rendered
 * images (no per-image element exists, so whatever owns the canvas's draw loop must
 * pull the current transform via `getImageTransform(image_id)` and apply it itself).
 * The same keyframe math drives both, so the two render modes stay visually in sync.
 *
 * @author Aiden Brown
 */
class StorybookAnimationsExtension implements JsPsychExtension {
  static info: JsPsychExtensionInfo = {
    name: "storybook-animations",
    version: version,
    data: {},
  };

  private active: Map<string, ActiveAnimation> = new Map();
  private current: Map<string, Transform> = new Map();
  private rafId: number | null = null;
  private renderMode: "dom" | "canvas" = "dom";

  constructor(private jsPsych: JsPsych) {}

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  on_start(params: AnimationsParams = {}): void {
    this.stopLoop();
    this.active.clear();
    this.current.clear();
    this.renderMode = params.render_mode ?? "dom";
  }

  on_load(params: AnimationsParams = {}): void {
    for (const spec of params.animations ?? []) {
      const start = () => this.startAnimation(spec);
      if ((spec.time_onset ?? 0) > 0) {
        this.jsPsych.pluginAPI.setTimeout(start, spec.time_onset);
      } else {
        start();
      }
    }
  }

  on_finish(): Record<string, any> {
    this.stopLoop();
    this.active.clear();
    this.current.clear();
    return {};
  }

  /**
   * The current transform for an image, meant for canvas-mode draw loops to pull and
   * apply themselves each frame. Returns the identity transform if nothing is
   * animating (or has finished without holding) that image.
   */
  getImageTransform(image_id: string): Transform {
    return this.current.get(image_id) ?? IDENTITY;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private startAnimation(spec: AnimationSpec): void {
    if (this.prefersReducedMotion()) {
      // Skip the motion itself, but still land on whatever end state the animation
      // would have held (e.g. a fadeOut should still end up transparent).
      const finalTransform: Transform = { ...IDENTITY, ...computeTransform(spec, 100) };
      const resolved = holdsFinalState(spec) ? finalTransform : IDENTITY;
      this.current.set(spec.image_id, resolved);
      if (this.renderMode === "dom") {
        // Some plugins insert their image elements asynchronously (e.g. on a
        // timer, even with a 0ms delay) rather than synchronously during
        // rendering, so the element may not exist in the DOM yet at this exact
        // point. The regular (motion) path tolerates this naturally since it
        // only starts touching the DOM on the next animation frame; do the
        // same here instead of writing immediately.
        requestAnimationFrame(() => this.applyToDom(spec.image_id, resolved));
      }
      return;
    }

    this.active.set(spec.image_id, { spec, startTime: performance.now() });
    this.runLoop();
  }

  private runLoop(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      this.step();
      this.rafId = this.active.size > 0 ? requestAnimationFrame(tick) : null;
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private step(): void {
    for (const [image_id, entry] of this.active) {
      const duration = entry.spec.duration ?? 1000;
      const elapsed = performance.now() - entry.startTime;
      const phasePct = Math.min(elapsed / duration, 1) * 100;
      const transform: Transform = { ...IDENTITY, ...computeTransform(entry.spec, phasePct) };

      if (elapsed >= duration) {
        this.active.delete(image_id);
        this.current.set(image_id, holdsFinalState(entry.spec) ? transform : IDENTITY);
      } else {
        this.current.set(image_id, transform);
      }

      if (this.renderMode === "dom") {
        this.applyToDom(image_id, this.current.get(image_id)!);
      }
    }
  }

  private applyToDom(image_id: string, transform: Transform): void {
    const el = this.jsPsych
      .getDisplayElement()
      .querySelector<HTMLElement>(`[data-image-id="${image_id}"]`);
    if (!el) return;
    el.style.transform = transformToCssString(transform);
    el.style.opacity = String(transform.opacity);
  }
}

export default StorybookAnimationsExtension;

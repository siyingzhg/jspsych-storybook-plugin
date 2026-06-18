# plugin-storybook

## Overview

Animated storybook with audio

## Loading

*Enter instructions for loading the plugin package here.*

To use the image animations, also load the extension browser bundle
alongside the plugin:

```html
<script src="dist/index.browser.min.js"></script>
<script src="dist/extension-animations.browser.min.js"></script>
```

## Compatibility

`plugin-storybook` requires jsPsych v8.0.0 or later.

## Extensions

### `jspsych-extension-animations`

Animates any image in the trial's `images` array, identified by `image_id`,
in one of two render modes:

- **`'dom'`** (default) — each image is its own DOM element. The extension finds
  it via a `data-image-id` attribute (which the plugin sets automatically) and
  writes the animation directly to its style.
- **`'canvas'`** — for setups where images are painted onto a shared `<canvas>`
  instead of being individual elements. The extension can't reach into someone
  else's canvas, so it doesn't touch the DOM in this mode. Instead, whatever
  code owns the canvas's draw loop should call `getImageTransform(image_id)`
  every frame and apply the returned transform itself when drawing that image.
  Both modes are driven by the same animation math, so they stay visually in sync.

```js
const trial = {
  type: jsPsychStorybook,
  images: [...],
  extensions: [
    {
      type: jsPsychExtensionAnimations,
      params: {
        render_mode: 'dom', // or 'canvas'
        animations: [
          { image_id: 'bunny', type: 'wiggle', duration: 1000, time_onset: 500 },
        ],
      },
    },
  ],
};
```

| Animation param      | Type   | Default | Description |
| --------------------- | ------ | ------- | ----------- |
| `image_id`             | string | —       | Must match the `id` of an image in the trial's `images` array. |
| `type`                  | string | —       | One of the 7 built-ins (`wiggle`, `loom`, `translate`, `fadeIn`, `fadeOut`, `bounce`, `shake`), or any custom name paired with `keyframes`. |
| `time_onset`            | int    | `0`     | Milliseconds to wait before the animation starts. |
| `duration`              | int    | `1000`  | How long the animation runs, in milliseconds. |
| `x`, `y`                | int    | `0`     | Pixel offset for the `translate` animation only. |
| `keyframes`             | object | —       | Custom (non-built-in) animation definition. See below. |
| `holds_final_state`     | boolean| `false` | For a custom animation: hold the final computed value once finished, instead of reverting to identity. |

#### Custom animations

Any `type` that isn't one of the 7 built-ins is treated as custom: provide a
`keyframes` object with per-property tables in the same `[percent, value]`
format the built-ins use internally, and the extension interpolates them with
the same easing — in both render modes, for free.

```js
{
  image_id: 'bunny',
  type: 'pulse',          // any name you like
  duration: 800,
  keyframes: {
    scale: [[0, 1], [50, 1.5], [100, 1]],
  },
}
```

Available properties: `rotate` (degrees), `scale`, `translateX`/`translateY`
(pixels), `opacity`. Any property left out stays at its identity value
(`rotate: 0`, `scale: 1`, `translateX`/`translateY: 0`, `opacity: 1`) for that
animation. Set `holds_final_state: true` if the animation should stay at its
last computed value instead of reverting once it finishes (this is how the
built-in `fadeIn`/`fadeOut` behave).

For canvas mode, the per-frame transform returned by `getImageTransform(image_id)`
looks like:

```js
{ rotate: 0, scale: 1, translateX: 0, translateY: 0, opacity: 1 } // identity
```

Reach the extension instance from a canvas-rendering plugin via
`jsPsych.extensions['storybook-animations']`.

Respects the OS-level `prefers-reduced-motion: reduce` setting: animations
jump straight to their end state with no tween.

## Documentation

See [documentation](/plugin-storybook/README.md)

## Author / Citation

Khuyen Le, Urvi Suwal, Valeria Inojosa, Aiden Brown, Becky Gilbert, Siying Zhang

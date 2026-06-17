import { clickTarget, startTimeline } from "@jspsych/test-utils";

import jsPsychStorybook from "./index";
import jsPsychExtensionAnimations from "./extension-animations";

jest.useFakeTimers();

const baseTrial = {
  type: jsPsychStorybook,
  audio: [],
  highlight: [],
};

const withAnimations = (animations: any[], render_mode?: "dom" | "canvas") => ({
  ...baseTrial,
  images: [{ id: "bunny", src: "bunny.png" }],
  extensions: [
    {
      type: jsPsychExtensionAnimations,
      params: { animations, ...(render_mode ? { render_mode } : {}) },
    },
  ],
});

const run = (timeline: any[]) =>
  startTimeline(timeline, { extensions: [{ type: jsPsychExtensionAnimations }] });

describe("extension-animations (DOM mode)", () => {
  it("applies a transform to the matching element immediately when time_onset is 0", async () => {
    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "wiggle", duration: 500, time_onset: 0 }]),
    ]);

    jest.advanceTimersByTime(100);
    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.transform).not.toBe("");
    expect(img.style.transform).not.toContain("rotate(0deg)");
  });

  it("delays the animation until time_onset elapses", async () => {
    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "bounce", duration: 500, time_onset: 1000 }]),
    ]);

    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.transform).toBe("");

    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(100);
    expect(img.style.transform).toContain("translate(0px, -");
  });

  it("reverts to the identity transform once a revert-style animation finishes", async () => {
    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "shake", duration: 500, time_onset: 0 }]),
    ]);

    jest.advanceTimersByTime(600);
    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.transform).toBe("rotate(0deg) scale(1) translate(0px, 0px)");
    expect(img.style.opacity).toBe("1");
  });

  it("holds the final opacity once a fadeOut animation finishes", async () => {
    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "fadeOut", duration: 500, time_onset: 0 }]),
    ]);

    jest.advanceTimersByTime(600);
    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.opacity).toBe("0");
  });

  it("moves an element out and back for a translate animation", async () => {
    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "translate", x: 100, y: -50, duration: 800, time_onset: 0 }]),
    ]);

    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;

    jest.advanceTimersByTime(400);
    expect(img.style.transform).toContain("translate(100px, -50px)");

    jest.advanceTimersByTime(400);
    expect(img.style.transform).toBe("rotate(0deg) scale(1) translate(0px, 0px)");
  });
});

describe("extension-animations (canvas mode)", () => {
  it("does not touch the DOM, and exposes the transform via getImageTransform", async () => {
    const { displayElement, jsPsych } = await run([
      withAnimations([{ image_id: "bunny", type: "wiggle", duration: 500, time_onset: 0 }], "canvas"),
    ]);

    jest.advanceTimersByTime(100);

    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.transform).toBe("");

    const extension = jsPsych.extensions["storybook-animations"] as InstanceType<
      typeof jsPsychExtensionAnimations
    >;
    const transform = extension.getImageTransform("bunny");
    expect(transform.rotate).not.toBe(0);
  });

  it("returns the identity transform for an image with no active animation", async () => {
    const { jsPsych } = await run([withAnimations([], "canvas")]);

    const extension = jsPsych.extensions["storybook-animations"] as InstanceType<
      typeof jsPsychExtensionAnimations
    >;
    expect(extension.getImageTransform("bunny")).toEqual({
      rotate: 0,
      scale: 1,
      translateX: 0,
      translateY: 0,
      opacity: 1,
    });
  });

  it("lets a fresh animation override a previous animation's held final state", async () => {
    const { jsPsych } = await run([
      withAnimations(
        [
          { image_id: "bunny", type: "fadeOut", duration: 800, time_onset: 0 },
          { image_id: "bunny", type: "fadeIn", duration: 800, time_onset: 900 },
        ],
        "canvas"
      ),
    ]);

    const extension = jsPsych.extensions["storybook-animations"] as InstanceType<
      typeof jsPsychExtensionAnimations
    >;

    jest.advanceTimersByTime(850); // fadeOut finished at 800ms and is holding opacity 0
    expect(extension.getImageTransform("bunny").opacity).toBe(0);

    jest.advanceTimersByTime(900); // fadeIn started at 900ms, finished by 1700ms; we're now at 1750ms
    expect(extension.getImageTransform("bunny").opacity).toBe(1);
  });

  it("lets a later animation on the same image fully replace an earlier, still-running one", async () => {
    const { jsPsych } = await run([
      withAnimations(
        [
          { image_id: "bunny", type: "wiggle", duration: 1000, time_onset: 0 },
          { image_id: "bunny", type: "bounce", duration: 500, time_onset: 200 },
        ],
        "canvas"
      ),
    ]);

    const extension = jsPsych.extensions["storybook-animations"] as InstanceType<
      typeof jsPsychExtensionAnimations
    >;

    jest.advanceTimersByTime(100);
    let transform = extension.getImageTransform("bunny");
    expect(transform.rotate).not.toBe(0);
    expect(transform.translateY).toBe(0);

    jest.advanceTimersByTime(150); // 250ms elapsed: bounce has taken over from wiggle
    transform = extension.getImageTransform("bunny");
    expect(transform.rotate).toBe(0);
    expect(transform.translateY).not.toBe(0);
  });
});

describe("extension-animations across multiple trials", () => {
  it("resets animation state between trials, even if the prior trial's animation never finished", async () => {
    const { jsPsych, displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "wiggle", duration: 5000, time_onset: 0 }], "canvas"),
      withAnimations([], "canvas"),
    ]);

    const extension = jsPsych.extensions["storybook-animations"] as InstanceType<
      typeof jsPsychExtensionAnimations
    >;

    jest.advanceTimersByTime(200); // trial 1's wiggle is mid-flight, nowhere near its 5000ms duration
    expect(extension.getImageTransform("bunny").rotate).not.toBe(0);

    await clickTarget(displayElement.querySelector("button"));

    expect(extension.getImageTransform("bunny")).toEqual({
      rotate: 0,
      scale: 1,
      translateX: 0,
      translateY: 0,
      opacity: 1,
    });
  });
});

describe("extension-animations with prefers-reduced-motion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("jumps straight to the held end state for a fadeOut, with no tween", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "fadeOut", duration: 800, time_onset: 0 }]),
    ]);

    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.opacity).toBe("0");
  });

  it("reverts straight to identity for a non-holding animation type, with no tween", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { displayElement } = await run([
      withAnimations([{ image_id: "bunny", type: "wiggle", duration: 800, time_onset: 0 }]),
    ]);

    const img = displayElement.querySelector('[data-image-id="bunny"]') as HTMLElement;
    expect(img.style.transform).toBe("rotate(0deg) scale(1) translate(0px, 0px)");
  });
});

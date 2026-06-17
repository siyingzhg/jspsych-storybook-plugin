import { clickTarget, startTimeline } from "@jspsych/test-utils";

import jsPsychStorybook from "./index";

jest.useFakeTimers();

const baseTrial = {
  type: jsPsychStorybook,
  audio: [],
  highlight: [],
};

describe("renderImages", () => {
  it("renders an img element per entry, positioned from x_pos/y_pos/width/height", async () => {
    const { displayElement } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "bunny", src: "bunny.png", x_pos: 42, y_pos: 60, width: 16, height: 25 }],
        animations: [],
      },
    ]);

    const img = displayElement.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.src).toContain("bunny.png");
    expect(img.style.left).toBe("42%");
    expect(img.style.top).toBe("60%");
    expect(img.style.width).toBe("16%");
    expect(img.style.height).toBe("25%");
  });

  it("finishes the trial with the image's id as the response when a clickable image is clicked", async () => {
    const { displayElement, getData } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "cat", src: "cat.png", clickable: true }],
        animations: [],
      },
    ]);

    const img = displayElement.querySelector("img") as HTMLImageElement;
    await clickTarget(img);

    const data = getData().values();
    expect(data[0].response).toBe("cat");
  });
});

describe("applyAnimations", () => {
  it("applies the CSS animation immediately when time_onset is 0", async () => {
    const { displayElement } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "bunny", src: "bunny.png" }],
        animations: [{ image_id: "bunny", type: "wiggle", duration: 500, time_onset: 0 }],
      },
    ]);

    const img = displayElement.querySelector("img") as HTMLImageElement;
    expect(img.style.animation).toContain("storybook-wiggle");
    expect(img.style.animation).toContain("500ms");
  });

  it("delays the animation until time_onset elapses", async () => {
    const { displayElement } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "bunny", src: "bunny.png" }],
        animations: [{ image_id: "bunny", type: "bounce", duration: 500, time_onset: 1000 }],
      },
    ]);

    const img = displayElement.querySelector("img") as HTMLImageElement;
    expect(img.style.animation).toBe("");

    jest.advanceTimersByTime(1000);
    expect(img.style.animation).toContain("storybook-bounce");
  });

  it("resets the animation style once it finishes", async () => {
    const { displayElement } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "bunny", src: "bunny.png" }],
        animations: [{ image_id: "bunny", type: "shake", duration: 500, time_onset: 0 }],
      },
    ]);

    const img = displayElement.querySelector("img") as HTMLImageElement;
    expect(img.style.animation).toContain("storybook-shake");

    img.dispatchEvent(new Event("animationend"));
    expect(img.style.animation).toBe("");
  });

  it("moves an element to the given offset and back for a translate animation", async () => {
    const { displayElement } = await startTimeline([
      {
        ...baseTrial,
        images: [{ id: "bunny", src: "bunny.png" }],
        animations: [{ image_id: "bunny", type: "translate", x: 100, y: -50, duration: 800, time_onset: 0 }],
      },
    ]);

    const img = displayElement.querySelector("img") as HTMLImageElement;
    expect(img.style.transform).toBe("translate(100px, -50px)");

    jest.advanceTimersByTime(400);
    expect(img.style.transform).toBe("translate(0, 0)");
  });

  it("does nothing when an animation references an image_id with no matching image", async () => {
    await expect(
      startTimeline([
        {
          ...baseTrial,
          images: [{ id: "bunny", src: "bunny.png" }],
          animations: [{ image_id: "nonexistent", type: "wiggle", duration: 500, time_onset: 0 }],
        },
      ])
    ).resolves.toBeDefined();
  });
});

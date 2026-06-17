import { clickTarget, startTimeline } from "@jspsych/test-utils";

import jsPsychStorybook from "./index";
import jsPsychExtensionProgress from "./extension-progress";

jest.useFakeTimers();

const baseTrial = {
  type: jsPsychStorybook,
  images: [{ id: "bg", src: "img.png" }],
  audio: [],
  highlight: [],
};

describe("extension-progress", () => {
  it("renders one star per total_pages, with completed stars filled in", async () => {
    const { jsPsych } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [
            {
              type: jsPsychExtensionProgress,
              params: { show_progress_bar: true, total_pages: 5, pages_completed: 2 },
            },
          ],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const bar = jsPsych.getDisplayContainerElement().querySelector("#storybook-progress-bar");
    expect(bar).not.toBeNull();
    expect(bar.children.length).toBe(5);
  });

  it("shows the celebration banner only once all pages are completed", async () => {
    const { jsPsych } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [
            {
              type: jsPsychExtensionProgress,
              params: { show_progress_bar: true, total_pages: 3, pages_completed: 2 },
            },
          ],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const container = jsPsych.getDisplayContainerElement();
    expect(container.querySelector("#storybook-celebration-banner")).toBeNull();
  });

  it("renders nothing when show_progress_bar is not set", async () => {
    const { jsPsych } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [{ type: jsPsychExtensionProgress, params: {} }],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const container = jsPsych.getDisplayContainerElement();
    expect(container.querySelector("#storybook-progress-bar")).toBeNull();
  });
});

describe("extension-progress across multiple trials", () => {
  it("clears the previous trial's bar and banner before the next trial starts", async () => {
    const { jsPsych, displayElement } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [
            {
              type: jsPsychExtensionProgress,
              params: { show_progress_bar: true, total_pages: 2, pages_completed: 2 },
            },
          ],
        },
        {
          ...baseTrial,
          extensions: [{ type: jsPsychExtensionProgress, params: { show_progress_bar: false } }],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const container = jsPsych.getDisplayContainerElement();
    expect(container.querySelector("#storybook-celebration-banner")).not.toBeNull();

    await clickTarget(displayElement.querySelector("button"));

    expect(container.querySelector("#storybook-progress-bar")).toBeNull();
    expect(container.querySelector("#storybook-celebration-banner")).toBeNull();
  });

  it("does not stack a second progress bar on top of the first", async () => {
    const makeTrial = (pages_completed: number) => ({
      ...baseTrial,
      extensions: [
        {
          type: jsPsychExtensionProgress,
          params: { show_progress_bar: true, total_pages: 3, pages_completed },
        },
      ],
    });

    const { jsPsych, displayElement } = await startTimeline([makeTrial(1), makeTrial(2), makeTrial(3)], {
      extensions: [{ type: jsPsychExtensionProgress }],
    });

    const container = jsPsych.getDisplayContainerElement();
    await clickTarget(displayElement.querySelector("button"));
    await clickTarget(displayElement.querySelector("button"));

    expect(container.querySelectorAll("#storybook-progress-bar").length).toBe(1);
  });
});

describe("extension-progress with prefers-reduced-motion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders the celebration banner immediately visible, with no pop-in animation", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { jsPsych } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [
            {
              type: jsPsychExtensionProgress,
              params: { show_progress_bar: true, total_pages: 2, pages_completed: 2 },
            },
          ],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const banner = jsPsych.getDisplayContainerElement().querySelector(
      "#storybook-celebration-banner"
    ) as HTMLElement;
    expect(banner.style.opacity).toBe("1");
    expect(banner.style.animation).toBe("");
  });

  it("renders the newly completed star without the pop animation", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { jsPsych } = await startTimeline(
      [
        {
          ...baseTrial,
          extensions: [
            {
              type: jsPsychExtensionProgress,
              params: { show_progress_bar: true, total_pages: 3, pages_completed: 2 },
            },
          ],
        },
      ],
      { extensions: [{ type: jsPsychExtensionProgress }] }
    );

    const bar = jsPsych.getDisplayContainerElement().querySelector("#storybook-progress-bar");
    const newStar = bar.children[1] as HTMLElement;
    expect(newStar.style.animation).toBe("");
  });
});

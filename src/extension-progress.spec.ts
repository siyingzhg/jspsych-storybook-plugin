import { startTimeline } from "@jspsych/test-utils";

import jsPsychStorybook from "./index";
import jsPsychExtensionProgress from "./extension-progress";

jest.useFakeTimers();

const baseTrial = {
  type: jsPsychStorybook,
  images: [{ id: "bg", src: "img.png" }],
  audio: [],
  highlight: [],
  animations: [],
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

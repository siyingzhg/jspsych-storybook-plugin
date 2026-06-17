import { JsPsych, JsPsychExtension, JsPsychExtensionInfo } from "jspsych";

import { version } from "../package.json";

declare global {
  interface Window { confetti: any; }
}

interface ProgressParams {
  show_progress_bar?: boolean;
  total_pages?: number;
  pages_completed?: number;
  celebration_sound?: string | null;
}

/**
 * **extension-progress**
 *
 * Star progress bar, confetti, and final-page celebration banner for plugin-storybook.
 * Renders into the display container element (not the trial's display element), since
 * it must survive plugins that clear/replace display_element content during the trial.
 *
 * @author Aiden Brown
 */
class StorybookProgressExtension implements JsPsychExtension {
  static info: JsPsychExtensionInfo = {
    name: "storybook-progress",
    version: version,
    data: {},
  };

  constructor(private jsPsych: JsPsych) {}

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  on_start(params: ProgressParams = {}): void {
    const {
      show_progress_bar = false,
      total_pages = 1,
      pages_completed = 0,
      celebration_sound = null,
    } = params;

    const container = this.jsPsych.getDisplayContainerElement();
    container.querySelector('#storybook-progress-bar')?.remove();
    container.querySelector('#storybook-celebration-banner')?.remove();

    if (show_progress_bar) {
      this.renderProgressBar(container, total_pages, pages_completed, celebration_sound);
    }
  }

  on_load(): void {}

  on_finish(): Record<string, any> {
    const container = this.jsPsych.getDisplayContainerElement();
    container.querySelector('#storybook-progress-bar')?.remove();
    container.querySelector('#storybook-celebration-banner')?.remove();
    return {};
  }

  private renderProgressBar(
    container: HTMLElement,
    totalPages: number,
    pagesCompleted: number,
    celebrationSound: string | null
  ): void {
    if (!document.getElementById('storybook-star-keyframes')) {
      const style = document.createElement('style');
      style.id = 'storybook-star-keyframes';
      style.textContent = `
        @keyframes storybook-star-pop {
          0%   { transform: scale(0.2); }
          60%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes storybook-celebrate {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.5); }
          70%  { transform: translateX(-50%) scale(1.08); }
          100% { opacity: 1; transform: translateX(-50%) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    const bar = document.createElement('div');
    bar.id = 'storybook-progress-bar';
    bar.style.cssText = `
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 14px; z-index: 100;
    `;

    for (let i = 0; i < totalPages; i++) {
      const star = document.createElement('span');
      star.textContent = '★';
      const isNew = i === pagesCompleted - 1;
      star.style.cssText = `
        font-size: 38px; line-height: 1; display: inline-block;
        color: ${i < pagesCompleted ? '#FFD700' : 'transparent'};
        -webkit-text-stroke: 2.5px #FFD700;
        ${isNew ? 'animation: storybook-star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;' : ''}
      `;
      bar.appendChild(star);
    }

    container.appendChild(bar);

    if (pagesCompleted >= totalPages) {
      const banner = document.createElement('div');
      banner.id = 'storybook-celebration-banner';
      banner.textContent = '⭐  Great job!  ⭐';
      banner.style.cssText = `
        position: absolute; top: 68px; left: 50%; white-space: nowrap;
        font-size: 26px; font-family: Georgia, serif; font-weight: bold;
        color: #FFD700; z-index: 100; opacity: 0;
        animation: storybook-celebrate 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
      `;
      container.appendChild(banner);

      if (celebrationSound) {
        const audio = new Audio(celebrationSound);
        audio.play().catch(() => {});
      }
    }

    if (typeof window.confetti !== 'function') return;

    if (pagesCompleted >= totalPages) {
      const deadline = Date.now() + 2500;
      const fire = () => {
        if (Date.now() > deadline) return;
        window.confetti({ particleCount: 55, angle:  60, spread: 60, origin: { x: 0 } });
        window.confetti({ particleCount: 55, angle: 120, spread: 60, origin: { x: 1 } });
        requestAnimationFrame(fire);
      };
      setTimeout(fire, 400);
    } else if (pagesCompleted > 0) {
      window.confetti({ particleCount: 70, spread: 55, startVelocity: 35, origin: { x: 0.5, y: 0.2 } });
    }
  }
}

export default StorybookProgressExtension;

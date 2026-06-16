export function updateInteractability(plugin, pixiobj, obj, state?) {
  const makeInteractive = (active: boolean) => {
    if (active) {
      if (obj.onClick && (obj.clickable ?? true)) {
        pixiobj.eventMode = 'dynamic';
        pixiobj.cursor = 'pointer';
        pixiobj.on('pointerdown', () => obj.onClick(plugin, obj));
      }
    } else {
      pixiobj.eventMode = 'none';
    }
  };

  if (state === true || state === false) {
    makeInteractive(state);
  } else {
    makeInteractive(pixiobj.alpha === 1);
  }
}

export function loom(plugin, obj, duration: number, maxSize: number, nTimes: number): Promise<void> {
  return new Promise((resolve) => {
    let timeElapsed = 0;
    const originalScale = obj.scale.x;
    const onTicker = (ticker) => {
      timeElapsed += ticker.deltaMS;
      const phase = timeElapsed / duration;
      const loopingPhase = 1 - ((Math.cos(phase * Math.PI * 2 * nTimes) + 1) / 2);
      obj.scale = originalScale + loopingPhase * (maxSize - 1) * originalScale;
      if (timeElapsed >= duration) {
        obj.scale = originalScale;
        plugin.app.ticker.remove(onTicker);
        resolve();
      }
    };
    plugin.app.ticker.add(onTicker);
  });
}

export function translate(plugin, obj, x: number, y: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    let timeElapsed = 0;
    const origX = obj.x;
    const origY = obj.y;
    if (duration === 0) {
      obj.x = x;
      obj.y = y;
      resolve();
      return;
    }
    const onTicker = (ticker) => {
      timeElapsed += ticker.deltaMS;
      if (timeElapsed >= duration) {
        plugin.app.ticker.remove(onTicker);
        obj.x = x;
        obj.y = y;
        resolve();
        return;
      }
      const phase = timeElapsed / duration;
      obj.x = origX * (1 - phase) + phase * x;
      obj.y = origY * (1 - phase) + phase * y;
    };
    plugin.app.ticker.add(onTicker);
  });
}

export function wiggle(plugin, obj, durationPerWiggle: number, wiggleAmount: number, nTimes: number): Promise<void> {
  return new Promise((resolve) => {
    let timeElapsed = 0;
    const defaultRotation = obj.rotation;
    const onTicker = (ticker) => {
      timeElapsed += ticker.deltaMS;
      const nWiggles = timeElapsed / durationPerWiggle;
      if (nWiggles >= nTimes) {
        plugin.app.ticker.remove(onTicker);
        obj.rotation = defaultRotation;
        resolve();
        return;
      }
      const singleCyclePhase = (timeElapsed % durationPerWiggle) / durationPerWiggle;
      if (singleCyclePhase < 0.25) {
        obj.rotation = defaultRotation + (singleCyclePhase / 0.25) * wiggleAmount;
      } else if (singleCyclePhase < 0.5) {
        obj.rotation = defaultRotation + (1 - (singleCyclePhase - 0.25) / 0.25) * wiggleAmount;
      } else if (singleCyclePhase < 0.75) {
        obj.rotation = defaultRotation - ((singleCyclePhase - 0.5) / 0.25) * wiggleAmount;
      } else {
        obj.rotation = defaultRotation - (1 - (singleCyclePhase - 0.75) / 0.25) * wiggleAmount;
      }
    };
    plugin.app.ticker.add(onTicker);
  });
}

export function fadeIn(plugin, pixiobject, obj, duration: number): Promise<void> {
  const onComplete = () => {
    pixiobject.alpha = 1;
    updateInteractability(plugin, pixiobject, obj);
  };
  if (duration === 0) {
    onComplete();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timeElapsed = 0;
    const onTicker = (ticker) => {
      timeElapsed += ticker.deltaMS;
      pixiobject.alpha = Math.min(timeElapsed / duration, 1);
      if (timeElapsed >= duration) {
        plugin.app.ticker.remove(onTicker);
        onComplete();
        resolve();
      }
    };
    plugin.app.ticker.add(onTicker);
  });
}

export function fadeOut(plugin, pixiobject, obj, duration: number): Promise<void> {
  updateInteractability(plugin, pixiobject, obj, false);
  const onComplete = () => { pixiobject.alpha = 0; };
  if (duration === 0) {
    onComplete();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timeElapsed = 0;
    const onTicker = (ticker) => {
      timeElapsed += ticker.deltaMS;
      pixiobject.alpha = Math.max(1 - timeElapsed / duration, 0);
      if (timeElapsed >= duration) {
        plugin.app.ticker.remove(onTicker);
        onComplete();
        resolve();
      }
    };
    plugin.app.ticker.add(onTicker);
  });
}

export function disappear(plugin, pixiobject, obj): Promise<void> {
  return fadeOut(plugin, pixiobject, obj, 0);
}

export function appear(plugin, pixiobject, obj): Promise<void> {
  return fadeIn(plugin, pixiobject, obj, 0);
}

export function changeClickability(plugin, pixiobj, obj, state: boolean): Promise<void> {
  obj.clickable = state;
  updateInteractability(plugin, pixiobj, obj);
  return Promise.resolve();
}

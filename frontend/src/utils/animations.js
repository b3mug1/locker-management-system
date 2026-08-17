import { animate, createTimeline, stagger } from 'animejs';

/**
 * Animate elements with staggered fade and slide up
 */
export function animateStagger(targets, options = {}) {
  if (!targets) return;
  const {
    translateY = [24, 0],
    opacity = [0, 1],
    scale = [0.96, 1],
    delay = 60,
    duration = 600,
    ease = 'outCubic',
    onComplete = null,
  } = options;

  try {
    return animate(targets, {
      translateY,
      opacity,
      scale,
      delay: stagger(delay),
      duration,
      ease,
      onComplete,
    });
  } catch (err) {
    console.debug('Animation stagger fallback', err);
  }
}

/**
 * Animate numeric counter
 */
export function animateCounter(targetElement, endValue, options = {}) {
  if (!targetElement) return;
  const {
    startValue = 0,
    duration = 1000,
    ease = 'outExpo',
    formatter = (val) => Math.round(val).toLocaleString(),
  } = options;

  const counterObj = { value: startValue };

  try {
    return animate(counterObj, {
      value: endValue,
      round: 1,
      duration,
      ease,
      onUpdate: () => {
        if (targetElement) {
          targetElement.textContent = formatter(counterObj.value);
        }
      },
    });
  } catch (err) {
    if (targetElement) targetElement.textContent = formatter(endValue);
  }
}

/**
 * Animate modal opening with smooth spring scale
 */
export function animateModalOpen(modalElement, backdropElement) {
  if (!modalElement) return;

  try {
    const tl = createTimeline({
      ease: 'outCubic',
    });

    if (backdropElement) {
      tl.add(backdropElement, {
        opacity: [0, 1],
        duration: 250,
      }, 0);
    }

    tl.add(modalElement, {
      scale: [0.88, 1],
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 350,
      ease: 'outBack',
    }, 50);

    return tl;
  } catch (err) {
    console.debug('Modal animation fallback', err);
  }
}

/**
 * Animate button click micro-interaction (scale punch)
 */
export function animateButtonPunch(target) {
  if (!target) return;
  try {
    return animate(target, {
      scale: [1, 0.94, 1],
      duration: 240,
      ease: 'inOutQuad',
    });
  } catch (err) {
    console.debug('Button punch fallback', err);
  }
}

/**
 * Animate grid items (e.g. lockers or cards) with wave from center
 */
export function animateGridWave(targets, options = {}) {
  if (!targets) return;
  const {
    duration = 500,
    scale = [0.8, 1],
    opacity = [0, 1],
    ease = 'outCubic',
  } = options;

  try {
    return animate(targets, {
      scale,
      opacity,
      delay: stagger(25, { from: 'center' }),
      duration,
      ease,
    });
  } catch (err) {
    console.debug('Grid wave fallback', err);
  }
}

/**
 * Pulse indicator or badge
 */
export function animatePulse(target) {
  if (!target) return;
  try {
    return animate(target, {
      scale: [1, 1.08, 1],
      duration: 1200,
      loop: true,
      ease: 'inOutSine',
    });
  } catch (err) {
    console.debug('Pulse fallback', err);
  }
}

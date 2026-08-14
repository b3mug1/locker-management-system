export function animateThemeSwitch() {
  const root = document.documentElement;
  root.classList.remove('theme-switching');
  // Restart the animation when users toggle quickly.
  window.requestAnimationFrame(() => {
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 720);
  });
}

// On phones and tablets the game feels like an app: a pinch or a double tap doesn't zoom the
// page. Three layers, because browsers differ: the viewport tag (user-scalable=no, which Android
// browsers follow, and maximum-scale=1, which also stops iPhones zooming into a text field);
// touch-action in app.css (scrolling only, no pinch or double-tap zoom); and, for Safari on the
// iPhone and iPad, which ignores the viewport tag, cancelling its pinch gestures here. Only on
// touch screens: on a computer, browser zoom (Ctrl or Command with +, a trackpad pinch) still
// works. Anyone who needs larger text has Settings → Text size.
export function stopGestureZoom() {
  if (typeof window === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  // Safari's own pinch events.
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  // A move with two fingers down is a pinch: the page doesn't scroll with two fingers on a phone.
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) stop(e); }, { passive: false });
}

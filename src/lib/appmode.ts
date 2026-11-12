// The installed app (a home-screen web app), and the touches that make it feel like one.
//
// - The status bar matches the page. index.html sets light and dark colors by the device's
//   setting; when the player picks a theme in Settings, this follows it.
// - Reopening the app, a home-screen shortcut, or a reminder brings back the open window
//   (the manifest's launch_handler) and goes to the page asked for, without a reload.

const PAPER = { light: '#f2f4ef', dark: '#0b100e' };

/** Point the status bar at the theme in use: 'system' gives back the device's light or dark. */
export function syncThemeColor(theme: 'system' | 'light' | 'dark') {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((m) => {
    const dark = (m.getAttribute('media') ?? '').includes('dark');
    m.content = theme === 'system' ? (dark ? PAPER.dark : PAPER.light) : PAPER[theme];
  });
}

type LaunchParams = { targetURL?: string };
/** A launch into the open window: go to its page (a shortcut's #daily, a reminder's ?daily). */
export function handleLaunches() {
  const q = (window as unknown as { launchQueue?: { setConsumer: (f: (p: LaunchParams) => void) => void } }).launchQueue;
  if (!q) return;
  q.setConsumer((p) => {
    if (!p.targetURL) return;
    const u = new URL(p.targetURL);
    if (u.search) { window.location.href = u.href; return; } // ?daily and shared links are read at load
    if (u.hash && u.hash !== window.location.hash) window.location.hash = u.hash;
  });
}

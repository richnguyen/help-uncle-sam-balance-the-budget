import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { takeLinkFromSearch } from './game/challenge';
import { resumeInstalledApp } from './game/resume';
import { syncReminders } from './game/reminders';
import { stopGestureZoom } from './lib/nozoom';
import './styles/app.css';

// A shared link (?p=… for a friend's plan, ?daily for the daily puzzle) becomes a page route.
takeLinkFromSearch();

// Phones and tablets: no pinch or double-tap zoom, so the game feels like an app.
stopGestureZoom();

// Opened from the home screen with no page asked for: back to the level the player was in.
resumeInstalledApp();

// The public site works offline and reopens fast (public/sw.js). Not in the claude.ai artifact,
// and not on the dev server.
if (__OFFLINE__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); syncReminders(); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

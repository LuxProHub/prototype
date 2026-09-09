import { useCallback, useEffect, useState } from 'react';

/**
 * Tab state backed by the URL fragment.
 *
 * The workspace used to hold the active tab in component state, so the browser
 * Back button left the app entirely, a refresh always dropped you on Overview
 * regardless of what you were doing, and there was no way to send a colleague
 * a link to a view. For a tool people keep open all day that is a daily tax.
 *
 * The fragment is used rather than a path because `vercel.json` serves the
 * build from the filesystem with no SPA fallback -- `/records` would 404 in
 * production. A fragment never reaches the server, so deep links work in dev
 * and production without touching deploy configuration.
 *
 * Assigning `location.hash` pushes a history entry on its own, which is what
 * makes Back and Forward move between views for free.
 */
function readHash(valid, fallback) {
  const id = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return valid.includes(id) ? id : fallback;
}

export function useHashRoute(valid, fallback) {
  const [tab, setTab] = useState(() => readHash(valid, fallback));

  // Canonicalise the address bar on first paint. replaceState rather than an
  // assignment, so landing on the app does not leave an empty entry behind
  // that Back would step into.
  useEffect(() => {
    if (readHash(valid, null) === null) {
      window.history.replaceState(null, '', `#/${tab}`);
    }
    // Intentionally first-paint only: later changes go through navigate().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHashChange = () => setTab(readHash(valid, fallback));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [valid, fallback]);

  const navigate = useCallback((id) => {
    if (readHash(valid, fallback) === id) {
      setTab(id); // already the current URL; just make sure state agrees
      return;
    }
    window.location.hash = `#/${id}`;
  }, [valid, fallback]);

  return [tab, navigate];
}

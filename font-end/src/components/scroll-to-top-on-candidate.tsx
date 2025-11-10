import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Ensures the window scrolls to top whenever navigating to a Candidate Profile route.
 */
export function ScrollToTopOnCandidate() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/candidate/')) {
      // Prefer scrolling the app's main scroll container if present
      const root = document.getElementById('app-scroll-root');
      if (root) {
        root.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        try {
          window.scrollTo({ top: 0, behavior: 'auto' });
        } catch {
          window.scrollTo(0, 0);
        }
      }
    }
  }, [location.pathname]);

  return null;
}

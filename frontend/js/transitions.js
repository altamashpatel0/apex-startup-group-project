/* ══════════════════════════════════════════════════════
   PAGE TRANSITIONS  — transitions.js
   Place this <script> at the END of <body> on every
   page, AFTER your existing scripts.

   How it works
   ────────────
   1. On DOMContentLoaded the body gets .pt-ready which
      plays the CSS enter animation (fade + slide up).
   2. When any qualifying link is clicked, .pt-leaving is
      added to play the exit animation (fade + slide up).
      Navigation fires after the animation finishes (or
      after a safety timeout), preventing hard flickers.
   3. Qualifying links: same-origin <a> tags that would
      cause a real navigation (not # anchors, not
      target="_blank", not already active page, not
      javascript: hrefs, not download links).
══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Timings (ms) — keep in sync with CSS ── */
  const ENTER_DURATION  = 450;   // matches pt-enter animation
  const EXIT_DURATION   = 280;   // matches pt-exit animation
  const SAFETY_TIMEOUT  = 350;   // max wait before forcing navigation

  /* ── 1. INIT: hide body instantly, then start enter ─ */
  document.body.classList.add('pt-init');

  function startEnter() {
    document.body.classList.remove('pt-init', 'pt-leaving');
    // Reflow so the browser registers the class removal
    void document.body.offsetHeight;
    document.body.classList.add('pt-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEnter);
  } else {
    // DOMContentLoaded already fired (e.g. script is deferred)
    startEnter();
  }

  /* ── 2. EXIT: intercept link clicks ─────────────── */

  /**
   * Is this link one we should animate before following?
   * Skips: external, _blank, #anchors, javascript:, download,
   *        data: URIs, and links to the very same page.
   */
  function shouldAnimate(anchor) {
    const href = anchor.getAttribute('href') || '';

    // Skip non-navigations
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('data:')) return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.target === '_blank' || anchor.target === '_top') return false;

    // Skip cross-origin links
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return false;
      // Skip if destination is the current page (same file)
      if (url.pathname === location.pathname && !url.search && !url.hash) return false;
    } catch (e) {
      return false;
    }

    return true;
  }

  document.addEventListener('click', function (e) {
    // Walk up the DOM in case the click target is a child of <a>
    const anchor = e.target.closest('a');
    if (!anchor) return;
    if (!shouldAnimate(anchor)) return;

    // Don't double-intercept
    if (document.body.classList.contains('pt-leaving')) return;

    e.preventDefault();
    const dest = anchor.href;

    // Play exit animation
    document.body.classList.remove('pt-ready');
    void document.body.offsetHeight; // reflow
    document.body.classList.add('pt-leaving');

    // Navigate after animation completes (or safety timeout)
    let navigated = false;
    function navigate() {
      if (navigated) return;
      navigated = true;
      window.location.href = dest;
    }

    // Listen for animation end
    document.body.addEventListener('animationend', navigate, { once: true });
    // Safety fallback in case animationend doesn't fire
    setTimeout(navigate, SAFETY_TIMEOUT);
  }, false);

  /* ── 3. Handle browser back/forward ─────────────── */
  // When the user hits Back/Forward the page is often restored
  // from bfcache with the leaving state still applied.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      // Page came from bfcache — re-run enter animation
      document.body.classList.remove('pt-leaving', 'pt-init');
      void document.body.offsetHeight;
      document.body.classList.add('pt-ready');
    }
  });

})();

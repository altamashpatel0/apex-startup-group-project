/* ══════════════════════════════════════════════════════
   APEX FRONTEND — API Helper (apex-api.js)
   Reusable fetch wrapper for all public-facing pages
══════════════════════════════════════════════════════ */

const APEX = (() => {
  /* ── CONFIG ─────────────────────────────────────── */
  // Always use localhost:5000 — the server binds to PORT 5000 and CORS
  // allows both localhost and 127.0.0.1 origins. Using an absolute URL
  // avoids same-origin confusion when the frontend is opened from the
  // file system or a different host.
  const BASE = 'http://localhost:5000/api';
  const IMG  = 'http://localhost:5000';

  /* ── FETCH WRAPPER ──────────────────────────────── */
  async function req(method, endpoint, body = null, isForm = false) {
    const headers = {};
    if (!isForm && body) headers['Content-Type'] = 'application/json';
    const opts = {
      method,
      headers,
      mode: 'cors',          // explicit: allow cross-origin requests
      credentials: 'omit',   // no cookies needed for public endpoints
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    try {
      const res  = await fetch(`${BASE}${endpoint}`, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error('[APEX API]', err);
      return { ok: false, status: 0, data: { message: 'Network error. Please check your connection.' } };
    }
  }

  const api = {
    get:      (ep)           => req('GET',    ep),
    post:     (ep, b)        => req('POST',   ep, b),
    postForm: (ep, fd)       => req('POST',   ep, fd, true),
  };

  /* ── IMAGE URL RESOLVER ─────────────────────────── */
  function imgUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${IMG}/${path.replace(/^\/+/, '')}`;
  }

  /* ── DATE FORMATTERS ────────────────────────────── */
  function fmtDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime(str) {
    if (!str) return '';
    return new Date(str).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDateTime(str) {
    if (!str) return '';
    return new Date(str).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function truncate(str = '', n = 120) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  /* ── TOAST SYSTEM ───────────────────────────────── */
  function showToast(msg, isErr = false) {
    // Works with register.html's simple #toast OR any existing toast div
    const t = document.getElementById('toast');
    if (!t) return;
    // register.html style
    if (t.classList.contains !== undefined && !t.closest('.toast-container')) {
      t.textContent = msg;
      t.style.background = isErr ? '#EF4444' : '#111827';
      t.classList.add('show');
      clearTimeout(t._tid);
      t._tid = setTimeout(() => t.classList.remove('show'), isErr ? 5000 : 3500);
    }
  }

  /* ── LOADING SKELETON ───────────────────────────── */
  function loadingSkeleton(count = 3, cls = 'skeleton-card') {
    return Array.from({ length: count }, () =>
      `<div class="${cls} skeleton-anim"></div>`
    ).join('');
  }

  /* ── VALIDATE REGISTRATION FORM ─────────────────── */
  function validateField(id, test, errId) {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId || `${id}-error`);
    if (!el) return true;
    const ok = test(el.value.trim());
    el.classList.toggle('error', !ok);
    if (err) err.style.display = ok ? 'none' : 'flex';
    return ok;
  }

  /* ── EVENT STATUS CALCULATOR ────────────────────── */
  function eventStatus(event) {
    const now   = new Date();
    const start = new Date(event.date || event.startDate);
    const end   = event.endDate ? new Date(event.endDate) : null;
    if (end && now > end)        return 'past';
    if (now >= start)            return 'ongoing';
    return 'upcoming';
  }

  return { api, imgUrl, fmtDate, fmtTime, fmtDateTime, truncate, showToast, loadingSkeleton, validateField, eventStatus };
})();

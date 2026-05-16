/* ══════════════════════════════════════════════════════
   EVENTS PAGE — Dynamic Loader  (fixed)
   Uses APEX helper from apex-api.js
══════════════════════════════════════════════════════ */
(function () {
  const grid      = document.getElementById('eventsGrid');
  const emptyBox  = document.getElementById('eventsEmpty');
  const emptyMsg  = document.getElementById('eventsEmptyMsg');
  const tabs      = document.querySelectorAll('.ev-tab');

  let allEvents    = [];   // raw from API
  let activeFilter = 'upcoming';

  /* ── STATUS BADGE CONFIG ─────────────────────────── */
  const BADGE = {
    upcoming: { label: 'Upcoming', cls: 'ev-badge-upcoming' },
    ongoing:  { label: 'Live Now', cls: 'ev-badge-ongoing'  },
    past:     { label: 'Past',     cls: 'ev-badge-past'     },
  };

  /* ────────────────────────────────────────────────────
     HELPERS
  ──────────────────────────────────────────────────── */

  /**
   * Safely resolve an image URL from various field shapes.
   * Image logic is intentionally left unchanged per requirements.
   */
  function resolveImage(ev) {
    const raw = ev.imageUrl || ev.coverImage
      || (Array.isArray(ev.images) && ev.images[0])
      || ev.image
      || ev.banner
      || ev.thumbnail
      || null;
    if (!raw) return null;
    if (typeof raw === 'string') return APEX.imgUrl(raw);
    if (typeof raw === 'object') {
      const url = raw.url || raw.src || raw.path || raw.uri || '';
      return url ? APEX.imgUrl(url) : null;
    }
    return null;
  }

  /**
   * Convert a location value (string OR nested object) to a readable string.
   * Format: "City, State" — falls back gracefully to any available field.
   */
  function resolveLocation(ev) {
    const raw = ev.location || ev.venue || ev.place || '';
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      const city  = raw.city  || raw.district || '';
      const state = raw.state || raw.province || raw.region || '';
      if (city && state) return `${city}, ${state}`;
      if (city)  return city;
      if (state) return state;
      // Last resort
      return raw.address || raw.name || raw.formatted || '';
    }
    return '';
  }

  /**
   * Derive the canonical status string (lowercase) from an event object.
   *
   * Priority:
   *  1. Explicit ev.status field (case-insensitive).
   *  2. Date-based fallback — compare startDate / endDate with today.
   *
   * This fixes the mismatch where the backend stores "Upcoming" (capital U)
   * but the public page compared against lowercase "upcoming".
   */
  function deriveStatus(ev) {
    // 1. Use explicit status if present — normalise to lowercase
    if (ev.status && typeof ev.status === 'string' && ev.status.trim()) {
      return ev.status.trim().toLowerCase();
    }

    // 2. Date-based fallback
    const now  = Date.now();
    const start = ev.startDate ? new Date(ev.startDate).getTime() : null;
    const end   = ev.endDate   ? new Date(ev.endDate).getTime()   : null;

    if (start && end) {
      if (now < start) return 'upcoming';
      if (now > end)   return 'past';
      return 'ongoing';
    }
    if (start) {
      // No end date: treat as upcoming if in future, past otherwise
      return now < start ? 'upcoming' : 'past';
    }

    return 'upcoming'; // safe default
  }

  /* ── CARD RENDERER ───────────────────────────────── */
  function renderCard(ev) {
    const status  = deriveStatus(ev);
    const badge   = BADGE[status] || BADGE.upcoming;
    const imgSrc  = resolveImage(ev);
    const dateStr = APEX.fmtDate(ev.date || ev.startDate);
    const timeStr = APEX.fmtTime(ev.date || ev.startDate);
    const loc     = resolveLocation(ev);
    const title   = ev.title || ev.name || 'Untitled Event';
    const desc    = APEX.truncate(ev.description || ev.about || '', 110);
    const link    = ev.registrationLink || ev.link || ev.url || '#';
    const isFree  = ev.isFree || ev.free || false;

    return `
      <article class="ev-card">
        <div class="ev-card-img-wrap">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${title}" class="ev-card-img" loading="lazy" onerror="this.parentNode.classList.add('ev-no-img');this.remove();"/>`
            : `<div class="ev-img-placeholder"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>`
          }
          <span class="ev-badge ${badge.cls}">${badge.label}</span>
          ${isFree ? '<span class="ev-free-tag">Free</span>' : ''}
        </div>
        <div class="ev-card-body">
          <h3 class="ev-card-title">${title}</h3>
          ${desc ? `<p class="ev-card-desc">${desc}</p>` : ''}
          <div class="ev-card-meta">
            ${dateStr ? `<span class="ev-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${dateStr}${timeStr ? ' · ' + timeStr : ''}</span>` : ''}
            ${loc ? `<span class="ev-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${loc}</span>` : ''}
          </div>
          ${status !== 'past'
            ? `<a href="${link}" target="_blank" rel="noopener" class="ev-register-btn btn btn-primary">Register Now</a>`
            : `<span class="ev-ended-label">Event ended</span>`
          }
        </div>
      </article>`;
  }

  /* ────────────────────────────────────────────────────
     EDIT FORM POPULATION
     Called from the admin panel when the user clicks
     "Edit" on an event. Populates every form field
     safely — never overwrites a field with undefined.
  ──────────────────────────────────────────────────── */

  /**
   * setField — only sets the element's value if the resolved value is
   * a non-empty string. Prevents clearing fields that the backend did
   * not return in this response.
   */
  function setField(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = (value !== undefined && value !== null) ? String(value).trim() : '';
    if (v !== '') el.value = v;
  }

  /**
   * Extract a date string (YYYY-MM-DD) from an ISO datetime string or
   * a plain date string. Returns '' if the input is falsy or unparseable.
   */
  function toDateInput(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    // Format as YYYY-MM-DD in local time to avoid timezone shifting
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Extract a time string (HH:MM) from an ISO datetime string, a plain
   * HH:MM string, or a standalone time field. Returns '' if unparseable.
   */
  function toTimeInput(raw) {
    if (!raw) return '';
    // Already looks like HH:MM or HH:MM:SS
    if (/^\d{1,2}:\d{2}/.test(raw)) return raw.slice(0, 5);
    // Try parsing as a full datetime
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  }

  /**
   * populateEditForm — call this with the raw event object from the API
   * to pre-fill the admin edit form.
   *
   * Field mapping covers all known backend field name variants so the
   * form always receives the right value regardless of how the backend
   * shapes its response.
   */
  function populateEditForm(ev) {
    if (!ev || typeof ev !== 'object') return;

    // ── Basic text fields ──────────────────────────────
    setField('edit-title',            ev.title || ev.name);
    setField('edit-description',      ev.description || ev.about);

    // ── Location — convert object → "City, State" string ──
    setField('edit-location', resolveLocation(ev));

    // ── Dates ──────────────────────────────────────────
    // startDate: prefer explicit startDate, fall back to date field
    setField('edit-startDate', toDateInput(ev.startDate || ev.date));
    setField('edit-endDate',   toDateInput(ev.endDate));

    // ── Times ──────────────────────────────────────────
    // 1. Prefer dedicated startTime / endTime fields from backend
    // 2. Fall back to extracting time from the ISO datetime
    const startTime = ev.startTime || toTimeInput(ev.startDate || ev.date);
    const endTime   = ev.endTime   || toTimeInput(ev.endDate);
    setField('edit-startTime', startTime);
    setField('edit-endTime',   endTime);

    // ── Status (case-insensitive) ──────────────────────
    // Normalise to lowercase so the <select> option values always match
    const statusEl = document.getElementById('edit-status');
    if (statusEl && ev.status) {
      const normalised = ev.status.trim().toLowerCase();
      // Try to select the matching option
      const opt = [...statusEl.options].find(
        o => o.value.toLowerCase() === normalised
      );
      if (opt) statusEl.value = opt.value;
    }

    // ── Capacity / registration limit ─────────────────
    setField('edit-maxRegistrations',
      ev.maxRegistrations || ev.capacity || ev.maxAttendees || ev.seats);

    // ── Image preview (do not change upload logic) ────
    const imgSrc = resolveImage(ev);
    const previewEl = document.getElementById('edit-image-preview');
    if (previewEl && imgSrc) {
      previewEl.src         = imgSrc;
      previewEl.style.display = 'block';
    }
  }

  /* ────────────────────────────────────────────────────
     FILTER + RENDER
  ──────────────────────────────────────────────────── */
  function applyFilter(filter) {
    activeFilter = filter;

    const filtered = filter === 'all'
      ? allEvents
      : allEvents.filter(ev => deriveStatus(ev) === filter);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyBox.style.display = 'flex';
      const labels = { upcoming: 'upcoming', ongoing: 'ongoing', past: 'past', all: 'any' };
      emptyMsg.textContent =
        `No ${labels[filter] || ''} events at the moment. Check back soon!`;
    } else {
      emptyBox.style.display = 'none';
      grid.innerHTML = filtered.map(renderCard).join('');
    }
  }

  /* ────────────────────────────────────────────────────
     FETCH
  ──────────────────────────────────────────────────── */
  async function loadEvents() {
    // Show skeletons while loading
    grid.innerHTML = `
      <div class="ev-skeleton skeleton-anim"></div>
      <div class="ev-skeleton skeleton-anim"></div>
      <div class="ev-skeleton skeleton-anim"></div>`;
    emptyBox.style.display = 'none';

    const res = await APEX.api.get('/events');

    if (!res.ok) {
      grid.innerHTML = '';
      emptyBox.style.display = 'flex';
      emptyMsg.textContent =
        res.data?.message || 'Failed to load events. Please try again later.';
      return;
    }

    // Normalise: API might return array, { events:[…] }, or { data:[…] }
    const raw = res.data;
    allEvents = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.events)
        ? raw.events
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

    applyFilter(activeFilter);
  }

  /* ── TAB CLICKS ──────────────────────────────────── */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilter(tab.dataset.filter);
    });
  });

  /* ── EXPOSE populateEditForm for use in admin panel ─ */
  // Admin edit buttons can call: window.EventsPage.populateEditForm(eventObj)
  window.EventsPage = { populateEditForm, resolveLocation, deriveStatus };

  /* ── INIT ────────────────────────────────────────── */
  loadEvents();
})();

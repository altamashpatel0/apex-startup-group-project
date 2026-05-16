/* ══════════════════════════════════════════════════════
   APEX ADMIN — Core JS (api.js)
   Shared utilities: API calls, auth, toast, sidebar
══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:5000/api';

// ── AUTH ──────────────────────────────────────────────
const Auth = {
  getToken() {
    // Check both storages — sessionStorage first, then localStorage
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token') || null;
  },
  getAdmin() {
    try { return JSON.parse(localStorage.getItem('admin_user') || '{}'); } catch { return {}; }
  },
  save(token, admin, remember = false) {
    // Always persist to localStorage so the token survives page refreshes.
    // Also write to sessionStorage so same-tab reads are fast.
    localStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(admin));
  },
  clear() {
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },
  isLoggedIn() { return !!this.getToken(); },
  logout() {
    this.clear();
    window.location.href = '../index.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '../index.html';
      return false;
    }
    return true;
  }
};

// ── API ───────────────────────────────────────────────
const api = {
  async request(method, endpoint, body = null, isFormData = false) {
    const token = Auth.getToken();

    // Warn clearly in the console if a protected request has no token
    if (!token) {
      console.warn(`[api] No auth token found for ${method} ${endpoint}. ` +
        'The request will be sent without Authorization header and will likely get a 401.');
    }

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);

    // Handle non-JSON responses (e.g. 502, nginx error pages) gracefully
    let data;
    try {
      data = await res.json();
    } catch {
      data = { message: `Non-JSON response (HTTP ${res.status})` };
    }

    if (res.status === 401) {
      console.error('[api] 401 Unauthorized — clearing session and redirecting to login.');
      Auth.logout();
      return;
    }

    return { ok: res.ok, status: res.status, data };
  },
  get(endpoint)               { return this.request('GET', endpoint); },
  post(endpoint, body)        { return this.request('POST', endpoint, body); },
  postForm(endpoint, fd)      { return this.request('POST', endpoint, fd, true); },
  put(endpoint, body)         { return this.request('PUT', endpoint, body); },
  putForm(endpoint, fd)       { return this.request('PUT', endpoint, fd, true); },
  patch(endpoint, body)       { return this.request('PATCH', endpoint, body); },
  delete(endpoint)            { return this.request('DELETE', endpoint); },
};

// ── TOAST ─────────────────────────────────────────────
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    this.container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'none';
      t.style.opacity = '0';
      t.style.transform = 'translateX(110%)';
      t.style.transition = 'all .3s';
      setTimeout(() => t.remove(), 300);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 5000); },
  info(msg)    { this.show(msg, 'info'); },
};

// ── SIDEBAR ───────────────────────────────────────────
const Sidebar = {
  init() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('open');
      });
      overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    // Highlight active link
    const current = window.location.pathname;
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link.dataset.page && current.includes(link.dataset.page)) {
        link.classList.add('active');
      }
    });

    // Populate user info
    const admin = Auth.getAdmin();
    const nameEl = document.getElementById('sidebar-name');
    const roleEl = document.getElementById('sidebar-role');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (nameEl) nameEl.textContent = admin.name || 'Admin';
    if (roleEl) roleEl.textContent = admin.role || 'administrator';
    if (avatarEl) avatarEl.textContent = (admin.name || 'A')[0].toUpperCase();

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      Auth.logout();
    });
  }
};

// ── CONFIRM DIALOG ────────────────────────────────────
const Confirm = {
  resolve: null,
  init() {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-cancel')?.addEventListener('click', () => {
      overlay.classList.remove('open');
      if (this.resolve) this.resolve(false);
    });
    document.getElementById('confirm-ok')?.addEventListener('click', () => {
      overlay.classList.remove('open');
      if (this.resolve) this.resolve(true);
    });
  },
  show(title, message) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-overlay').classList.add('open');
    return new Promise(res => { this.resolve = res; });
  }
};

// ── MODAL HELPERS ─────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ── IMAGE PREVIEW ─────────────────────────────────────
function setupImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

// ── DRAG & DROP UPLOAD ZONE ───────────────────────────
function setupDropzone(zoneId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const input = zone.querySelector('input[type=file]');
    if (input && e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// ── SEARCH FILTER ─────────────────────────────────────
function setupSearch(inputId, tableBodyId) {
  const input = document.getElementById(inputId);
  const tbody = document.getElementById(tableBodyId);
  if (!input || !tbody) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    Array.from(tbody.rows).forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ── FORMAT HELPERS ────────────────────────────────────
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function truncate(str = '', n = 60) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `http://localhost:5000/${path}`;
}

// ── SHARED LAYOUT HTML ────────────────────────────────
function renderSidebarLayout(activePageId) {
  const nav = [
    { id: 'dashboard',     icon: '📊', label: 'Dashboard',     href: 'dashboard.html' },
    { id: 'blogs',         icon: '📝', label: 'Blogs',          href: 'blogs.html' },
    { id: 'gallery',       icon: '🖼️', label: 'Gallery',        href: 'gallery.html' },
    { id: 'events',        icon: '📅', label: 'Events',         href: 'events.html' },
    { id: 'registrations', icon: '📋', label: 'Registrations',  href: 'registrations.html' },
  ];

  return `
  <div id="sidebar-overlay" class="sidebar-overlay"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <a class="sidebar-logo-inner" href="dashboard.html">
        <div class="sidebar-logo-icon">🚀</div>
        <div class="sidebar-logo-text">
          Apex
          <span>Admin Panel</span>
        </div>
      </a>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Main</div>
      ${nav.map(n => `
        <a class="sidebar-link${n.id === activePageId ? ' active' : ''}" href="${n.href}" data-page="${n.id}">
          <span class="icon">${n.icon}</span>
          ${n.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar">A</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebar-name">Admin</div>
          <div class="sidebar-user-role" id="sidebar-role">administrator</div>
        </div>
        <button class="sidebar-logout-btn" id="logout-btn" title="Logout">⬅</button>
      </div>
    </div>
  </aside>

  <!-- Confirm Dialog -->
  <div class="confirm-overlay" id="confirm-overlay">
    <div class="confirm-box">
      <div class="confirm-icon">⚠️</div>
      <div class="confirm-title" id="confirm-title">Are you sure?</div>
      <div class="confirm-message" id="confirm-message">This action cannot be undone.</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Delete</button>
      </div>
    </div>
  </div>

  <div class="toast-container" id="toast-container"></div>
  `;
}

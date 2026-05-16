// ── PAGE ROUTING ──

// Map page names to their HTML files
const pageFiles = {
  home:    'index.html',
  about:   'about.html',
  join:    'join.html',
  events:  'events.html',
  gallery: 'gallery.html',
  blog:    'blog.html',
  contact: 'contact.html'
};

// Detect which page we're on by looking for an active .page div
function getCurrentPage() {
  const active = document.querySelector('.page.active');
  if (!active) return 'home';
  return active.id.replace('page-', '');
}

function showPage(name) {
  const target = pageFiles[name] || 'index.html';
  const current = getCurrentPage();

  // If we're already on this page, do nothing
  if (current === name) return false;

  // Navigate to the target file
  window.location.href = target;
  return false;
}

// ── NAV ACTIVE STATE ──
// Highlight the correct nav link based on which page we're on
(function setActiveNav() {
  const current = getCurrentPage();
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === current);
  });
})();

// ── MOBILE MENU ──
function closeMob() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger) hamburger.classList.remove('open');
  if (mobileMenu) mobileMenu.classList.remove('open');
}

const ham = document.getElementById('hamburger');
const mob = document.getElementById('mobileMenu');
if (ham && mob) {
  ham.addEventListener('click', () => {
    ham.classList.toggle('open');
    mob.classList.toggle('open');
  });
}

// ── TOAST ──
function showToast(msg, err = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = err ? '#EF4444' : '#111827';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── FORMS ──
function submitJoin() {
  const n = document.getElementById('j-name').value.trim();
  const e = document.getElementById('j-email').value.trim();
  if (!n || !e) { showToast('⚠️ Please fill in required fields.', true); return; }
  ['j-name', 'j-email', 'j-phone', 'j-company', 'j-role'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showToast("✅ Application submitted! We'll be in touch soon.");
}

function submitContact() {
  const n = document.getElementById('c-name').value.trim();
  const e = document.getElementById('c-email').value.trim();
  if (!n || !e) { showToast('⚠️ Please fill in required fields.', true); return; }
  ['c-name', 'c-email', 'c-phone', 'c-msg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showToast("✅ Message sent! We'll get back to you soon.");
}

function subscribeNL() {
  const e = document.getElementById('nl-email').value.trim();
  if (!e) { showToast('⚠️ Please enter your email.', true); return; }
  document.getElementById('nl-email').value = '';
  showToast('✅ Subscribed! Welcome to the community.');
}

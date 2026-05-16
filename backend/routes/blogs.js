/**
 * backend/routes/blogs.js
 *
 * REST routes for Blog CRUD.
 * Supports:
 *   - string author names  (e.g. "Super Admin" from the admin UI)
 *   - ObjectId author refs (programmatic / seeded data)
 *   - multipart/form-data  (image upload via multer)
 *   - application/json     (no image)
 *   - create and update in both modes
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const Blog     = require('../models/Blog');

// ── MULTER SETUP ────────────────────────────────────────────────────────────
// Store uploaded cover images in  /uploads/blogs/
const uploadDir = path.join(__dirname, '../uploads/blogs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
             allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Normalise the author value coming from the frontend.
 * - If it looks like a 24-char hex ObjectId → keep as-is (Mongoose will cast it).
 * - Otherwise treat as a plain display-name string.
 * - Falls back to 'Admin' when nothing is provided.
 */
function normaliseAuthor(raw) {
  if (!raw) return 'Admin';
  const str = String(raw).trim();
  if (!str) return 'Admin';
  // 24-hex ObjectId test
  if (/^[a-f\d]{24}$/i.test(str)) return str; // Mongoose will cast to ObjectId
  return str; // plain string — stored as-is
}

/**
 * Parse the `tags` field which may arrive as:
 *   - a JSON-stringified array  → '["tag1","tag2"]'
 *   - a comma-separated string  → 'tag1,tag2'
 *   - a real JS array           → already parsed by body-parser
 *   - undefined / null
 */
function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  } catch (_) { /* not JSON */ }
  return String(raw).split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

/** Relative path stored in DB; served statically from /uploads/ */
function coverImagePath(file) {
  return file ? `/uploads/blogs/${file.filename}` : null;
}

/** Build the update object for PUT — only include fields that were sent */
function buildUpdateFields(body, file) {
  const fields = {};

  if (body.title    !== undefined) fields.title    = body.title;
  if (body.excerpt  !== undefined) fields.excerpt  = body.excerpt;
  if (body.content  !== undefined) fields.content  = body.content;
  if (body.category !== undefined) fields.category = body.category;
  if (body.status   !== undefined) {
    fields.status = body.status;
    if (body.status === 'published') fields.publishedAt = new Date();
  }
  if (body.author !== undefined) fields.author = normaliseAuthor(body.author);
  if (body.tags   !== undefined) fields.tags   = parseTags(body.tags);

  // Re-generate slug if title changed
  if (body.title) {
    fields.slug =
      String(body.title)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-') +
      '-' +
      Date.now();
  }

  // Only update coverImage if a new file was actually uploaded
  if (file) fields.coverImage = coverImagePath(file);

  return fields;
}

// ── GET /blogs  — list all (most-recent first) ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      page  = 1,
      limit = 100,
    } = req.query;

    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title:    { $regex: search, $options: 'i' } },
        { excerpt:  { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({ ok: true, data: blogs });
  } catch (err) {
    console.error('[GET /blogs]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /blogs/:id  — single blog ───────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ ok: false, message: 'Blog not found' });
    return res.json({ ok: true, data: blog });
  } catch (err) {
    console.error('[GET /blogs/:id]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /blogs  — create ────────────────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, excerpt, content, category, status, author, tags } = req.body;

    // Required field validation (done here, not in Mongoose, for clear JSON errors)
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, message: 'Title is required.' });
    }
    if (!content || !String(content).trim()) {
      return res.status(400).json({ ok: false, message: 'Content is required.' });
    }

    const blog = new Blog({
      title:      String(title).trim(),
      excerpt:    excerpt  ? String(excerpt).trim()  : undefined,
      content:    String(content).trim(),
      category:   category ? String(category).trim() : 'General',
      status:     status   || 'draft',
      author:     normaliseAuthor(author),   // ← string name or ObjectId, never throws
      tags:       parseTags(tags),
      coverImage: coverImagePath(req.file),  // null when no file uploaded
    });

    await blog.save();

    return res.status(201).json({ ok: true, data: blog });
  } catch (err) {
    console.error('[POST /blogs]', err);
    // Remove uploaded file on error to avoid orphans
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── PUT /blogs/:id  — update ─────────────────────────────────────────────────
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ ok: false, message: 'Blog not found' });
    }

    const updates = buildUpdateFields(req.body, req.file);

    // Apply each updated field onto the document so pre-save hooks fire
    Object.assign(blog, updates);
    await blog.save();

    return res.json({ ok: true, data: blog });
  } catch (err) {
    console.error('[PUT /blogs/:id]', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── DELETE /blogs/:id ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ ok: false, message: 'Blog not found' });

    // Clean up cover image file if it lives in our uploads folder
    if (blog.coverImage) {
      const filePath = path.join(__dirname, '..', blog.coverImage);
      fs.unlink(filePath, () => {}); // best-effort, ignore errors
    }

    return res.json({ ok: true, message: 'Blog deleted successfully.' });
  } catch (err) {
    console.error('[DELETE /blogs/:id]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── MULTER ERROR HANDLER ─────────────────────────────────────────────────────
// Must be the last middleware on this router so it catches multer errors.
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  console.error('[blogs router error]', err);
  return res.status(400).json({ ok: false, message: err.message || 'Upload error.' });
});

module.exports = router;

const express = require('express');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');

const router = express.Router();

const galleryUpload = (req, res, next) => {
  req.uploadFolder = 'gallery';
  next();
};

/**
 * Multer fields config — accepts both 'image' (singular, from frontend)
 * and 'images' (plural, from legacy / bulk upload flows).
 * maxCount 10 on each so either field can carry up to 10 files.
 */
const galleryFields = upload.fields([
  { name: 'image',  maxCount: 10 },
  { name: 'images', maxCount: 10 },
]);

/**
 * Normalise req.files into a flat array regardless of which field name
 * the client used ('image', 'images', or both).
 * Returns [] when no files were uploaded (safe for optional update uploads).
 */
const resolveFiles = (req) =>
  (req.files?.image ?? []).concat(req.files?.images ?? []);

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// GET /api/gallery
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.isFeatured = true;
    if (req.query.type) filter.mediaType = req.query.type;

    const items = await Gallery.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate('uploadedBy', 'name');

    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/gallery/:id
router.get('/:id', async (req, res, next) => {
  try {
    const item = await Gallery.findById(req.params.id).populate('uploadedBy', 'name');
    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ─── PROTECTED ───────────────────────────────────────────────────────────────

// POST /api/gallery
// Accepts: 'image' (single/multiple) OR 'images' (single/multiple)
router.post('/', protect, galleryUpload, galleryFields, async (req, res, next) => {
  try {
    const files = resolveFiles(req);

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Media file is required.' });
    }

    const { title, description, category, tags, isFeatured, sortOrder } = req.body;
    const file = files[0];
    const ext  = file.mimetype.split('/')[0]; // 'image' or 'video'

    const item = await Gallery.create({
      title,
      description,
      mediaUrl:   `uploads/gallery/${file.filename}`,
      mediaType:  ext === 'video' ? 'video' : 'image',
      category,
      tags:       tags ? JSON.parse(tags) : [],
      isFeatured: isFeatured === 'true',
      sortOrder:  sortOrder ? parseInt(sortOrder) : 0,
      uploadedBy: req.admin._id,
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// PUT /api/gallery/:id
// Accepts: 'image' (single) OR 'images' (single) — file is optional on update
router.put('/:id', protect, galleryUpload, galleryFields, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.tags && typeof updates.tags === 'string') updates.tags = JSON.parse(updates.tags);
    if (updates.isFeatured !== undefined) updates.isFeatured = updates.isFeatured === 'true' || updates.isFeatured === true;

    // If a replacement file was uploaded (via either field name), update media fields
    const files = resolveFiles(req);
    if (files.length) {
      const file        = files[0];
      updates.mediaUrl  = `uploads/gallery/${file.filename}`;
      updates.mediaType = file.mimetype.split('/')[0] === 'video' ? 'video' : 'image';
    }

    const item = await Gallery.findByIdAndUpdate(req.params.id, updates, {
      new:          true,
      runValidators: true,
    });

    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gallery/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const item = await Gallery.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

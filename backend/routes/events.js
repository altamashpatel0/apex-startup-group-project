const express = require('express');
const Event = require('../models/Event');
const Member = require('../models/Member');
const { protect } = require('../middleware/auth');
const Registration = require('../models/Registrations');
const upload = require('../middleware/multer');
const router = express.Router();

const eventUpload = (req, res, next) => {
  req.uploadFolder = 'events';
  next();
};

// ─── FILE HELPER ─────────────────────────────────────────────────────────────
// Accepts both `image` (single) and `images` (array) field names from multer.fields()
// Returns the path of the first resolved file, or undefined if none uploaded.
function resolveFiles(req) {
  const files = req.files || {};
  // Support both field names
  const fileList = files['image'] || files['images'] || [];
  if (fileList.length > 0) {
    return `uploads/events/${fileList[0].filename}`;
  }
  return undefined;
}

// Multer field config — accepts `image` OR `images`, up to 1 file each
const eventFields = upload.fields([
  { name: 'image',  maxCount: 1 },
  { name: 'images', maxCount: 1 },
]);

// ─── SAFE JSON PARSE HELPER ──────────────────────────────────────────────────
// Only tries to parse if the value looks like a JSON array or object.
// Returns the original string for plain text values (e.g. "jalgaon").
function safeParseJSON(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON — return as-is
    }
  }
  return value;
}

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    // Default: only non-draft for public
    if (!req.query.all) filter.status = { $ne: 'draft' };

    const events = await Event.find(filter)
      .sort({ startDate: 1 })
      .populate('createdBy', 'name');

    res.json({ success: true, total: events.length, data: events });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

// ─── PROTECTED ───────────────────────────────────────────────────────────────

// GET /api/events/admin/all  – all events including drafts
router.get('/admin/all', protect, async (req, res, next) => {
  try {
    const events = await Event.find()
      .sort({ startDate: -1 })
      .populate('createdBy', 'name email');
    res.json({ success: true, total: events.length, data: events });
  } catch (err) {
    next(err);
  }
});

// POST /api/events
router.post('/', protect, eventUpload, eventFields, async (req, res, next) => {
  try {
    const body = { ...req.body };

    // Attach uploaded image if present
    const filePath = resolveFiles(req);
    if (filePath) body.coverImage = filePath;

    // Only parse tags/location if they look like JSON arrays/objects —
    // plain strings like "jalgaon" are left untouched.
    if (body.tags)     body.tags     = safeParseJSON(body.tags);
    if (body.location) body.location = safeParseJSON(body.location);

    body.createdBy = req.admin._id;

    const event = await Event.create(body);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id
router.put('/:id', protect, eventUpload, eventFields, async (req, res, next) => {
  try {
    const updates = { ...req.body };

    // Attach uploaded image if present
    const filePath = resolveFiles(req);
    if (filePath) updates.coverImage = filePath;

    // Only parse tags/location if they look like JSON arrays/objects
    if (updates.tags)     updates.tags     = safeParseJSON(updates.tags);
    if (updates.location) updates.location = safeParseJSON(updates.location);

    const event = await Event.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    // Cascade delete registrations
    await Registration.deleteMany({ event: req.params.id });
    res.json({ success: true, message: 'Event and related registrations deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id/registrations  (admin)
router.get('/:id/registrations', protect, async (req, res, next) => {
  try {
    const registrations = await Registration.find({ event: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, total: registrations.length, data: registrations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const Member = require('../models/Member');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require admin auth
router.use(protect);

// GET /api/registrations  – all member registrations, newest first
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const registrations = await Member.find(filter)
      .select('fullName email mobile role orgName createdAt isActive')
      .sort({ createdAt: -1 });

    res.json({ success: true, registrations });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/registrations/:id  – remove a member registration (admin)
router.delete('/:id', async (req, res, next) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }
    res.json({ success: true, message: 'Registration deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

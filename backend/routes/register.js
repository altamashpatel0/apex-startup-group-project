const express = require('express');
const Member = require('../models/Member');
const Registration = require('../models/Registrations');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// POST /api/register  – register for an event
router.post('/', async (req, res, next) => {
  try {
    const { eventId, firstName, lastName, email, phone, organization, message } = req.body;

    if (!eventId || !firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'eventId, firstName, lastName, and email are required.' });
    }

    // Validate event exists and registration is open
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (!event.isRegistrationOpen) {
      return res.status(400).json({ success: false, message: 'Registration for this event is closed.' });
    }
    if (event.capacity && event.registrationCount >= event.capacity) {
      return res.status(400).json({ success: false, message: 'This event is fully booked.' });
    }
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed.' });
    }

    const registration = await Registration.create({
      event: eventId,
      firstName,
      lastName,
      email,
      phone,
      organization,
      message,
    });

    // Increment event registration count
    await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: 1 } });

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: {
        id: registration._id,
        token: registration.registrationToken,
        event: event.title,
        name: `${firstName} ${lastName}`,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already registered for this event.' });
    }
    next(err);
  }
});

// GET /api/register/verify/:token  – verify registration by token
router.get('/verify/:token', async (req, res, next) => {
  try {
    const registration = await Registration.findOne({ registrationToken: req.params.token })
      .populate('event', 'title startDate location');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
});

// ─── PROTECTED ───────────────────────────────────────────────────────────────

// GET /api/register  – all registrations (admin)
router.get('/', protect, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.event) filter.event = req.query.event;
    if (req.query.status) filter.status = req.query.status;

    const registrations = await Registration.find(filter)
      .populate('event', 'title startDate')
      .sort({ createdAt: -1 });

    res.json({ success: true, total: registrations.length, data: registrations });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/register/:id/status  – update registration status (admin)
router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'cancelled', 'attended'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found.' });
    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/register/:id  (admin)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const reg = await Registration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });
    await Event.findByIdAndUpdate(reg.event, { $inc: { registrationCount: -1 } });
    res.json({ success: true, message: 'Registration deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

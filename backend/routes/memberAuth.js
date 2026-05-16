const express = require('express');
const jwt = require('jsonwebtoken');
const Member = require('../models/Member');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id, type: 'member' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Public endpoint: create a new member account
router.post('/register', async (req, res, next) => {
  try {
    const { role, fullName, mobile, email, orgName, password } = req.body;

    // Basic field check
    if (!role || !fullName || !mobile || !email || !orgName || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    // Password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    // Create member (duplicate email → 11000 error caught below)
    const member = await Member.create({
      role,
      fullName,
      mobile,
      email,
      orgName,
      password,
    });

    const token = signToken(member._id);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to APEX.',
      token,
      member: {
        id: member._id,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        orgName: member.orgName,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key — figure out which field
      const field = Object.keys(err.keyPattern || {})[0] || 'email';
      return res.status(409).json({
        success: false,
        message: `An account with that ${field} already exists.`,
        field,
      });
    }
    next(err);
  }
});

// ─── POST /api/auth/login (admin) ────────────────────────────────────────────
// Keep existing admin-login logic; import it from auth.js at the server level.
// This route file is for member-facing auth only.

module.exports = router;

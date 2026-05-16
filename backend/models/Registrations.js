const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RegistrationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'moderator'],
      default: 'member',
    },
    orgName: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ── Mongoose v8: hooks must return a Promise (async) — no next() parameter ──

// Hash password before saving (only if modified)
RegistrationSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Example post-save hook (logging, side-effects, etc.)
RegistrationSchema.post('save', async function (doc) {
  // doc is the saved document; add any post-save logic here
  // e.g. send welcome email, audit log, etc.
});

// Pre-deleteOne / findOneAndDelete hook (cascade cleanup if needed)
RegistrationSchema.pre(
  ['deleteOne', 'findOneAndDelete'],
  { document: true, query: false },
  async function () {
    // Add any pre-delete cleanup here
    // e.g. await RelatedModel.deleteMany({ memberId: this._id });
  }
);

// ── Instance method: compare plain password against hash ──
RegistrationSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Registration', RegistrationSchema);

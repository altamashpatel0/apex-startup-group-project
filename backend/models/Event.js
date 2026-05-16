const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
    },
    coverImage: {
      type: String, // relative path from /uploads/events/
      default: null,
    },
    location: {
      venue: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      isOnline: { type: Boolean, default: false },
      onlineLink: { type: String, trim: true },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
    },
    registrationDeadline: {
      type: Date,
    },
    capacity: {
      type: Number,
      default: null, // null = unlimited
    },
    registrationCount: {
      type: Number,
      default: 0,
    },
    isFree: {
      type: Boolean,
      default: true,
    },
    ticketPrice: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled', 'draft'],
      default: 'draft',
    },
    isRegistrationOpen: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true }
);

// Virtual: check if event is full
eventSchema.virtual('isFull').get(function () {
  if (!this.capacity) return false;
  return this.registrationCount >= this.capacity;
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);

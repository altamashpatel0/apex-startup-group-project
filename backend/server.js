// ─── Load environment variables first ────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./db');
const seedAdmin = require('./config/seedAdmin');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ─── Route imports ────────────────────────────────────────────────────────────
const memberAuthRoutes = require('./routes/memberAuth'); // public member registration
const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blogs');
const galleryRoutes = require('./routes/gallery');
const eventRoutes = require('./routes/events');
const registerRoutes = require('./routes/register');
const registrationsRoutes = require('./routes/registrations');

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// FIX: Include both localhost AND 127.0.0.1 variants.
// Browsers treat these as different origins. Live Server typically serves
// on 127.0.0.1:5500 or 127.0.0.1:3000, not localhost:3000.
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',   // VS Code Live Server default
  'http://127.0.0.1:5500',
  'http://localhost:5501',   // Live Server alternate port
  'http://127.0.0.1:5501',
  'http://localhost:8080',   // common dev server port
  'http://127.0.0.1:8080',
  'http://localhost:4200',   // Angular CLI
  'http://127.0.0.1:4200',
];

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (origin === 'null') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static uploads ───────────────────────────────────────────────────────────
// Files are stored at <project-root>/uploads/ and served at /uploads/*
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── Explicit pre-flight for all routes ───────────────────────────────────────
// Required so browsers don't get a 404 on OPTIONS before the real request.
app.options(/.*/, cors());

// ─── API Routes ───────────────────────────────────────────────────────────────
// IMPORTANT: memberAuthRoutes MUST be mounted before authRoutes on the same
// /api/auth prefix. Express matches routes in registration order; if authRoutes
// came first and had no /register handler, the request would fall through to 404.
app.use('/api/auth', memberAuthRoutes);   // POST /api/auth/register  (public member signup)
app.use('/api/auth', authRoutes);         // POST /api/auth/login, GET /api/auth/me, etc.
app.use('/api/blogs', blogRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/registrations', registrationsRoutes);

// ─── Admin dashboard frontend (future) ───────────────────────────────────────
// When the /admin frontend is built, uncomment:
// app.use('/admin', express.static(path.join(__dirname, '..', 'admin-build')));
// app.get('/admin/*', (req, res) =>
//   res.sendFile(path.join(__dirname, '..', 'admin-build', 'index.html'))
// );

// ─── 404 & error handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📡 API base: http://localhost:${PORT}/api`);
    console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  });
};

start();

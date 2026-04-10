'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const slotsRoutes = require('./routes/slots');
const applicationsRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// ── Static files ────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────────────────────────────

app.use('/', authRoutes);
app.use('/', slotsRoutes);
app.use('/', applicationsRoutes);
app.use('/admin', adminRoutes);

// ── Landing page ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ── API session info (used by frontend to check login state) ─────────────────

app.get('/api/me', (req, res) => {
  res.json({
    isOwner: !!req.session.ownerId,
    ownerName: req.session.ownerName || null,
    isWalker: !!req.session.isWalker
  });
});

// ── 404 handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public/index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Karma Jobs running at http://localhost:${PORT}`);
});

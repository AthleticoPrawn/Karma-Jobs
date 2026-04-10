'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../db');

const router = express.Router();

// ── Owner identification (find-or-create, no password) ──────────────────────
//
// First-time visitors: provide name, phone, dog_name, address → creates record
// Returning visitors:  same endpoint, phone is the unique key → reuses record

router.post('/api/identify', (req, res) => {
  const { name, phone, dog_name, address } = req.body;

  if (!name || !phone || !dog_name || !address) {
    return res.status(400).json({ error: 'Name, phone number, dog\'s name and area are all required' });
  }

  const existing = db.prepare('SELECT * FROM owners WHERE phone = ?').get(phone.trim());

  if (existing) {
    // Returning visitor — update their details in case anything changed
    db.prepare(
      'UPDATE owners SET name = ?, dog_name = ?, address = ? WHERE phone = ?'
    ).run(name.trim(), dog_name.trim(), address.trim(), phone.trim());

    req.session.ownerId = existing.id;
    req.session.ownerName = name.trim();
    return res.json({ ok: true, isNew: false });
  }

  // New visitor — create a record
  const result = db.prepare(
    'INSERT INTO owners (name, phone, dog_name, address) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), phone.trim(), dog_name.trim(), address.trim());

  req.session.ownerId = result.lastInsertRowid;
  req.session.ownerName = name.trim();
  res.json({ ok: true, isNew: true });
});

// ── Owner lookup by phone (for My Applications page) ───────────────────────

router.post('/api/lookup', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const owner = db.prepare('SELECT * FROM owners WHERE phone = ?').get(phone.trim());
  if (!owner) {
    return res.status(404).json({ error: 'No applications found for that number' });
  }

  req.session.ownerId = owner.id;
  req.session.ownerName = owner.name;
  res.json({ ok: true, name: owner.name, dog_name: owner.dog_name });
});

// ── Owner logout ─────────────────────────────────────────────────────────────

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Walker admin login ────────────────────────────────────────────────────────

router.get('/admin/login', (req, res) => {
  if (req.session.isWalker) return res.redirect('/admin/');
  res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

router.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const hash = process.env.WALKER_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ error: 'Walker password not configured. Set WALKER_PASSWORD_HASH in .env' });
  }

  const match = await bcrypt.compare(password, hash);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  req.session.isWalker = true;
  res.json({ ok: true });
});

// ── Walker admin logout ───────────────────────────────────────────────────────

router.post('/api/admin/logout', (req, res) => {
  req.session.isWalker = false;
  req.session.save(() => res.json({ ok: true }));
});

module.exports = router;

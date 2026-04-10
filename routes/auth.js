'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../db');

const router = express.Router();

// ── Owner registration ──────────────────────────────────────────────────────

router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

router.post('/api/register', async (req, res) => {
  const { name, phone, dog_name, address, password } = req.body;

  if (!name || !phone || !dog_name || !address || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM owners WHERE phone = ?').get(phone.trim());
  if (existing) {
    return res.status(409).json({ error: 'An account with that phone number already exists' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO owners (name, phone, password_hash, dog_name, address) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), phone.trim(), password_hash, dog_name.trim(), address.trim());

  req.session.ownerId = result.lastInsertRowid;
  req.session.ownerName = name.trim();
  res.json({ ok: true });
});

// ── Owner login ─────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

router.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  const owner = db.prepare('SELECT * FROM owners WHERE phone = ?').get(phone.trim());
  if (!owner) {
    return res.status(401).json({ error: 'Incorrect phone number or password' });
  }

  const match = await bcrypt.compare(password, owner.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect phone number or password' });
  }

  req.session.ownerId = owner.id;
  req.session.ownerName = owner.name;
  res.json({ ok: true });
});

// ── Owner logout ────────────────────────────────────────────────────────────

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Walker admin login ──────────────────────────────────────────────────────

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

// ── Walker admin logout ─────────────────────────────────────────────────────

router.post('/api/admin/logout', (req, res) => {
  req.session.isWalker = false;
  req.session.save(() => res.json({ ok: true }));
});

module.exports = router;

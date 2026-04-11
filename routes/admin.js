'use strict';

const express = require('express');
const path = require('path');
const db = require('../db');
const { requireWalker } = require('../auth');

const router = express.Router();

// All admin routes require walker auth
router.use(requireWalker);

// ── Admin dashboard / slot list ─────────────────────────────────────────────

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/slots.html'));
});

router.get('/api/slots', (req, res) => {
  const slots = db.prepare(`
    SELECT
      s.*,
      COUNT(a.id) AS application_count,
      SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count
    FROM slots s
    LEFT JOIN applications a ON a.slot_id = s.id
    GROUP BY s.id
    ORDER BY s.date ASC, s.start_time ASC
  `).all();
  res.json(slots);
});

// ── Create slot ─────────────────────────────────────────────────────────────

router.post('/api/slots', (req, res) => {
  const { date, start_time, end_time, duration_minutes, notes } = req.body;
  if (!date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'date, start_time, and duration_minutes are required' });
  }

  const result = db.prepare(
    'INSERT INTO slots (date, start_time, end_time, duration_minutes, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(date, start_time, end_time || null, parseInt(duration_minutes, 10), notes || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── Edit slot ───────────────────────────────────────────────────────────────

router.put('/api/slots/:id', (req, res) => {
  const { date, start_time, end_time, duration_minutes, notes } = req.body;
  const slotId = parseInt(req.params.id, 10);

  const slot = db.prepare('SELECT id FROM slots WHERE id = ?').get(slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  db.prepare(
    'UPDATE slots SET date = ?, start_time = ?, end_time = ?, duration_minutes = ?, notes = ? WHERE id = ?'
  ).run(date, start_time, end_time || null, parseInt(duration_minutes, 10), notes || null, slotId);

  res.json({ ok: true });
});

// ── Delete slot ─────────────────────────────────────────────────────────────

router.delete('/api/slots/:id', (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  const result = db.prepare('DELETE FROM slots WHERE id = ?').run(slotId);
  if (result.changes === 0) return res.status(404).json({ error: 'Slot not found' });
  res.json({ ok: true });
});

// ── Applicants for a slot ───────────────────────────────────────────────────

router.get('/applicants', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/applicants.html'));
});

router.get('/api/slots/:id/applicants', (req, res) => {
  const slotId = parseInt(req.params.id, 10);

  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const applicants = db.prepare(`
    SELECT
      a.id AS application_id,
      a.status,
      a.applied_at,
      a.proposed_time,
      o.id AS owner_id,
      o.name,
      o.phone,
      o.dog_name,
      o.address
    FROM applications a
    JOIN owners o ON o.id = a.owner_id
    WHERE a.slot_id = ?
    ORDER BY a.applied_at ASC
  `).all(slotId);

  res.json({ slot, applicants });
});

// ── Confirm an applicant ────────────────────────────────────────────────────

router.post('/api/slots/:id/confirm/:appId', (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  const appId = parseInt(req.params.appId, 10);

  const app = db.prepare(
    'SELECT id FROM applications WHERE id = ? AND slot_id = ?'
  ).get(appId, slotId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  // Atomic: confirm one, decline all others for this slot
  const confirmOne = db.transaction(() => {
    db.prepare(
      'UPDATE applications SET status = ? WHERE id = ? AND slot_id = ?'
    ).run('confirmed', appId, slotId);
    db.prepare(
      'UPDATE applications SET status = ? WHERE slot_id = ? AND id != ?'
    ).run('declined', slotId, appId);
  });

  confirmOne();
  res.json({ ok: true });
});

// ── Unconfirm (reset slot back to pending) ──────────────────────────────────

router.post('/api/slots/:id/unconfirm', (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  db.prepare(
    'UPDATE applications SET status = ? WHERE slot_id = ? AND status = ?'
  ).run('pending', slotId, 'confirmed');
  res.json({ ok: true });
});

module.exports = router;

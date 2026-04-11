'use strict';

const express = require('express');
const path = require('path');
const db = require('../db');
const { requireOwner } = require('../auth');

const router = express.Router();

// ── Browse available slots ──────────────────────────────────────────────────

router.get('/slots', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/slots.html'));
});

router.get('/api/slots', (req, res) => {
  // A slot is "available" if no application for it is confirmed yet
  let query = `
    SELECT s.*,
           (SELECT COUNT(*) FROM applications a WHERE a.slot_id = s.id) AS application_count
    FROM slots s
    WHERE s.id NOT IN (
      SELECT slot_id FROM applications WHERE status = 'confirmed'
    )
  `;
  const params = [];

  if (req.query.date) {
    query += ' AND s.date = ?';
    params.push(req.query.date);
  }

  query += ' ORDER BY s.date ASC, s.start_time ASC';

  const slots = db.prepare(query).all(...params);

  // If owner is logged in, annotate which slots they've already applied to
  if (req.session.ownerId) {
    const applied = db.prepare(
      'SELECT slot_id FROM applications WHERE owner_id = ?'
    ).all(req.session.ownerId);
    const appliedIds = new Set(applied.map(r => r.slot_id));
    slots.forEach(s => { s.already_applied = appliedIds.has(s.id); });
  }

  res.json(slots);
});

// ── Apply for a slot ────────────────────────────────────────────────────────

router.post('/api/slots/:id/apply', requireOwner, (req, res) => {
  const slotId = parseInt(req.params.id, 10);

  const slot = db.prepare('SELECT id FROM slots WHERE id = ?').get(slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }

  // Check if already confirmed by someone else
  const confirmed = db.prepare(
    'SELECT id FROM applications WHERE slot_id = ? AND status = ?'
  ).get(slotId, 'confirmed');
  if (confirmed) {
    return res.status(409).json({ error: 'This slot has already been filled' });
  }

  const { proposed_time, message } = req.body || {};

  try {
    db.prepare(
      'INSERT INTO applications (slot_id, owner_id, proposed_time, message) VALUES (?, ?, ?, ?)'
    ).run(slotId, req.session.ownerId, proposed_time || null, message || null);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'You have already applied for this slot' });
    }
    throw err;
  }
});

module.exports = router;

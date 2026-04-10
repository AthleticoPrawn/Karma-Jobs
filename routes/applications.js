'use strict';

const express = require('express');
const path = require('path');
const db = require('../db');
const { requireOwner } = require('../auth');

const router = express.Router();

router.get('/my-applications', requireOwner, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/my-applications.html'));
});

router.get('/api/my-applications', requireOwner, (req, res) => {
  const rows = db.prepare(`
    SELECT
      a.id AS application_id,
      a.status,
      a.applied_at,
      s.id AS slot_id,
      s.date,
      s.start_time,
      s.duration_minutes,
      s.notes
    FROM applications a
    JOIN slots s ON s.id = a.slot_id
    WHERE a.owner_id = ?
    ORDER BY s.date ASC, s.start_time ASC
  `).all(req.session.ownerId);

  res.json(rows);
});

module.exports = router;

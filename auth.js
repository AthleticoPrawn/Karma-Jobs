'use strict';

function requireOwner(req, res, next) {
  if (!req.session.ownerId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Login required' });
    }
    return res.redirect('/slots');
  }
  next();
}

function requireWalker(req, res, next) {
  if (!req.session.isWalker) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Walker login required' });
    }
    return res.redirect('/admin/login');
  }
  next();
}

module.exports = { requireOwner, requireWalker };

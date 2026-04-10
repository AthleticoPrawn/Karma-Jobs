'use strict';

const container = document.getElementById('applications-container');
const welcomeMsg = document.getElementById('welcome-msg');

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

async function init() {
  // Get owner name for welcome message
  const meRes = await fetch('/api/me');
  const me = await meRes.json();
  if (!me.isOwner) {
    window.location.href = '/login?next=/my-applications';
    return;
  }
  welcomeMsg.textContent = `Here are all the walk slots you've applied for, ${me.ownerName}.`;

  loadApplications();
}

async function loadApplications() {
  try {
    const res = await fetch('/api/my-applications');
    if (res.status === 401) { window.location.href = '/login?next=/my-applications'; return; }
    const apps = await res.json();
    renderApplications(apps);
  } catch {
    container.innerHTML = '<p class="error-text">Failed to load applications. Please refresh.</p>';
  }
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${display}:${m}${ampm}`;
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting decision', cls: 'badge-yellow' },
  confirmed: { label: 'Confirmed!',        cls: 'badge-green'  },
  declined:  { label: 'Not this time',     cls: 'badge-red'    }
};

function renderApplications(apps) {
  if (apps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>You haven't applied for any walks yet.</p>
        <a href="/slots" class="btn btn-primary">Browse available walks</a>
      </div>`;
    return;
  }

  const rows = apps.map(app => {
    const { label, cls } = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
    return `
      <div class="slot-card">
        <div class="slot-info">
          <div class="slot-datetime">
            <strong>${formatDate(app.date)}</strong>
            <span>${formatTime(app.start_time)} &bull; ${app.duration_minutes} min</span>
          </div>
          ${app.notes ? `<p class="slot-notes">${escHtml(app.notes)}</p>` : ''}
        </div>
        <div class="slot-action">
          <span class="badge ${cls}">${label}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="slot-list">${rows}</div>
    <p class="help-text">Decisions are made by the walkers — check back here to see your status.</p>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();

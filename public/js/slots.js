'use strict';

const slotsContainer = document.getElementById('slots-container');
const navArea = document.getElementById('nav-area');

// ── Check login state ────────────────────────────────────────────────────────

let currentUser = null;

async function init() {
  const res = await fetch('/api/me');
  currentUser = await res.json();

  if (currentUser.isOwner) {
    navArea.innerHTML = `
      <span class="nav-label">Hi, ${escHtml(currentUser.ownerName)}</span>
      <a href="/my-applications" class="btn btn-ghost btn-sm">My applications</a>
      <button id="logout-btn" class="btn btn-ghost btn-sm">Log out</button>`;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    });
  } else {
    navArea.innerHTML = `
      <a href="/login" class="btn btn-ghost btn-sm">Log in</a>
      <a href="/register" class="btn btn-primary btn-sm">Sign up</a>`;
  }

  loadSlots();
}

// ── Load and render slots ────────────────────────────────────────────────────

async function loadSlots() {
  try {
    const res = await fetch('/api/slots');
    const slots = await res.json();
    renderSlots(slots);
  } catch {
    slotsContainer.innerHTML = '<p class="error-text">Failed to load walks. Please refresh the page.</p>';
  }
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${display}:${m}${ampm}`;
}

function renderSlots(slots) {
  if (slots.length === 0) {
    slotsContainer.innerHTML = `
      <div class="empty-state">
        <p>No walks are available right now. Check back soon — we add new slots regularly!</p>
      </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  slots.forEach(slot => {
    if (!byDate[slot.date]) byDate[slot.date] = [];
    byDate[slot.date].push(slot);
  });

  const html = Object.entries(byDate).map(([date, daySlots]) => `
    <section class="day-group">
      <h2 class="day-heading">${formatDate(date)}</h2>
      ${daySlots.map(slot => renderSlotCard(slot)).join('')}
    </section>
  `).join('');

  slotsContainer.innerHTML = html;
}

function renderSlotCard(slot) {
  let actionHtml;

  if (!currentUser.isOwner) {
    actionHtml = `<a href="/login?next=/slots" class="btn btn-primary">Log in to apply</a>`;
  } else if (slot.already_applied) {
    actionHtml = `<span class="badge badge-yellow">Applied — awaiting decision</span>`;
  } else {
    actionHtml = `
      <button class="btn btn-primary apply-btn" data-slot-id="${slot.id}" data-slot-date="${escHtml(slot.date)}" data-slot-time="${escHtml(slot.start_time)}">
        Apply for this walk
      </button>`;
  }

  return `
    <div class="slot-card" id="slot-${slot.id}">
      <div class="slot-info">
        <div class="slot-datetime">
          <span class="slot-time-big">${formatTime(slot.start_time)}</span>
          <span class="slot-duration">${slot.duration_minutes} min walk</span>
        </div>
        ${slot.notes ? `<p class="slot-notes">${escHtml(slot.notes)}</p>` : ''}
      </div>
      <div class="slot-action" id="action-${slot.id}">
        ${actionHtml}
      </div>
    </div>`;
}

// ── Apply for a slot ─────────────────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.apply-btn');
  if (!btn) return;

  const slotId = btn.dataset.slotId;
  btn.disabled = true;
  btn.textContent = 'Applying…';

  try {
    const res = await fetch(`/api/slots/${slotId}/apply`, { method: 'POST' });
    const data = await res.json();
    const actionDiv = document.getElementById(`action-${slotId}`);

    if (res.ok) {
      actionDiv.innerHTML = `<span class="badge badge-green">Applied! We'll review all applicants and be in touch.</span>`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Apply for this walk';
      actionDiv.insertAdjacentHTML('beforeend', `<p class="error-text">${escHtml(data.error)}</p>`);
    }
  } catch {
    btn.disabled = false;
    btn.textContent = 'Apply for this walk';
  }
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();

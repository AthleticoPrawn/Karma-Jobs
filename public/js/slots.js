'use strict';

const slotsContainer = document.getElementById('slots-container');
const navArea = document.getElementById('nav-area');

let currentUser = null;

// ── Init ─────────────────────────────────────────────────────────────────────

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
  }

  loadSlots();
}

// ── Load and render slots ─────────────────────────────────────────────────────

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

  if (slot.already_applied) {
    actionHtml = `<span class="badge badge-yellow">Applied — awaiting decision</span>`;
  } else if (currentUser.isOwner) {
    actionHtml = `
      <button class="btn btn-primary apply-btn" data-slot-id="${slot.id}">
        Apply for this walk
      </button>`;
  } else {
    // Not yet identified — show the apply button, form appears on click
    actionHtml = `
      <button class="btn btn-primary apply-btn" data-slot-id="${slot.id}">
        Apply for this walk
      </button>`;
  }

  const timeDisplay = slot.end_time
    ? `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`
    : formatTime(slot.start_time);

  return `
    <div class="slot-card" id="slot-${slot.id}" data-start-time="${slot.start_time}" data-end-time="${slot.end_time || ''}">
      <div class="slot-info">
        <div class="slot-datetime">
          <span class="slot-time-big">${timeDisplay}</span>
          <span class="slot-duration">${slot.duration_minutes} min walk</span>
        </div>
        ${slot.notes ? `<p class="slot-notes">${escHtml(slot.notes)}</p>` : ''}
      </div>
      <div class="slot-action" id="action-${slot.id}">
        ${actionHtml}
      </div>
    </div>`;
}

// ── Apply / identify flow ─────────────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.apply-btn');
  if (!btn) return;

  const slotId = btn.dataset.slotId;

  // Always show the form — identified users just see a shorter version
  showIdentifyForm(slotId);
});

function showIdentifyForm(slotId) {
  const actionDiv = document.getElementById(`action-${slotId}`);
  const slotCard = document.getElementById(`slot-${slotId}`);
  const hasRange = slotCard.querySelector('.slot-time-big').textContent.includes('–');

  // Get the time range from the slot card to show in the prompt
  const timeRangeText = slotCard.querySelector('.slot-time-big').textContent.trim();

  const identityFields = currentUser.isOwner ? '' : `
    <input type="text"  name="name"     placeholder="Your name"       required autocomplete="name">
    <input type="tel"   name="phone"    placeholder="Phone number"    required autocomplete="tel">
    <input type="text"  name="dog_name" placeholder="Dog's name"      required>
    <input type="text"  name="address"  placeholder="Rough area (e.g. Chorlton, M21)" required>`;

  const introText = currentUser.isOwner
    ? (hasRange ? `What time works best for you within the ${timeRangeText} window?` : 'Confirm your application:')
    : 'Just a few details so we know whose dog we\'re walking:';

  actionDiv.innerHTML = `
    <form class="identify-form" data-slot-id="${slotId}" novalidate>
      <p class="identify-intro">${introText}</p>
      <div class="identify-fields">
        ${identityFields}
        ${hasRange ? `<input type="time" name="proposed_time" required min="${slotCard.dataset.startTime}" max="${slotCard.dataset.endTime}">
        <small class="identify-time-hint">Your preferred start time</small>` : ''}
      </div>
      <div class="identify-error hidden"></div>
      <div class="identify-actions">
        <button type="submit" class="btn btn-primary">Apply</button>
        <button type="button" class="btn btn-ghost cancel-identify-btn">Cancel</button>
      </div>
    </form>`;
}

// Cancel — restore the apply button
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cancel-identify-btn')) return;
  const form = e.target.closest('.identify-form');
  const slotId = form.dataset.slotId;
  document.getElementById(`action-${slotId}`).innerHTML = `
    <button class="btn btn-primary apply-btn" data-slot-id="${slotId}">
      Apply for this walk
    </button>`;
});

// Submit identify form → identify → apply
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.identify-form');
  if (!form) return;
  e.preventDefault();

  const slotId = form.dataset.slotId;
  const errorDiv = form.querySelector('.identify-error');
  const submitBtn = form.querySelector('[type="submit"]');

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Applying…';

  const proposedTimeEl = form.querySelector('[name="proposed_time"]');
  const proposedTime = proposedTimeEl ? proposedTimeEl.value : null;

  try {
    if (!currentUser.isOwner) {
      // Step 1: identify (new or returning visitor)
      const payload = {
        name:     form.querySelector('[name="name"]').value.trim(),
        phone:    form.querySelector('[name="phone"]').value.trim(),
        dog_name: form.querySelector('[name="dog_name"]').value.trim(),
        address:  form.querySelector('[name="address"]').value.trim()
      };

      const idRes = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const idData = await idRes.json();

      if (!idRes.ok) {
        errorDiv.textContent = idData.error || 'Something went wrong';
        errorDiv.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply';
        return;
      }

      // Update local state so other apply buttons work without re-identifying
      currentUser.isOwner = true;
      currentUser.ownerName = payload.name;
      navArea.innerHTML = `
        <span class="nav-label">Hi, ${escHtml(payload.name)}</span>
        <a href="/my-applications" class="btn btn-ghost btn-sm">My applications</a>
        <button id="logout-btn" class="btn btn-ghost btn-sm">Log out</button>`;
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
      });
    }

    // Step 2: apply (with optional proposed time)
    await doApply(slotId, proposedTime);
  } catch {
    errorDiv.textContent = 'Network error — please try again';
    errorDiv.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Apply';
  }
});

async function doApply(slotId, proposedTime) {
  const actionDiv = document.getElementById(`action-${slotId}`);
  actionDiv.innerHTML = `<span class="badge badge-yellow">Applying…</span>`;

  try {
    const res = await fetch(`/api/slots/${slotId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposed_time: proposedTime || null })
    });
    const data = await res.json();

    if (res.ok) {
      actionDiv.innerHTML = `<span class="badge badge-green">Applied! We'll review all applicants and be in touch.</span>`;
    } else {
      actionDiv.innerHTML = `
        <p class="error-text">${escHtml(data.error)}</p>`;
    }
  } catch {
    actionDiv.innerHTML = `<p class="error-text">Network error — please refresh and try again.</p>`;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();

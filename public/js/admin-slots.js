'use strict';

const slotsContainer = document.getElementById('slots-container');
const slotFormWrap = document.getElementById('slot-form-wrap');
const slotForm = document.getElementById('slot-form');
const slotFormTitle = document.getElementById('slot-form-title');
const slotFormSubmit = document.getElementById('slot-form-submit');
const slotFormError = document.getElementById('slot-form-error');
const editSlotId = document.getElementById('edit-slot-id');

// ── Logout ──────────────────────────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
});

// ── Toggle new slot form ────────────────────────────────────────────────────

document.getElementById('new-slot-btn').addEventListener('click', () => {
  slotFormTitle.textContent = 'New slot';
  slotFormSubmit.textContent = 'Create slot';
  editSlotId.value = '';
  slotForm.reset();
  slotFormError.classList.add('hidden');
  slotFormWrap.classList.remove('hidden');
  document.getElementById('slot-date').focus();
});

document.getElementById('slot-form-cancel').addEventListener('click', () => {
  slotFormWrap.classList.add('hidden');
});

// ── Submit slot form (create or update) ─────────────────────────────────────

slotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  slotFormError.classList.add('hidden');

  const id = editSlotId.value;
  const payload = {
    date: document.getElementById('slot-date').value,
    start_time: document.getElementById('slot-time').value,
    end_time: document.getElementById('slot-end-time').value || null,
    duration_minutes: document.getElementById('slot-duration').value,
    notes: document.getElementById('slot-notes').value.trim()
  };

  const url = id ? `/admin/api/slots/${id}` : '/admin/api/slots';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      slotFormError.textContent = data.error || 'Failed to save slot';
      slotFormError.classList.remove('hidden');
      return;
    }
    slotFormWrap.classList.add('hidden');
    slotForm.reset();
    loadSlots();
  } catch {
    slotFormError.textContent = 'Network error — please try again';
    slotFormError.classList.remove('hidden');
  }
});

// ── Load and render slots ───────────────────────────────────────────────────

async function loadSlots() {
  try {
    const res = await fetch('/admin/api/slots');
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    const slots = await res.json();
    renderSlots(slots);
  } catch {
    slotsContainer.innerHTML = '<p class="error-text">Failed to load slots.</p>';
  }
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${display}:${m}${ampm}`;
}

function formatTimeRange(start, end) {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

function renderSlots(slots) {
  if (slots.length === 0) {
    slotsContainer.innerHTML = `
      <div class="empty-state">
        <p>No slots yet. Click <strong>+ New slot</strong> to add your first available walk time.</p>
      </div>`;
    return;
  }

  const html = `
    <div class="slot-list">
      ${slots.map(slot => {
        const isFilled = slot.confirmed_count > 0;
        return `
        <div class="slot-card ${isFilled ? 'slot-filled' : ''}">
          <div class="slot-info">
            <div class="slot-datetime">
              <strong>${formatDate(slot.date)}</strong>
              <span>${formatTimeRange(slot.start_time, slot.end_time)} &bull; ${slot.duration_minutes} min walk</span>
            </div>
            ${slot.notes ? `<div class="slot-notes">${escHtml(slot.notes)}</div>` : ''}
          </div>
          <div class="slot-meta">
            <a href="/admin/applicants?slot=${slot.id}" class="badge ${
              isFilled ? 'badge-green' :
              slot.application_count > 0 ? 'badge-yellow' : 'badge-grey'
            }">
              ${isFilled ? 'Filled' : slot.application_count + ' applicant' + (slot.application_count !== 1 ? 's' : '')}
            </a>
          </div>
          <div class="slot-actions">
            <button class="btn btn-ghost btn-sm" onclick="editSlot(${slot.id}, '${slot.date}', '${slot.start_time}', '${slot.end_time || ''}', ${slot.duration_minutes}, ${JSON.stringify(escHtml(slot.notes || ''))})">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="cloneSlot('${slot.date}', '${slot.start_time}', '${slot.end_time || ''}', ${slot.duration_minutes}, ${JSON.stringify(escHtml(slot.notes || ''))})">Clone</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSlot(${slot.id})">Delete</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  slotsContainer.innerHTML = html;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Edit slot ───────────────────────────────────────────────────────────────

window.editSlot = function(id, date, startTime, endTime, duration, notes) {
  slotFormTitle.textContent = 'Edit slot';
  slotFormSubmit.textContent = 'Save changes';
  editSlotId.value = id;
  document.getElementById('slot-date').value = date;
  document.getElementById('slot-time').value = startTime;
  document.getElementById('slot-end-time').value = endTime;
  document.getElementById('slot-duration').value = duration;
  document.getElementById('slot-notes').value = notes;
  slotFormError.classList.add('hidden');
  slotFormWrap.classList.remove('hidden');
  slotFormWrap.scrollIntoView({ behavior: 'smooth' });
};

// ── Clone slot ──────────────────────────────────────────────────────────────

window.cloneSlot = function(date, startTime, endTime, duration, notes) {
  slotFormTitle.textContent = 'New slot (cloned)';
  slotFormSubmit.textContent = 'Create slot';
  editSlotId.value = ''; // no ID = create new
  document.getElementById('slot-date').value = date;
  document.getElementById('slot-time').value = startTime;
  document.getElementById('slot-end-time').value = endTime;
  document.getElementById('slot-duration').value = duration;
  document.getElementById('slot-notes').value = notes;
  slotFormError.classList.add('hidden');
  slotFormWrap.classList.remove('hidden');
  document.getElementById('slot-date').focus();
  slotFormWrap.scrollIntoView({ behavior: 'smooth' });
};

// ── Delete slot ─────────────────────────────────────────────────────────────

window.deleteSlot = async function(id) {
  if (!confirm('Delete this slot? Any pending applications will also be removed.')) return;
  const res = await fetch(`/admin/api/slots/${id}`, { method: 'DELETE' });
  if (res.ok) {
    loadSlots();
  } else {
    alert('Failed to delete slot');
  }
};

// ── Init ─────────────────────────────────────────────────────────────────────

loadSlots();

'use strict';

const slotDetail = document.getElementById('slot-detail');
const applicantsContainer = document.getElementById('applicants-container');
const slotId = new URLSearchParams(window.location.search).get('slot');

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
});

if (!slotId) {
  applicantsContainer.innerHTML = '<p class="error-text">No slot selected. <a href="/admin/">Go back to slots.</a></p>';
} else {
  loadApplicants();
}

async function loadApplicants() {
  try {
    const res = await fetch(`/admin/api/slots/${slotId}/applicants`);
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    if (!res.ok) {
      applicantsContainer.innerHTML = '<p class="error-text">Failed to load applicants.</p>';
      return;
    }
    const { slot, applicants } = await res.json();
    renderSlotHeader(slot);
    renderApplicants(slot, applicants);
  } catch {
    applicantsContainer.innerHTML = '<p class="error-text">Network error — please refresh.</p>';
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

function renderSlotHeader(slot) {
  const isFilled = slot.confirmed_count > 0;
  slotDetail.innerHTML = `
    <div class="slot-datetime">
      <strong>${formatDate(slot.date)}</strong>
      <span>${formatTime(slot.start_time)} &bull; ${slot.duration_minutes} min</span>
    </div>
    ${slot.notes ? `<p class="slot-notes">${escHtml(slot.notes)}</p>` : ''}
  `;
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',    cls: 'badge-yellow' },
  confirmed: { label: 'Confirmed',  cls: 'badge-green'  },
  declined:  { label: 'Not selected', cls: 'badge-red'  }
};

function renderApplicants(slot, applicants) {
  if (applicants.length === 0) {
    applicantsContainer.innerHTML = `
      <div class="empty-state">
        <p>No one has applied for this slot yet.</p>
      </div>`;
    return;
  }

  const hasConfirmed = applicants.some(a => a.status === 'confirmed');

  const cards = applicants.map(app => {
    const { label, cls } = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
    const canConfirm = !hasConfirmed && app.status === 'pending';

    return `
      <div class="applicant-card" id="app-${app.application_id}">
        <div class="applicant-info">
          <div class="applicant-name">
            <strong>${escHtml(app.name)}</strong>
            <span class="badge ${cls}">${label}</span>
          </div>
          <div class="applicant-details">
            <span>🐶 ${escHtml(app.dog_name)}</span>
            <span>📍 ${escHtml(app.address)}</span>
            <span>📞 <a href="tel:${escHtml(app.phone)}">${escHtml(app.phone)}</a></span>
          </div>
          <div class="applicant-meta">Applied: ${new Date(app.applied_at).toLocaleString('en-GB')}</div>
        </div>
        <div class="applicant-action" id="app-action-${app.application_id}">
          ${canConfirm
            ? `<button class="btn btn-primary confirm-btn" data-app-id="${app.application_id}">Confirm this walk</button>`
            : app.status === 'confirmed'
              ? `<button class="btn btn-ghost btn-sm unconfirm-btn">Undo confirm</button>`
              : ''
          }
        </div>
      </div>`;
  }).join('');

  applicantsContainer.innerHTML = `<div class="applicant-list">${cards}</div>`;

  // Bind confirm buttons
  applicantsContainer.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmApplicant(btn.dataset.appId));
  });

  // Bind unconfirm button
  applicantsContainer.querySelectorAll('.unconfirm-btn').forEach(btn => {
    btn.addEventListener('click', () => unconfirmSlot());
  });
}

async function confirmApplicant(appId) {
  if (!confirm('Confirm this applicant? All other applicants will be marked as not selected.')) return;

  const res = await fetch(`/admin/api/slots/${slotId}/confirm/${appId}`, { method: 'POST' });
  if (res.ok) {
    loadApplicants();
  } else {
    alert('Failed to confirm applicant');
  }
}

async function unconfirmSlot() {
  if (!confirm('Reset this slot back to pending? All applicants will go back to "pending" status.')) return;
  const res = await fetch(`/admin/api/slots/${slotId}/unconfirm`, { method: 'POST' });
  if (res.ok) {
    loadApplicants();
  } else {
    alert('Failed to reset slot');
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

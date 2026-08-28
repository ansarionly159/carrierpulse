let tier = 'free';

const freeBtn = document.getElementById('freeBtn');
const paidBtn = document.getElementById('paidBtn');
const form = document.getElementById('searchForm');
const singleField = document.getElementById('singleField');
const startField = document.getElementById('startField');
const endField = document.getElementById('endField');
const resultsBody = document.getElementById('resultsBody');
const resultCount = document.getElementById('resultCount');
const upgradeOverlay = document.getElementById('upgradeOverlay');
const exportBtn = document.getElementById('exportBtn');
const switchToPaidBtn = document.getElementById('switchToPaidBtn');

function setTier(t) {
  tier = t;
  freeBtn.classList.toggle('active', t === 'free');
  paidBtn.classList.toggle('active', t === 'paid');
  runSearch();
}
freeBtn.addEventListener('click', () => setTier('free'));
paidBtn.addEventListener('click', () => setTier('paid'));
switchToPaidBtn.addEventListener('click', () => setTier('paid'));

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', e => {
    const isRange = e.target.value === 'range';
    singleField.classList.toggle('hidden', isRange);
    startField.classList.toggle('hidden', !isRange);
    endField.classList.toggle('hidden', !isRange);
  });
});

function currentParams() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const params = new URLSearchParams({ tier });
  if (mode === 'single') {
    params.set('date', document.getElementById('date').value);
  } else {
    params.set('start', document.getElementById('start').value);
    params.set('end', document.getElementById('end').value);
  }
  return params;
}

async function runSearch() {
  const params = currentParams();
  const res = await fetch(`/api/carriers?${params.toString()}`);
  const data = await res.json();
  render(data);
}

function render(data) {
  resultCount.textContent = `${data.count} carrier${data.count === 1 ? '' : 's'} found`;
  resultsBody.innerHTML = data.results.map(r => `
    <tr class="${r.locked ? 'locked' : ''}">
      <td>${r.company_name}</td>
      <td>${r.phone}</td>
      <td>${r.dot_number}</td>
      <td>${r.mc_number}</td>
      <td>${r.city}, ${r.state}</td>
      <td class="${r.status === 'Active' ? 'status-active' : 'status-pending'}">${r.status}</td>
      <td>${r.equipment_count}</td>
      <td>${r.registration_date}</td>
    </tr>
  `).join('');

  const hasLocked = data.results.some(r => r.locked);
  upgradeOverlay.classList.toggle('hidden', !hasLocked);
  exportBtn.disabled = tier !== 'paid';
}

form.addEventListener('submit', e => {
  e.preventDefault();
  runSearch();
});

exportBtn.addEventListener('click', () => {
  const params = currentParams();
  window.location.href = `/api/export?${params.toString()}`;
});

runSearch();
const redeemBtn = document.getElementById('redeemBtn');
const codeInput = document.getElementById('codeInput');
const redeemMsg = document.getElementById('redeemMsg');

redeemBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (!code) return;
  redeemMsg.textContent = 'Checking...';
  const res = await fetch(`/api/redeem?code=${encodeURIComponent(code)}`);
  const data = await res.json();
  if (data.valid) {
    localStorage.setItem('cp_paid_code', code);
    redeemMsg.textContent = 'Unlocked! ✅';
    setTier('paid');
  } else {
    redeemMsg.textContent = 'Ye code sahi nahi hai.';
  }
});

const savedCode = localStorage.getItem('cp_paid_code');
if (savedCode) {
  fetch(`/api/redeem?code=${encodeURIComponent(savedCode)}`)
    .then(res => res.json())
    .then(data => { if (data.valid) setTier('paid'); });
}

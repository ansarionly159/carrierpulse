// Dotmanifest frontend — search, account (login/signup), export.

let currentTier = 'free';
let authToken = localStorage.getItem('dm_token') || '';
let showingSignup = false;

const form = document.getElementById('searchForm');
const singleField = document.getElementById('singleField');
const startField = document.getElementById('startField');
const endField = document.getElementById('endField');
const resultsBody = document.getElementById('resultsBody');
const resultCount = document.getElementById('resultCount');
const upgradeOverlay = document.getElementById('upgradeOverlay');
const exportBtn = document.getElementById('exportBtn');

const accountStatus = document.getElementById('accountStatus');
const openAuthBtn = document.getElementById('openAuthBtn');
const openAuthBtn2 = document.getElementById('openAuthBtn2');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

function openAuth() { authModal.classList.remove('hidden'); }
function closeAuth() { authModal.classList.add('hidden'); }
openAuthBtn.addEventListener('click', openAuth);
if (openAuthBtn2) openAuthBtn2.addEventListener('click', openAuth);
closeAuthBtn.addEventListener('click', closeAuth);

showLoginBtn.addEventListener('click', () => {
  showingSignup = false;
  showLoginBtn.classList.add('active');
  showSignupBtn.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
});
showSignupBtn.addEventListener('click', () => {
  showingSignup = true;
  showSignupBtn.classList.add('active');
  showLoginBtn.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  signupError.textContent = '';
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) { signupError.textContent = data.error; return; }
  authToken = data.token;
  localStorage.setItem('dm_token', authToken);
  closeAuth();
  refreshAccountStatus();
  runSearch();
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) { loginError.textContent = data.error; return; }
  authToken = data.token;
  localStorage.setItem('dm_token', authToken);
  closeAuth();
  refreshAccountStatus();
  runSearch();
});

logoutBtn.addEventListener('click', () => {
  authToken = '';
  localStorage.removeItem('dm_token');
  refreshAccountStatus();
  runSearch();
});

async function refreshAccountStatus() {
  if (!authToken) {
    currentTier = 'free';
    accountStatus.textContent = 'Not logged in';
    openAuthBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }
  const res = await fetch(`/api/me?token=${encodeURIComponent(authToken)}`);
  const data = await res.json();
  currentTier = data.tier;
  accountStatus.textContent = currentTier === 'paid' ? 'Premium account' : 'Free account';
  openAuthBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
}

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
  const params = new URLSearchParams();
  if (authToken) params.set('token', authToken);
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
  currentTier = data.tier;
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
  exportBtn.disabled = currentTier !== 'paid';
}

form.addEventListener('submit', e => {
  e.preventDefault();
  runSearch();
});

exportBtn.addEventListener('click', () => {
  const params = currentParams();
  window.location.href = `/api/export?${params.toString()}`;
});

refreshAccountStatus().then(runSearch);

const lookupBtn = document.getElementById('lookupBtn');
const lookupResult = document.getElementById('lookupResult');
lookupBtn.addEventListener('click', async () => {
  const type = document.getElementById('lookupType').value;
  const value = document.getElementById('lookupValue').value.trim();
  if (!value) {
    lookupResult.innerHTML = '<p class="auth-error">Pehle kuch likhein.</p>';
    return;
  }
  lookupResult.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">Searching...</p>';
  const params = new URLSearchParams({ type, value, token: authToken });
  const res = await fetch(`/api/lookup?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    lookupResult.innerHTML = `<p class="auth-error">${data.error}</p>`;
    return;
  }
  const docParams = new URLSearchParams({
    name: data.legal_name, dot: data.dot_number, mc: data.mc_number,
    address: data.physical_address, status: data.status
  });

  const field = (label, value) => `
    <div>
      <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:3px;">${label}</div>
      <div style="font-size:0.92rem; color:var(--text); font-weight:500;">${value || '—'}</div>
    </div>
  `;

  const cargoTags = (data.cargo || []).map(c =>
    `<span style="display:inline-block; background:var(--panel); border:1px solid var(--border); border-radius:20px; padding:5px 14px; font-size:0.8rem; margin:0 6px 6px 0;">${c}</span>`
  ).join('') || '<span style="color:var(--muted); font-size:0.85rem;">Not reported</span>';

  lookupResult.innerHTML = `
    <div style="background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:24px; box-shadow:0 2px 10px rgba(236,143,178,0.1);">
      <div style="margin-bottom:6px;">
        <strong style="color:var(--blue); font-size:1.15rem;">${data.legal_name}</strong>
        ${data.dba_name ? `<span style="color:var(--muted); font-size:0.9rem;"> (DBA: ${data.dba_name})</span>` : ''}
      </div>

      <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:var(--blue); margin:20px 0 10px; border-bottom:1px solid var(--border); padding-bottom:6px;">Identifiers &amp; Classification</div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:8px;">
        ${field('USDOT', data.dot_number)}
        ${field('MC Docket', data.mc_number)}
        ${field('Status', `<span class="${data.status === 'Active' ? 'status-active' : 'status-pending'}">${data.status}</span>`)}
        ${field('Operation Class', data.operation_class)}
        ${field('Carrier Operation', data.carrier_operation)}
        ${field('Business Org', data.business_org)}
        ${field('MCS-150 Date', data.mcs150_date)}
        ${field('Reported Since (FMCSA)', data.add_date)}
        ${field('Reported Mileage', data.reported_mileage)}
      </div>

      <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:var(--blue); margin:20px 0 10px; border-bottom:1px solid var(--border); padding-bottom:6px;">Cargo</div>
      <div style="margin-bottom:8px;">${cargoTags}</div>

      <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:var(--blue); margin:20px 0 10px; border-bottom:1px solid var(--border); padding-bottom:6px;">Contact Information</div>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
        ${field('Primary Officer', data.primary_officer)}
        ${field('Email', data.email)}
        ${field('Phone', data.phone)}
        ${field('Physical Address', data.physical_address)}
        ${field('Mailing Address', data.mailing_address || 'Same as physical')}
        ${field('Power Units', data.power_units)}
      </div>

      <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
        <a href="/mc-letter.html?${docParams.toString()}" target="_blank" class="export-btn" style="text-decoration:none; display:inline-block;">MC Authority Letter</a>
        <a href="/w9-template.html?${docParams.toString()}" target="_blank" class="export-btn" style="text-decoration:none; display:inline-block;">W-9 Template</a>
      </div>
    </div>
  `;
});

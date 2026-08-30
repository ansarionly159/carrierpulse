// fetch-fmcsa-data.js
// Pulls newly-authorized carriers from FMCSA's official Socrata open-data API.
// Run this once a day (via a cron job on your host) — needs internet access,
// so it can't run inside a sandbox. Activate after deploying (see README.md).
//
// Data source: "Motus Carrier" dataset (id: nakq-58th) — a DAILY DIFFERENCE
// file. Each day FMCSA republishes this dataset containing only the carriers
// that were newly authorized or changed in the last 24 hours. There is no
// date column inside the file — the file itself IS "today's new carriers".
// Updated daily around 9:30 AM Eastern Time.
//
// Because of this, our own database builds up history day by day: every time
// this script runs, we tag whatever rows come back with TODAY's date and
// store them. We cannot retroactively get carriers from before we started
// running this script daily — FMCSA does not keep a historical date field.
//
// Confirmed column names (from the dataset's own documentation):
//   usdot_number, docket_number, legal_name, bus_city, bus_state_code,
//   bus_telno, op_auth_status

const https = require('https');
const fs = require('fs');
const path = require('path');

const MOTUS_CARRIER_DATASET_ID = 'nakq-58th';
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN || ''; // optional, raises rate limit

function socrataGet(datasetId) {
  return new Promise((resolve, reject) => {
    let url = `https://data.transportation.gov/resource/${datasetId}.json?$limit=50000`;
    if (SOCRATA_APP_TOKEN) url += `&$$app_token=${SOCRATA_APP_TOKEN}`;
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Could not parse response: ' + data.slice(0, 300)));
        }
      });
    }).on('error', reject);
  });
}

async function run(targetDate) {
  console.log(`Fetching today's Motus Carrier daily-difference file...`);
  const rows = await socrataGet(MOTUS_CARRIER_DATASET_ID);
  console.log(`Found ${rows.length} records`);

  const mapped = rows.map(r => ({
    company_name: r.legal_name || 'Unknown',
    phone: r.bus_telno || '',
    dot_number: r.usdot_number || '',
    mc_number: r.docket_number || '',
    city: r.bus_city || '',
    state: r.bus_state_code || '',
    status: (r.op_auth_status || '').toUpperCase().includes('ACTIVE') ? 'Active' : 'Pending',
    equipment_count: r.total_power_units || 0,
    registration_date: targetDate
  }));

  const outFile = path.join(__dirname, 'data', 'carriers.json');
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile)) : [];
  const merged = [...existing.filter(c => c.registration_date !== targetDate), ...mapped];
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`Saved ${mapped.length} carriers for ${targetDate}`);
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
run(today).catch(err => console.error('Fetch failed:', err.message));

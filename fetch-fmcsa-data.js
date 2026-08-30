// fetch-fmcsa-data.js
// Pulls newly-authorized carriers from FMCSA's official Socrata open-data API.
// Runs on your LIVE server (via a daily cron job) — needs internet access,
// so it can't run inside a sandbox. Activate after deploying (see README.md).
//
// Data source: "Motus Carrier" dataset — FMCSA's official daily delta file of
// newly authorized / changed carrier entities.
// Dataset page: https://data.transportation.gov/Trucking-and-Motorcoaches/Motus-Carrier/nakq-58th/about_data
// Updated daily at 9:30 AM Eastern Time.
//
// IMPORTANT — before this will work, you must confirm the exact column names:
// 1. Open the dataset page above in your browser
// 2. Click the "API" button (usually top-right) to see the field names
// 3. Look for the date field (something like OP_AUTH_STAT_CHANGE_DATE) and
//    replace DATE_FIELD, DOT_FIELD, NAME_FIELD, etc. below to match exactly.
//
// The API endpoint pattern (Socrata SODA API) for any dataset ID is:
//   https://data.transportation.gov/resource/<DATASET_ID>.json?$where=...
// No API key is required for reasonable usage, but a free Socrata app token
// raises your rate limit.

const https = require('https');
const fs = require('fs');
const path = require('path');

const MOTUS_CARRIER_DATASET_ID = 'nakq-58th';
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN || '';

const DATE_FIELD = 'op_auth_stat_change_date';
const DOT_FIELD = 'usdot_number';
const NAME_FIELD = 'legal_name';
const CITY_FIELD = 'phy_city';
const STATE_FIELD = 'phy_state';
const PHONE_FIELD = 'telephone';
const STATUS_FIELD = 'op_auth_status';
const MC_FIELD = 'docket_number';

function socrataGet(datasetId, whereClause) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(whereClause);
    let url = `https://data.transportation.gov/resource/${datasetId}.json?$where=${query}&$limit=5000`;
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
  const where = `${DATE_FIELD} between '${targetDate}T00:00:00' and '${targetDate}T23:59:59'`;
  console.log(`Querying Motus Carrier dataset for ${targetDate}...`);
  const rows = await socrataGet(MOTUS_CARRIER_DATASET_ID, where);
  console.log(`Found ${rows.length} records`);

  const mapped = rows.map(r => ({
    company_name: r[NAME_FIELD] || 'Unknown',
    phone: r[PHONE_FIELD] || '',
    dot_number: r[DOT_FIELD] || '',
    mc_number: r[MC_FIELD] || '',
    city: r[CITY_FIELD] || '',
    state: r[STATE_FIELD] || '',
    status: (r[STATUS_FIELD] || '').toUpperCase().includes('ACTIVE') ? 'Active' : 'Pending',
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

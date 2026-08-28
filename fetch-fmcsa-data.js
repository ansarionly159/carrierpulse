// fetch-fmcsa-data.js
// This is the script you'll run once a day (via cron / GitHub Actions) on your
// LIVE server to pull real FMCSA data. It needs internet access, so it will
// NOT run inside this sandbox — activate it after you deploy (see README.md).
//
// Two official, free FMCSA data sources are used together:
//
// 1) QCMobile API — real-time, per-carrier lookup (phone, address, status).
//    Free API key: register at https://mobile.fmcsa.dot.gov/QCDevsite/home
//
// 2) FMCSA Open Data / Census file — bulk file with ALL carriers + their
//    registration ("MCS-150" / add) date. This is how you find WHICH carriers
//    are new on a given day. Source: https://ai.fmcsa.dot.gov (Data.gov / DOT
//    Open Data Portal). File is updated by FMCSA periodically (historically
//    weekly, not real-time) — confirm current refresh cadence when you fetch it,
//    since a "new carrier today" list is only as fresh as FMCSA's own file.
//
// IMPORTANT — be upfront with buyers about two real limits:
//  a) Email address is NOT part of FMCSA's public data. Only phone + mailing
//     address are published. If you advertise "email address" as a field,
//     you'll need a separate enrichment source (e.g. company website lookup)
//     — don't promise data FMCSA doesn't provide.
//  b) FMCSA's own file refresh cadence controls how "daily" your data really
//     is. If FMCSA only republishes weekly, your app can only be as fresh as
//     that, no matter how often your cron job runs. Check the current cadence
//     at https://ai.fmcsa.dot.gov before promising "daily" to customers.

const https = require('https');
const fs = require('fs');
const path = require('path');

const QCMOBILE_API_KEY = process.env.FMCSA_API_KEY || 'PUT_YOUR_FREE_KEY_HERE';
const CENSUS_FILE_URL = 'https://ai.fmcsa.dot.gov/SMS/files/SMS_Company_Census.csv'; // verify exact URL on the portal — FMCSA occasionally renames these

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.filter(Boolean).map(line => {
    const cols = line.split(','); // for production, use a proper CSV parser (fields can contain commas/quotes)
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}

async function lookupCarrierDetails(dotNumber) {
  // Example QCMobile call — check current docs for the exact path/params,
  // FMCSA has changed this endpoint shape before.
  const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${QCMOBILE_API_KEY}`;
  const raw = await httpGet(url);
  return JSON.parse(raw);
}

async function run(targetDate) {
  console.log(`Fetching FMCSA census file...`);
  const csvText = await httpGet(CENSUS_FILE_URL);
  const rows = parseCSV(csvText);

  // Filter to carriers whose registration/add date matches the target date.
  // Confirm the exact column name in the file you download — it has been
  // called ADD_DATE / MCS150_DATE in different FMCSA exports.
  const newToday = rows.filter(r => r.ADD_DATE === targetDate);

  console.log(`Found ${newToday.length} carriers registered on ${targetDate}`);

  const enriched = [];
  for (const carrier of newToday) {
    try {
      const details = await lookupCarrierDetails(carrier.DOT_NUMBER);
      enriched.push({
        company_name: carrier.LEGAL_NAME,
        phone: details?.content?.carrier?.phone || '',
        dot_number: carrier.DOT_NUMBER,
        mc_number: carrier.MC_NUMBER || '',
        city: carrier.PHY_CITY,
        state: carrier.PHY_STATE,
        status: carrier.AUTHORIZED_FOR_HIRE === 'Y' ? 'Active' : 'Pending',
        equipment_count: carrier.TOTAL_POWER_UNITS || 0,
        registration_date: carrier.ADD_DATE
      });
    } catch (e) {
      console.warn(`Could not enrich DOT ${carrier.DOT_NUMBER}:`, e.message);
    }
  }

  const outFile = path.join(__dirname, 'data', 'carriers.json');
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile)) : [];
  const merged = [...existing.filter(c => c.registration_date !== targetDate), ...enriched];
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`Saved ${enriched.length} carriers for ${targetDate}`);
}

// Run for "today" in US Eastern time when executed by the daily cron job.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
run(today).catch(err => console.error('Fetch failed:', err));

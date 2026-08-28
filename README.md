# CarrierPulse — Setup Guide (Roman Urdu)

Ye folder aapki website ka poora working code hai. Neeche step-by-step batayein
gaya hai ke ise apni asli, live, paid website kaise banayein.

## 1. Abhi apne computer par test karein (2 minute)

Node.js already installed honi chahiye (nodejs.org se free download).

```
cd carrierpulse
node server.js
```

Phir browser mein `http://localhost:3000` kholein. "Free" aur "Premium" button
switch karke dekhein — blur effect aur export lock kaam karta dikhega.

Iske liye koi `npm install` ki zaroorat nahi — maine jaan boojh kar sirf
built-in Node.js se banaya hai taake foran chal jaye.

## 2. Real FMCSA data connect karna

- Free API key yahan se lein: https://mobile.fmcsa.dot.gov/QCDevsite/home
  (Login.gov account chahiye hoga — free hai)
- Bulk "new carriers by date" list ke liye FMCSA ka Open Data / Census file
  use hoga: https://ai.fmcsa.dot.gov
- `fetch-fmcsa-data.js` file mein poora template hai — bas API key daal kar
  aur file ka exact URL/column names confirm kar ke activate kar dein.

**2 zaroori sacchai jo customers ko pehle se batani chahiye:**
1. **Email address FMCSA nahi deta.** Sirf phone number aur mailing address
   public data hai. Agar aap "email" bechna chahte hain to alag se koi
   enrichment source (company website lookup) lagana hoga.
2. **"Daily" update FMCSA ke apne update cycle par depend karta hai.** Agar
   FMCSA apni file hafte mein ek baar update karta hai, to aapki app bhi
   utni hi "fresh" hogi, chahe aapka cron job roz chale. Ye limitation
   marketing mein overpromise na karein.

## 3. Hosting (website ko live karna)

Kisi bhi ek ko choose karein (dono ke paas free tier hai):

- **Render.com** — sabse aasan, GitHub se connect karke ek click deploy
- **Railway.app** — bhi bohot simple, free credit milta hai

Steps (Render ka example):
1. Ye code GitHub repository mein upload karein
2. Render.com par account banayein → "New Web Service" → apni repo select karein
3. Start command: `node server.js`
4. Deploy dabayein — 2-3 minute mein live ho jayega

## 4. Domain lena

- Namecheap ya GoDaddy se domain khareedein (~$8-12/year, e.g. carrierpulse.com)
- Render/Railway ke dashboard mein "Custom Domain" add kar ke DNS records
  domain provider ke panel mein daal dein (dono step-by-step guide dete hain)

## 5. Daily automatic update (cron job)

Render/Railway dono par "Cron Job" / "Scheduled Job" feature hota hai — wahan
`node fetch-fmcsa-data.js` ko daily US Eastern time (jaise 6:00 AM ET) par
chalne ke liye set kar dein. Alternative: GitHub Actions ka free scheduled
workflow bhi use ho sakta hai agar hosting provider mein cron na ho.

## 6. Payment gateway (subscriptions charge karna)

Pakistan se seedha Stripe account open karna mushkil hai, is liye best options:

- **Lemon Squeezy** (recommended) — "Merchant of Record" hai, matlab wo khud
  tax/compliance handle karte hain, aur Pakistan-based sellers ko allow karte
  hain. Cards + PayPal dono support karta hai. Checkout link banayein
  ($10/year aur $30/lifetime ke do products), aur webhook se apni app ko
  batayein ke customer ne pay kar diya (tab uska account "paid" mark ho jaye).
- **Paddle** — Lemon Squeezy jesa hi, alternative option.
- **Gumroad** — sabse simple, lekin fees thodi zyada.

Is demo mein tier switch abhi ek button se ho raha hai (sirf demo dikhane ke
liye). Real app mein:
1. User signup/login banayein (email + password ya Google login)
2. Jab Lemon Squeezy webhook "payment successful" bheje, us user ke record
   mein `paid: true` set kar dein (database mein)
3. `/api/carriers` aur `/api/export` endpoints mein `tier` query ki jagah
   logged-in user ka asli paid status check karein

## 7. Database upgrade (jab users badh jayein)

Abhi data ek simple `carriers.json` file mein hai — testing ke liye theek hai.
Live launch se pehle free-tier database istemal karein:
- **Supabase** (Postgres, free tier, sabse popular)
- **Neon** (Postgres, free tier)

## Folder structure

```
carrierpulse/
  server.js              → backend (API + static files serve karta hai)
  fetch-fmcsa-data.js     → daily FMCSA data pull (production mein activate karein)
  data/carriers.json      → sample/demo data (real data isi jagah replace hoga)
  public/
    index.html            → page structure
    style.css             → design
    app.js                → frontend logic (search, blur, export)
```

## Kya AI tools is poore kaam mein madad karenge?

- **Claude Code / Claude in Chrome** — agar aap khud future mein features
  add/edit karna chahein (bina developer hire kiye), to mujhse (Claude) hi
  seedha code changes karwa saktay hain
- **Render / Railway** — hosting (koi coding nahi chahiye, dashboard se sab)
- **Lemon Squeezy** — payment (no-code checkout links)
- **Namecheap/GoDaddy** — domain

Koi bhi step confusing lage to bata dein, mai wahi step aur detail mein
samjha doon ya us hissay ka code adjust kar doon.

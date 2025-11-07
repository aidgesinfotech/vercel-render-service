const express = require('express');
const app = express();
const PORT = 3000; // static port for local/dev use; Render overrides in production
// STATIC CONFIG: Update these URLs as needed; no env vars used
const VERCEL_PULSE_URL = 'https://vercel-render-service.vercel.app/api/pulse';
const INTERVAL_MS = 25000;

let timer = null;
let lastPing = 0;

function log(...args){ try{ console.log('[render-service]', ...args); }catch(_){} }

async function safeFetch(url, opts = {}){
  try{
    if (!url) return { ok: false, error: 'no_url' };
    const ac = new AbortController();
    const id = setTimeout(()=>ac.abort(), opts.timeout || 8000);
    const res = await fetch(url, { method: 'GET', signal: ac.signal });
    clearTimeout(id);
    const text = await res.text().catch(()=> '');
    return { ok: true, status: res.status, body: text };
  }catch(e){ return { ok: false, error: e.message || String(e) }; }
}

function schedulePing(){
  if (timer) return;
  const run = async () => {
    try{
      if (VERCEL_PULSE_URL){
        const r = await safeFetch(VERCEL_PULSE_URL, { timeout: 8000 });
        lastPing = Date.now();
        if (!r.ok) log('pulse failed:', r.error);
      }
    }catch(_e){}
    timer = setTimeout(run, INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  };
  run();
}

app.get('/keepalive', (_req, res)=>{
  res.status(200).json({ ok: true, ts: Date.now(), lastPing });
});

app.get('/tick', (_req, res)=>{
  schedulePing();
  res.status(200).json({ ok: true, running: !!timer, interval: INTERVAL_MS });
});

process.on('uncaughtException', (e)=> log('uncaughtException', e && e.stack || e));
process.on('unhandledRejection', (e)=> log('unhandledRejection', e && e.stack || e));

app.listen(PORT, ()=>{
  log('up on', PORT, 'interval', INTERVAL_MS);
  // Optional: auto start loop on boot
  // schedulePing();
});

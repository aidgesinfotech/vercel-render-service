// Dual-mode: Vercel serverless handler and local dev server
// Static config only; no environment variables

// UPDATE these constants with your real URLs
const RENDER_KEEPALIVE_URL = 'https://your-render-app.onrender.com/keepalive';
const TELEGRAM_CRM_ROLES_URL = 'https://telegram-crm.onrender.com/api/siteconfig/getSiteconfig';
const TELEGRAM_CRM_TOKEN = '';

function toJsonSafe(x){ try{ return JSON.parse(x); }catch(_){ return x; } }

async function ping(url, opts = {}){
  try{
    if (!url) return { ok:false, error:'no_url' };
    const ac = new AbortController();
    const to = setTimeout(()=>ac.abort(), opts.timeout || 8000);
    const headers = opts.headers || {};
    const res = await fetch(url, { method: opts.method || 'GET', headers, signal: ac.signal });
    clearTimeout(to);
    const text = await res.text().catch(()=> '');
    return { ok:true, status:res.status, body:text, json: toJsonSafe(text) };
  }catch(e){ return { ok:false, error: e.message || String(e) }; }
}

async function handler(req, res){
  const out = { ts: Date.now() };
  try{
    const renderUrl = RENDER_KEEPALIVE_URL;
    const crmUrl = TELEGRAM_CRM_ROLES_URL;
    const crmHeaders = { 'Content-Type':'application/json' };
    if (TELEGRAM_CRM_TOKEN){ crmHeaders['Authorization'] = `Bearer ${TELEGRAM_CRM_TOKEN}`; }

    const [r1, r2] = await Promise.allSettled([
      ping(renderUrl),
      ping(crmUrl, { headers: crmHeaders })
    ]);
    out.render = r1.status === 'fulfilled' ? r1.value : { ok:false, error:'promise_rejected' };
    out.crm = r2.status === 'fulfilled' ? r2.value : { ok:false, error:'promise_rejected' };
    res.status(200).json({ ok: true, ...out });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e), ...out });
  }
}

module.exports = handler;

// Local dev mode with nodemon: start a tiny server
if (require.main === module){
  const express = require('express');
  const app = express();
  const PORT = 3001; // static for local
  app.get('/api/pulse', (req, res) => handler(req, res));
  app.get('/', (_req, res)=> res.status(200).send('vercel-service local up'));
  process.on('uncaughtException', e=> console.log('[vercel-service] uncaughtException', e?.stack || e));
  process.on('unhandledRejection', e=> console.log('[vercel-service] unhandledRejection', e?.stack || e));
  app.listen(PORT, ()=> console.log('[vercel-service] up on', PORT));
}

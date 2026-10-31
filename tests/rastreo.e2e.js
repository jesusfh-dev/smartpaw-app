// Prueba de extremo a extremo: collar (página A) y dueño (página B) con un broker MQTT simulado.
// Requiere: npm i -D playwright  &&  npx playwright install chromium
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LEAFLET_STUB = `
window.L = (function(){
  function LatLng(a,b){ this.lat=a; this.lng=b; }
  const latLng = (a,b) => Array.isArray(a) ? new LatLng(a[0],a[1]) : (a instanceof LatLng ? a : new LatLng(a,b));
  function Pt(x,y){ this.x=x; this.y=y; } Pt.prototype.add=function(p){ return new Pt(this.x+p[0], this.y+p[1]); };
  return {
    latLng,
    map(id){ const el=document.getElementById(id); let c=latLng(0,0);
      return { el, setView(p){ c=latLng(p); return this; }, on(){ return this; }, panTo(p){ c=latLng(p); window.__center=c; },
        project(p){ p=latLng(p); return new Pt(p.lng*1e5, -p.lat*1e5); }, unproject(pt){ return latLng(-pt.y/1e5, pt.x/1e5); }, invalidateSize(){} }; },
    tileLayer(){ return { addTo(){ return this; } }; },
    polyline(pts){ return { pts, addTo(){ return this; }, setLatLngs(p){ this.pts=p; window.__route=p.length; } }; },
    circle(){ return { r:0, addTo(){ return this; }, setLatLng(){ return this; }, setRadius(r){ this.r=r; return this; } }; },
    divIcon(o){ return o; },
    marker(p,o){ let pos=latLng(p); return { addTo(m){ m.el.insertAdjacentHTML('beforeend', o.icon.html); return this; },
      getLatLng(){ return pos; }, setLatLng(q){ pos=latLng(q); window.__marker=pos; return this; } }; }
  };
})();`;

const MQTT_FAKE = `
window.__clients = {};
window.__mqttIn = (cid, t, p) => { const c = window.__clients[cid]; if (c && c.connected) c.emit('message', t, { toString: () => p }); };
window.mqtt = { connect(url, opts) {
  const c = { url, connected: false, h: {},
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; },
    emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); },
    subscribe(list) { window.__mqttOut(opts.clientId, 'sub', JSON.stringify(list)); },
    publish(t, p, o, cb) { window.__mqttOut(opts.clientId, 'pub', JSON.stringify({ t, p, o })); if (cb) setTimeout(cb, 10); },
    end(force, o, cb) { this.connected = false; window.__mqttOut(opts.clientId, force === true ? 'kill' : 'disc', '{}'); if (typeof cb === 'function') setTimeout(cb, 10); this.emit('close'); } };
  window.__clients[opts.clientId] = c;
  window.__mqttOut(opts.clientId, 'connect', JSON.stringify({ will: opts.will, url }));
  setTimeout(() => { c.connected = true; c.emit('connect'); }, 60);
  return c; } };`;

// ---------- Broker simulado (retención + Last Will) ----------
const clients = new Map();   // cid -> { page, topics:Set, will }
const retained = new Map();
const log = [];
function deliver(t, p) {
  for (const [cid, c] of clients) if (c.topics.has(t))
    c.page.evaluate(([a, b, d]) => window.__mqttIn(a, b, d), [cid, t, p]).catch(() => { });
}
function publish(t, p, retain) { if (retain) retained.set(t, p); deliver(t, p); log.push(t.split('/').slice(3).join('/')); }
function kill(cid) {
  const c = clients.get(cid); if (!c) return;
  clients.delete(cid);
  if (c.will) publish(c.will.topic, c.will.payload, c.will.retain);
}
async function wire(page) {
  await page.exposeFunction('__mqttOut', (cid, op, arg) => {
    const a = JSON.parse(arg);
    if (op === 'connect') clients.set(cid, { page, topics: new Set(), will: a.will });
    else if (op === 'sub') { const c = clients.get(cid); if (!c) return; a.forEach(t => { c.topics.add(t); if (retained.has(t)) setTimeout(() => c.page.evaluate(([x, y, z]) => window.__mqttIn(x, y, z), [cid, t, retained.get(t)]).catch(() => { }), 5); }); }
    else if (op === 'pub') publish(a.t, a.p, a.o && a.o.retain);
    else if (op === 'disc') clients.delete(cid);
    else if (op === 'kill') kill(cid);
  });
  page.on('close', () => { for (const [cid, c] of [...clients]) if (c.page === page) kill(cid); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('leaflet') && u.endsWith('.js')) return r.fulfill({ contentType: 'text/javascript', body: LEAFLET_STUB });
    if (u.includes('mqtt.min.js')) return r.fulfill({ contentType: 'text/javascript', body: MQTT_FAKE });
    if (u.includes('chart.js')) return r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){};' });
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    return r.fulfill({ status: 204, body: '' });
  });
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); errors.push(e.message); });
}
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, info = '') { results.push([ok ? 'PASS' : 'FAIL', name, info]); console.log(ok ? '✅' : '❌', name, info); }
const txt = (p, id) => p.$eval('#' + id, e => e.textContent.trim());
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(300); } return false; }

(async () => {
  // Uso: python3 -m http.server 8765  (en la carpeta del proyecto)  y luego  node tests/rastreo.e2e.js
  const URL = process.env.SMARTPAW_URL || 'http://127.0.0.1:8765/index.html';
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 400, height: 850 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 850 } });
  const A = await ctxA.newPage(); await wire(A);
  const B = await ctxB.newPage(); await wire(B);

  await A.goto(URL); await A.click('.nav-item:nth-child(4)');
  const code = await txt(A, 'collar-code');
  check('Collar genera código de 6 caracteres', /^[A-Z0-9]{6}$/.test(code), code);

  await B.goto(URL);
  check('Dueño sin vincular muestra estado', (await txt(B, 'collar-pill')) === 'Sin vincular');
  // Vincular a mano con el modal
  await B.click('#pair-btn-text'); await B.fill('#pair-input', code.toLowerCase()); await B.click('.modal-sheet .btn-primary');
  check('Vinculación por código (insensible a minúsculas)', await waitFor(async () => (await txt(B, 'pet-sub')).includes(code)));
  check('Dueño espera al collar', await waitFor(async () => (await txt(B, 'collar-pill')) === 'Esperando collar', 3000), await txt(B, 'collar-pill'));

  await A.click('#btn-toggle-emitter');
  check('Collar transmitiendo', await waitFor(async () => (await txt(A, 'collar-state-title')) === 'Transmitiendo en vivo'));
  check('Dueño ve collar En línea', await waitFor(async () => (await txt(B, 'collar-pill')) === 'En línea'), await txt(B, 'collar-pill'));
  check('Collar detecta al dueño conectado (bidireccional)', await waitFor(async () => (await txt(A, 'lv-owner')).includes('Conectado')), await txt(A, 'lv-owner'));

  await sleep(11500);
  const route = await B.evaluate(() => window.__route || 0);
  const dist = await txt(B, 'st-dist');
  check('La ruta crece con las ubicaciones recibidas', route >= 2, `puntos=${route}`);
  check('Distancia recorrida > 0', !/^0 m$/.test(dist), dist);
  check('Velocidad y batería visibles', (await txt(B, 'st-speed')) !== '—' && (await txt(B, 'st-bat')).endsWith('%'), `${await txt(B, 'st-speed')} km/h, ${await txt(B, 'st-bat')}`);
  const mA = await A.evaluate(() => ({ lat: Collar.pos.lat, lng: Collar.pos.lng }));
  const mB = await B.evaluate(() => ({ lat: Owner.last.lat, lng: Owner.last.lng }));
  check('Coordenadas del dueño = coordenadas del collar', Math.abs(mA.lat - mB.lat) < 1e-4 && Math.abs(mA.lng - mB.lng) < 1e-4, `${mB.lat.toFixed(5)}, ${mB.lng.toFixed(5)}`);
  check('Latencia medida por ping', await waitFor(async () => (await txt(B, 'st-lat')).endsWith('ms'), 12000), await txt(B, 'st-lat'));
  await B.screenshot({ path: 'tests/capturas/1-dueno-en-linea.png' });
  await A.screenshot({ path: 'tests/capturas/2-collar-transmitiendo.png' });

  // Comando: sonar collar
  await B.click('#btn-buzz');
  check('Collar recibe "Sonar collar"', await waitFor(async () => (await txt(A, 'event-log')).includes('hizo sonar'), 5000));
  check('Dueño recibe confirmación (ack)', await waitFor(async () => (await B.$$eval('.toast', ts => ts.map(t => t.textContent).join('|'))).includes('respondió'), 5000));

  // Comando: modo intensivo
  const p0 = +(await txt(A, 'lv-pkts'));
  await B.click('#btn-mode');
  check('Collar cambia a modo intensivo', await waitFor(async () => (await txt(A, 'lv-mode')).startsWith('Intensiva'), 5000));
  await sleep(5000);
  const p1 = +(await txt(A, 'lv-pkts'));
  check('Frecuencia intensiva (~1 paquete/s)', p1 - p0 >= 4, `${p1 - p0} paquetes en ~5 s`);
  check('Botón del dueño refleja modo intensivo', await B.$eval('#btn-mode', e => e.classList.contains('on')));
  await B.click('#btn-mode');
  await waitFor(async () => (await txt(A, 'lv-mode')).startsWith('Normal'), 5000);

  // Batería baja
  await A.click('text=Batería baja');
  check('Dueño marca batería baja', await waitFor(async () => B.$eval('#st-bat-box', e => e.classList.contains('warn')), 7000), await txt(B, 'st-bat'));

  // Pérdida de señal simulada
  await A.click('.switch span');
  check('Dueño detecta "Sin señal" (~15 s)', await waitFor(async () => (await txt(B, 'collar-pill')) === 'Sin señal', 22000), await txt(B, 'track-meta'));
  check('Marcador cambia a estado sin señal', await B.$eval('#pet-marker', e => e.classList.contains('stale')));
  check('Comandos deshabilitados sin señal', await B.$eval('#btn-buzz', e => e.disabled));
  await B.screenshot({ path: 'tests/capturas/3-dueno-sin-senal.png' });
  await A.click('.switch span');
  check('Dueño ve que el collar regresó', await waitFor(async () => (await txt(B, 'collar-pill')) === 'En línea', 8000));

  // Apagado limpio
  await A.click('#btn-toggle-emitter');
  check('Apagado limpio => Fuera de línea', await waitFor(async () => (await txt(B, 'collar-pill')) === 'Fuera de línea', 5000));
  check('Muestra motivo y última conexión', (await txt(B, 'track-meta')).includes('Collar apagado'), await txt(B, 'track-meta'));
  await B.screenshot({ path: 'tests/capturas/4-dueno-fuera-de-linea.png' });

  // Un dueño nuevo recibe la última ubicación retenida
  const ctxC = await browser.newContext({ viewport: { width: 400, height: 850 } });
  const C = await ctxC.newPage(); await wire(C);
  await C.goto(URL + '?collar=' + code);
  check('Dueño nuevo ve la última ubicación (retenida)', await waitFor(async () => C.evaluate(() => !!Owner.last), 5000));
  check('Dueño nuevo ve estado Fuera de línea', await waitFor(async () => (await txt(C, 'collar-pill')) === 'Fuera de línea', 5000), await txt(C, 'collar-pill'));

  // Desconexión abrupta (se cierra la app del collar) => Last Will
  await A.click('#btn-toggle-emitter');
  await waitFor(async () => (await txt(B, 'collar-pill')) === 'En línea', 8000);
  await A.close();
  check('Cierre abrupto => Last Will => Fuera de línea', await waitFor(async () => (await txt(B, 'collar-pill')) === 'Fuera de línea', 5000));
  check('Motivo: se perdió la conexión', (await txt(B, 'track-meta')).includes('Se perdió la conexión'), await txt(B, 'track-meta'));

  // Desvincular
  await B.click('#pair-btn-text'); await B.click('#btn-unpair');
  check('Desvincular', (await txt(B, 'collar-pill')) === 'Sin vincular');

  check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  const fail = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fail}/${results.length} pruebas superadas`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

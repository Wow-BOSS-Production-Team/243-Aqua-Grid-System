/* AquaGrid — Dasbor operator (mockup, data simulasi).
   Dasbor mengikuti Lampiran B dan halaman Rancangan mengikuti Lampiran A
   proposal AquaGrid (Tim SHANI, BPC UI Innovation War 2026). */
(function () {
  'use strict';

  const STORE_KEY = 'aquagrid-web-v2';
  const TARIF_SOSIAL = 500;   // Rp per liter (simulasi tarif sosial)
  const BIAYA_PENUH = 1979;   // Rp per liter (biaya sederhana per liter, proposal hlm. 12)
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastsEl = document.getElementById('toasts');

  // ---------- data awal ----------
  function makeModules(seed) {
    return seed.map((health, i) => ({
      id: 'M' + String(i + 1).padStart(2, '0'),
      health,
      cycles: Math.round((100 - health) * 9.3 + 40),
      rh: 58 + ((i * 7) % 15),
      temp: 29 + (i % 4),
      litres: +(4.1 + ((i * 3) % 9) / 10).toFixed(1),
    }));
  }
  function site(name, place, o) {
    return Object.assign({
      name, place, interlock: true, sensor: 'normal', lab: { status: 'belum' }, labs: [],
      distributions: [], payments: [], issues: [], services: [], todo: [false, false, false, false],
      energy: { pv: 412, battery: 78, collector: 'Aktif' },
    }, o);
  }
  function initialState() {
    const lab2 = { status: 'lulus', date: '2026-10-20', labName: 'Laboratorium mitra (simulasi)', micro: 'lulus', chem: 'lulus' };
    return {
      operator: null, siteId: 'DEMO01', online: true, queue: [], sent: 0,
      sites: {
        DEMO01: site('Lokasi DEMO 01', 'Sekolah dasar · wilayah layanan awal', {
          today: 45.0, target: 50, history: [38, 42, 40, 47, 44, 46, 45], tank: 132, tankCap: 200,
          modules: makeModules([92, 88, 81, 76, 95, 18, 84, 90, 73, 87]),
        }),
        DEMO02: site('Lokasi DEMO 02', 'Klinik desa · koperasi air', {
          today: 48.5, target: 50, history: [44, 46, 49, 47, 45, 50, 48.5], tank: 171, tankCap: 200,
          lab: lab2, labs: [lab2], modules: makeModules([86, 91, 89, 94, 83, 88, 92, 79, 85, 90]),
          energy: { pv: 455, battery: 91, collector: 'Aktif' },
        }),
        DEMO03: site('Lokasi DEMO 03', 'Komunitas terpencil · musim kering', {
          today: 31.0, target: 50, history: [36, 34, 33, 30, 29, 32, 31], tank: 48, tankCap: 200, sensor: 'gagal',
          modules: makeModules([70, 64, 22, 77, 68, 15, 72, 66, 80, 61]),
          energy: { pv: 298, battery: 54, collector: 'Aktif' },
        }),
      },
    };
  }

  let state = load();
  let ui = { menu: false, mod: null, steps: null, vol: 20, payVol: 20, ch: 'Tunai', issueFilter: 'semua', diag: null };

  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return initialState();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  // ---------- util ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const num = (n, d = 1) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  const now = () => new Date();
  const timeStr = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const isToday = (d) => new Date(d).toDateString() === now().toDateString();
  const uid = (p) => p + '-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random() * 90 + 10);
  const S = () => state.sites[state.siteId];
  const modStatus = (m) => (m.health < 25 ? 'bad' : m.health < 60 ? 'warn' : 'ok');
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // Air boleh didistribusikan untuk konsumsi hanya jika pengolahan normal DAN lab lulus.
  function safety(s) {
    if (s.sensor !== 'normal') return { ok: false, level: 'bad', short: 'Distribusi dihentikan', title: 'Pengolahan bermasalah', text: 'Interlock menutup keluaran. Distribusi dihentikan sampai petugas mutu memeriksa.' };
    if (s.lab.status === 'gagal') return { ok: false, level: 'bad', short: 'Uji lab gagal', title: 'Uji laboratorium gagal', text: 'Hentikan distribusi, perbaiki, lalu uji ulang.' };
    if (s.lab.status !== 'lulus') return { ok: false, level: 'warn', short: 'Menunggu uji lab', title: 'Uji laboratorium belum diunggah', text: 'Air belum boleh diklaim aman. Sensor normal tidak berarti air aman diminum.' };
    return { ok: true, level: 'ok', short: 'Aman diminum', title: 'Lolos uji mutu', text: 'Hasil lab terakhir ' + dateStr(s.lab.date) + '. Distribusi untuk konsumsi diizinkan.' };
  }

  // Semua tindakan tulis lewat sini: offline → antre lokal, online → terkirim.
  function record(label) {
    if (state.online) { state.sent++; toast(label + ' · terkirim'); }
    else { state.queue.push({ label, at: now().toISOString(), site: state.siteId }); toast(label + ' · tersimpan lokal'); }
    save();
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = icon('i-check') + '<span>' + esc(msg) + '</span>';
    toastsEl.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
  }

  // ---------- routing ----------
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || 'dasbor', arg: parts[1] };
  }
  function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
  window.addEventListener('hashchange', () => { ui.menu = false; ui.steps = null; render(); window.scrollTo(0, 0); });

  const NAV = [
    ['dasbor', 'Dasbor', 'i-home'],
    ['modul', 'Modul C50', 'i-grid'],
    ['distribusi', 'Distribusi', 'i-drop'],
    ['pembayaran', 'Pembayaran', 'i-wallet'],
    ['laboratorium', 'Laboratorium', 'i-flask'],
    ['gangguan', 'Gangguan', 'i-alert'],
    ['sinkronisasi', 'Sinkronisasi', 'i-sync'],
    ['rancangan', 'Rancangan C50', 'i-layers'],
  ];
  const NAV_OF = { servis: 'modul' };

  // ---------- layout ----------
  function header(active) {
    const s = S();
    const openIssues = s.issues.filter((i) => !i.closed).length;
    return `
    <header class="hdr">
      <div class="wrap">
        <div class="hdr-top">
          <a class="brand" href="#/dasbor"><svg aria-hidden="true"><use href="#logo"/></svg>
            <span class="brand-name">AquaGrid<span class="sep">|</span><span class="tag">Dasbor operator</span></span></a>
          <div class="hdr-right">
            <label class="site-select" title="Ganti lokasi">${icon('i-pin')}
              <select data-act="site" aria-label="Lokasi">${Object.entries(state.sites).map(([id, x]) => `<option value="${id}" ${id === state.siteId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
              ${icon('i-down', 'ic caret')}
            </label>
            ${state.online
              ? `<button class="net on" data-act="net" title="Klik untuk simulasi jaringan putus">${icon('i-wifi')}Online</button>`
              : `<button class="net off" data-act="net" title="Klik untuk menyambung kembali">${icon('i-wifi-off')}Offline${state.queue.length ? `<span class="badge">${state.queue.length}</span>` : ''}</button>`}
            <button class="user-btn" data-act="menu" aria-label="Akun"><span class="avatar">${esc(initials(state.operator.name))}</span><span class="nm">${esc(state.operator.name)}<small>${esc(state.operator.id)}</small></span></button>
          </div>
        </div>
        <nav class="nav">${NAV.map(([k, l, ic]) => {
          const cnt = k === 'gangguan' && openIssues ? openIssues : k === 'sinkronisasi' && state.queue.length ? state.queue.length : 0;
          return `<a href="#/${k}" class="${active === k ? 'active' : ''}">${icon(ic)}${l}${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`;
        }).join('')}</nav>
        ${ui.menu ? `<div class="menu">
          <div class="who"><b>${esc(state.operator.name)}</b>${esc(state.operator.id)} · Operator komunitas</div>
          <button data-act="reset">${icon('i-sync')}Atur ulang data simulasi</button>
          <button data-act="logout">${icon('i-logout')}Keluar</button>
        </div>` : ''}
      </div>
    </header>`;
  }

  function pageHead(title, opts = {}) {
    return `<div class="page-head"><div>
      <h2>${title}</h2>
      ${opts.sim !== false ? '<div class="sim">DATA SIMULASI • Bukan hasil pengukuran prototipe</div>' : ''}
      ${opts.lead ? `<div class="lead">${opts.lead}</div>` : ''}
    </div>${opts.actions ? `<div class="head-actions">${opts.actions}</div>` : ''}</div>`;
  }

  const footer = () => `<footer class="footer"><div class="wrap"><span>AquaGrid · Jaringan generator air dari udara bertenaga surya untuk wilayah krisis air</span><span>Mockup konsep · Tim SHANI · BPC UI Innovation War 2026</span></div></footer>`;

  const safetyAlert = (sf) => `<div class="alert ${sf.level}">${icon(sf.ok ? 'i-check' : 'i-alert')}<div><b>${sf.title}</b>${sf.text}</div></div>`;

  // ---------- halaman ----------
  const pages = {};

  pages.login = () => `
    <div class="login">
      <section class="login-hero">
        <div class="brand"><svg aria-hidden="true" style="width:40px;height:40px"><use href="#logo"/></svg><span class="brand-name">AquaGrid</span></div>
        <h1>Air minum dari <em>udara</em>, dipantau dari satu dasbor.</h1>
        <p>Jaringan perangkat modular yang menangkap uap air dengan material higroskopis dan energi matahari. Operator komunitas memantau produksi, keamanan air, distribusi, dan servis modul dari sini.</p>
        <div class="hero-stats">
          <div><b>10</b><span>modul per C50</span></div>
          <div><b>50 L</b><span>target per hari</span></div>
          <div><b>90%</b><span>asumsi ketersediaan</span></div>
        </div>
        <div class="hero-foot">Mockup konsep · data simulasi · Tim SHANI, BPC UI Innovation War 2026</div>
      </section>
      <section class="login-form">
        <div class="card">
          <h2>Masuk operator</h2>
          <p class="sub" style="margin:0 0 22px">Gunakan akun demo di bawah, atau isi sendiri.</p>
          <form data-form="login">
            <label class="f" for="op-id">ID operator</label>
            <input class="input" id="op-id" name="id" value="OPR-0142" required>
            <label class="f" for="op-name">Nama operator</label>
            <input class="input" id="op-name" name="name" value="Operator Komunitas" required>
            <label class="f" for="op-pin">PIN</label>
            <input class="input" id="op-pin" name="pin" type="password" inputmode="numeric" maxlength="6" value="1234" required>
            <button class="btn block" type="submit">Masuk ke dasbor ${icon('i-chev')}</button>
          </form>
        </div>
      </section>
    </div>`;

  pages.dasbor = () => {
    const s = S();
    const sf = safety(s);
    const max = Math.max(s.target, ...s.history) * 1.12;
    const H = 170;
    const todos = [['Periksa kartrid', 'modul'], ['Catat pengambilan air', 'distribusi'], ['Unggah hasil laboratorium', 'laboratorium'], ['Laporkan gangguan', 'gangguan']];
    const distToday = s.distributions.filter((d) => isToday(d.at)).reduce((a, d) => a + d.vol, 0);
    const payToday = s.payments.filter((d) => isToday(d.at)).reduce((a, d) => a + d.paid, 0);
    const needSvc = s.modules.filter((m) => modStatus(m) === 'bad').length;
    const activity = [
      ...s.distributions.map((d) => ({ at: d.at, ic: 'i-drop', lv: '', t: `${num(d.vol)} L diambil · ${d.hh}`, d: d.use })),
      ...s.payments.map((p) => ({ at: p.at, ic: 'i-wallet', lv: 'ok', t: `Pembayaran ${rp(p.paid)} · ${p.payer}`, d: `${p.vol} L · ${p.ch}` })),
      ...s.services.map((v) => ({ at: v.at, ic: 'i-recycle', lv: '', t: `Servis ${v.module} · kartrid diganti`, d: `Kartrid lama ${v.returnCode} disegel` })),
      ...s.issues.map((i) => ({ at: i.at, ic: 'i-alert', lv: i.closed ? 'ok' : 'bad', t: i.cat, d: i.desc })),
      ...s.labs.filter((l) => l.at).map((l) => ({ at: l.at, ic: 'i-flask', lv: l.status === 'lulus' ? 'ok' : 'bad', t: 'Hasil lab ' + l.status, d: l.labName })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);

    return `
      ${pageHead(esc(s.name), { actions: `<span class="pill ${sf.level}" style="font-size:13px;padding:6px 12px"><span class="dot"></span>${sf.short}</span>` })}

      <div class="grid g3">
        <div class="card">
          <h3>Produksi hari ini</h3>
          <p class="line">${num(s.today)} liter</p>
          <p class="line">Target desain ${s.target} liter/hari</p>
          <div class="meter ${s.today / s.target < .7 ? 'warn' : ''}"><i style="width:${Math.min(100, (s.today / s.target) * 100)}%"></i></div>
        </div>
        <div class="card">
          <h3>Status pengolahan</h3>
          <p class="line">Interlock ${s.interlock ? 'aktif' : 'nonaktif'}</p>
          <p class="line">Sensor proses: <span style="color:${s.sensor === 'normal' ? 'inherit' : 'var(--bad)'};font-weight:${s.sensor === 'normal' ? 400 : 700}">${s.sensor}</span></p>
          <p class="line muted small">Keluaran ${s.sensor === 'normal' ? 'terbuka' : 'ditutup otomatis'}</p>
        </div>
        <a class="card" href="#/laboratorium" style="text-decoration:none;color:inherit">
          <h3>Uji laboratorium</h3>
          <p class="line">${s.lab.status === 'belum' ? 'Belum diunggah' : s.lab.status === 'lulus' ? 'Lulus · sampel ' + dateStr(s.lab.date) : 'Gagal · sampel ' + dateStr(s.lab.date)}</p>
          <p class="line" style="color:${sf.ok ? 'var(--ok)' : 'inherit'}">${sf.ok ? 'Air boleh didistribusikan' : 'Air belum boleh diklaim aman'}</p>
          <p class="line muted small">Klik untuk mengunggah hasil</p>
        </a>
      </div>

      <div class="grid g-2-1 mt">
        <div class="card">
          <div class="card-h"><h3>Riwayat produksi simulasi</h3><span class="muted small">rata-rata ${num(s.history.reduce((a, b) => a + b, 0) / 7)} L/hari</span></div>
          <div class="line" style="margin:0">Liter per hari | 7 hari terakhir</div>
          <div class="chart" style="height:${H + 40}px">
            <div class="tgt" style="bottom:${(s.target / max) * H}px"><span>target ${s.target} L</span></div>
            ${s.history.map((v, i) => `<div class="b ${i === 6 ? 'today' : ''}" title="Hari ${i + 1}: ${num(v)} L"><b>${Math.round(v)}</b><i style="height:${(v / max) * H}px"></i></div>`).join('')}
          </div>
          <div class="chart-x">${s.history.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>
          <div class="chart-legend"><span><i style="background:var(--teal)"></i>Hari sebelumnya</span><span><i style="background:var(--navy)"></i>Hari ini</span><span><i style="border-top:2px dashed #9fb7bd;height:0;width:14px;border-radius:0"></i>Target desain</span></div>
        </div>
        <div class="card">
          <h3>Tindakan operator</h3>
          <ol class="todo">${todos.map(([t, r], i) => `<li class="${s.todo[i] ? 'done' : ''}"><span class="n">${s.todo[i] ? '✓' : i + 1}</span><span class="t">${t}</span><a href="#/${r}">Buka →</a></li>`).join('')}</ol>
          <p class="conn">Koneksi: ${state.online ? 'online' : 'tersimpan lokal'}${state.queue.length ? ` · <b>${state.queue.length}</b> menunggu dikirim` : ''}</p>
        </div>
      </div>

      <p class="principle">Prinsip tampilan: volume produksi dipisahkan dari status keamanan air.</p>

      <div class="section-t">Ringkasan hari ini</div>
      <div class="grid g4">
        <div class="card stat"><div class="s-ic">${icon('i-drop')}</div><div><div class="v">${num(distToday)} L</div><div class="l">Air didistribusikan</div></div></div>
        <div class="card stat"><div class="s-ic">${icon('i-wallet')}</div><div><div class="v">${rp(payToday)}</div><div class="l">Pembayaran warga</div></div></div>
        <div class="card stat"><div class="s-ic" style="${needSvc ? 'background:var(--bad-soft);color:var(--bad)' : ''}">${icon('i-recycle')}</div><div><div class="v">${needSvc}</div><div class="l">Modul perlu servis</div></div></div>
        <div class="card stat"><div class="s-ic" style="${state.queue.length ? 'background:var(--warn-soft);color:var(--warn)' : ''}">${icon('i-sync')}</div><div><div class="v">${state.queue.length}</div><div class="l">Catatan belum terkirim</div></div></div>
      </div>

      <div class="grid g3 mt">
        <div class="card">
          <div class="card-h"><h3>Tangki</h3><span class="muted small">tertutup</span></div>
          <div class="tank">
            <div class="tank-vis"><i style="height:${(s.tank / s.tankCap) * 100}%"></i></div>
            <div><div class="big">${Math.round(s.tank)}<small> / ${s.tankCap} L</small></div>
            <div class="muted small" style="margin-top:6px">${s.tank / s.tankCap < .3 ? 'Isi rendah — atur jadwal pengambilan' : 'Cukup untuk ± ' + Math.floor(s.tank / 2) + ' alokasi 2 L'}</div></div>
          </div>
        </div>
        <a class="card" href="#/modul" style="text-decoration:none;color:inherit">
          <div class="card-h"><h3>Modul sorpsi</h3><span class="muted small">10 modul</span></div>
          <div class="mods mini">${s.modules.map((m) => `<span class="m ${modStatus(m)}" title="${m.id}: ${m.health}%">${m.id.slice(1)}</span>`).join('')}</div>
          <p class="line muted small" style="margin-top:12px">Warna menunjukkan sisa umur kartrid sorben.</p>
        </a>
        <div class="card">
          <h3>Energi</h3>
          <div class="kv"><span>${icon('i-sun')}Kolektor panas</span><b>${s.energy.collector}</b></div>
          <div class="kv"><span>${icon('i-bolt')}Panel PV</span><b>${s.energy.pv} W</b></div>
          <div class="kv"><span>${icon('i-bolt')}Baterai</span><b>${s.energy.battery}%</b></div>
        </div>
      </div>

      <div class="grid g-2-1 mt">
        <div class="card">
          <h3>Aktivitas terbaru</h3>
          ${activity.length ? `<ul class="list">${activity.map((a) => `<li><div class="li-ic ${a.lv}">${icon(a.ic)}</div><div class="li-main"><div class="t">${esc(a.t)}</div><div class="d">${esc(a.d)}</div></div><span class="muted small">${timeStr(a.at)}</span></li>`).join('')}</ul>`
            : '<div class="empty">Belum ada aktivitas hari ini. Mulai dari daftar tindakan operator.</div>'}
        </div>
        <div class="card">
          <h3>Semua lokasi</h3>
          <ul class="list">${Object.entries(state.sites).map(([id, x]) => { const f = safety(x); return `
            <li><div class="li-ic ${f.level}">${icon('i-pin')}</div><div class="li-main"><div class="t">${esc(x.name)}</div><div class="d">${num(x.today)} L · ${f.short}</div></div>
            ${id === state.siteId ? '<span class="pill info">Aktif</span>' : `<button class="btn ghost sm" data-act="pick-site" data-id="${id}">Buka</button>`}</li>`; }).join('')}</ul>
        </div>
      </div>`;
  };

  pages.modul = () => {
    const s = S();
    const sel = s.modules.find((m) => m.id === ui.mod) || s.modules.slice().sort((a, b) => a.health - b.health)[0];
    ui.mod = sel.id;
    const st = modStatus(sel);
    const c = { ok: 0, warn: 0, bad: 0 };
    s.modules.forEach((m) => c[modStatus(m)]++);
    return `
      ${pageHead('Modul C50', { lead: 'Satu C50 berisi sepuluh modul sorpsi dengan target 5 liter per modul per hari. Pilih modul untuk melihat detail dan memulai servis kartrid.' })}
      <div class="grid g-3-2">
        <div>
          <div class="card">
            <div class="card-h"><h3>Status modul sorpsi</h3>
              <div style="display:flex;gap:6px"><span class="pill ok">${c.ok} normal</span><span class="pill warn">${c.warn} pantau</span><span class="pill bad">${c.bad} servis</span></div></div>
            <div class="mods">${s.modules.map((m) => { const ms = modStatus(m); return `
              <button class="mod ${ms} ${m.id === sel.id ? 'sel' : ''}" data-act="mod" data-id="${m.id}">
                <span class="top"><span class="id">${m.id}</span><span class="led"></span></span>
                <span class="hp">${m.health}%</span>
                <span class="meter ${ms === 'ok' ? '' : ms}"><i style="width:${m.health}%"></i></span>
                <span class="muted small">${num(m.litres)} L hari ini</span>
              </button>`; }).join('')}</div>
            <p class="muted small" style="margin:14px 0 0">Persentase = perkiraan sisa umur kartrid sorben. Merah di bawah 25%, kuning di bawah 60%.</p>
          </div>
          <div class="card mt">
            <h3>Riwayat servis</h3>
            ${s.services.length ? `<ul class="list">${s.services.slice().reverse().map((v) => `<li><div class="li-ic">${icon('i-recycle')}</div><div class="li-main"><div class="t">${v.module} · kartrid diganti</div><div class="d">Kartrid lama ${v.returnCode} disegel untuk pengembalian melalui distributor</div></div><span class="muted small">${dateStr(v.at)}</span></li>`).join('')}</ul>`
              : '<div class="empty">Belum ada servis tercatat.</div>'}
          </div>
        </div>
        <div class="card sticky">
          <div class="card-h"><h3>Modul ${sel.id}</h3><span class="pill ${st}"><span class="dot"></span>${st === 'ok' ? 'Normal' : st === 'warn' ? 'Pantau' : 'Perlu servis'}</span></div>
          <div class="big">${sel.health}<small>% sisa umur kartrid</small></div>
          <div class="meter ${st === 'ok' ? '' : st}"><i style="width:${sel.health}%"></i></div>
          <div style="margin-top:14px">
            <div class="kv"><span>${icon('i-sync')}Siklus serap–lepas</span><b>${sel.cycles}</b></div>
            <div class="kv"><span>${icon('i-drop')}Produksi hari ini</span><b>${num(sel.litres)} L</b></div>
            <div class="kv"><span>${icon('i-drop')}Kelembapan udara (RH)</span><b>${sel.rh}%</b></div>
            <div class="kv"><span>${icon('i-thermo')}Suhu</span><b>${sel.temp}°C</b></div>
            <div class="kv"><span>${icon('i-layers')}Prafilter</span><b>Bersih</b></div>
          </div>
          <div class="alert info" style="margin-top:14px">${icon('i-info')}<div>Kendali berbasis suhu dan kelembapan mengatur waktu siklus serap dan lepas uap.</div></div>
          <a class="btn block ${st === 'bad' ? '' : 'ghost'}" href="#/servis/${sel.id}">${icon('i-recycle')}Mulai servis kartrid</a>
        </div>
      </div>`;
  };

  const SERVICE_STEPS = [
    ['Identifikasi nomor modul', 'Cocokkan nomor seri modul dengan catatan komponen.'],
    ['Isolasi jalur air dan energi', 'Tutup katup modul dan putus daya bantu.'],
    ['Lepas kartrid lama', 'Segel kartrid lama dan beri label pengembalian.'],
    ['Pasang kartrid pengganti', 'Catat nomor seri kartrid baru.'],
    ['Uji kebocoran dan mutu', 'Pastikan tidak ada kebocoran sorben ke jalur air.'],
    ['Kembalikan modul ke operasi', 'Buka katup dan aktifkan kembali siklus.'],
  ];

  pages.servis = (arg) => {
    const s = S();
    const m = s.modules.find((x) => x.id === arg);
    if (!m) { go('modul'); return ''; }
    ui.steps = ui.steps || SERVICE_STEPS.map(() => false);
    const done = ui.steps.filter(Boolean).length;
    const next = ui.steps.indexOf(false);
    return `
      ${pageHead('Servis kartrid · ' + m.id, { lead: 'Ikuti langkah servis lapangan secara berurutan. Kartrid lama dicatat untuk pengembalian.', actions: `<a class="btn ghost sm" href="#/modul">Kembali ke modul</a>` })}
      <div class="grid g-3-2">
        <div class="card">
          <div class="card-h"><h3>Langkah servis</h3><span class="muted">${done} dari ${SERVICE_STEPS.length} selesai</span></div>
          <div class="meter" style="margin-top:0"><i style="width:${(done / SERVICE_STEPS.length) * 100}%"></i></div>
          <ol class="steps" style="margin-top:6px">${SERVICE_STEPS.map(([t, d], i) => {
            const locked = next !== -1 && i > next;
            return `<li><button class="step ${ui.steps[i] ? 'done' : ''} ${i === next ? 'next' : ''}" data-act="step" data-i="${i}" ${locked ? 'disabled' : ''}>
              <span class="box">${ui.steps[i] ? icon('i-check') : ''}</span><span><span class="t">${i + 1}. ${t}</span><span class="d">${d}</span></span></button></li>`;
          }).join('')}</ol>
          <button class="btn block" data-act="finish-service" data-id="${m.id}" ${done < SERVICE_STEPS.length ? 'disabled' : ''}>${icon('i-check')}Selesaikan & catat servis</button>
        </div>
        <div>
          <div class="card">
            <h3>Modul ${m.id}</h3>
            <div class="kv"><span>Sisa umur kartrid</span><b style="color:${modStatus(m) === 'bad' ? 'var(--bad)' : 'inherit'}">${m.health}%</b></div>
            <div class="kv"><span>Siklus</span><b>${m.cycles}</b></div>
            <div class="kv"><span>Lokasi</span><b>${esc(s.name)}</b></div>
          </div>
          <div class="alert info mt">${icon('i-recycle')}<div><b>Strategi sirkular</b>Kartrid lama dikembalikan melalui distributor untuk diperbaiki, dipakai ulang jika aman, atau diserahkan ke pengelola limbah yang sesuai. Target pengembalian ≥80% komponen berdasarkan massa.</div></div>
        </div>
      </div>`;
  };

  pages.distribusi = () => {
    const s = S();
    const sf = safety(s);
    const today = s.distributions.filter((d) => isToday(d.at));
    const total = today.reduce((a, d) => a + d.vol, 0);
    return `
      ${pageHead('Catat distribusi', { lead: 'Catat setiap pengambilan air per rumah tangga. Pencatatan untuk konsumsi hanya dibuka setelah air lolos uji mutu.' })}
      ${safetyAlert(sf)}
      <div class="grid g-3-2 mt">
        <div class="card">
          <h3 style="margin-bottom:14px">Pengambilan baru</h3>
          <form data-form="dist">
            <label class="f">Volume diambil (liter)</label>
            <div class="chips">${[5, 10, 20, 40].map((v) => `<button type="button" class="chip ${ui.vol === v ? 'on' : ''}" data-act="vol" data-k="vol" data-v="${v}">${v} L</button>`).join('')}</div>
            <input class="input" style="margin-top:10px" name="vol" type="number" min="0.5" step="0.5" value="${ui.vol}" data-bind="vol">
            <div class="frow">
              <div><label class="f" for="hh">ID rumah tangga / penerima</label><input class="input" id="hh" name="hh" placeholder="mis. RT-018" required></div>
              <div><label class="f" for="use">Keperluan</label><select class="input" id="use" name="use"><option>Minum & memasak</option><option>Sekolah</option><option>Klinik</option></select></div>
            </div>
            <button class="btn block" type="submit" ${sf.ok ? '' : 'disabled'}>${icon('i-drop')}Catat pengambilan</button>
            ${sf.ok ? '' : '<p class="muted small" style="text-align:center;margin:10px 0 0">Distribusi untuk konsumsi mengikuti keputusan petugas mutu. <a href="#/laboratorium">Unggah hasil lab →</a></p>'}
          </form>
        </div>
        <div>
          <div class="grid g2" style="gap:14px">
            <div class="card stat"><div class="s-ic">${icon('i-drop')}</div><div><div class="v">${num(total)} L</div><div class="l">Tercatat hari ini</div></div></div>
            <div class="card stat"><div class="s-ic">${icon('i-layers')}</div><div><div class="v">${Math.round(s.tank)} L</div><div class="l">Sisa di tangki</div></div></div>
          </div>
          <div class="card mt">
            <h3>Riwayat hari ini</h3>
            ${today.length ? `<ul class="list">${today.slice().reverse().map((d) => `<li><div class="li-ic">${icon('i-drop')}</div><div class="li-main"><div class="t">${num(d.vol)} L · ${esc(d.hh)}</div><div class="d">${esc(d.use)}</div></div><span class="muted small">${timeStr(d.at)}</span></li>`).join('')}</ul>`
              : '<div class="empty">Belum ada pengambilan tercatat.</div>'}
          </div>
        </div>
      </div>`;
  };

  pages.pembayaran = () => {
    const s = S();
    const v = ui.payVol;
    return `
      ${pageHead('Pembayaran komunitas', { lead: 'Pilih volume, tampilkan tarif dan dukungan subsidi, terima pembayaran tunai atau melalui kanal setempat, lalu terbitkan bukti.' })}
      <div class="grid g-3-2">
        <div class="card">
          <form data-form="pay">
            <label class="f"><span class="step-n">1</span>Pilih volume</label>
            <div class="chips">${[10, 20, 40, 60].map((x) => `<button type="button" class="chip ${v === x ? 'on' : ''}" data-act="vol" data-k="payVol" data-v="${x}">${x} L</button>`).join('')}</div>
            <input class="input" style="margin-top:10px" type="number" min="1" step="1" value="${v}" data-bind="payVol">
            <label class="f" style="margin-top:22px"><span class="step-n">2</span>Kanal pembayaran</label>
            <div class="chips">${['Tunai', 'Kanal setempat'].map((c) => `<button type="button" class="chip ${ui.ch === c ? 'on' : ''}" data-act="ch" data-v="${c}">${c}</button>`).join('')}</div>
            <label class="f" for="payer" style="margin-top:22px"><span class="step-n">3</span>ID rumah tangga</label>
            <input class="input" id="payer" name="payer" placeholder="mis. RT-018" required>
            <button class="btn block" type="submit" data-pay-btn>${icon('i-wallet')}Terima ${rp(v * TARIF_SOSIAL)} & terbitkan bukti</button>
          </form>
        </div>
        <div>
          <div class="card sticky">
            <h3>Tarif dan dukungan subsidi</h3>
            <div class="kv"><span>Volume</span><b data-o="vol">${v} L</b></div>
            <div class="kv"><span>Biaya penuh (${rp(BIAYA_PENUH)}/L)</span><b data-o="full">${rp(v * BIAYA_PENUH)}</b></div>
            <div class="kv"><span>Ditanggung sponsor</span><b style="color:var(--ok)" data-o="sub">−${rp(v * (BIAYA_PENUH - TARIF_SOSIAL))}</b></div>
            <div class="kv total"><span>Dibayar warga (${rp(TARIF_SOSIAL)}/L)</span><b data-o="pay">${rp(v * TARIF_SOSIAL)}</b></div>
            <p class="muted small" style="margin:12px 0 0;line-height:1.5">Tarif sosial adalah simulasi. Keterjangkauan ditetapkan bersama sponsor dan koperasi. Data keuangan warga dibatasi sesuai kebutuhan operasional; laporan sponsor memakai ringkasan agregat.</p>
          </div>
          <div class="card mt">
            <h3>Pembayaran terakhir</h3>
            ${s.payments.length ? `<ul class="list">${s.payments.slice().reverse().slice(0, 6).map((p) => `<li><div class="li-ic ok">${icon('i-wallet')}</div><div class="li-main"><div class="t">${rp(p.paid)} · ${esc(p.payer)}</div><div class="d">${p.vol} L · ${esc(p.ch)} · ${timeStr(p.at)}</div></div><button class="btn ghost sm" data-act="receipt" data-id="${p.id}">Bukti</button></li>`).join('')}</ul>`
              : '<div class="empty">Belum ada pembayaran.</div>'}
          </div>
        </div>
      </div>`;
  };

  pages.laboratorium = () => {
    const s = S();
    const sf = safety(s);
    return `
      ${pageHead('Hasil laboratorium', { lead: 'Sensor proses tidak membuktikan ketiadaan mikroba. Laboratorium independen harus memeriksa parameter mikrobiologi dan kimia sebelum air diklaim aman.' })}
      ${safetyAlert(sf)}
      <div class="grid g-3-2 mt">
        <div class="card">
          <h3 style="margin-bottom:14px">Unggah hasil uji</h3>
          <form data-form="lab">
            <div class="frow">
              <div><label class="f" for="ld">Tanggal pengambilan sampel</label><input class="input" id="ld" name="date" type="date" value="${now().toISOString().slice(0, 10)}" required></div>
              <div><label class="f" for="ln">Laboratorium</label><input class="input" id="ln" name="labName" value="Laboratorium mitra (simulasi)" required></div>
            </div>
            <div class="frow">
              <div><label class="f" for="lm">Parameter mikrobiologi</label><select class="input" id="lm" name="micro"><option value="lulus">Memenuhi syarat</option><option value="gagal">Tidak memenuhi</option></select></div>
              <div><label class="f" for="lc">Parameter kimia</label><select class="input" id="lc" name="chem"><option value="lulus">Memenuhi syarat</option><option value="gagal">Tidak memenuhi</option></select></div>
            </div>
            <label class="f" for="lf">Dokumen hasil (PDF atau foto)</label>
            <input class="input" id="lf" name="file" type="file" accept="application/pdf,image/*">
            <button class="btn block" type="submit">${icon('i-flask')}Unggah hasil</button>
          </form>
        </div>
        <div>
          <div class="card">
            <h3>Status pengolahan</h3>
            <div class="kv"><span>Interlock</span><b>${s.interlock ? 'Aktif' : 'Nonaktif'}</b></div>
            <div class="kv"><span>Sensor proses</span><b style="color:${s.sensor === 'normal' ? 'var(--ok)' : 'var(--bad)'}">${s.sensor}</b></div>
            <div class="kv"><span>Keluaran</span><b>${s.sensor === 'normal' ? 'Terbuka' : 'Ditutup'}</b></div>
            ${s.sensor !== 'normal' ? `<button class="btn ghost block" data-act="fix-sensor">${icon('i-check')}Tandai pengolahan sudah diperbaiki</button>` : ''}
          </div>
          <div class="card mt">
            <h3>Riwayat uji</h3>
            ${s.labs.length ? `<ul class="list">${s.labs.slice().reverse().map((l) => `<li><div class="li-ic ${l.status === 'lulus' ? 'ok' : 'bad'}">${icon('i-flask')}</div><div class="li-main"><div class="t">${l.status === 'lulus' ? 'Lulus' : 'Gagal'} · ${dateStr(l.date)}</div><div class="d">${esc(l.labName)}${l.file ? ' · ' + esc(l.file) : ''}</div></div></li>`).join('')}</ul>`
              : '<div class="empty">Belum ada hasil untuk lokasi ini.</div>'}
          </div>
        </div>
      </div>`;
  };

  pages.gangguan = () => {
    const s = S();
    const f = ui.issueFilter;
    const items = s.issues.filter((i) => f === 'semua' || (f === 'terbuka' ? !i.closed : i.closed)).slice().reverse();
    return `
      ${pageHead('Laporan gangguan', { lead: 'Warga dapat melapor melalui operator tanpa wajib memakai aplikasi. Data gangguan menjadi dasar perbaikan desain.' })}
      <div class="grid g-3-2">
        <div class="card">
          <h3 style="margin-bottom:14px">Laporan baru</h3>
          <form data-form="issue">
            <div class="frow">
              <div><label class="f" for="ic">Jenis gangguan</label><select class="input" id="ic" name="cat"><option>Rasa atau bau air</option><option>Debit rendah</option><option>Kebocoran</option><option>Perangkat mati</option><option>Antrean atau tarif</option><option>Lainnya</option></select></div>
              <div><label class="f" for="ir">Dilaporkan oleh</label><select class="input" id="ir" name="by"><option>Warga (melalui operator)</option><option>Operator</option><option>Koperasi</option></select></div>
            </div>
            <label class="f" for="idesc">Keterangan</label>
            <textarea class="input" id="idesc" name="desc" placeholder="Jelaskan singkat apa yang terjadi" required></textarea>
            <button class="btn block" type="submit">${icon('i-alert')}Kirim laporan</button>
          </form>
        </div>
        <div class="card">
          <div class="card-h"><h3>Riwayat laporan</h3>
            <div class="seg">${['semua', 'terbuka', 'selesai'].map((k) => `<button class="${f === k ? 'on' : ''}" data-act="ifilter" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
          ${items.length ? `<ul class="list">${items.map((i) => `<li><div class="li-ic ${i.closed ? 'ok' : 'bad'}">${icon(i.closed ? 'i-check' : 'i-alert')}</div>
            <div class="li-main"><div class="t">${esc(i.cat)}</div><div class="d">${esc(i.desc)} · ${esc(i.by)} · ${timeStr(i.at)}</div></div>
            ${i.closed ? '<span class="pill ok">Selesai</span>' : `<button class="btn ghost sm" data-act="close-issue" data-id="${i.id}">Tutup</button>`}</li>`).join('')}</ul>`
            : '<div class="empty">Tidak ada laporan.</div>'}
        </div>
      </div>`;
  };

  pages.sinkronisasi = () => `
    ${pageHead('Sinkronisasi data', { sim: false, lead: 'Pemantauan tetap berjalan saat jaringan putus. Catatan disimpan di perangkat dan dikirim ulang saat tersambung.' })}
    <div class="grid g-3-2">
      <div>
        <div class="alert ${state.online ? 'ok' : 'warn'}">${icon(state.online ? 'i-wifi' : 'i-wifi-off')}<div><b>${state.online ? 'Online' : 'Offline · data disimpan di perangkat'}</b>${state.online ? 'Catatan baru langsung dikirim ke server.' : 'Catatan tetap tersimpan lokal dan dikirim ulang saat tersambung.'}</div></div>
        <div class="card mt">
          <h3>Antrean pengiriman</h3>
          ${state.queue.length ? `<ul class="list">${state.queue.slice().reverse().map((q) => `<li><div class="li-ic warn">${icon('i-sync')}</div><div class="li-main"><div class="t">${esc(q.label)}</div><div class="d">${esc(state.sites[q.site]?.name || '')}</div></div><span class="muted small">${timeStr(q.at)}</span></li>`).join('')}</ul>`
            : '<div class="empty">Tidak ada data yang menunggu.</div>'}
        </div>
      </div>
      <div class="card">
        <h3>Ringkasan</h3>
        <div class="kv"><span>Status jaringan</span><b>${state.online ? 'Terhubung' : 'Terputus'}</b></div>
        <div class="kv"><span>Menunggu dikirim</span><b>${state.queue.length}</b></div>
        <div class="kv"><span>Sudah terkirim</span><b>${state.sent}</b></div>
        <button class="btn block ${state.online ? 'ghost' : 'dark'}" data-act="net">${icon(state.online ? 'i-wifi-off' : 'i-sync')}${state.online ? 'Simulasikan jaringan putus' : 'Sambungkan & kirim ulang'}</button>
      </div>
    </div>`;

  const DIAG = {
    energi: 'Kolektor panas surya menyediakan panas regenerasi untuk desorpsi. Panel fotovoltaik memberi listrik untuk sensor, kipas, pompa, dan disinfeksi.',
    modul: 'Udara melewati prafilter menuju sorben. Material higroskopis menyerap uap air; pemanasan melepaskannya.',
    kondensasi: 'Kondensor mengubah uap menjadi air cair. Pemisah tetesan mencegah sorben masuk ke jalur air.',
    pantau: 'Sensor volume, suhu, kelembapan, dan status pengolahan dipantau terus. Interlock menutup keluaran saat proses bermasalah.',
    olah: 'Air melewati filtrasi dan disinfeksi yang tervalidasi. Laboratorium independen memeriksa parameter mikrobiologi dan kimia.',
    sirkular: 'Kartrid, kipas, sensor, dan baterai dapat diganti tanpa membuang seluruh alat. Komponen dikumpulkan kembali melalui distributor.',
    tangki: 'Air disimpan di tangki tertutup. Volume pengambilan dicatat dan pengambilan dijadwalkan.',
  };
  const dbox = (k, title, lines, style) => `<button class="dbox ${ui.diag === k ? 'on' : ''}" data-act="diag" data-k="${k}" style="${style}"><b>${title}</b>${lines.join('<br>')}</button>`;

  pages.rancangan = () => `
    ${pageHead('Rancangan produk', { sim: false, lead: 'Rancangan konseptual AquaGrid C50. Klik setiap bagian untuk penjelasan. Visual ini adalah desain sistem usulan, bukan foto prototipe.' })}
    <div class="diagram">
      <h3 class="dt">AquaGrid C50</h3>
      <div class="ds">Rancangan konseptual • 10 modul × target 5 liter per hari</div>
      <div class="dgrid">
        ${dbox('energi', 'Energi matahari', ['Kolektor panas: desorpsi', 'Panel PV: listrik bantu', 'Baterai: kontrol dan sensor'], 'grid-column:1;grid-row:1')}
        <div class="arr-r" style="grid-column:2;grid-row:1"></div>
        ${dbox('modul', 'Modul penangkap uap', ['Udara melewati prafilter', 'Kartrid sorben terisolasi', 'Siklus serap dan lepas uap'], 'grid-column:3;grid-row:1')}
        <div class="arr-r" style="grid-column:4;grid-row:1"></div>
        ${dbox('kondensasi', 'Kondensasi', ['Uap menjadi air cair', 'Pemisah tetesan sorben', 'Jalur air tertutup'], 'grid-column:5;grid-row:1')}
        <div class="arr-d" style="grid-column:5;grid-row:2"></div>
        ${dbox('pantau', 'Pemantauan dan kendali lokal', ['Sensor volume, suhu, RH, dan status pengolahan', 'Interlock menutup keluaran saat proses bermasalah', 'Data tetap tersimpan ketika jaringan terputus'], 'grid-column:1 / span 3;grid-row:3')}
        ${dbox('olah', 'Pengolahan air', ['Filtrasi dan disinfeksi', 'Pemantauan proses', 'Uji laboratorium berkala'], 'grid-column:5;grid-row:3')}
        <div class="arr-d" style="grid-column:5;grid-row:4"></div>
        <div class="gap" style="grid-column:1 / span 3;grid-row:4"></div>
        ${dbox('sirkular', 'Perawatan sirkular', ['Kartrid dan modul dapat dilepas untuk servis', 'Komponen dikembalikan melalui distributor', 'Baterai dan residu dipisahkan dari aliran air'], 'grid-column:1 / span 3;grid-row:5')}
        ${dbox('tangki', 'Tangki dan dispenser', ['Tangki tertutup', 'Pencatatan volume', 'Pengambilan air terjadwal'], 'grid-column:5;grid-row:5')}
      </div>
    </div>
    ${ui.diag ? `<div class="alert info mt">${icon('i-info')}<div>${DIAG[ui.diag]}</div></div>` : ''}

    <div class="grid g3 mt">
      <div class="card">
        <h3>Angka rencana</h3>
        <div class="kv"><span>Target produksi</span><b>50 L/hari per C50</b></div>
        <div class="kv"><span>Ketersediaan operasi</span><b>90%</b></div>
        <div class="kv"><span>Volume tahunan</span><b>16.425 L</b></div>
        <div class="kv"><span>Layanan (alokasi 2 L/orang)</span><b>± 22 orang</b></div>
      </div>
      <div class="card">
        <h3>Model bisnis</h3>
        <div class="kv"><span>Harga rencana C50</span><b>Rp175 juta</b></div>
        <div class="kv"><span>Kontrak layanan</span><b>Rp12 juta/tahun</b></div>
        <div class="kv"><span>Biaya per liter (sederhana)</span><b>Rp1.979</b></div>
        <div class="kv"><span>Tarif sosial simulasi</span><b>Rp500/L</b></div>
      </div>
      <div class="card">
        <h3>Proses servis</h3>
        <p class="sub" style="margin:4px 0 0">Identifikasi nomor modul, isolasi jalur air dan energi, lepas kartrid, pasang pengganti, uji kebocoran dan mutu, lalu kembalikan modul ke operasi. Kartrid lama disegel dan dicatat untuk pengembalian.</p>
        <a class="btn ghost sm" href="#/modul" style="margin-top:14px">Lihat modul ${icon('i-chev')}</a>
      </div>
    </div>`;

  // ---------- modal bukti ----------
  function openReceipt(id) {
    const s = S();
    const p = s.payments.find((x) => x.id === id);
    if (!p) return;
    modalRoot.innerHTML = `
      <div class="overlay" data-act="close-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Bukti pembayaran">
          <div class="modal-h"><h3>Bukti pembayaran</h3><button class="x-btn no-print" data-act="close-modal" aria-label="Tutup">${icon('i-x')}</button></div>
          <div class="modal-b">
            <div class="receipt-head"><div class="ok-ic">${icon('i-check')}</div>
              <div style="font-weight:800;font-size:24px;letter-spacing:-.02em">${rp(p.paid)}</div>
              <div class="muted small">${dateStr(p.at)} · ${timeStr(p.at)}</div></div>
            <div class="kv"><span>No. bukti</span><b>${p.id}</b></div>
            <div class="kv"><span>Lokasi</span><b>${esc(s.name)}</b></div>
            <div class="kv"><span>Rumah tangga</span><b>${esc(p.payer)}</b></div>
            <div class="kv"><span>Volume</span><b>${p.vol} L</b></div>
            <div class="kv"><span>Tarif sosial</span><b>${rp(TARIF_SOSIAL)}/L</b></div>
            <div class="kv"><span>Dukungan sponsor</span><b>${rp(p.subsidy)}</b></div>
            <div class="kv"><span>Kanal</span><b>${esc(p.ch)}</b></div>
            <div class="kv"><span>Operator</span><b>${esc(state.operator.name)}</b></div>
            <p class="muted small" style="text-align:center;margin:14px 0 0">Dikelola koperasi air setempat · data simulasi</p>
            <div class="grid g2 no-print" style="gap:10px;margin-top:18px">
              <button class="btn ghost" data-act="print">${icon('i-print')}Cetak</button>
              <button class="btn" data-act="close-modal">Selesai</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ---------- render ----------
  function render() {
    if (!state.operator) { app.innerHTML = pages.login(); return; }
    const { name, arg } = parseHash();
    const fn = pages[name] && name !== 'login' ? pages[name] : pages.dasbor;
    const body = fn(arg);
    const active = NAV_OF[name] || (pages[name] ? name : 'dasbor');
    app.innerHTML = header(active) + `<main class="page"><div class="wrap">${body}</div></main>` + footer();
  }

  // ---------- event ----------
  document.addEventListener('click', (e) => {
    if (ui.menu && !e.target.closest('.menu,[data-act="menu"]')) { ui.menu = false; render(); }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'close-modal') { if (e.target === t || t.tagName === 'BUTTON') modalRoot.innerHTML = ''; return; }
    if (act === 'site') return;
    const s = state.operator && S();

    switch (act) {
      case 'menu': ui.menu = !ui.menu; render(); break;
      case 'net':
        state.online = !state.online;
        if (state.online && state.queue.length) { const n = state.queue.length; state.sent += n; state.queue = []; save(); render(); toast(n + ' catatan terkirim ulang'); }
        else { save(); render(); toast(state.online ? 'Tersambung kembali' : 'Jaringan terputus · mode simpan lokal'); }
        break;
      case 'pick-site': state.siteId = t.dataset.id; ui.mod = null; save(); render(); window.scrollTo(0, 0); toast('Beralih ke ' + S().name); break;
      case 'mod': ui.mod = t.dataset.id; render(); if (innerWidth <= 900) document.querySelector('.sticky')?.scrollIntoView({ behavior: 'smooth' }); break;
      case 'vol': ui[t.dataset.k] = Number(t.dataset.v); render(); break;
      case 'ch': ui.ch = t.dataset.v; render(); break;
      case 'ifilter': ui.issueFilter = t.dataset.v; render(); break;
      case 'diag': ui.diag = ui.diag === t.dataset.k ? null : t.dataset.k; render(); break;
      case 'step': {
        const i = Number(t.dataset.i);
        ui.steps[i] = !ui.steps[i];
        if (!ui.steps[i]) for (let j = i + 1; j < ui.steps.length; j++) ui.steps[j] = false;
        render(); break;
      }
      case 'finish-service': {
        const m = s.modules.find((x) => x.id === t.dataset.id);
        m.health = 100; m.cycles = 0;
        s.services.push({ module: m.id, at: now().toISOString(), returnCode: uid('RTN') });
        s.todo[0] = true; ui.mod = m.id;
        record('Servis ' + m.id + ' dicatat');
        go('modul'); break;
      }
      case 'close-issue': s.issues.find((x) => x.id === t.dataset.id).closed = true; record('Laporan gangguan ditutup'); render(); break;
      case 'fix-sensor': s.sensor = 'normal'; record('Pengolahan ditandai normal'); render(); break;
      case 'receipt': openReceipt(t.dataset.id); break;
      case 'print': window.print(); break;
      case 'reset': { const op = state.operator; state = initialState(); state.operator = op; ui.menu = false; save(); go('dasbor'); toast('Data simulasi diatur ulang'); break; }
      case 'logout': state.operator = null; ui.menu = false; save(); location.hash = ''; render(); break;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.dataset.act === 'site') { state.siteId = e.target.value; ui.mod = null; save(); render(); toast('Beralih ke ' + S().name); }
  });

  document.addEventListener('input', (e) => {
    const k = e.target.dataset.bind;
    if (!k) return;
    ui[k] = Math.max(0, Number(e.target.value) || 0);
    document.querySelectorAll(`.chip[data-k="${k}"]`).forEach((c) => c.classList.toggle('on', Number(c.dataset.v) === ui[k]));
    if (k === 'payVol') {
      const v = ui.payVol;
      const set = (o, txt) => { const el = document.querySelector(`[data-o="${o}"]`); if (el) el.textContent = txt; };
      set('vol', v + ' L'); set('full', rp(v * BIAYA_PENUH)); set('sub', '−' + rp(v * (BIAYA_PENUH - TARIF_SOSIAL))); set('pay', rp(v * TARIF_SOSIAL));
      const b = document.querySelector('[data-pay-btn]'); if (b) b.lastChild.textContent = 'Terima ' + rp(v * TARIF_SOSIAL) + ' & terbitkan bukti';
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { modalRoot.innerHTML = ''; if (ui.menu) { ui.menu = false; render(); } } });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const d = Object.fromEntries(new FormData(f));
    const s = state.operator && S();
    switch (f.dataset.form) {
      case 'login':
        state.operator = { id: d.id.trim(), name: d.name.trim() };
        save(); go('dasbor'); break;
      case 'dist': {
        const vol = Number(d.vol);
        if (!vol || vol <= 0) return toast('Isi volume yang valid');
        if (vol > s.tank) return toast('Volume melebihi isi tangki (' + Math.round(s.tank) + ' L)');
        s.tank -= vol;
        s.distributions.push({ vol, hh: d.hh.trim(), use: d.use, at: now().toISOString() });
        s.todo[1] = true;
        record(num(vol) + ' L untuk ' + d.hh.trim());
        render(); break;
      }
      case 'pay': {
        if (!ui.payVol) return toast('Isi volume yang valid');
        const p = { id: uid('BKT'), vol: ui.payVol, paid: ui.payVol * TARIF_SOSIAL, subsidy: ui.payVol * (BIAYA_PENUH - TARIF_SOSIAL), ch: ui.ch, payer: d.payer.trim(), at: now().toISOString() };
        s.payments.push(p);
        record('Pembayaran ' + rp(p.paid));
        render(); openReceipt(p.id); break;
      }
      case 'lab': {
        const status = d.micro === 'lulus' && d.chem === 'lulus' ? 'lulus' : 'gagal';
        const entry = { status, date: d.date, labName: d.labName, micro: d.micro, chem: d.chem, file: d.file && d.file.name, at: now().toISOString() };
        s.lab = entry; s.labs.push(entry); s.todo[2] = true;
        record('Hasil lab: ' + status);
        go('dasbor'); break;
      }
      case 'issue':
        s.issues.push({ id: uid('GGN'), cat: d.cat, by: d.by, desc: d.desc.trim(), at: now().toISOString(), closed: false });
        s.todo[3] = true;
        record('Laporan gangguan dikirim');
        render(); break;
    }
  });

  render();
})();

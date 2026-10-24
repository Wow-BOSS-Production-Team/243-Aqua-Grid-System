/* AquaGrid Operator — mockup aplikasi (data simulasi).
   Alur mengikuti Lampiran A & B proposal AquaGrid (Tim SHANI, BPC UIIW 2026). */
(function () {
  'use strict';

  const STORE_KEY = 'aquagrid-mockup-v1';
  const TARIF_SOSIAL = 500;     // Rp per liter (simulasi tarif sosial)
  const BIAYA_PENUH = 1979;     // Rp per liter (biaya sederhana per liter dari proposal)
  const app = document.getElementById('app');

  // ---------- data awal (simulasi) ----------
  function makeModules(seed) {
    return Array.from({ length: 10 }, (_, i) => {
      const id = 'M' + String(i + 1).padStart(2, '0');
      const health = seed[i];
      return { id, health, cycles: Math.round((100 - health) * 9.3 + 40), rh: 58 + ((i * 7) % 15), temp: 29 + (i % 4) };
    });
  }

  function initialState() {
    return {
      operator: null,
      siteId: null,
      online: true,
      queue: [],
      sent: 0,
      sites: {
        DEMO01: {
          name: 'Lokasi DEMO 01', place: 'Sekolah dasar · wilayah layanan awal',
          today: 45.0, target: 50, history: [38, 42, 40, 47, 44, 46, 45], tank: 132, tankCap: 200,
          interlock: true, sensor: 'normal', lab: { status: 'belum' },
          modules: makeModules([92, 88, 81, 76, 95, 18, 84, 90, 73, 87]),
          distributions: [], payments: [], issues: [], services: [],
          todo: [false, false, false, false],
        },
        DEMO02: {
          name: 'Lokasi DEMO 02', place: 'Klinik desa · koperasi air',
          today: 48.5, target: 50, history: [44, 46, 49, 47, 45, 50, 48.5], tank: 171, tankCap: 200,
          interlock: true, sensor: 'normal',
          lab: { status: 'lulus', date: '2026-10-20', labName: 'Laboratorium mitra (simulasi)', micro: 'lulus', chem: 'lulus' },
          modules: makeModules([86, 91, 89, 94, 83, 88, 92, 79, 85, 90]),
          distributions: [], payments: [], issues: [], services: [],
          todo: [false, false, false, false],
        },
        DEMO03: {
          name: 'Lokasi DEMO 03', place: 'Komunitas terpencil · musim kering',
          today: 31.0, target: 50, history: [36, 34, 33, 30, 29, 32, 31], tank: 48, tankCap: 200,
          interlock: true, sensor: 'gagal', lab: { status: 'belum' },
          modules: makeModules([70, 64, 22, 77, 68, 15, 72, 66, 80, 61]),
          distributions: [], payments: [], issues: [], services: [],
          todo: [false, false, false, false],
        },
      },
    };
  }

  let state = load();
  let route = { name: state.operator ? (state.siteId ? 'dash' : 'sites') : 'login', params: {} };
  let ui = {}; // state form sementara per layar

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage tidak tersedia */ }
    return initialState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ }
  }

  // ---------- util ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const num = (n, d = 1) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  const now = () => new Date();
  const timeStr = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = (p) => p + '-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random() * 90 + 10);
  const site = () => state.sites[state.siteId];

  function modStatus(m) { return m.health < 25 ? 'bad' : m.health < 60 ? 'warn' : 'ok'; }

  // Air boleh didistribusikan untuk konsumsi hanya jika lab lulus DAN pengolahan normal.
  function safety(s) {
    if (s.sensor !== 'normal') return { ok: false, level: 'bad', title: 'Pengolahan bermasalah', text: 'Interlock menutup keluaran. Distribusi dihentikan sampai petugas mutu memeriksa.' };
    if (s.lab.status === 'gagal') return { ok: false, level: 'bad', title: 'Uji laboratorium gagal', text: 'Hentikan distribusi, perbaiki, lalu uji ulang.' };
    if (s.lab.status !== 'lulus') return { ok: false, level: 'warn', title: 'Uji laboratorium belum diunggah', text: 'Air belum boleh diklaim aman. Sensor normal tidak berarti air aman diminum.' };
    return { ok: true, level: 'ok', title: 'Lolos uji mutu', text: 'Hasil lab terakhir ' + dateStr(s.lab.date) + '. Distribusi untuk konsumsi diizinkan.' };
  }

  // Semua tindakan tulis lewat sini: offline → antre lokal, online → langsung terkirim.
  function record(kind, label) {
    if (state.online) { state.sent++; toast(label + ' · terkirim'); }
    else { state.queue.push({ kind, label, at: now().toISOString(), site: state.siteId }); toast(label + ' · tersimpan lokal'); }
    save();
  }

  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    const old = app.querySelector('.toast'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = icon('i-check') + '<span>' + esc(msg) + '</span>';
    setTimeout(() => app.appendChild(el), 0);
    toastTimer = setTimeout(() => el.remove(), 2400);
  }

  function go(name, params = {}) { route = { name, params }; ui = {}; render(); const c = app.querySelector('.content'); if (c) c.scrollTop = 0; }

  // ---------- chrome ----------
  const TABS = [
    ['dash', 'Dasbor', 'i-home'],
    ['modules', 'Modul', 'i-grid'],
    ['dist', 'Distribusi', 'i-drop'],
    ['pay', 'Bayar', 'i-wallet'],
    ['more', 'Lainnya', 'i-more'],
  ];
  const TAB_OF = { dash: 'dash', modules: 'modules', module: 'modules', service: 'modules', dist: 'dist', pay: 'pay', receipt: 'pay', more: 'more', lab: 'more', issues: 'more', sync: 'more', about: 'more' };

  function netBtn() {
    const q = state.queue.length;
    return state.online
      ? `<button class="net on" data-act="toggle-net" title="Ketuk untuk simulasi jaringan putus">${icon('i-wifi')}Online</button>`
      : `<button class="net off" data-act="toggle-net" title="Ketuk untuk menyambung kembali">${icon('i-wifi-off')}Offline${q ? ` <span class="badge">${q}</span>` : ''}</button>`;
  }

  function shell(title, subtitle, body, opts = {}) {
    const back = opts.back ? `<button class="icon-btn" data-go="${opts.back}" aria-label="Kembali">${icon('i-back')}</button>` : `<svg class="logo" aria-hidden="true"><use href="#logo"/></svg>`;
    const tab = TAB_OF[route.name];
    return `
      <header class="topbar">
        <div class="topbar-row">
          ${back}
          <h1>${esc(title)}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</h1>
          ${opts.noNet ? '' : netBtn()}
        </div>
        ${opts.sim ? '<div class="sim-banner">DATA SIMULASI • Bukan hasil pengukuran prototipe</div>' : ''}
      </header>
      <main class="content">${body}</main>
      ${opts.noTabs ? '' : `<nav class="tabbar">${TABS.map(([k, l, ic]) => `<button class="tab ${tab === k ? 'active' : ''}" data-go="${k}">${icon(ic)}${l}</button>`).join('')}</nav>`}`;
  }

  // ---------- layar ----------
  const screens = {};

  screens.login = () => `
    <div class="login">
      <svg class="logo" aria-hidden="true"><use href="#logo"/></svg>
      <h2>AquaGrid Operator</h2>
      <p>Masuk untuk memantau AquaGrid C50, mencatat distribusi air, dan mengelola servis modul di lokasi Anda.</p>
      <form data-form="login">
        <label class="f" for="op-id">ID operator</label>
        <input class="input" id="op-id" name="id" placeholder="mis. OPR-0142" value="OPR-0142" required>
        <label class="f" for="op-name">Nama operator</label>
        <input class="input" id="op-name" name="name" placeholder="Nama lengkap" value="Operator Komunitas" required>
        <label class="f" for="op-pin">PIN</label>
        <input class="input" id="op-pin" name="pin" type="password" inputmode="numeric" maxlength="6" value="1234" required>
        <button class="btn" type="submit">Masuk</button>
      </form>
      <div class="foot">Mockup konsep · data simulasi<br>Tim SHANI · BPC UI Innovation War 2026</div>
    </div>`;

  screens.sites = () => {
    const items = Object.entries(state.sites).map(([id, s]) => {
      const sf = safety(s);
      return `
        <button class="site-card" data-site="${id}">
          <div class="site-ico">${icon('i-pin')}</div>
          <div class="grow" style="flex:1;min-width:0">
            <div style="font-weight:700">${esc(s.name)}</div>
            <div class="muted">${esc(s.place)}</div>
            <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">
              <span class="pill info">${num(s.today)} L hari ini</span>
              <span class="pill ${sf.level}"><span class="dot"></span>${sf.ok ? 'Aman diminum' : sf.level === 'bad' ? 'Distribusi dihentikan' : 'Menunggu uji lab'}</span>
            </div>
          </div>
          ${icon('i-chev', 'ic chev')}
        </button>`;
    }).join('');
    return shell('Pilih lokasi', 'Halo, ' + state.operator.name, `
      <p class="sub" style="margin:0 2px 14px">Pilih sistem C50 yang Anda tangani hari ini.</p>
      ${items}
      <button class="btn secondary" data-act="logout">${icon('i-logout')}Keluar</button>`, { noTabs: true, sim: true });
  };

  screens.dash = () => {
    const s = site();
    const sf = safety(s);
    const pct = Math.min(100, (s.today / s.target) * 100);
    const max = Math.max(s.target, ...s.history) * 1.1;
    const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Hari ini'];
    const needService = s.modules.filter((m) => modStatus(m) === 'bad').length;
    const todos = [
      ['Periksa kartrid', 'modules'],
      ['Catat pengambilan air', 'dist'],
      ['Unggah hasil laboratorium', 'lab'],
      ['Laporkan gangguan', 'issues'],
    ];
    return shell(s.name, s.place, `
      <div class="grid2">
        <div class="card">
          <h3>Produksi hari ini</h3>
          <div class="big">${num(s.today)}<small> liter</small></div>
          <div class="muted">Target desain ${s.target} L/hari</div>
          <div class="meter ${pct < 70 ? 'warn' : ''}"><i style="width:${pct}%"></i></div>
        </div>
        <div class="card">
          <h3>Tangki</h3>
          <div class="big">${Math.round(s.tank)}<small> / ${s.tankCap} L</small></div>
          <div class="muted">Tangki tertutup</div>
          <div class="meter ${s.tank / s.tankCap < .3 ? 'warn' : ''}"><i style="width:${(s.tank / s.tankCap) * 100}%"></i></div>
        </div>
      </div>

      <div class="section">Keamanan air</div>
      <div class="grid2">
        <div class="card">
          <h3>Status pengolahan</h3>
          <div class="status-line"><span class="pill ${s.interlock ? 'info' : 'neutral'}"><span class="dot"></span>Interlock ${s.interlock ? 'aktif' : 'nonaktif'}</span></div>
          <div class="status-line">Sensor proses: <b style="color:${s.sensor === 'normal' ? 'var(--ok)' : 'var(--bad)'}">${s.sensor}</b></div>
          <div class="status-line">Keluaran: <b>${s.sensor === 'normal' ? 'terbuka' : 'ditutup'}</b></div>
        </div>
        <button class="card" data-go="lab" style="text-align:left">
          <h3>Uji laboratorium</h3>
          <div class="status-line"><span class="pill ${s.lab.status === 'lulus' ? 'ok' : s.lab.status === 'gagal' ? 'bad' : 'warn'}"><span class="dot"></span>${s.lab.status === 'belum' ? 'Belum diunggah' : s.lab.status === 'lulus' ? 'Lulus' : 'Gagal'}</span></div>
          <div class="status-line">${s.lab.status === 'belum' ? 'Air belum boleh diklaim aman' : 'Sampel ' + dateStr(s.lab.date)}</div>
        </button>
      </div>
      <div class="alert ${sf.level}" style="margin-top:12px">${icon(sf.ok ? 'i-check' : 'i-alert')}<div><b>${sf.title}</b>${sf.text}</div></div>

      <div class="section">Riwayat produksi</div>
      <div class="card">
        <div class="row between"><h3>Liter per hari · 7 hari terakhir</h3><span class="muted">rata-rata ${num(s.history.reduce((a, b) => a + b, 0) / 7)} L</span></div>
        <div class="bars">
          <div class="target" style="bottom:${(s.target / max) * 114}px"><span>target ${s.target} L</span></div>
          ${s.history.map((v, i) => `<div class="bar ${i === 6 ? 'today' : ''}"><b>${Math.round(v)}</b><i style="height:${(v / max) * 114}px"></i></div>`).join('')}
        </div>
        <div class="bar-labels">${days.map((d) => `<span>${d}</span>`).join('')}</div>
      </div>

      <div class="section">Tindakan operator</div>
      <div class="card">
        ${todos.map(([t, r], i) => `
          <div class="todo ${s.todo[i] ? 'done' : ''}">
            <span class="n">${s.todo[i] ? '✓' : i + 1}</span>
            <span class="t" style="flex:1">${t}</span>
            <button class="pill info" data-go="${r}" style="border:0">Buka</button>
          </div>`).join('')}
        <div class="status-line" style="margin-top:12px">Koneksi: <b>${state.online ? 'online' : 'tersimpan lokal'}</b>${state.queue.length ? ` · ${state.queue.length} antre` : ''}</div>
      </div>
      ${needService ? `<div class="alert warn" style="margin-top:12px">${icon('i-alert')}<div><b>${needService} modul perlu servis</b>Kesehatan kartrid di bawah 25%. <a href="#" data-go="modules" style="color:inherit;font-weight:700">Lihat modul</a></div></div>` : ''}
      <p class="muted" style="text-align:center;margin-top:18px">Prinsip tampilan: volume produksi dipisahkan dari status keamanan air.</p>
    `, { sim: true });
  };

  screens.modules = () => {
    const s = site();
    const counts = { ok: 0, warn: 0, bad: 0 };
    s.modules.forEach((m) => counts[modStatus(m)]++);
    return shell('Modul C50', s.name + ' · 10 modul × target 5 L/hari', `
      <div class="card">
        <div class="row between">
          <h3>Status modul sorpsi</h3>
          <div class="row" style="gap:6px"><span class="pill ok">${counts.ok}</span><span class="pill warn">${counts.warn}</span><span class="pill bad">${counts.bad}</span></div>
        </div>
        <div class="modgrid" style="margin-top:12px">
          ${s.modules.map((m) => `<button class="mod ${modStatus(m)}" data-go="module" data-id="${m.id}"><span class="led"></span><span class="id">${m.id}</span><span class="hp">${m.health}%</span></button>`).join('')}
        </div>
        <p class="muted" style="margin:12px 0 0">Persentase = perkiraan sisa umur kartrid sorben.</p>
      </div>
      <div class="section">Energi</div>
      <div class="card">
        <div class="kv"><span>${icon('i-sun')} Kolektor panas (desorpsi)</span><b>Aktif</b></div>
        <div class="kv"><span>Panel PV · listrik bantu</span><b>412 W</b></div>
        <div class="kv"><span>Baterai · kontrol & sensor</span><b>78%</b></div>
        <p class="muted" style="margin:8px 0 0">Baterai mendukung beban bantu, bukan menjamin produksi air malam hari.</p>
      </div>
      <div class="section">Riwayat servis</div>
      ${s.services.length ? `<div class="list">${s.services.slice().reverse().map((v) => `
        <div class="list-item"><div class="ico">${icon('i-recycle')}</div><div class="grow"><div class="t">${v.module} · kartrid diganti</div><div class="d">${dateStr(v.at)} ${timeStr(v.at)} · kartrid lama ${v.returnCode} disegel untuk pengembalian</div></div></div>`).join('')}</div>`
        : '<div class="card empty">Belum ada servis tercatat.</div>'}
    `, { sim: true });
  };

  screens.module = () => {
    const s = site();
    const m = s.modules.find((x) => x.id === route.params.id);
    const st = modStatus(m);
    return shell('Modul ' + m.id, s.name, `
      <div class="card">
        <div class="row between"><h3>Kartrid sorben</h3><span class="pill ${st}"><span class="dot"></span>${st === 'ok' ? 'Normal' : st === 'warn' ? 'Pantau' : 'Perlu servis'}</span></div>
        <div class="big">${m.health}<small>% sisa umur</small></div>
        <div class="meter ${st === 'ok' ? '' : st}"><i style="width:${m.health}%"></i></div>
        <div style="margin-top:12px">
          <div class="kv"><span>Siklus serap–lepas</span><b>${m.cycles}</b></div>
          <div class="kv"><span>Kelembapan udara (RH)</span><b>${m.rh}%</b></div>
          <div class="kv"><span>Suhu</span><b>${m.temp}°C</b></div>
          <div class="kv"><span>Prafilter</span><b>Bersih</b></div>
        </div>
      </div>
      <div class="alert info" style="margin-top:12px">${icon('i-info')}<div>Kendali berbasis suhu dan kelembapan mengatur waktu siklus serap dan lepas uap.</div></div>
      <button class="btn ${st === 'bad' ? '' : 'secondary'}" data-go="service" data-id="${m.id}">${icon('i-recycle')}Mulai servis kartrid</button>
    `, { back: 'modules', sim: true });
  };

  const SERVICE_STEPS = [
    ['Identifikasi nomor modul', 'Cocokkan nomor seri modul dengan catatan.'],
    ['Isolasi jalur air dan energi', 'Tutup katup modul dan putus daya bantu.'],
    ['Lepas kartrid lama', 'Segel kartrid lama dan beri label pengembalian.'],
    ['Pasang kartrid pengganti', 'Catat nomor seri kartrid baru.'],
    ['Uji kebocoran dan mutu', 'Pastikan tidak ada kebocoran sorben ke jalur air.'],
    ['Kembalikan modul ke operasi', 'Buka katup dan aktifkan kembali siklus.'],
  ];

  screens.service = () => {
    const s = site();
    const m = s.modules.find((x) => x.id === route.params.id);
    ui.steps = ui.steps || SERVICE_STEPS.map(() => false);
    const doneCount = ui.steps.filter(Boolean).length;
    const next = ui.steps.indexOf(false);
    return shell('Servis ' + m.id, 'Penggantian kartrid di lapangan', `
      <div class="card">
        <div class="row between"><h3>Langkah servis</h3><span class="muted">${doneCount}/${SERVICE_STEPS.length}</span></div>
        <div class="meter"><i style="width:${(doneCount / SERVICE_STEPS.length) * 100}%"></i></div>
        <div class="steps" style="margin-top:6px">
          ${SERVICE_STEPS.map(([t, d], i) => `
            <button class="step ${ui.steps[i] ? 'done' : ''} ${i > next && next !== -1 ? 'locked' : ''}" data-act="step" data-i="${i}" ${i > next && next !== -1 ? 'disabled' : ''}>
              <span class="box">${ui.steps[i] ? icon('i-check') : ''}</span>
              <span><span class="t">${i + 1}. ${t}</span><span class="d" style="display:block">${d}</span></span>
            </button>`).join('')}
        </div>
      </div>
      <div class="alert info" style="margin-top:12px">${icon('i-recycle')}<div><b>Strategi sirkular</b>Kartrid lama dikembalikan melalui distributor untuk diperbaiki, dipakai ulang jika aman, atau diserahkan ke pengelola limbah yang sesuai.</div></div>
      <button class="btn" data-act="finish-service" data-id="${m.id}" ${doneCount < SERVICE_STEPS.length ? 'disabled' : ''}>Selesaikan & catat servis</button>
    `, { back: 'module&id=' + m.id, sim: true });
  };

  screens.dist = () => {
    const s = site();
    const sf = safety(s);
    ui.vol = ui.vol ?? 20;
    const todayTotal = s.distributions.filter((d) => new Date(d.at).toDateString() === now().toDateString()).reduce((a, d) => a + d.vol, 0);
    return shell('Catat distribusi', s.name, `
      <div class="alert ${sf.level}">${icon(sf.ok ? 'i-check' : 'i-alert')}<div><b>${sf.title}</b>${sf.text}</div></div>
      <div class="card" style="margin-top:12px">
        <form data-form="dist">
          <label class="f">Volume diambil (liter)</label>
          <div class="chips">${[5, 10, 20, 40].map((v) => `<button type="button" class="chip ${ui.vol === v ? 'on' : ''}" data-act="vol" data-v="${v}">${v} L</button>`).join('')}</div>
          <input class="input" style="margin-top:8px" name="vol" type="number" min="1" max="${Math.floor(s.tank)}" step="0.5" value="${ui.vol}" data-bind="vol">
          <label class="f" for="hh">ID rumah tangga / penerima</label>
          <input class="input" id="hh" name="hh" placeholder="mis. RT-018" required>
          <label class="f" for="use">Keperluan</label>
          <select class="input" id="use" name="use">
            <option>Minum & memasak</option>
            <option>Sekolah</option>
            <option>Klinik</option>
          </select>
          <button class="btn" type="submit" ${sf.ok ? '' : 'disabled'}>${icon('i-drop')}Catat pengambilan</button>
          ${sf.ok ? '' : '<p class="muted" style="text-align:center;margin:8px 0 0">Distribusi untuk konsumsi mengikuti keputusan petugas mutu.</p>'}
        </form>
      </div>
      <div class="section">Hari ini · ${num(todayTotal)} L tercatat · tangki ${Math.round(s.tank)} L</div>
      ${s.distributions.length ? `<div class="list">${s.distributions.slice().reverse().slice(0, 8).map((d) => `
        <div class="list-item"><div class="ico">${icon('i-drop')}</div><div class="grow"><div class="t">${num(d.vol)} L · ${esc(d.hh)}</div><div class="d">${esc(d.use)} · ${timeStr(d.at)}</div></div></div>`).join('')}</div>`
        : '<div class="card empty">Belum ada pengambilan tercatat.</div>'}
    `, { sim: true });
  };

  screens.pay = () => {
    const s = site();
    ui.vol = ui.vol ?? 20;
    ui.ch = ui.ch ?? 'Tunai';
    const user = ui.vol * TARIF_SOSIAL;
    const sub = ui.vol * (BIAYA_PENUH - TARIF_SOSIAL);
    return shell('Pembayaran komunitas', s.name, `
      <div class="card">
        <form data-form="pay">
          <label class="f">1 · Pilih volume</label>
          <div class="chips">${[10, 20, 40, 60].map((v) => `<button type="button" class="chip ${ui.vol === v ? 'on' : ''}" data-act="vol" data-v="${v}">${v} L</button>`).join('')}</div>
          <input class="input" style="margin-top:8px" type="number" min="1" step="1" value="${ui.vol}" data-bind="vol">

          <label class="f">2 · Tarif dan dukungan subsidi</label>
          <div class="kv"><span>Biaya penuh (${rp(BIAYA_PENUH)}/L)</span><b>${rp(ui.vol * BIAYA_PENUH)}</b></div>
          <div class="kv"><span>Ditanggung sponsor</span><b style="color:var(--ok)">−${rp(sub)}</b></div>
          <div class="kv total"><span>Dibayar warga (${rp(TARIF_SOSIAL)}/L)</span><b>${rp(user)}</b></div>

          <label class="f">3 · Kanal pembayaran</label>
          <div class="chips">${['Tunai', 'Kanal setempat'].map((c) => `<button type="button" class="chip ${ui.ch === c ? 'on' : ''}" data-act="ch" data-v="${c}">${c}</button>`).join('')}</div>

          <label class="f" for="payer">ID rumah tangga</label>
          <input class="input" id="payer" name="payer" placeholder="mis. RT-018" required>

          <button class="btn" type="submit">${icon('i-wallet')}Terima ${rp(user)} & terbitkan bukti</button>
        </form>
      </div>
      <p class="muted" style="margin:12px 2px 0">Tarif sosial adalah simulasi. Keterjangkauan ditetapkan bersama sponsor dan koperasi. Data keuangan warga dibatasi sesuai kebutuhan operasional; laporan sponsor memakai ringkasan agregat.</p>
      ${s.payments.length ? `<div class="section">Pembayaran terakhir</div><div class="list">${s.payments.slice().reverse().slice(0, 5).map((p) => `
        <button class="list-item" data-go="receipt" data-id="${p.id}"><div class="ico">${icon('i-wallet')}</div><div class="grow"><div class="t">${rp(p.paid)} · ${esc(p.payer)}</div><div class="d">${p.vol} L · ${esc(p.ch)} · ${timeStr(p.at)}</div></div>${icon('i-chev', 'ic chev')}</button>`).join('')}</div>` : ''}
    `, { sim: true });
  };

  screens.receipt = () => {
    const s = site();
    const p = s.payments.find((x) => x.id === route.params.id);
    return shell('Bukti pembayaran', p.id, `
      <div class="receipt">
        <div class="head">
          <div class="ok-ic">${icon('i-check')}</div>
          <div style="font-weight:800;font-size:18px">${rp(p.paid)}</div>
          <div class="muted">${dateStr(p.at)} · ${timeStr(p.at)}</div>
        </div>
        <div class="kv"><span>No. bukti</span><b>${p.id}</b></div>
        <div class="kv"><span>Lokasi</span><b>${esc(s.name)}</b></div>
        <div class="kv"><span>Rumah tangga</span><b>${esc(p.payer)}</b></div>
        <div class="kv"><span>Volume</span><b>${p.vol} L</b></div>
        <div class="kv"><span>Tarif sosial</span><b>${rp(TARIF_SOSIAL)}/L</b></div>
        <div class="kv"><span>Dukungan sponsor</span><b>${rp(p.subsidy)}</b></div>
        <div class="kv"><span>Kanal</span><b>${esc(p.ch)}</b></div>
        <div class="kv"><span>Operator</span><b>${esc(state.operator.name)}</b></div>
        <p class="muted" style="text-align:center;margin:12px 0 0">Dikelola koperasi air setempat · data simulasi</p>
      </div>
      <button class="btn" data-go="pay">Selesai</button>
    `, { back: 'pay', noNet: false });
  };

  screens.more = () => {
    const s = site();
    const items = [
      ['lab', 'i-flask', 'Unggah hasil laboratorium', s.lab.status === 'belum' ? 'Belum ada hasil untuk lokasi ini' : 'Terakhir: ' + s.lab.status, s.lab.status === 'lulus' ? '' : 'warn'],
      ['issues', 'i-alert', 'Laporan gangguan', s.issues.filter((i) => !i.closed).length + ' terbuka', s.issues.some((i) => !i.closed) ? 'bad' : ''],
      ['sync', 'i-sync', 'Sinkronisasi data', state.queue.length ? state.queue.length + ' catatan menunggu dikirim' : 'Semua data terkirim', state.queue.length ? 'warn' : ''],
      ['about', 'i-info', 'Rancangan AquaGrid C50', 'Alur energi, modul, pengolahan, dan perawatan sirkular', ''],
    ];
    return shell('Lainnya', s.name, `
      <div class="list">
        ${items.map(([r, ic, t, d, lv]) => `<button class="list-item" data-go="${r}"><div class="ico ${lv}">${icon(ic)}</div><div class="grow"><div class="t">${t}</div><div class="d">${esc(d)}</div></div>${icon('i-chev', 'ic chev')}</button>`).join('')}
      </div>
      <div class="section">Akun</div>
      <div class="list">
        <div class="list-item"><div class="ico">${icon('i-home')}</div><div class="grow"><div class="t">${esc(state.operator.name)}</div><div class="d">${esc(state.operator.id)}</div></div></div>
        <button class="list-item" data-act="switch-site"><div class="ico">${icon('i-pin')}</div><div class="grow"><div class="t">Ganti lokasi</div><div class="d">${esc(s.name)}</div></div>${icon('i-chev', 'ic chev')}</button>
        <button class="list-item" data-act="reset"><div class="ico warn">${icon('i-sync')}</div><div class="grow"><div class="t">Atur ulang data simulasi</div><div class="d">Kembalikan semua lokasi ke kondisi awal</div></div></button>
        <button class="list-item" data-act="logout"><div class="ico bad">${icon('i-logout')}</div><div class="grow"><div class="t">Keluar</div></div></button>
      </div>
    `, { sim: true });
  };

  screens.lab = () => {
    const s = site();
    const sf = safety(s);
    return shell('Hasil laboratorium', s.name, `
      <div class="alert ${sf.level}">${icon(sf.ok ? 'i-check' : 'i-alert')}<div><b>Status saat ini: ${sf.title}</b>Sensor proses tidak membuktikan ketiadaan mikroba; laboratorium independen harus memeriksa parameter mikrobiologi dan kimia.</div></div>
      <div class="card" style="margin-top:12px">
        <form data-form="lab">
          <label class="f" for="ld">Tanggal pengambilan sampel</label>
          <input class="input" id="ld" name="date" type="date" value="${now().toISOString().slice(0, 10)}" required>
          <label class="f" for="ln">Laboratorium</label>
          <input class="input" id="ln" name="labName" value="Laboratorium mitra (simulasi)" required>
          <label class="f" for="lm">Parameter mikrobiologi</label>
          <select class="input" id="lm" name="micro"><option value="lulus">Memenuhi syarat</option><option value="gagal">Tidak memenuhi</option></select>
          <label class="f" for="lc">Parameter kimia</label>
          <select class="input" id="lc" name="chem"><option value="lulus">Memenuhi syarat</option><option value="gagal">Tidak memenuhi</option></select>
          <label class="f" for="lf">Dokumen hasil (PDF/foto)</label>
          <input class="input" id="lf" name="file" type="file" accept="application/pdf,image/*">
          <button class="btn" type="submit">${icon('i-flask')}Unggah hasil</button>
        </form>
      </div>
      ${s.sensor !== 'normal' ? `<button class="btn secondary" data-act="fix-sensor">Tandai pengolahan sudah diperbaiki</button>` : ''}
    `, { back: 'more', sim: true });
  };

  screens.issues = () => {
    const s = site();
    return shell('Laporan gangguan', s.name, `
      <div class="card">
        <form data-form="issue">
          <label class="f" for="ic">Jenis gangguan</label>
          <select class="input" id="ic" name="cat">
            <option>Rasa atau bau air</option><option>Debit rendah</option><option>Kebocoran</option><option>Perangkat mati</option><option>Antrean / tarif</option><option>Lainnya</option>
          </select>
          <label class="f" for="ir">Dilaporkan oleh</label>
          <select class="input" id="ir" name="by"><option>Warga (melalui operator)</option><option>Operator</option><option>Koperasi</option></select>
          <label class="f" for="id">Keterangan</label>
          <textarea class="input" id="id" name="desc" placeholder="Jelaskan singkat apa yang terjadi" required></textarea>
          <button class="btn" type="submit">${icon('i-alert')}Kirim laporan</button>
        </form>
      </div>
      <p class="muted" style="margin:10px 2px 0">Warga dapat melapor melalui operator tanpa wajib memakai aplikasi. Data gangguan menjadi dasar perbaikan desain.</p>
      <div class="section">Riwayat laporan</div>
      ${s.issues.length ? `<div class="list">${s.issues.slice().reverse().map((i) => `
        <div class="list-item"><div class="ico ${i.closed ? '' : 'bad'}">${icon(i.closed ? 'i-check' : 'i-alert')}</div>
          <div class="grow"><div class="t">${esc(i.cat)}</div><div class="d">${esc(i.desc)} · ${esc(i.by)} · ${timeStr(i.at)}</div></div>
          ${i.closed ? '<span class="pill ok">Selesai</span>' : `<button class="pill warn" style="border:0" data-act="close-issue" data-id="${i.id}">Tutup</button>`}
        </div>`).join('')}</div>` : '<div class="card empty">Belum ada laporan.</div>'}
    `, { back: 'more', sim: true });
  };

  screens.sync = () => shell('Sinkronisasi', state.online ? 'Terhubung' : 'Jaringan terputus', `
    <div class="alert ${state.online ? 'ok' : 'warn'}">${icon(state.online ? 'i-wifi' : 'i-wifi-off')}<div>
      <b>${state.online ? 'Online' : 'Offline · data disimpan di perangkat'}</b>
      ${state.online ? 'Catatan baru langsung dikirim ke server.' : 'Catatan tetap tersimpan lokal dan dikirim ulang otomatis saat tersambung.'}
    </div></div>
    <div class="card" style="margin-top:12px">
      <div class="kv"><span>Menunggu dikirim</span><b>${state.queue.length}</b></div>
      <div class="kv"><span>Sudah terkirim (sesi ini)</span><b>${state.sent}</b></div>
    </div>
    <button class="btn ${state.online ? 'secondary' : 'dark'}" data-act="toggle-net">${icon(state.online ? 'i-wifi-off' : 'i-sync')}${state.online ? 'Simulasikan jaringan putus' : 'Sambungkan & kirim ulang'}</button>
    <div class="section">Antrean</div>
    ${state.queue.length ? `<div class="list">${state.queue.slice().reverse().map((q) => `
      <div class="list-item"><div class="ico warn">${icon('i-sync')}</div><div class="grow"><div class="t">${esc(q.label)}</div><div class="d">${esc(state.sites[q.site]?.name || '')} · ${timeStr(q.at)}</div></div></div>`).join('')}</div>`
      : '<div class="card empty">Tidak ada data yang menunggu.</div>'}
  `, { back: 'more' });

  screens.about = () => shell('Rancangan C50', '10 modul × target 5 liter per hari', `
    <div class="flow">
      <div class="node"><b>${icon('i-sun')} Energi matahari</b><span>Kolektor panas untuk desorpsi · panel PV untuk listrik bantu · baterai untuk kontrol dan sensor</span></div>
      <div class="arrow">▼</div>
      <div class="node"><b>Modul penangkap uap</b><span>Udara melewati prafilter · kartrid sorben terisolasi · siklus serap dan lepas uap</span></div>
      <div class="arrow">▼</div>
      <div class="node"><b>Kondensasi</b><span>Uap menjadi air cair · pemisah tetesan sorben · jalur air tertutup</span></div>
      <div class="arrow">▼</div>
      <div class="node"><b>Pengolahan air</b><span>Filtrasi dan disinfeksi · pemantauan proses · uji laboratorium berkala</span></div>
      <div class="arrow">▼</div>
      <div class="node"><b>Tangki dan dispenser</b><span>Tangki tertutup · pencatatan volume · pengambilan air terjadwal</span></div>
      <div class="node" style="border-color:var(--teal);margin-top:8px"><b>Pemantauan dan kendali lokal</b><span>Sensor volume, suhu, RH, dan status pengolahan · interlock menutup keluaran saat proses bermasalah · data tetap tersimpan ketika jaringan terputus</span></div>
      <div class="node" style="border-color:var(--teal)"><b>${icon('i-recycle')} Perawatan sirkular</b><span>Kartrid dan modul dapat dilepas untuk servis · komponen dikembalikan melalui distributor · baterai dan residu dipisahkan dari aliran air</span></div>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Angka rencana (asumsi proposal)</h3>
      <div class="kv"><span>Target produksi</span><b>50 L/hari per C50</b></div>
      <div class="kv"><span>Ketersediaan operasi</span><b>90%</b></div>
      <div class="kv"><span>Volume tahunan</span><b>16.425 L</b></div>
      <div class="kv"><span>Layanan (alokasi 2 L/orang)</span><b>±22 orang</b></div>
      <div class="kv"><span>Target pengembalian komponen</span><b>≥80% massa</b></div>
    </div>
    <p class="muted" style="margin:12px 2px 0">Visual ini adalah desain sistem usulan, bukan foto prototipe yang sudah dibuat.</p>
  `, { back: 'more' });

  // ---------- render & event ----------
  function render() {
    if (!state.operator) route = { name: 'login', params: {} };
    else if (!state.siteId && route.name !== 'sites') route = { name: 'sites', params: {} };
    const fn = screens[route.name] || screens.dash;
    app.innerHTML = fn();
  }

  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-act],[data-site]');
    if (!t) return;
    if (t.tagName === 'A') e.preventDefault();
    const s = state.siteId && site();

    if (t.dataset.site) { state.siteId = t.dataset.site; save(); go('dash'); return; }

    if (t.dataset.go) {
      const [name, q] = t.dataset.go.split('&');
      const params = {};
      if (q) { const [k, v] = q.split('='); params[k] = v; }
      if (t.dataset.id) params.id = t.dataset.id;
      go(name, params);
      return;
    }

    switch (t.dataset.act) {
      case 'toggle-net':
        state.online = !state.online;
        if (state.online && state.queue.length) {
          const n = state.queue.length;
          state.sent += n; state.queue = [];
          save(); render(); toast(n + ' catatan terkirim ulang');
        } else { save(); render(); toast(state.online ? 'Tersambung kembali' : 'Jaringan terputus · mode lokal'); }
        break;
      case 'vol': ui.vol = Number(t.dataset.v); render(); break;
      case 'ch': ui.ch = t.dataset.v; render(); break;
      case 'step': {
        const i = Number(t.dataset.i);
        ui.steps[i] = !ui.steps[i];
        if (!ui.steps[i]) for (let j = i + 1; j < ui.steps.length; j++) ui.steps[j] = false;
        render(); break;
      }
      case 'finish-service': {
        const m = s.modules.find((x) => x.id === t.dataset.id);
        const code = uid('RTN');
        m.health = 100; m.cycles = 0;
        s.services.push({ module: m.id, at: now().toISOString(), returnCode: code });
        s.todo[0] = true;
        record('servis', 'Servis ' + m.id + ' dicatat');
        go('modules');
        break;
      }
      case 'close-issue': {
        const i = s.issues.find((x) => x.id === t.dataset.id);
        i.closed = true; record('gangguan', 'Laporan ditutup'); render(); break;
      }
      case 'fix-sensor':
        s.sensor = 'normal'; record('pengolahan', 'Pengolahan ditandai normal'); render(); break;
      case 'switch-site': state.siteId = null; save(); go('sites'); break;
      case 'reset': {
        const op = state.operator;
        state = initialState(); state.operator = op; save(); go('sites'); toast('Data simulasi diatur ulang');
        break;
      }
      case 'logout': state.operator = null; state.siteId = null; save(); go('login'); break;
    }
  });

  app.addEventListener('input', (e) => {
    if (e.target.dataset.bind === 'vol') ui.vol = Math.max(0, Number(e.target.value) || 0);
    // perbarui total pembayaran tanpa merender ulang input
    if (route.name === 'pay' && e.target.dataset.bind === 'vol') {
      const kvs = app.querySelectorAll('.kv b');
      if (kvs.length >= 3) {
        kvs[0].textContent = rp(ui.vol * BIAYA_PENUH);
        kvs[1].textContent = '−' + rp(ui.vol * (BIAYA_PENUH - TARIF_SOSIAL));
        kvs[2].textContent = rp(ui.vol * TARIF_SOSIAL);
        const b = app.querySelector('[data-form="pay"] .btn');
        b.lastChild.textContent = 'Terima ' + rp(ui.vol * TARIF_SOSIAL) + ' & terbitkan bukti';
      }
      app.querySelectorAll('.chip[data-act="vol"]').forEach((c) => c.classList.toggle('on', Number(c.dataset.v) === ui.vol));
    }
    if (route.name === 'dist' && e.target.dataset.bind === 'vol') {
      app.querySelectorAll('.chip[data-act="vol"]').forEach((c) => c.classList.toggle('on', Number(c.dataset.v) === ui.vol));
    }
  });

  app.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const d = Object.fromEntries(new FormData(f));
    const s = state.siteId && site();

    switch (f.dataset.form) {
      case 'login':
        state.operator = { id: d.id.trim(), name: d.name.trim() };
        save(); go('sites');
        break;
      case 'dist': {
        const vol = Number(d.vol);
        if (!vol || vol <= 0) return toast('Isi volume yang valid');
        if (vol > s.tank) return toast('Volume melebihi isi tangki (' + Math.round(s.tank) + ' L)');
        s.tank -= vol;
        s.distributions.push({ vol, hh: d.hh.trim(), use: d.use, at: now().toISOString() });
        s.todo[1] = true;
        record('distribusi', num(vol) + ' L untuk ' + d.hh.trim());
        render();
        break;
      }
      case 'pay': {
        if (!ui.vol || ui.vol <= 0) return toast('Isi volume yang valid');
        const p = {
          id: uid('BKT'), vol: ui.vol, paid: ui.vol * TARIF_SOSIAL, subsidy: ui.vol * (BIAYA_PENUH - TARIF_SOSIAL),
          ch: ui.ch, payer: d.payer.trim(), at: now().toISOString(),
        };
        s.payments.push(p);
        record('pembayaran', 'Pembayaran ' + rp(p.paid));
        go('receipt', { id: p.id });
        break;
      }
      case 'lab': {
        const status = d.micro === 'lulus' && d.chem === 'lulus' ? 'lulus' : 'gagal';
        s.lab = { status, date: d.date, labName: d.labName, micro: d.micro, chem: d.chem, file: d.file && d.file.name };
        s.todo[2] = true;
        record('lab', 'Hasil lab: ' + status);
        go('dash');
        break;
      }
      case 'issue': {
        s.issues.push({ id: uid('GGN'), cat: d.cat, by: d.by, desc: d.desc.trim(), at: now().toISOString(), closed: false });
        s.todo[3] = true;
        record('gangguan', 'Laporan gangguan dikirim');
        render();
        break;
      }
    }
  });

  render();
})();

// PACPAC LAND — 横スクロール・アクション（クラシック横スクロールゲームへのオマージュ作品）
// 操作は「左」「右」「ジャンプ」の3ボタンのみ。
'use strict';
(() => {
  const W = 768, H = 432, GROUND = 368;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (i, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ------------------------------------------------------------------
  // 入力（左・右・ジャンプ）
  // ------------------------------------------------------------------
  const input = { left: false, right: false, jump: false, jumpEdge: false };
  const held = { left: new Set(), right: new Set(), jump: new Set() };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  };
  function press(btn, src) {
    if (btn === 'jump' && held.jump.size === 0) input.jumpEdge = true;
    held[btn].add(src);
    input[btn] = true;
    ensureAudio();
  }
  function release(btn, src) {
    held[btn].delete(src);
    input[btn] = held[btn].size > 0;
  }
  addEventListener('keydown', e => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (!e.repeat) press(b, 'k' + e.code);
  });
  addEventListener('keyup', e => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    release(b, 'k' + e.code);
  });
  addEventListener('blur', () => {
    for (const b in held) { held[b].clear(); input[b] = false; }
    document.querySelectorAll('[data-btn]').forEach(el => el.classList.remove('on'));
  });
  document.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.dataset.btn;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      el.classList.add('on');
      press(b, 'p' + e.pointerId);
    });
    const up = e => {
      release(b, 'p' + e.pointerId);
      if (!held[b].size) el.classList.remove('on');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  });
  // タイトル／ゲームオーバー画面は画面タップでも進める
  canvas.addEventListener('pointerdown', () => {
    ensureAudio();
    if (state === 'title' || state === 'gameover' || state === 'fairy' || state === 'home') input.jumpEdge = true;
  });

  // ------------------------------------------------------------------
  // サウンド（WebAudioで生成するオリジナル効果音・BGM）
  // ------------------------------------------------------------------
  let actx = null, muted = false;
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(f, dur, type = 'square', vol = 0.06, f2 = 0, at = 0) {
    if (!actx || muted) return;
    const t0 = actx.currentTime + Math.max(0, at);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const seq = (notes, step, type = 'square', vol = 0.05) =>
    notes.forEach((n, i) => { if (n) tone(mf(n), step * 0.95, type, vol, 0, i * step); });
  const sfx = {
    jump: () => tone(330, 0.15, 'square', 0.045, 660),
    air: () => tone(520, 0.12, 'triangle', 0.07, 1040),
    spring: () => tone(180, 0.32, 'square', 0.05, 900),
    fruit: () => seq([81, 85, 88, 93], 0.05, 'triangle', 0.07),
    pellet: () => seq([72, 79, 76, 84, 79, 88], 0.06, 'square', 0.04),
    eat: () => tone(260, 0.4, 'sawtooth', 0.05, 1600),
    die: () => seq([76, 75, 74, 73, 72, 71, 70, 64, 0, 52], 0.09, 'square', 0.05),
    clear: () => seq([72, 0, 76, 79, 84, 0, 79, 84, 88, 0, 0, 91], 0.1, 'square', 0.05),
    warn: () => seq([88, 0, 88, 0, 88], 0.08, 'square', 0.05),
    oneup: () => seq([84, 88, 91, 96, 91, 96], 0.07, 'triangle', 0.07),
    tick: () => tone(1200, 0.03, 'square', 0.02),
    secret: () => seq([79, 83, 86, 91, 95], 0.06, 'triangle', 0.07),
  };

  // オリジナル曲（ほのぼのマーチ風）
  const MEL = [72, 0, 76, 79, 77, 76, 74, 0, 72, 0, 76, 79, 81, 79, 77, 0,
    76, 0, 74, 72, 74, 76, 77, 79, 77, 76, 74, 72, 71, 72, 74, 0,
    79, 0, 81, 79, 77, 0, 76, 74, 76, 0, 77, 76, 74, 0, 72, 71,
    72, 74, 76, 77, 79, 0, 84, 0, 83, 81, 79, 77, 76, 74, 72, 0];
  const BAS = [48, 0, 55, 0, 53, 0, 55, 0, 48, 0, 55, 0, 53, 0, 50, 0,
    52, 0, 55, 0, 50, 0, 55, 0, 53, 0, 55, 0, 43, 0, 47, 0,
    52, 0, 55, 0, 53, 0, 57, 0, 52, 0, 55, 0, 50, 0, 55, 0,
    48, 0, 52, 0, 53, 0, 57, 0, 55, 0, 53, 0, 43, 0, 48, 0];
  const bgm = { on: false, step: 0, next: 0, tempo: 0.15 };
  function bgmStart(tempo) {
    if (!actx) return;
    bgm.on = true; bgm.step = 0; bgm.tempo = tempo; bgm.next = actx.currentTime + 0.05;
  }
  function bgmStop() { bgm.on = false; }
  function bgmTick() {
    if (!actx || !bgm.on) return;
    if (muted || bgm.next < actx.currentTime - 0.25) { bgm.next = actx.currentTime + 0.02; if (muted) return; }
    while (bgm.next < actx.currentTime + 0.12) {
      const i = bgm.step % MEL.length, at = bgm.next - actx.currentTime;
      if (MEL[i]) tone(mf(MEL[i]), bgm.tempo * 0.85, 'square', 0.022, 0, at);
      if (BAS[i]) tone(mf(BAS[i]), bgm.tempo * 0.95, 'triangle', 0.06, 0, at);
      bgm.step++;
      bgm.next += bgm.tempo;
    }
  }
  const muteBtn = document.getElementById('mute');
  if (muteBtn) muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇 サウンド OFF' : '🔊 サウンド ON';
    muteBtn.blur();
  });

  // ------------------------------------------------------------------
  // ステージデータ
  // ------------------------------------------------------------------
  const hyd = x => ({ x, y: GROUND - 30, w: 22, h: 30, kind: 'hydrant' });
  const stump = (x, h = 36) => ({ x, y: GROUND - h, w: 40, h, kind: 'stump' });
  const cactus = (x, h = 46) => ({ x, y: GROUND - h, w: 24, h, kind: 'cactus' });
  const rock = (x, w, h) => ({ x, y: GROUND - h, w, h, kind: 'rock' });
  const ledge = (x, y, w, kind = 'ledge') => ({ x, y, w, h: 14, kind });
  const spring = (x, y = GROUND) => ({ x, y: y - 12, w: 30, h: 12, kind: 'spring', anim: 0 });
  const log = (x, y, w, ax, ay, range, speed, phase = 0) =>
    ({ x0: x, y0: y, x, y, w, h: 16, ax, ay, range, speed, phase, kind: 'log', dx: 0, dy: 0, t: 0 });
  const fr = (x, y, kind) => ({ x, y, kind });
  const pellet = (x, y) => ({ x, y, kind: 'pellet' });
  const en = (t, x) => ({ t, x });

  function stageTown() {
    return {
      name: 'STAGE 1', sub: 'にぎやかタウン', theme: 'town', len: 5400, time: 90, start: 80, goal: 5200,
      pits: [], movers: [],
      solids: [hyd(520), hyd(900), hyd(1380), hyd(1720), hyd(2350), hyd(2760), hyd(3320), hyd(3820),
        hyd(4300), hyd(4760), ledge(1900, 276, 140, 'awning'), ledge(3480, 276, 140, 'awning')],
      springs: [spring(1120), spring(3020), spring(4520)],
      enemies: [en('walker', 1550), en('walker', 2620), en('pogo', 4050), en('walker', 4900)],
      items: [fr(700, 300, 'cherry'), fr(1135, 150, 'strawberry'), pellet(1970, 254), fr(2800, 300, 'orange'),
        fr(3035, 150, 'apple'), fr(3550, 254, 'cherry'), fr(4535, 140, 'melon')],
      traffic: { interval: 150, min: 2, max: 3 },
    };
  }
  function stageForest() {
    return {
      name: 'STAGE 2', sub: 'もりの こみち', theme: 'forest', len: 5800, time: 100, start: 80, goal: 5600,
      pits: [[1820, 1930], [3220, 3330], [4620, 4740]], movers: [],
      solids: [stump(620), stump(1400, 48), ledge(1480, 250, 120, 'branch'), stump(2560), ledge(2660, 280, 130, 'branch'),
        stump(3900), stump(4300, 48), ledge(5000, 260, 160, 'branch')],
      springs: [spring(1780), spring(3180), spring(5330)],
      enemies: [en('walker', 900), en('pogo', 1650), en('walker', 2100), en('plane', 2500), en('pogo', 3050),
        en('walker', 3600), en('plane', 4250), en('pogo', 4500), en('walker', 5200)],
      items: [fr(1000, 300, 'cherry'), fr(1540, 222, 'strawberry'), pellet(2580, 300), fr(2725, 252, 'orange'),
        fr(3195, 140, 'grape'), fr(4000, 280, 'apple'), fr(5080, 232, 'melon'), fr(5345, 150, 'orange')],
      traffic: { interval: 260, min: 2, max: 2.6 },
    };
  }
  function stageLake() {
    return {
      name: 'STAGE 3', sub: 'みずうみと やまみち', theme: 'lake', len: 6400, time: 110, start: 80, goal: 6200,
      pits: [[900, 1020], [1480, 1920], [2600, 2720], [3300, 3820], [4500, 4620], [5200, 5640]],
      movers: [log(1560, 340, 100, 1, 0, 170, 1.0), log(3365, 270, 90, 0, 1, 70, 1.3, 0),
        log(3530, 270, 90, 0, 1, 70, 1.3, 2.1), log(3695, 270, 90, 0, 1, 70, 1.3, 4.2),
        log(5300, 330, 100, 1, 0, 150, 1.2)],
      solids: [rock(2100, 160, 40), rock(2180, 80, 90), rock(4000, 120, 50), rock(4060, 60, 100), rock(4900, 140, 60)],
      springs: [spring(860), spring(3000), spring(4250)],
      enemies: [en('floater', 1300), en('floater', 2400), en('pogo', 2900), en('plane', 3000), en('floater', 3550),
        en('walker', 4200), en('floater', 4800), en('floater', 5450), en('walker', 5900)],
      items: [fr(1700, 290, 'strawberry'), pellet(2220, 255), fr(3460, 200, 'grape'), fr(4090, 230, 'apple'),
        fr(5420, 250, 'melon'), fr(6000, 300, 'cherry')],
      traffic: null,
    };
  }
  function stageDesert() {
    return {
      name: 'STAGE 4', sub: 'さばくの ハイウェイ', theme: 'desert', len: 6000, time: 100, start: 80, goal: 5800,
      pits: [[1600, 1710], [3400, 3520], [4800, 4910]], movers: [],
      solids: [cactus(500), cactus(1000), cactus(1300, 60), cactus(2000), cactus(2450), rock(2600, 100, 40),
        cactus(2900, 60), cactus(3800), cactus(4300), ledge(4500, 260, 120), cactus(5200), cactus(5500, 60)],
      springs: [spring(1560), spring(3360), spring(4760)],
      enemies: [en('plane', 1200), en('pogo', 2200), en('plane', 2800), en('walker', 3100), en('pogo', 3900),
        en('plane', 4400), en('pogo', 5000), en('walker', 5400)],
      items: [fr(1010, 280, 'cherry'), fr(1575, 140, 'orange'), pellet(2650, 300), fr(3375, 140, 'grape'),
        pellet(4560, 240), fr(4775, 140, 'melon'), fr(5600, 300, 'apple')],
      traffic: { interval: 170, min: 2.6, max: 3.4 },
    };
  }
  function stageReturn() {
    const st = stageLake();
    st.name = 'STAGE 5'; st.sub = 'ゆうやけの かえりみち'; st.theme = 'dusk'; st.time = 120; st.boots = true;
    st.enemies.push(en('plane', 1800), en('plane', 4400), en('floater', 2000), en('pogo', 4300));
    st.items.push(pellet(3000, 200));
    return mirror(st);
  }
  const STAGES = [stageTown, stageForest, stageLake, stageDesert, stageReturn];

  // 帰り道用：ステージを左右反転する
  function mirror(st) {
    const L = st.len;
    const mx = o => { o.x = L - o.x - (o.w || 0); };
    st.solids.forEach(mx);
    st.springs.forEach(mx);
    st.movers.forEach(m => { m.x0 = L - m.x0 - m.w - (m.ax ? m.range : 0); m.x = m.x0; });
    st.pits = st.pits.map(([a, b]) => [L - b, L - a]);
    st.enemies.forEach(e => { e.x = L - e.x; });
    st.items.forEach(i => { i.x = L - i.x; });
    st.dir = -1;
    st.start = L - st.start - 26;
    st.goal = L - st.goal;
    return st;
  }

  function placeMover(m) {
    const f = (Math.sin(m.t * 0.02 * m.speed + m.phase) + 1) / 2;
    const nx = m.x0 + m.ax * f * m.range, ny = m.y0 + m.ay * f * m.range;
    m.dx = nx - m.x; m.dy = ny - m.y;
    m.x = nx; m.y = ny;
  }

  function buildStage(st) {
    st.dir = st.dir || 1;
    st.pits.sort((a, b) => a[0] - b[0]);
    st.ground = [];
    let x = -200;
    for (const [a, b] of st.pits) { st.ground.push({ x, y: GROUND, w: a - x, h: 120, kind: 'ground' }); x = b; }
    st.ground.push({ x, y: GROUND, w: st.len + 200 - x, h: 120, kind: 'ground' });
    st.movers.forEach(m => { m.t = 0; placeMover(m); m.dx = m.dy = 0; });
    st.items.forEach(i => { i.taken = false; });
    st.colliders = [...st.ground, ...st.solids, ...st.springs, ...st.movers];
    return st;
  }
  const groundAt = x => !stage.pits.some(([a, b]) => x > a && x < b);

  // ------------------------------------------------------------------
  // ゲーム状態
  // ------------------------------------------------------------------
  let state = 'title', stateT = 0, globalT = 0;
  let round = 1, stageIdx = 0, stage = null;
  let score = 0, lives = 3, nextExtend = 20000;
  let hiscore = 0;
  try { hiscore = parseInt(localStorage.getItem('pacpacland.hi') || '0', 10) || 0; } catch (e) { hiscore = 0; }
  const saveHi = () => { try { localStorage.setItem('pacpacland.hi', String(hiscore)); } catch (e) { /* ignore */ } };

  let p = null, enemies = [], popups = [], particles = [];
  let frightT = 0, chain = 0, timer = 0, trafficT = 0, hunterOut = false, checkpoint = 0, bonusLeft = 0;
  const cam = { x: 0 };
  const fairy = { x: 0, y: 0 };
  let colorIdx = 0;
  const COLORS = ['#e8453c', '#9b5de5', '#2bb673', '#ff7eb6'];
  const spd = () => Math.min(1.6, 1 + (round - 1) * 0.15);
  const frightLen = () => Math.max(240, 480 - (round - 1) * 60);

  function addScore(n, x, y) {
    score += n;
    if (x !== undefined) popups.push({ x, y, text: String(n), t: 0 });
    if (score > hiscore) hiscore = score;
    if (score >= nextExtend) {
      lives++;
      nextExtend += nextExtend === 20000 ? 40000 : 60000;
      sfx.oneup();
      if (p) popups.push({ x: p.x, y: p.y - 30, text: '1UP!', t: 0 });
    }
  }

  function startGame() {
    score = 0; lives = 3; round = 1; stageIdx = 0; nextExtend = 20000;
    loadStage(0);
  }

  function loadStage(idx) {
    stageIdx = idx;
    stage = buildStage(STAGES[idx]());
    checkpoint = stage.start;
    resetActors();
    spawnPlayer(stage.start);
    state = 'intro'; stateT = 0;
  }

  function resetActors() {
    enemies = []; popups = []; particles = [];
    frightT = 0; chain = 0; hunterOut = false; trafficT = 150;
    timer = stage.time * 60;
    stage.enemies.forEach(e => { e.spawned = false; });
  }

  function safeX(x) {
    const box = { x, y: GROUND - 28, w: 26, h: 28 };
    for (let n = 0; n < 200; n++) {
      box.x = x;
      const bad = !groundAt(x + 2) || !groundAt(x + 24) || stage.solids.some(s => overlap(box, s)) ||
        stage.springs.some(s => overlap(box, s));
      if (!bad) return x;
      x -= stage.dir * 20;
    }
    return stage.start;
  }

  function spawnPlayer(x) {
    x = safeX(x);
    p = {
      x, y: GROUND - 28, w: 26, h: 28, vx: 0, vy: 0, face: stage.dir, onGround: true,
      coyote: 0, buffer: 0, hold: 0, stand: null, anim: 0, rot: 0,
    };
    cam.x = clamp(p.x + p.w / 2 - W / 2 + stage.dir * 80, 0, stage.len - W);
    fairy.x = p.x - stage.dir * 30; fairy.y = p.y - 20;
    // 画面内にいる敵は出現済み扱いにして、復活直後に重ならないようにする
    stage.enemies.forEach(e => { if (e.x > cam.x - 100 && e.x < cam.x + W + 100) e.spawned = true; });
  }

  // ------------------------------------------------------------------
  // 敵キャラ「モックン」たち
  // ------------------------------------------------------------------
  function createEnemy(t, x, extra) {
    const color = COLORS[colorIdx++ % COLORS.length];
    const pcx = p.x + p.w / 2;
    const toward = -(Math.sign(x - pcx) || stage.dir);
    const s = spd();
    let e;
    switch (t) {
      case 'walker': e = { w: 26, h: 26, y: GROUND - 26, vx: toward * 0.9 * s, g: 0.5 }; break;
      case 'mini': e = { w: 20, h: 20, y: 100, vx: 0, g: 0.35 }; break;
      case 'pogo': e = { w: 26, h: 40, y: GROUND - 40, vx: 0, g: 0.4 }; break;
      case 'car': e = { w: 56, h: 34, y: GROUND - 34, vx: toward * 2.5 * s, g: 0.5 }; break;
      case 'plane': {
        const base = 70 + Math.random() * 50;
        e = { w: 50, h: 30, y: base, base, vx: toward * 1.7 * s, drops: 2, cd: 0 }; break;
      }
      case 'floater': {
        const base = 200 + Math.random() * 50;
        e = { w: 28, h: 26, y: base, base, vx: toward * 1.1 * s, ph: Math.random() * 6 }; break;
      }
      case 'hunter': e = { w: 32, h: 30, y: 40, vx: 0, vy: 0, color: '#d62828' }; break;
      default: e = { w: 26, h: 26, y: GROUND - 26, vx: 0 };
    }
    return Object.assign({ t, x, vy: 0, at: 0, color, onGround: false }, e, extra || {});
  }

  function enemyGround(e) {
    e.vy += e.g || 0.5;
    e.y += e.vy;
    e.onGround = false;
    const cx = e.x + e.w / 2;
    if (e.vy >= 0 && groundAt(cx) && e.y + e.h >= GROUND && e.y + e.h - e.vy <= GROUND + 2) {
      e.y = GROUND - e.h; e.vy = 0; e.onGround = true;
    }
  }

  function updateEnemies() {
    const f = frightT > 0 ? 0.55 : 1;
    const s = spd();
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;

    // 固定配置の敵の出現
    for (const d of stage.enemies) {
      if (!d.spawned && d.x > cam.x - 60 && d.x < cam.x + W + 60) {
        d.spawned = true;
        enemies.push(createEnemy(d.t, d.x));
      }
    }

    // 道路を走るクルマ
    if (stage.traffic && state === 'play') {
      if (--trafficT <= 0) {
        const tr = stage.traffic;
        trafficT = (tr.interval / s) * (0.7 + Math.random() * 0.6);
        const ahead = Math.random() < 0.75;
        const dir = stage.dir;
        const x = ahead ? (dir > 0 ? cam.x + W + 30 : cam.x - 86) : (dir > 0 ? cam.x - 86 : cam.x + W + 30);
        const nearGoal = Math.abs(x - stage.goal) < 420 || Math.abs(p.x - stage.goal) < 300;
        if (!nearGoal && groundAt(x + 28) && x > 0 && x < stage.len) {
          const v = (tr.min + Math.random() * (tr.max - tr.min)) * s;
          enemies.push(createEnemy('car', x, { vx: ahead ? -dir * v : dir * v * 0.55 }));
        }
      }
    }

    for (const e of enemies) {
      e.at++;
      switch (e.t) {
        case 'walker': case 'mini': case 'car':
          e.x += e.vx * f;
          enemyGround(e);
          if (e.t === 'mini' && e.onGround && !e.vx) e.vx = -(Math.sign(e.x + e.w / 2 - pcx) || stage.dir) * 1.1 * s;
          break;
        case 'pogo':
          e.x += e.vx * f;
          enemyGround(e);
          if (e.onGround) { e.vy = -8.5; e.vx = -(Math.sign(e.x + e.w / 2 - pcx) || 1) * 1.2 * s; }
          break;
        case 'plane':
          e.x += e.vx * f;
          e.y = e.base + Math.sin(e.at * 0.05) * 8;
          if (e.cd > 0) e.cd--;
          if (e.drops > 0 && e.cd <= 0 && frightT <= 0 && Math.abs(e.x + e.w / 2 - pcx) < 170) {
            enemies.push(createEnemy('mini', e.x + 15, { y: e.y + 22, color: e.color }));
            e.drops--; e.cd = 70;
          }
          break;
        case 'floater':
          e.x += e.vx * f;
          e.y = e.base + Math.sin(e.at * 0.05 + e.ph) * 45;
          break;
        case 'hunter': {
          const dx = pcx - (e.x + e.w / 2), dy = pcy - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1;
          const sp = 2.4 * s;
          e.vx += (dx / d * sp - e.vx) * 0.04;
          e.vy += (dy / d * sp - e.vy) * 0.04;
          e.x += e.vx * f; e.y += e.vy * f;
          break;
        }
        case 'eyes':
          e.y -= 5;
          break;
      }
    }
    enemies = enemies.filter(e => {
      if (e.y > H + 60 || e.y < -90) return false;
      if (e.t !== 'hunter' && (e.x < cam.x - 340 || e.x > cam.x + W + 340)) return false;
      return true;
    });
  }

  function checkEnemyHits() {
    const hb = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 6 };
    for (const e of enemies) {
      if (e.t === 'eyes') continue;
      const eb = { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 8 };
      if (!overlap(hb, eb)) continue;
      if (frightT > 0) {
        chain = Math.min(chain + 1, 4);
        const pts = [200, 400, 800, 1600][chain - 1];
        addScore(pts, e.x + e.w / 2, e.y);
        burst(e.x + e.w / 2, e.y + e.h / 2, '#9ad1ff', 10);
        e.t = 'eyes';
        sfx.eat();
      } else {
        killPlayer();
        return;
      }
    }
  }

  // ------------------------------------------------------------------
  // 主人公「ポッコ」
  // ------------------------------------------------------------------
  const MAXV = 3.4;
  function updatePlayer() {
    if (p.stand && p.stand.kind === 'log') { p.x += p.stand.dx; p.y += p.stand.dy; }

    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (ax) {
      p.vx += ax * (p.onGround ? 0.4 : 0.25);
      p.face = ax;
    } else {
      p.vx *= p.onGround ? 0.72 : 0.97;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }
    p.vx = clamp(p.vx, -MAXV, MAXV);

    if (input.jumpEdge) p.buffer = 7;
    if (p.onGround) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
    if (p.buffer > 0) {
      if (p.coyote > 0) {
        p.vy = -10.5; p.hold = 12; p.coyote = 0; p.buffer = 0;
        p.onGround = false; p.stand = null;
        sfx.jump();
      } else if (stage.boots && input.jumpEdge) {
        // ウィングブーツ：空中でもジャンプできる
        p.vy = Math.min(p.vy, -8); p.hold = 6; p.buffer = 0;
        sfx.air();
        burst(p.x + p.w / 2, p.y + p.h, '#ffffff', 6);
      } else {
        p.buffer--;
      }
    }

    let g = 0.55;
    if (p.hold > 0) {
      if (input.jump && p.vy < 0) { g = 0.25; p.hold--; } else p.hold = 0;
    }
    p.vy = Math.min(p.vy + g, 12);

    // 横移動と衝突
    p.x += p.vx;
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > stage.len - p.w) { p.x = stage.len - p.w; p.vx = 0; }
    for (const s of stage.colliders) {
      if (!overlap(p, s)) continue;
      // ジャンプ台のような低い段差は そのまま乗り上げる
      if (p.onGround && s.y >= p.y + p.h - 14) { p.y = s.y - p.h; continue; }
      const fromLeft = p.vx > 0 || (p.vx === 0 && p.x + p.w / 2 < s.x + s.w / 2);
      p.x = fromLeft ? s.x - p.w : s.x + s.w;
      if (s.kind === 'hydrant' && ax && p.onGround) pushHydrant(s);
      p.vx = 0;
    }

    // 縦移動と衝突
    p.y += p.vy;
    p.onGround = false; p.stand = null;
    for (const s of stage.colliders) {
      if (!overlap(p, s)) continue;
      if (p.vy >= 0) {
        p.y = s.y - p.h;
        if (s.kind === 'spring') {
          p.vy = input.jump ? -17 : -15; p.hold = 0; s.anim = 12;
          sfx.spring();
        } else {
          p.vy = 0; p.onGround = true; p.stand = s;
        }
      } else {
        p.y = s.y + s.h; p.vy = 0; p.hold = 0;
      }
    }

    if (p.onGround && Math.abs(p.vx) > 0.3) p.anim += Math.abs(p.vx) * 0.12;

    if (p.y > H + 20) { killPlayer(); return; }

    // アイテム
    const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const it of stage.items) {
      if (it.taken) continue;
      if (!overlap(pb, { x: it.x - 11, y: it.y - 11, w: 22, h: 22 })) continue;
      it.taken = true;
      if (it.kind === 'pellet') {
        frightT = frightLen(); chain = 0;
        addScore(100, it.x, it.y);
        sfx.pellet();
        burst(it.x, it.y, '#ffe066', 14);
      } else {
        addScore(FRUIT_PTS[it.kind] || 100, it.x, it.y);
        sfx.fruit();
        burst(it.x, it.y, '#ffffff', 8);
      }
    }

    // チェックポイント（ステージの中間）
    const mid = (stage.start + stage.goal) / 2;
    if (stage.dir > 0 ? p.x > mid : p.x < mid) checkpoint = mid;
  }

  // ひみつ：消火栓を押し続けると…
  function pushHydrant(s) {
    s.push = (s.push || 0) + 1;
    if (s.push === 75 && !s.revealed) {
      s.revealed = true;
      stage.items.push({ x: s.x + 11, y: s.y - 50, kind: 'clover', taken: false });
      popups.push({ x: s.x + 11, y: s.y - 80, text: 'ひみつ はっけん！', t: 0 });
      sfx.secret();
    }
  }

  const FRUIT_PTS = { cherry: 100, strawberry: 300, orange: 500, apple: 700, melon: 1000, grape: 1000, clover: 3000 };

  function killPlayer() {
    if (state !== 'play') return;
    state = 'dying'; stateT = 0;
    p.vy = -9; p.vx = 0;
    bgmStop();
    sfx.die();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 30 + Math.random() * 20, color });
    }
  }

  // ------------------------------------------------------------------
  // メインループ（更新）
  // ------------------------------------------------------------------
  function update() {
    globalT++; stateT++;
    switch (state) {
      case 'title':
        if (input.jumpEdge) startGame();
        break;
      case 'intro':
        updateCamera(true);
        stage.movers.forEach(m => { m.t++; placeMover(m); });
        if (stateT > 110) { state = 'play'; stateT = 0; bgmStart(0.15 / spd()); }
        break;
      case 'play':
        stage.movers.forEach(m => { m.t++; placeMover(m); });
        stage.springs.forEach(s => { if (s.anim > 0) s.anim--; });
        updatePlayer();
        if (state !== 'play') break;
        updateEnemies();
        checkEnemyHits();
        if (state !== 'play') break;
        if (frightT > 0 && --frightT === 0) chain = 0;
        if (timer > 0) {
          timer--;
          if (timer === 0 && !hunterOut) {
            hunterOut = true;
            const hx = stage.dir > 0 ? cam.x - 40 : cam.x + W + 10;
            enemies.push(createEnemy('hunter', hx));
            popups.push({ x: p.x, y: p.y - 40, text: 'タイムオーバー！にげろ！', t: 0 });
            sfx.warn();
          }
        }
        if (stage.dir > 0 ? p.x > stage.goal : p.x + p.w < stage.goal) {
          state = 'clear'; stateT = 0;
          bonusLeft = Math.ceil(timer / 60);
          bgmStop(); sfx.clear();
        }
        updateCamera(false);
        break;
      case 'dying':
        p.vy += 0.45; p.y += p.vy; p.rot += 0.25;
        if (stateT > 110) {
          lives--;
          if (lives <= 0) {
            state = 'gameover'; stateT = 0; saveHi();
          } else {
            resetActors();
            spawnPlayer(checkpoint);
            state = 'intro'; stateT = 40;
          }
        }
        break;
      case 'clear':
        if (stateT > 70 && bonusLeft > 0) {
          bonusLeft--; addScore(50);
          if (stateT % 3 === 0) sfx.tick();
          stateT = 71;
        }
        if (bonusLeft === 0 && stateT > 150) advance();
        break;
      case 'fairy':
        if (stateT > 420 || (stateT > 120 && input.jumpEdge)) loadStage(4);
        break;
      case 'home':
        if (stateT > 420 || (stateT > 120 && input.jumpEdge)) { round++; loadStage(0); }
        break;
      case 'gameover':
        if (stateT > 600 || (stateT > 90 && input.jumpEdge)) { state = 'title'; stateT = 0; }
        break;
    }
    if (state !== 'title' && state !== 'fairy' && state !== 'home') updateFairy();
    for (const pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--; }
    particles = particles.filter(pt => pt.life > 0);
    for (const pu of popups) pu.t++;
    popups = popups.filter(pu => pu.t < 70);
    input.jumpEdge = false;
  }

  function advance() {
    saveHi();
    if (stageIdx === 3) { state = 'fairy'; stateT = 0; sfx.oneup(); }
    else if (stageIdx === 4) { state = 'home'; stateT = 0; addScore(5000); lives++; sfx.oneup(); }
    else loadStage(stageIdx + 1);
  }

  function updateCamera(snap) {
    const target = clamp(p.x + p.w / 2 - W / 2 + stage.dir * 80, 0, stage.len - W);
    cam.x = snap ? target : cam.x + (target - cam.x) * 0.1;
  }

  function updateFairy() {
    if (!p || stage.boots) return;
    const tx = p.x + p.w / 2 - p.face * 34, ty = p.y - 18 + Math.sin(globalT * 0.08) * 6;
    fairy.x += (tx - fairy.x) * 0.08;
    fairy.y += (ty - fairy.y) * 0.08;
  }

  // ------------------------------------------------------------------
  // 描画ヘルパー
  // ------------------------------------------------------------------
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(x, y, rx, ry, c, rot = 0) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  function rrect(x, y, w, h, r, c) {
    r = Math.min(r, w / 2, h / 2);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
  function tri(x1, y1, x2, y2, x3, y3, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
  }
  const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
  function text(s, x, y, size, color, align = 'center', stroke = '#1a1530') {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 4.5);
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function layer(camX, speed, tile, fn) {
    const off = camX * speed;
    const i0 = Math.floor(off / tile) - 1;
    const n = Math.ceil(W / tile) + 3;
    for (let i = i0; i < i0 + n; i++) fn(i * tile - off, i);
  }
  function sky(c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function clouds(camX, col = '#ffffff', s = 0.08) {
    layer(camX, s, 280, (x, i) => {
      const y = 50 + rnd(i, 1) * 70, k = 0.7 + rnd(i, 2) * 0.6;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x + 60 * k, y + 8 * k, 46 * k, 14 * k, 0, 0, Math.PI * 2);
      ctx.moveTo(x + 50 * k, y); ctx.arc(x + 32 * k, y, 18 * k, 0, Math.PI * 2);
      ctx.moveTo(x + 82 * k, y - 8 * k); ctx.arc(x + 58 * k, y - 8 * k, 24 * k, 0, Math.PI * 2);
      ctx.moveTo(x + 104 * k, y + 2 * k); ctx.arc(x + 88 * k, y + 2 * k, 16 * k, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ------------------------------------------------------------------
  // 背景
  // ------------------------------------------------------------------
  const HOUSE = ['#ffd6a5', '#caffbf', '#ffadad', '#bdb2ff', '#a0c4ff', '#fdffb6'];
  const ROOF = ['#c0392b', '#2d6a4f', '#7b2cbf', '#1d3557', '#b5651d'];
  function drawBackground(theme, camX) {
    switch (theme) {
      case 'town':
        sky('#6ec3f4', '#d9f2ff');
        clouds(camX);
        layer(camX, 0.25, 66, (x, i) => {
          const h = 60 + rnd(i, 7) * 140;
          rect(x, GROUND - h, 58, h, '#a9c6e2');
          for (let wy = GROUND - h + 10; wy < GROUND - 20; wy += 18)
            for (let wx = 8; wx < 50; wx += 16) rect(x + wx, wy, 8, 9, '#c9dcf0');
        });
        layer(camX, 0.55, 210, (x, i) => {
          if (rnd(i, 3) < 0.18) {
            rect(x + 60, GROUND - 70, 10, 70, '#7a4b2a');
            circle(x + 65, GROUND - 82, 30, '#4caf50');
            circle(x + 48, GROUND - 70, 20, '#43a047');
            circle(x + 84, GROUND - 68, 20, '#43a047');
            return;
          }
          const w = 110 + Math.floor(rnd(i, 4) * 50), h = 70 + Math.floor(rnd(i, 5) * 40), base = GROUND;
          rect(x, base - h, w, h, HOUSE[Math.floor(rnd(i, 6) * HOUSE.length)]);
          tri(x - 10, base - h, x + w / 2, base - h - 38 - rnd(i, 8) * 22, x + w + 10, base - h, ROOF[Math.floor(rnd(i, 9) * ROOF.length)]);
          rect(x + 14, base - h + 16, 24, 20, '#fff7d1'); rect(x + 25, base - h + 16, 2, 20, '#8d6e63');
          rect(x + w - 38, base - h + 16, 24, 20, '#fff7d1'); rect(x + w - 27, base - h + 16, 2, 20, '#8d6e63');
          rect(x + w / 2 - 11, base - 36, 22, 36, '#8d5a3b');
          circle(x + w / 2 + 6, base - 18, 2, '#ffd166');
        });
        // 手前の柵
        layer(camX, 1, 24, x => { rect(x, GROUND - 16, 4, 16, '#ffffff'); });
        rect(0, GROUND - 13, W, 3, '#ffffff');
        break;
      case 'forest':
        sky('#8fd8ff', '#e8fbff');
        clouds(camX);
        layer(camX, 0.18, 420, (x, i) => ell(x + 210, GROUND + 20, 260, 120 + rnd(i, 1) * 50, '#93d69a'));
        layer(camX, 0.35, 90, (x, i) => {
          const h = 90 + rnd(i, 2) * 60;
          rect(x + 40, GROUND - h, 8, h, '#6d8f5b');
          ell(x + 44, GROUND - h, 26, 40, '#5fb36b');
        });
        layer(camX, 0.6, 140, (x, i) => {
          const h = 100 + rnd(i, 3) * 70;
          rect(x + 58, GROUND - h, 16, h, '#7a4b2a');
          circle(x + 66, GROUND - h - 10, 40, '#2e8b57');
          circle(x + 40, GROUND - h + 18, 28, '#3cb371');
          circle(x + 92, GROUND - h + 16, 28, '#3cb371');
          if (rnd(i, 4) < 0.4) { circle(x + 52, GROUND - h, 5, '#ff595e'); circle(x + 80, GROUND - h + 22, 5, '#ff595e'); }
        });
        layer(camX, 1, 60, (x, i) => { if (rnd(i, 5) < 0.5) ell(x + 30, GROUND - 4, 22, 12, '#2f9e44'); });
        break;
      case 'lake':
      case 'dusk': {
        const dusk = theme === 'dusk';
        if (dusk) {
          sky('#2b1d5c', '#ff9e6d');
          for (let i = 0; i < 40; i++) {
            const sx = (rnd(i, 11) * W * 2 - camX * 0.02) % W, sy = rnd(i, 12) * 160;
            circle((sx + W) % W, sy, rnd(i, 13) < 0.2 ? 1.6 : 1, `rgba(255,255,255,${0.4 + 0.5 * Math.abs(Math.sin(globalT * 0.03 + i))})`);
          }
          circle(W - 140 - camX * 0.02 % 50, 250, 46, '#ffcf70');
        } else {
          sky('#7cc6ff', '#e2f6ff');
          clouds(camX);
        }
        layer(camX, 0.15, 300, (x, i) => {
          const h = 150 + rnd(i, 1) * 90, cx = x + 150;
          tri(cx - 190, GROUND, cx, GROUND - h, cx + 190, GROUND, dusk ? '#4b3b7a' : '#7d93b2');
          tri(cx - 40, GROUND - h + 42, cx, GROUND - h, cx + 40, GROUND - h + 42, dusk ? '#f6c7d8' : '#ffffff');
        });
        layer(camX, 0.45, 80, (x, i) => {
          const h = 70 + rnd(i, 2) * 50;
          rect(x + 37, GROUND - 16, 6, 16, dusk ? '#2a1e40' : '#5d4037');
          tri(x + 12, GROUND - 12, x + 40, GROUND - h, x + 68, GROUND - 12, dusk ? '#2e2550' : '#2d6a4f');
          tri(x + 18, GROUND - h * 0.45, x + 40, GROUND - h - 14, x + 62, GROUND - h * 0.45, dusk ? '#3a2f63' : '#40916c');
        });
        break;
      }
      case 'desert':
        sky('#ff9f43', '#ffe3a3');
        circle(W * 0.72 - camX * 0.02 % 40, 110, 50, '#fff3b0');
        layer(camX, 0.15, 380, (x, i) => ell(x + 190, GROUND + 10, 240, 70 + rnd(i, 1) * 40, '#f2c48d'));
        layer(camX, 0.3, 560, (x, i) => {
          if (rnd(i, 2) < 0.35) return;
          const s = 0.7 + rnd(i, 3) * 0.6, cx = x + 280;
          tri(cx - 120 * s, GROUND, cx, GROUND - 130 * s, cx + 120 * s, GROUND, '#e0a96d');
          tri(cx, GROUND, cx, GROUND - 130 * s, cx + 120 * s, GROUND, '#c98b4f');
        });
        layer(camX, 0.6, 230, (x, i) => {
          if (rnd(i, 4) < 0.4) return;
          const h = 40 + rnd(i, 5) * 30;
          rrect(x + 100, GROUND - h, 12, h, 6, '#6a994e');
          rrect(x + 86, GROUND - h * 0.75, 8, 22, 4, '#6a994e');
          rrect(x + 118, GROUND - h * 0.85, 8, 18, 4, '#6a994e');
        });
        break;
    }
  }

  const GROUND_STYLE = {
    town: { top: '#cfcfd8', body: '#55555f', edge: '#8e8e99' },
    forest: { top: '#5cc95c', body: '#8b5a2b', edge: '#3f8f3f' },
    lake: { top: '#6bd16b', body: '#7a5230', edge: '#46a046' },
    dusk: { top: '#3f8f5a', body: '#4a3326', edge: '#2f6e45' },
    desert: { top: '#f6d39a', body: '#e0a85f', edge: '#d39448' },
  };

  function drawTerrain(camX) {
    const th = stage.theme, gs = GROUND_STYLE[th];
    // 穴（水または奈落）
    for (const [a, b] of stage.pits) {
      const sx = a - camX, w = b - a;
      if (sx > W || sx + w < 0) continue;
      if (th === 'lake' || th === 'dusk') {
        rect(sx, GROUND + 18, w, H - GROUND, th === 'dusk' ? '#5a4fcf' : '#3a86ff');
        ctx.strokeStyle = th === 'dusk' ? '#a29bfe' : '#bde0fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = GROUND + 18 + Math.sin((a + x) * 0.08 + globalT * 0.08) * 2;
          if (x === 0) ctx.moveTo(sx + x, y); else ctx.lineTo(sx + x, y);
        }
        ctx.stroke();
      } else {
        const g = ctx.createLinearGradient(0, GROUND, 0, H);
        g.addColorStop(0, '#2a1f45'); g.addColorStop(1, '#0d0819');
        ctx.fillStyle = g; ctx.fillRect(sx, GROUND, w, H - GROUND);
      }
    }
    // 地面
    for (const s of stage.ground) {
      const sx = s.x - camX;
      if (sx > W || sx + s.w < 0) continue;
      rect(sx, GROUND, s.w, H - GROUND, gs.body);
      rect(sx, GROUND, s.w, 12, gs.top);
      rect(sx, GROUND + 12, s.w, 3, gs.edge);
      if (th === 'town') {
        const from = Math.max(s.x, camX - 70), to = Math.min(s.x + s.w, camX + W + 70);
        for (let wx = Math.ceil(from / 70) * 70; wx < to - 30; wx += 70) rect(wx - camX, GROUND + 38, 30, 4, '#ffd166');
      } else {
        const from = Math.max(s.x, camX - 40), to = Math.min(s.x + s.w, camX + W + 40);
        for (let wx = Math.ceil(from / 37) * 37; wx < to - 6; wx += 37) {
          const k = Math.floor(wx / 37);
          if (rnd(k, 21) < 0.5) circle(wx - camX, GROUND + 26 + rnd(k, 22) * 30, 2 + rnd(k, 23) * 2, gs.edge);
        }
      }
      if (stage.pits.length) {
        rect(sx, GROUND, 3, H, gs.edge);
        rect(sx + s.w - 3, GROUND, 3, H, gs.edge);
      }
    }
  }

  function drawSolid(s, camX) {
    const x = s.x - camX, y = s.y;
    if (x > W + 20 || x + s.w < -20) return;
    switch (s.kind) {
      case 'hydrant':
        rrect(x + 2, y + 6, s.w - 4, s.h - 6, 4, '#e63946');
        rrect(x, y + 2, s.w, 8, 3, '#c1121f');
        circle(x + s.w / 2, y + 2, 5, '#c1121f');
        rect(x - 4, y + 13, 5, 7, '#c1121f'); rect(x + s.w - 1, y + 13, 5, 7, '#c1121f');
        rect(x + 5, y + 10, 3, s.h - 14, 'rgba(255,255,255,.35)');
        break;
      case 'awning': {
        for (let i = 0; i < s.w; i += 20) rect(x + i, y, 10, s.h, '#ef476f'), rect(x + i + 10, y, 10, s.h, '#ffffff');
        for (let i = 0; i < s.w; i += 20) { ctx.fillStyle = (i / 20) % 2 ? '#ef476f' : '#ffffff'; ctx.beginPath(); ctx.arc(x + i + 10, y + s.h, 10, 0, Math.PI); ctx.fill(); }
        rect(x + 4, y + s.h, 4, GROUND - y - s.h, '#6c757d');
        rect(x + s.w - 8, y + s.h, 4, GROUND - y - s.h, '#6c757d');
        break;
      }
      case 'stump':
        rect(x, y + 6, s.w, s.h - 6, '#8b5a2b');
        ell(x + s.w / 2, y + 6, s.w / 2, 7, '#deb887');
        ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x + s.w / 2, y + 6, s.w / 4, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
        rect(x + 8, y + 14, 3, s.h - 18, '#6f4421');
        rect(x + s.w - 12, y + 18, 3, s.h - 22, '#6f4421');
        break;
      case 'branch':
        rrect(x, y, s.w, s.h, 7, '#8b5a2b');
        rect(x + 4, y + 3, s.w - 8, 3, '#a9713d');
        circle(x + 10, y - 2, 9, '#3cb371'); circle(x + s.w - 12, y - 3, 10, '#2e8b57');
        break;
      case 'rock':
        rrect(x, y, s.w, s.h + 4, 8, '#8d99ae');
        rrect(x + 4, y + 4, s.w - 8, 8, 4, '#b8c1d1');
        rect(x + s.w * 0.6, y + 16, 3, s.h - 20, '#6c7a91');
        break;
      case 'cactus':
        rrect(x + 6, y, 12, s.h, 6, '#2d6a4f');
        rrect(x - 2, y + s.h * 0.3, 8, s.h * 0.35, 4, '#2d6a4f');
        rrect(x + 18, y + s.h * 0.2, 8, s.h * 0.3, 4, '#2d6a4f');
        rect(x + 10, y + 4, 2, s.h - 8, '#40916c');
        break;
      case 'ledge':
        rect(x, y, s.w, s.h, '#d4a373');
        for (let i = 0; i < s.w; i += 24) rect(x + i, y, 2, s.h, '#b07d4f');
        rect(x, y + s.h - 3, s.w, 3, '#b07d4f');
        break;
      case 'spring': {
        const c = s.anim > 0 ? 6 : 0;
        rect(x, s.y + s.h - 3, s.w, 3, '#495057');
        ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        const top = s.y + 3 + c, bot = s.y + s.h - 3;
        for (let k = 0; k <= 4; k++) {
          const yy = top + (bot - top) * k / 4;
          ctx.lineTo(x + (k % 2 ? 5 : s.w - 5), yy);
        }
        ctx.stroke();
        rrect(x - 2, s.y + c, s.w + 4, 5, 2, '#f77f00');
        break;
      }
      case 'log':
        rrect(x, y, s.w, s.h, 8, '#8b5a2b');
        rect(x + 6, y + 3, s.w - 12, 3, '#b07d4f');
        ell(x + 6, y + s.h / 2, 5, s.h / 2 - 1, '#deb887');
        ell(x + s.w - 6, y + s.h / 2, 5, s.h / 2 - 1, '#deb887');
        break;
    }
  }

  function drawGoal(camX) {
    const x = stage.goal - camX;
    if (x < -120 || x > W + 120) return;
    if (stageIdx === 3) {
      // ようせいの国の門
      rrect(x - 50, GROUND - 120, 18, 120, 4, '#ff8fab');
      rrect(x + 32, GROUND - 120, 18, 120, 4, '#ff8fab');
      ctx.strokeStyle = '#ffc2d1'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(x, GROUND - 120, 41, Math.PI, 0); ctx.stroke();
      text('ようせいの国', x, GROUND - 175, 16, '#fff', 'center', '#c9184a');
      for (let i = 0; i < 6; i++) {
        const a = globalT * 0.04 + i;
        circle(x + Math.cos(a) * 60, GROUND - 120 + Math.sin(a * 1.3) * 40, 2.5, '#fff6a5');
      }
    } else if (stageIdx === 4) {
      // おうち
      rect(x - 60, GROUND - 90, 120, 90, '#ffd6a5');
      tri(x - 75, GROUND - 90, x, GROUND - 145, x + 75, GROUND - 90, '#c0392b');
      rect(x + 30, GROUND - 140, 16, 30, '#8d5a3b');
      rect(x - 14, GROUND - 46, 28, 46, '#8d5a3b');
      rect(x - 48, GROUND - 74, 26, 22, '#ffe066'); rect(x + 22, GROUND - 74, 26, 22, '#ffe066');
      text('HOME', x, GROUND - 106, 14, '#fff', 'center', '#8d2f1f');
    } else {
      rect(x - 3, GROUND - 90, 6, 90, '#6c4f3d');
      rrect(x - 52, GROUND - 120, 104, 40, 8, '#ffffff');
      rrect(x - 48, GROUND - 116, 96, 32, 6, '#2ec4b6');
      text('ひとやすみ', x, GROUND - 100, 14, '#ffffff', 'center', '#11756b');
    }
  }

  // ------------------------------------------------------------------
  // キャラクター描画
  // ------------------------------------------------------------------
  // 主人公：みかん色の まんまるキャラ「ポッコ」（頭に葉っぱ、青いスニーカー）
  function drawPokko(x, y, face, t, opts = {}) {
    const cx = x + 13, cy = y + 12;
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(face, 1);
    const air = opts.air, moving = opts.moving;
    const step = moving ? Math.sin(t) * 5 : 0;
    // スニーカー
    if (air) {
      ell(5, 14, 7, 4, '#2f6fe0', -0.3); ell(-7, 12, 7, 4, '#2f6fe0', 0.3);
    } else {
      ell(-5 + step, 15, 7, 4.2, '#2f6fe0'); ell(7 - step, 15, 7, 4.2, '#2f6fe0');
      rect(-9 + step, 16, 8, 2, '#ffffff'); rect(3 - step, 16, 8, 2, '#ffffff');
    }
    if (opts.boots) {
      ell(-9 + step, 11, 4, 2.5, '#ffffff', -0.6); ell(3 - step, 11, 4, 2.5, '#ffffff', -0.6);
    }
    // からだ
    const g = ctx.createRadialGradient(-4, -6, 3, 0, 0, 16);
    g.addColorStop(0, '#ffc46b'); g.addColorStop(1, '#f57c00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    // 葉っぱ
    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1, -13); ctx.lineTo(-2, -18); ctx.stroke();
    ell(4, -19, 6, 3, '#43a047', -0.4);
    // 目
    ell(5, -4, 3.6, 4.6, '#ffffff');
    ell(6.2, -3.4, 2, 2.8, '#1a1530');
    circle(6.8, -4.6, 0.8, '#ffffff');
    // ほっぺ
    circle(10, 3, 2.6, 'rgba(255,90,120,.55)');
    // くち（ぱくぱく）
    const open = moving ? (Math.sin(t * 1.5) > 0 ? 4.5 : 1.5) : 2;
    ctx.fillStyle = '#7a1f1f';
    ctx.beginPath(); ctx.ellipse(6, 6, 4.5, open, 0, 0, Math.PI * 2); ctx.fill();
    if (open > 3) ell(6, 7.5, 2.6, 1.4, '#ff7b7b');
    ctx.restore();
  }

  // 敵：ツノのある ぷにぷにオバケ「モックン」
  function drawMoku(x, y, w, h, color, lookX, fright, flash, t, opts = {}) {
    const cx = x + w / 2, cy = y + h / 2;
    const col = fright ? (flash ? '#f1f1ff' : '#3046d6') : color;
    const wob = Math.sin(t * 0.2) * 1.2;
    // ツノ
    tri(cx - w * 0.36, cy - h * 0.18, cx - w * 0.42, cy - h * 0.64, cx - w * 0.1, cy - h * 0.38, col);
    tri(cx + w * 0.36, cy - h * 0.18, cx + w * 0.42, cy - h * 0.64, cx + w * 0.1, cy - h * 0.38, col);
    // からだ
    ell(cx, cy + 1, w / 2 + wob * 0.3, h / 2 * 0.9 - wob * 0.3, col);
    // あし
    if (!opts.noFeet) for (const k of [-1, 0, 1]) ell(cx + k * w * 0.27, y + h - 2, w * 0.12, h * 0.1, col);
    // しっぽ
    if (!fright && opts.tail !== false) tri(cx - w * 0.48, cy + 2, cx - w * 0.72, cy - 4 + wob, cx - w * 0.46, cy + 8, col);
    if (fright) {
      circle(cx - w * 0.15, cy - h * 0.1, 2.2, flash ? '#e63946' : '#ffd6e0');
      circle(cx + w * 0.15, cy - h * 0.1, 2.2, flash ? '#e63946' : '#ffd6e0');
      ctx.strokeStyle = flash ? '#e63946' : '#ffd6e0'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) ctx.lineTo(cx - w * 0.25 + k * w * 0.083, cy + h * 0.15 + (k % 2 ? -2 : 2));
      ctx.stroke();
    } else {
      const ex = lookX * 1.6;
      ell(cx - w * 0.17, cy - h * 0.08, w * 0.14, h * 0.17, '#ffffff');
      ell(cx + w * 0.17, cy - h * 0.08, w * 0.14, h * 0.17, '#ffffff');
      circle(cx - w * 0.17 + ex, cy - h * 0.05, w * 0.07, '#1a1530');
      circle(cx + w * 0.17 + ex, cy - h * 0.05, w * 0.07, '#1a1530');
      if (opts.angry) {
        ctx.strokeStyle = '#1a1530'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.3, cy - h * 0.32); ctx.lineTo(cx - w * 0.06, cy - h * 0.22);
        ctx.moveTo(cx + w * 0.3, cy - h * 0.32); ctx.lineTo(cx + w * 0.06, cy - h * 0.22);
        ctx.stroke();
      }
      rect(cx - w * 0.1, cy + h * 0.18, w * 0.2, 2, 'rgba(26,21,48,.6)');
    }
  }

  function drawEnemy(e, camX) {
    const x = e.x - camX, y = e.y;
    if (x > W + 80 || x + e.w < -80) return;
    const fright = frightT > 0 && e.t !== 'eyes';
    const flash = fright && frightT < 120 && Math.floor(frightT / 8) % 2 === 0;
    const look = Math.sign(p.x - e.x) || 0;
    switch (e.t) {
      case 'walker': case 'mini':
        drawMoku(x, y, e.w, e.h, e.color, look, fright, flash, e.at + (e.t === 'mini' ? 3 : 0));
        break;
      case 'pogo': {
        rect(x + e.w / 2 - 2, y + 18, 4, e.h - 18, '#495057');
        ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) ctx.lineTo(x + e.w / 2 + (k % 2 ? 5 : -5), y + e.h - 14 + k * 3);
        ctx.stroke();
        rect(x + 4, y + 24, e.w - 8, 3, '#495057');
        drawMoku(x, y - 2, e.w, 24, e.color, look, fright, flash, e.at, { noFeet: true });
        break;
      }
      case 'car': {
        const d = Math.sign(e.vx) || 1;
        drawMoku(x + e.w / 2 - 11, y - 2, 22, 20, e.color, d, fright, flash, e.at, { noFeet: true, tail: false });
        rrect(x, y + 12, e.w, 16, 7, fright ? (flash ? '#ffffff' : '#3046d6') : e.color);
        rrect(x + (d > 0 ? e.w - 16 : 4), y + 15, 12, 6, 3, '#bde0fe');
        rect(x + 2, y + 22, e.w - 4, 3, 'rgba(0,0,0,.2)');
        for (const wx of [x + 12, x + e.w - 12]) {
          circle(wx, y + e.h - 5, 7, '#212529');
          circle(wx, y + e.h - 5, 3, '#ced4da');
        }
        break;
      }
      case 'plane': {
        const d = Math.sign(e.vx) || 1;
        const body = fright ? (flash ? '#ffffff' : '#3046d6') : e.color;
        ell(x + e.w / 2, y + 18, e.w / 2, 8, body);
        rect(x + 8, y + 12, e.w - 16, 3, '#f8f9fa');
        rect(x + 8, y + 24, e.w - 16, 3, '#f8f9fa');
        tri(x + (d > 0 ? 2 : e.w - 2), y + 18, x + (d > 0 ? -6 : e.w + 6), y + 6, x + (d > 0 ? 8 : e.w - 8), y + 14, body);
        const px = d > 0 ? x + e.w + 2 : x - 2;
        rect(px - 1, y + 18 - 10 * Math.abs(Math.sin(globalT * 0.9)), 2, 20 * Math.abs(Math.sin(globalT * 0.9)), '#dee2e6');
        drawMoku(x + e.w / 2 - 9, y - 4, 18, 16, e.color, d, fright, flash, e.at, { noFeet: true, tail: false });
        break;
      }
      case 'floater': {
        const fl = Math.sin(e.at * 0.4) * 4;
        ell(x - 2, y + 8 - fl, 8, 4, 'rgba(255,255,255,.85)', -0.5);
        ell(x + e.w + 2, y + 8 - fl, 8, 4, 'rgba(255,255,255,.85)', 0.5);
        drawMoku(x, y, e.w, e.h, e.color, look, fright, flash, e.at, { noFeet: true });
        break;
      }
      case 'hunter':
        drawMoku(x, y, e.w, e.h, e.color, look, fright, flash, e.at, { angry: true, noFeet: true });
        break;
      case 'eyes':
        ell(x + e.w / 2 - 5, y + 10, 4, 5, '#ffffff'); ell(x + e.w / 2 + 5, y + 10, 4, 5, '#ffffff');
        circle(x + e.w / 2 - 5, y + 8, 2, '#1a1530'); circle(x + e.w / 2 + 5, y + 8, 2, '#1a1530');
        break;
    }
  }

  function drawFairy(x, y, t, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const flap = Math.abs(Math.sin(t * 0.3));
    ell(-7, -3, 8 * flap + 2, 5, 'rgba(200,240,255,.8)', -0.5);
    ell(7, -3, 8 * flap + 2, 5, 'rgba(200,240,255,.8)', 0.5);
    tri(-6, 10, 0, -2, 6, 10, '#ff8fab');
    circle(0, -6, 5, '#ffe0c7');
    ell(0, -10, 6, 3, '#ffd166');
    circle(-1.8, -6, 0.9, '#1a1530'); circle(1.8, -6, 0.9, '#1a1530');
    circle(0, -15, 1.5, '#fff6a5');
    ctx.restore();
    if (Math.floor(t) % 6 === 0) particles.push({ x: x + (Math.random() - 0.5) * 6 + (scale === 1 ? cam.x : 0), y: y + 8, vx: 0, vy: 0.3, life: 25, color: '#fff6a5', screen: scale !== 1 });
  }

  function drawFruit(kind, x, y, t) {
    const b = Math.sin(t * 0.08 + x) * 2;
    y += b;
    switch (kind) {
      case 'cherry':
        ctx.strokeStyle = '#2d6a4f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y + 2); ctx.quadraticCurveTo(x, y - 10, x + 3, y - 10); ctx.moveTo(x + 5, y + 3); ctx.lineTo(x + 3, y - 10); ctx.stroke();
        circle(x - 5, y + 4, 5.5, '#d00000'); circle(x + 5, y + 5, 5.5, '#e5383b');
        circle(x - 7, y + 2, 1.5, '#ffb3b3');
        break;
      case 'strawberry':
        ctx.fillStyle = '#e63946';
        ctx.beginPath(); ctx.moveTo(x - 8, y - 3); ctx.quadraticCurveTo(x, y - 8, x + 8, y - 3); ctx.quadraticCurveTo(x + 6, y + 8, x, y + 10); ctx.quadraticCurveTo(x - 6, y + 8, x - 8, y - 3); ctx.fill();
        tri(x - 6, y - 5, x, y - 9, x + 6, y - 5, '#2d6a4f');
        for (let i = 0; i < 5; i++) circle(x - 4 + (i % 3) * 4, y - 1 + Math.floor(i / 3) * 5, 0.9, '#fff3b0');
        break;
      case 'orange':
        circle(x, y, 8, '#fb8500'); circle(x - 3, y - 3, 2, '#ffd29d'); ell(x + 3, y - 8, 4, 2, '#2d6a4f', -0.4);
        break;
      case 'apple':
        circle(x, y + 1, 8, '#d62828'); circle(x - 3, y - 2, 2, '#ff9b9b');
        rect(x - 1, y - 10, 2, 5, '#6d4c41'); ell(x + 4, y - 8, 4, 2, '#52b788', -0.5);
        break;
      case 'melon':
        circle(x, y, 9, '#95d5b2');
        ctx.strokeStyle = '#52b788'; ctx.lineWidth = 1.2;
        for (const k of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x + k, y - 9); ctx.quadraticCurveTo(x + k * 2, y, x + k, y + 9); ctx.stroke(); }
        rect(x - 1, y - 12, 2, 4, '#6d4c41');
        break;
      case 'grape':
        for (const [dx, dy] of [[-4, -3], [4, -3], [0, -3], [-2, 2], [2, 2], [0, 7]]) circle(x + dx, y + dy, 3.6, '#7b2cbf');
        ell(x + 3, y - 8, 4, 2, '#52b788', -0.3);
        break;
      case 'clover':
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 0.03; circle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 5, '#2bb673'); }
        circle(x, y, 2, '#fff3b0');
        break;
      case 'pellet': {
        const pulse = 1 + Math.sin(t * 0.15) * 0.15;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 16 * pulse);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,224,102,.9)'); g.addColorStop(1, 'rgba(255,224,102,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5 - Math.PI / 2 + t * 0.02, r = i % 2 ? 3.5 : 8;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.fill();
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // 画面描画
  // ------------------------------------------------------------------
  function drawWorld() {
    const camX = Math.round(cam.x);
    drawBackground(stage.theme, camX);
    drawTerrain(camX);
    drawGoal(camX);
    for (const s of stage.solids) drawSolid(s, camX);
    for (const s of stage.springs) drawSolid(s, camX);
    for (const m of stage.movers) drawSolid(m, camX);
    for (const it of stage.items) if (!it.taken) drawFruit(it.kind, it.x - camX, it.y, globalT);
    for (const e of enemies) drawEnemy(e, camX);
    if (!stage.boots && state !== 'dying') drawFairy(fairy.x - camX, fairy.y, globalT);
    const visible = state !== 'dying' || stateT > 20 || Math.floor(stateT / 3) % 2 === 0;
    if (visible) {
      drawPokko(p.x - camX, p.y, p.face, p.anim, {
        moving: p.onGround && Math.abs(p.vx) > 0.3, air: !p.onGround && state !== 'dying',
        rot: state === 'dying' ? p.rot : 0, boots: stage.boots,
      });
    }
    for (const pt of particles) {
      ctx.globalAlpha = clamp(pt.life / 30, 0, 1);
      circle(pt.screen ? pt.x : pt.x - camX, pt.y, 2, pt.color);
    }
    ctx.globalAlpha = 1;
    for (const pu of popups) {
      ctx.globalAlpha = clamp(1 - (pu.t - 40) / 30, 0, 1);
      text(pu.text, pu.x - camX, pu.y - pu.t * 0.5, 14, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    rect(0, 0, W, 30, 'rgba(26,21,48,.55)');
    text(`SCORE ${score}`, 12, 16, 16, '#ffffff', 'left');
    text(`HI ${hiscore}`, 210, 16, 16, '#ffd166', 'left');
    const sec = Math.ceil(timer / 60);
    text(`TIME ${sec}`, 380, 16, 16, sec <= 10 && Math.floor(globalT / 15) % 2 ? '#ff5252' : '#ffffff', 'left');
    text(`R${round}-${stageIdx + 1}`, 510, 16, 16, '#9ad1ff', 'left');
    for (let i = 0; i < Math.min(lives - 1, 6); i++) {
      const lx = W - 24 - i * 24;
      circle(lx, 15, 8, '#f57c00');
      ell(lx + 3, 7, 3, 1.6, '#43a047', -0.4);
      circle(lx + 3, 13, 1.4, '#1a1530');
    }
    if (stage.boots) text('ウィングブーツ：くうちゅうジャンプOK', W / 2, 46, 13, '#ffffff');
    if (frightT > 0) {
      rect(W / 2 - 80, 38 + (stage.boots ? 18 : 0), 160 * frightT / frightLen(), 6, '#ffe066');
    }
  }

  function overlayBand(lines) {
    rect(0, H / 2 - 60, W, 120, 'rgba(26,21,48,.72)');
    lines.forEach(([s, size, color], i) => text(s, W / 2, H / 2 - 30 + i * 32, size, color));
  }

  function drawTitle() {
    const camX = globalT * 1.2;
    drawBackground('town', camX);
    rect(0, GROUND, W, H - GROUND, '#55555f');
    rect(0, GROUND, W, 12, '#cfcfd8');
    rect(0, GROUND + 12, W, 3, '#8e8e99');
    for (let wx = Math.ceil(camX / 70) * 70; wx < camX + W; wx += 70) rect(wx - camX, GROUND + 38, 30, 4, '#ffd166');

    const bob = Math.sin(globalT * 0.1) * 6;
    text('PACPAC LAND', W / 2, 98 + bob * 0.3, 64, '#ffd166', 'center', '#c1121f');
    text('〜 パクパクランド 〜', W / 2, 148, 20, '#ffffff');
    text('まいごの ようせいを「ようせいの国」へ おくりとどけて、おうちに かえろう！', W / 2, 186, 14, '#ffffff');

    // 主人公と追いかけてくるモックン
    const px = 260 + Math.sin(globalT * 0.02) * 40;
    drawPokko(px, GROUND - 28 + (Math.abs(Math.sin(globalT * 0.08)) * -18), 1, globalT * 0.3, { moving: true });
    drawFairy(px - 30, GROUND - 60 + Math.sin(globalT * 0.08) * 5, globalT, 1.0001);
    drawMoku(px - 140, GROUND - 26, 26, 26, '#e8453c', 1, false, false, globalT);
    drawMoku(px - 190, GROUND - 26, 26, 26, '#9b5de5', 1, false, false, globalT + 5);
    const carX = W - ((globalT * 2.5) % (W + 200)) + 60;
    drawMoku(carX + 17, GROUND - 36, 22, 20, '#2bb673', -1, false, false, globalT, { noFeet: true, tail: false });
    rrect(carX, GROUND - 22, 56, 16, 7, '#2bb673');
    circle(carX + 12, GROUND - 5, 7, '#212529'); circle(carX + 44, GROUND - 5, 7, '#212529');

    if (Math.floor(globalT / 30) % 2 === 0) text('ジャンプボタン で スタート', W / 2, 250, 22, '#ffffff', 'center', '#c1121f');
    text('◀ ▶ いどう　／　JUMP ジャンプ（ながおしで 高く とぶ）', W / 2, 286, 14, '#1a1530', 'center', '#ffffff');
    text(`HI SCORE ${hiscore}`, W / 2, 314, 14, '#ffd166');
    text('PACPAC LAND — クラシック横スクロールへのオマージュ作品', W / 2, H - 14, 11, '#ffffff');
  }

  function drawFairyland() {
    sky('#ffc8ec', '#d6f5ff');
    for (let i = 0; i < 30; i++) {
      const x = (rnd(i, 1) * W + globalT * (0.2 + rnd(i, 2))) % W;
      circle(x, rnd(i, 3) * 300, 1.5 + rnd(i, 4) * 2, 'rgba(255,255,255,.8)');
    }
    // お城
    const cx = W / 2;
    rect(cx - 110, 150, 220, 218, '#fff0f6');
    for (const tx of [cx - 130, cx - 30, cx + 70]) {
      rect(tx, 110, 60, 258, '#ffe5ef');
      tri(tx - 8, 112, tx + 30, 40, tx + 68, 112, '#ff8fab');
    }
    rrect(cx - 30, 280, 60, 88, 30, '#c9184a');
    rect(0, GROUND, W, H - GROUND, '#b8f2c9');
    rect(0, GROUND, W, 10, '#e0ffe9');
    // 妖精たち
    for (let i = 0; i < 5; i++) {
      drawFairy(cx - 200 + i * 100, 220 + Math.sin(globalT * 0.05 + i) * 20, globalT + i * 3, 1.5);
    }
    drawPokko(cx - 13, GROUND - 28, 1, globalT * 0.2, { boots: stateT > 150 });
    if (stateT > 150) burst(cx, GROUND - 6, '#ffffff', 1), particles.forEach(pt => { pt.screen = true; });
    for (const pt of particles) { ctx.globalAlpha = clamp(pt.life / 30, 0, 1); circle(pt.x, pt.y, 2, pt.color); }
    ctx.globalAlpha = 1;

    rect(0, 0, W, 34, 'rgba(26,21,48,.5)');
    text(`SCORE ${score}`, 12, 17, 16, '#ffffff', 'left');
    if (stateT > 20) text('ようせいの国に とうちゃく！', cx, 70, 28, '#ffffff', 'center', '#c9184a');
    if (stateT > 90) text('「おくってくれて ありがとう！」', cx, 300, 18, '#ffffff', 'center', '#c9184a');
    if (stateT > 150) text('おれいに ウィングブーツを もらった！ くうちゅうでも ジャンプできるぞ', cx, 334, 15, '#ffffff', 'center', '#1a1530');
    if (stateT > 220) text('さあ、おうちへ かえろう！', cx, 408, 20, '#ffd166', 'center', '#1a1530');
  }

  function drawHome() {
    sky('#141a3a', '#3a3f8f');
    for (let i = 0; i < 60; i++) circle(rnd(i, 1) * W, rnd(i, 2) * 300, rnd(i, 3) < 0.2 ? 1.8 : 1, `rgba(255,255,255,${0.5 + 0.5 * Math.abs(Math.sin(globalT * 0.03 + i))})`);
    circle(640, 80, 34, '#fff3b0');
    circle(652, 72, 30, '#141a3a');
    const cx = W / 2;
    rect(0, GROUND, W, H - GROUND, '#2f6e45');
    rect(0, GROUND, W, 10, '#3f8f5a');
    rect(cx - 90, GROUND - 130, 180, 130, '#ffd6a5');
    tri(cx - 110, GROUND - 130, cx, GROUND - 210, cx + 110, GROUND - 130, '#c0392b');
    rect(cx - 70, GROUND - 106, 40, 34, '#ffe066'); rect(cx + 30, GROUND - 106, 40, 34, '#ffe066');
    rect(cx - 20, GROUND - 60, 40, 60, '#8d5a3b');
    drawPokko(cx + 110, GROUND - 28 - Math.abs(Math.sin(globalT * 0.12)) * 20, -1, globalT * 0.2, { boots: true });
    rect(0, 0, W, 34, 'rgba(26,21,48,.5)');
    text(`SCORE ${score}`, 12, 17, 16, '#ffffff', 'left');
    if (stateT > 20) text('おうちに かえってきた！', cx, 70, 30, '#ffffff', 'center', '#c0392b');
    if (stateT > 80) text(`ROUND ${round} クリア！　ボーナス 5000点 ＆ 1UP`, cx, 118, 18, '#ffd166');
    if (stateT > 160) text('つぎのラウンドは もっと むずかしいぞ…', cx, 400, 16, '#ffffff');
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state === 'title') { drawTitle(); return; }
    if (state === 'fairy') { drawFairyland(); return; }
    if (state === 'home') { drawHome(); return; }
    drawWorld();
    drawHUD();
    if (state === 'intro') {
      overlayBand([[`${stage.name}　${stage.sub}`, 26, '#ffffff'], [stage.boots ? 'おうちを めざせ！（← ひだりへ すすもう）' : 'ようせいを おくりとどけよう！', 16, '#9ad1ff'], ['READY!', 24, '#ffd166']]);
    } else if (state === 'clear') {
      overlayBand([['ステージ クリア！', 30, '#ffd166'], [`のこりタイム ボーナス  ${bonusLeft * 50}`, 18, '#ffffff'], ['', 10, '#fff']]);
    } else if (state === 'gameover') {
      overlayBand([['GAME OVER', 40, '#ff5252'], [`SCORE ${score}`, 20, '#ffffff'], ['ジャンプで タイトルへ', 14, '#9ad1ff']]);
    }
  }

  // ------------------------------------------------------------------
  // ループ
  // ------------------------------------------------------------------
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    bgmTick();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // テスト用の簡易フック
  window.__pacpac = {
    get state() { return state; }, get stage() { return stage; }, get player() { return p; },
    get enemies() { return enemies; }, get score() { return score; }, get lives() { return lives; },
    loadStage, startGame,
  };
})();

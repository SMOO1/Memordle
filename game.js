"use strict";

/* ---------- Date + seeded randomness ---------- */
const EPOCH = new Date(2026, 10, 5); // Puzzle #1 = Nov 5, 2026

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d);
}
function puzzleNo() {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((t - EPOCH) / 864e5) + 1;
}
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TODAY = dateKey();
const rngFor = (tag) => mulberry32(hashSeed(`recall:${TODAY}:${tag}`));
const pick = (r, n) => Math.floor(r() * n);
function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = pick(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* ---------- Storage ---------- */
const KEY = "memordle-v1";
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
const S = load();
S.days = S.days || {};
S.stats = S.stats || { played: 0, streak: 0, maxStreak: 0, totalStars: 0, last: null };
const D = (S.days[TODAY] = S.days[TODAY] || { results: [], inProgress: null });

/* ---------- Games ---------- */
const GAMES = [
  { id: "echo", name: "Echo", icon: "◉", sub: "Repeat the sequence",
    blurb: "Tiles light up one at a time. Tap them back in the same order. Each round the sequence grows by one — get to 10 for three stars.",
    run: runEcho },
  { id: "flash", name: "Flash", icon: "▦", sub: "Recall the pattern",
    blurb: "A pattern flashes on the grid for a moment. Tap every cell that was lit. One wrong tap ends the round. Three rounds, each harder.",
    run: runFlash },
  { id: "pairs", name: "Pairs", icon: "❖", sub: "Match the cards",
    blurb: "Flip two cards at a time to find matching pairs. Clear the board in as few moves as you can.",
    run: runPairs },
  { id: "digits", name: "Digits", icon: "#", sub: "Remember the number",
    blurb: "A number appears for a few seconds. Type it back from memory. Three rounds: 5, 7 and 9 digits.",
    run: runDigits },
];
const MAX_STARS = GAMES.length * 3;

function flashCls(el, cls, ms = 260) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
function makeCells(grid, count, cls = "cell") {
  grid.innerHTML = "";
  return Array.from({ length: count }, (_, i) => {
    const b = document.createElement("button");
    b.className = cls; b.dataset.i = i; b.setAttribute("aria-label", `Tile ${i + 1}`);
    grid.appendChild(b); return b;
  });
}
function pips(el, results, total) {
  el.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="pip ${results[i] === true ? "ok" : results[i] === false ? "no" : ""}"></span>`).join("");
}

/* Echo — Simon-style growing sequence on a 3x3 grid */
async function runEcho(stage) {
  const r = rngFor("echo");
  const seq = [];
  while (seq.length < 10) { const n = pick(r, 9); if (n !== seq[seq.length - 1]) seq.push(n); }

  stage.innerHTML = `<div class="status" id="st"></div><div class="grid locked" id="g" style="--n:3"></div>`;
  const st = stage.querySelector("#st"), g = stage.querySelector("#g");
  const cells = makeCells(g, 9);
  let best = 0;

  for (let len = 3; len <= 10; len++) {
    st.innerHTML = `Watch <span class="sub">· ${len} tiles</span>`;
    g.classList.add("locked");
    await sleep(700);
    const on = Math.max(280, 520 - len * 25);
    for (let k = 0; k < len; k++) {
      const c = cells[seq[k]];
      c.classList.add("lit"); await sleep(on);
      c.classList.remove("lit"); await sleep(160);
    }
    st.textContent = "Your turn";
    g.classList.remove("locked");
    const ok = await new Promise((res) => {
      let k = 0;
      g.onclick = (e) => {
        const c = e.target.closest(".cell"); if (!c) return;
        if (+c.dataset.i === seq[k]) {
          flashCls(c, "good"); k++;
          if (k === len) { g.onclick = null; res(true); }
        } else {
          g.onclick = null; c.classList.add("bad"); cells[seq[k]].classList.add("hint"); res(false);
        }
      };
    });
    g.classList.add("locked");
    if (!ok) { st.textContent = `Missed — you reached ${best}`; await sleep(1500); break; }
    best = len;
    st.textContent = len === 10 ? "Flawless!" : "Nice";
    await sleep(len === 10 ? 1000 : 450);
  }
  const stars = best >= 10 ? 3 : best >= 7 ? 2 : best >= 5 ? 1 : 0;
  return { stars, detail: `Longest sequence: ${best} / 10` };
}

/* Flash — memorize a briefly shown pattern */
async function runFlash(stage) {
  const r = rngFor("flash");
  const rounds = [{ n: 4, k: 5 }, { n: 5, k: 7 }, { n: 5, k: 9 }];
  stage.innerHTML = `<div class="status" id="st"></div><div class="grid locked" id="g"></div><div class="pips" id="pp"></div>`;
  const st = stage.querySelector("#st"), g = stage.querySelector("#g"), pp = stage.querySelector("#pp");
  const res = [];
  pips(pp, res, 3);

  for (const [ri, { n, k }] of rounds.entries()) {
    const target = new Set(shuffle(r, [...Array(n * n).keys()]).slice(0, k));
    g.style.setProperty("--n", n);
    const cells = makeCells(g, n * n);
    g.classList.add("locked");
    st.innerHTML = `Round ${ri + 1} of 3 <span class="sub">· memorize ${k} cells</span>`;
    await sleep(800);
    target.forEach((t) => cells[t].classList.add("lit"));
    await sleep(1500);
    target.forEach((t) => cells[t].classList.remove("lit"));
    st.textContent = "Tap the cells that were lit";
    g.classList.remove("locked");
    const ok = await new Promise((done) => {
      let found = 0;
      g.onclick = (e) => {
        const c = e.target.closest(".cell"); if (!c || c.classList.contains("on")) return;
        if (target.has(+c.dataset.i)) {
          c.classList.add("on"); found++;
          if (found === k) { g.onclick = null; done(true); }
        } else {
          g.onclick = null; c.classList.add("wrong");
          target.forEach((t) => { if (!cells[t].classList.contains("on")) cells[t].classList.add("hint"); });
          done(false);
        }
      };
    });
    g.classList.add("locked");
    res.push(ok); pips(pp, res, 3);
    st.textContent = ok ? "Perfect" : "Not quite";
    await sleep(1300);
  }
  const passed = res.filter(Boolean).length;
  return { stars: passed, detail: `Patterns recalled: ${passed} / 3` };
}

/* Pairs — classic concentration */
const EMOJI = ["🍋", "🌵", "🐙", "🎈", "🍄", "🦊", "🌙", "🎲", "🐝", "🍉", "⚓", "🪐", "🦋", "🍩", "🔑", "🌻", "🐳", "🎸", "🧊", "🍒", "🦔", "🧁", "🚀", "🐢"];
function runPairs(stage) {
  const r = rngFor("pairs");
  const faces = shuffle(r, EMOJI.slice()).slice(0, 8);
  const deck = shuffle(r, [...faces, ...faces]);
  stage.innerHTML = `<div class="status" id="st">Moves: 0</div><div class="grid" id="g" style="--n:4"></div>`;
  const st = stage.querySelector("#st"), g = stage.querySelector("#g");
  const cards = makeCells(g, 16, "card");
  cards.forEach((c, i) => { c.dataset.f = deck[i]; c.innerHTML = `<span class="face">${deck[i]}</span>`; c.setAttribute("aria-label", "Hidden card"); });

  return new Promise((resolve) => {
    let first = null, busy = false, moves = 0, matched = 0;
    g.onclick = async (e) => {
      const c = e.target.closest(".card");
      if (!c || busy || c.classList.contains("up")) return;
      c.classList.add("up"); c.setAttribute("aria-label", c.dataset.f);
      if (!first) { first = c; return; }
      const a = first; first = null; moves++;
      st.textContent = `Moves: ${moves}`;
      if (a.dataset.f === c.dataset.f) {
        a.classList.add("done"); c.classList.add("done"); matched++;
        if (matched === 8) {
          g.onclick = null;
          st.textContent = `Cleared in ${moves} moves`;
          await sleep(1100);
          const stars = moves <= 12 ? 3 : moves <= 16 ? 2 : moves <= 22 ? 1 : 0;
          resolve({ stars, detail: `Cleared in ${moves} moves` });
        }
      } else {
        busy = true; await sleep(800);
        [a, c].forEach((x) => { x.classList.remove("up"); x.setAttribute("aria-label", "Hidden card"); });
        busy = false;
      }
    };
  });
}

/* Digits — number span */
async function runDigits(stage) {
  const r = rngFor("digits");
  const lens = [5, 7, 9];
  stage.innerHTML = `
    <div class="status" id="st"></div>
    <div class="number" id="num"></div>
    <form class="digit-form" id="f" hidden>
      <input id="in" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Your answer">
      <button class="btn" type="submit">Submit</button>
    </form>
    <div class="pips" id="pp"></div>`;
  const st = stage.querySelector("#st"), num = stage.querySelector("#num"),
    f = stage.querySelector("#f"), inp = stage.querySelector("#in"), pp = stage.querySelector("#pp");
  const res = [];
  pips(pp, res, 3);

  for (const [i, len] of lens.entries()) {
    let s = String(1 + pick(r, 9));
    while (s.length < len) s += pick(r, 10);
    st.innerHTML = `Round ${i + 1} of 3 <span class="sub">· ${len} digits</span>`;
    f.hidden = true; num.hidden = false; num.className = "number"; num.textContent = "";
    await sleep(700);
    num.textContent = s;
    await sleep(1000 + len * 300);
    num.textContent = ""; num.hidden = true;
    f.hidden = false; inp.value = ""; inp.focus();
    st.textContent = "What was the number?";
    const ans = await new Promise((done) => { f.onsubmit = (e) => { e.preventDefault(); done(inp.value.replace(/\D/g, "")); }; });
    const ok = ans === s;
    res.push(ok); pips(pp, res, 3);
    f.hidden = true; num.hidden = false;
    if (ok) { num.className = "number good"; num.textContent = s; st.textContent = "Correct"; }
    else { num.className = "number bad"; num.innerHTML = `<s>${ans || "—"}</s><br>${s}`; st.textContent = "Not quite"; }
    await sleep(1600);
  }
  const passed = res.filter(Boolean).length;
  return { stars: passed, detail: `Numbers recalled: ${passed} / 3` };
}

/* ---------- Screens ---------- */
const app = document.getElementById("app");
document.getElementById("tag").textContent = `#${puzzleNo()} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

const starStr = (n) => "★".repeat(n) + `<span class="off">${"★".repeat(3 - n)}</span>`;
function currentStreak() {
  const st = S.stats;
  return st.last === TODAY || st.last === yesterdayKey() ? st.streak : 0;
}
function view(html) { app.innerHTML = `<div class="fadein">${html}</div>`; }

function lineup() {
  return `<ul class="lineup">${GAMES.map((g, i) => {
    const r = D.results[i];
    return `<li class="${r ? "done" : ""}"><span class="ico">${g.icon}</span>
      <div><div class="name">${g.name}</div><div class="sub">${g.sub}</div></div>
      ${r ? `<span class="stars">${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)}</span>` : ""}</li>`;
  }).join("")}</ul>`;
}
function statsBlock() {
  const st = S.stats;
  return `<div class="stats">
    <div><b>${st.played}</b><span>Played</span></div>
    <div><b>${currentStreak()}</b><span>Streak</span></div>
    <div><b>${st.maxStreak}</b><span>Best streak</span></div></div>`;
}

function showHome() {
  const started = D.results.length > 0;
  view(`
    <p class="kicker">Today's set</p>
    <h2>Four games. One shot each.</h2>
    <p class="lede">Same four memory games every day, new puzzles every day. Everyone gets the same ones.</p>
    ${lineup()}
    <button class="btn" id="go">${started ? "Continue" : "Play"}</button>
    ${statsBlock()}`);
  document.getElementById("go").onclick = () => showIntro(D.results.length);
}

function showIntro(i) {
  const g = GAMES[i];
  view(`
    <p class="kicker">Game ${i + 1} of ${GAMES.length}</p>
    <h2>${g.icon}&nbsp; ${g.name}</h2>
    <p class="lede">${g.blurb}</p>
    <button class="btn" id="go">Start</button>`);
  document.getElementById("go").onclick = () => playGame(i);
}

async function playGame(i) {
  const g = GAMES[i];
  D.inProgress = i; save(); // leaving mid-game counts as 0 stars
  view(`<p class="kicker">Game ${i + 1} of ${GAMES.length} · ${g.name}</p><div id="stage"></div>`);
  const result = await g.run(document.getElementById("stage"));
  D.results[i] = result; D.inProgress = null;
  if (D.results.length === GAMES.length) finishDay();
  save();
  showResult(i, result);
}

function showResult(i, r) {
  const last = i === GAMES.length - 1;
  view(`
    <p class="kicker center">${GAMES[i].name}</p>
    <div class="big-stars">${starStr(r.stars)}</div>
    <p class="lede center">${r.detail}</p>
    <button class="btn" id="go">${last ? "See today's score" : `Next: ${GAMES[i + 1].name}`}</button>`);
  document.getElementById("go").onclick = () => (last ? showSummary() : showIntro(i + 1));
}

function finishDay() {
  const st = S.stats;
  if (st.last === TODAY) return;
  st.streak = st.last === yesterdayKey() ? st.streak + 1 : 1;
  st.maxStreak = Math.max(st.maxStreak, st.streak);
  st.played += 1;
  st.totalStars += D.results.reduce((a, r) => a + r.stars, 0);
  st.last = TODAY;
}

function shareRank() {
  const p = D.pct;
  if (p && p.real) return ` · beat ${p.value}% of players`;
  return "";
}
function shareText() {
  const total = D.results.reduce((a, r) => a + r.stars, 0);
  const rows = GAMES.map((g, i) => {
    const s = D.results[i].stars;
    return `${g.name.padEnd(6, " ")} ${"🟪".repeat(s)}${"⬜".repeat(3 - s)}`;
  });
  return `Memordle #${puzzleNo()} · ${total}/${MAX_STARS}★${shareRank()}\n${rows.join("\n")}\n${location.href.split("#")[0]}`;
}

/* ---------- Backend: real "better than x% of today's players" ---------- */
const CFG = window.MEMORDLE_CONFIG || {};
const BACKEND = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const MIN_PLAYERS = 5; // below this, the real percentile is too noisy to show

function clientId() {
  if (!S.clientId) {
    S.clientId = (crypto.randomUUID && crypto.randomUUID()) ||
      "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
    save();
  }
  return S.clientId;
}
function api(path, body) {
  const base = CFG.SUPABASE_URL.replace(/\/+$/, "");
  return fetch(`${base}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}
async function submitScore() {
  if (!BACKEND || D.submitted) return;
  const games = D.results.map((r) => r.stars);
  const res = await api("scores", {
    day: TODAY, puzzle: puzzleNo(), total: games.reduce((a, b) => a + b, 0), games, client_id: clientId(),
  });
  // 409 = this player already submitted today, which is fine
  if (res.ok || res.status === 409) { D.submitted = true; save(); }
  else throw new Error(`submit failed: ${res.status}`);
}
async function fetchDistribution() {
  const res = await api("rpc/day_distribution", { p_day: TODAY });
  if (!res.ok) throw new Error(`distribution failed: ${res.status}`);
  return res.json(); // [{ total, players }]
}
function realPercentile(total, rows) {
  let n = 0, below = 0, same = 0;
  for (const { total: t, players } of rows) {
    const c = Number(players); n += c;
    if (t < total) below += c; else if (t === total) same += c;
  }
  if (n < MIN_PLAYERS) return { n, pct: null };
  // You count in "same"; compare against everyone else.
  const others = n - 1;
  const pct = Math.round(((below + Math.max(0, same - 1) / 2) / others) * 100);
  return { n, pct: Math.max(0, Math.min(100, pct)) };
}

/* Fallback when there's no backend or too few players yet:
   an estimate from a modeled score distribution (roughly normal, mean 6.5★, sd 2.4). */
function estimatedPercentile(total) {
  const r = rngFor("crowd");
  const mean = 6.5 + (r() - 0.5) * 1.2, sd = 2.4;
  const pdf = (x) => Math.exp(-((x - mean) ** 2) / (2 * sd * sd));
  const w = Array.from({ length: MAX_STARS + 1 }, (_, i) => pdf(i));
  const sum = w.reduce((a, b) => a + b, 0);
  let below = 0;
  for (let i = 0; i < total; i++) below += w[i];
  return Math.max(1, Math.min(99, Math.round(((below + w[total] / 2) / sum) * 100)));
}

const todayTotal = () => D.results.reduce((a, r) => a + r.stars, 0);
function pctHTML() {
  const p = D.pct;
  if (p && p.real) {
    return `Better than <b>${p.value}%</b> of today's players<span class="est">${p.n.toLocaleString()} played</span>`;
  }
  if (p && p.few) {
    return `You're one of the first <b>${p.n}</b> players today<span class="est">early</span>`;
  }
  return `Better than <b>${estimatedPercentile(todayTotal())}%</b> of players<span class="est">estimate</span>`;
}
async function loadPercentile() {
  if (!BACKEND) return;
  const el = document.getElementById("pct");
  if (el) el.classList.add("loading");
  try {
    await submitScore();
    const { n, pct } = realPercentile(todayTotal(), await fetchDistribution());
    D.pct = pct === null ? { few: true, n } : { real: true, value: pct, n };
    save();
  } catch (e) {
    console.warn("Memordle backend:", e);
  }
  const now = document.getElementById("pct");
  if (now) { now.innerHTML = pctHTML(); now.classList.remove("loading"); }
}

function showSummary() {
  const total = todayTotal();
  const verdict = total >= 11 ? "Elephant-grade memory." : total >= 8 ? "Sharp today." : total >= 5 ? "Solid effort." : "Tomorrow's a new set.";
  view(`
    <p class="kicker center">Puzzle #${puzzleNo()} complete</p>
    <div class="score">${total}<small> / ${MAX_STARS}</small></div>
    <p class="lede center">${verdict}</p>
    <div class="pct" id="pct">${pctHTML()}</div>
    ${lineup()}
    <div class="row">
      <button class="btn" id="share">Share result</button>
    </div>
    ${statsBlock()}
    <div class="countdown">Next puzzle in <b id="cd">--:--:--</b></div>`);
  document.getElementById("share").onclick = share;
  tickCountdown();
  loadPercentile(); // refreshes the real number every time the summary is opened
}

async function share() {
  const text = shareText();
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand("copy"); toast("Copied to clipboard"); } catch { toast("Couldn't copy"); }
    ta.remove();
  }
}
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 1900);
}

let cdTimer;
function tickCountdown() {
  clearInterval(cdTimer);
  const update = () => {
    const el = document.getElementById("cd"); if (!el) return clearInterval(cdTimer);
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = next - now;
    if (ms <= 0 || dateKey() !== TODAY) return location.reload();
    const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
    el.textContent = [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
  };
  update(); cdTimer = setInterval(update, 1000);
}

/* ---------- Boot ---------- */
(function boot() {
  // A game abandoned mid-play (refresh / close) is scored 0 so it can't be replayed.
  if (D.inProgress !== null && !D.results[D.inProgress]) {
    D.results[D.inProgress] = { stars: 0, detail: "Left mid-game" };
  }
  D.inProgress = null;
  if (D.results.length === GAMES.length) finishDay();
  // Trim old days so storage stays small
  Object.keys(S.days).sort().slice(0, -60).forEach((k) => delete S.days[k]);
  save();
  D.results.length === GAMES.length ? showSummary() : showHome();
})();

/* GCSE Week Planner. Worksheets come from worksheets/manifest.json (written by tools/generate.js). */
(function () {
  "use strict";
  const G = window.GCSE, CFG = window.PLANNER_CONFIG || {};
  const WEIGHT = { high: 4, medium: 3, low: 2 }; // high is exactly twice low
  const DAYNAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const SCIENCES = ["biology","chemistry","physics"];
  const GAP = 15; // minimum minutes between revision blocks
  const STORE = "gcse-intranet-planner-v2", OLD_STORE = "gcse-intranet-planner-v1";
  const $ = s => document.querySelector(s);
  const esc = G.esc;
  let MANIFEST = { items: {} };

  /* ---------- State ---------- */
  function nextMonday() {
    const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const weekday = () => ({ off: false, start: "16:30", end: "20:30", count: 3, len: 30 });
  const weekend = () => ({ off: false, start: "10:00", end: "13:00", count: 3, len: 30 });
  function defaults() {
    return {
      weekStart: nextMonday(), arrange: "spread",
      template: weekday(),
      days: [weekday(), weekday(), weekday(), weekday(), Object.assign(weekday(), { off: true }), weekend(), weekend()],
      commitments: [
        { label: "Meal time", days: [0,1,2,3,4,5,6], start: "18:00", end: "18:45" },
        { label: "Football training", days: [1,3], start: "17:00", end: "18:30" },
        { label: "Seeing friends", days: [5], start: "11:30", end: "17:00" }
      ],
      science: { route: "combined", tier: "higher" },
      subjects: {
        maths: { on: true, priority: "high", tier: "higher" },
        englang: { on: true, priority: "medium" },
        englit: { on: true, priority: "high" },
        combined: { on: true, priority: "high" },
        biology: { on: true, priority: "medium" }, chemistry: { on: true, priority: "medium" }, physics: { on: true, priority: "medium" }
      },
      railCollapsed: false
    };
  }
  let S, PLAN = null, CODE = null;
  try {
    const o = JSON.parse(localStorage.getItem(STORE) || "null");
    if (o) { S = o.settings; PLAN = o.plan; CODE = o.code || null; }
    else {
      // Carry over subjects and commitments from the earlier version of the planner.
      const old = JSON.parse(localStorage.getItem(OLD_STORE) || "null");
      if (old && old.settings) { S = defaults(); S.subjects = old.settings.subjects || S.subjects; S.science = old.settings.science || S.science; }
    }
  } catch (e) {}
  if (!S) S = defaults();
  migrate(S);
  // Older commitments used a single "day" value; they now use a list of days.
  function migrate(st) {
    st.subjects = st.subjects || {};
    for (const sub of G.SUBJECTS) {
      if (!st.subjects[sub.key]) st.subjects[sub.key] = { on: false, priority: "medium" };
      const c = st.subjects[sub.key];
      if (sub.other && sub.tiered && !c.tier) c.tier = "higher";
      if (sub.other && sub.options.length) c.opts = Object.assign(G.defaultOpts(sub.key), c.opts || {});
    }
    for (const c of st.commitments || []) {
      if (Array.isArray(c.days)) continue;
      c.days = c.day === "all" ? [0,1,2,3,4,5,6] : c.day === "weekdays" ? [0,1,2,3,4] : c.day === "weekend" ? [5,6] : (c.day === undefined || c.day === "" ? [] : [+c.day]);
      delete c.day;
    }
  }
  function save(noSync) {
    try { localStorage.setItem(STORE, JSON.stringify({ settings: S, plan: PLAN, code: CODE })); } catch (e) {}
    if (!noSync && CODE && PLAN) scheduleSync();
  }

  const tierFor = k => k === "maths" ? S.subjects.maths.tier : (k === "combined" || SCIENCES.includes(k)) ? S.science.tier : (G.SUBJ[k].tiered ? S.subjects[k].tier || "higher" : "");
  const optsFor = k => (S.subjects[k] && S.subjects[k].opts) || G.defaultOpts(k);
  function activeSubjects() {
    return G.SUBJECTS.map(s => s.key).filter(k => {
      if (!S.subjects[k].on) return false;
      if (k === "combined") return S.science.route === "combined";
      if (SCIENCES.includes(k)) return S.science.route === "separate";
      return true;
    });
  }

  /* ---------- Worksheet availability ---------- */
  const specFor = (b, format) => G.worksheetSpec(b.subject, tierFor(b.subject), b, format || b.format);
  function visibleVersions(id) {
    const it = MANIFEST.items[id]; if (!it) return [];
    return it.versions.filter(v => v.status === "approved" || (CFG.showUnreviewed && v.status === "pending"));
  }
  const isReady = (b, format) => visibleVersions(specFor(b, format).id).length > 0;

  /* ---------- Times ---------- */
  const toMin = t => { if (!t) return NaN; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTime = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const rand = n => Math.floor(Math.random() * n);
  const commitDays = c => Array.isArray(c.days) ? c.days : [];
  const commitsOn = di => S.commitments.filter(c => c.start && c.end && toMin(c.end) > toMin(c.start) && commitDays(c).includes(di));

  /* Work out the block times for one day.
     Blocks sit between the day's start and end, at least GAP minutes apart, and never overlap a commitment.
     If they can't all fit, the fewest possible are removed. */
  function scheduleDay(di) {
    const d = S.days[di], L = +d.len, want = Math.max(0, Math.min(10, +d.count || 0));
    const res = { blocks: [], removed: 0, reason: "" };
    if (d.off || !want) return res;
    const S0 = toMin(d.start), E0 = toMin(d.end);
    if (!(E0 > S0)) { res.removed = want; res.reason = "the end time is before the start time"; return res; }
    // Busy times inside the window; very short commitments still leave a full gap between blocks.
    const busy = commitsOn(di).map(c => ({ s: toMin(c.start), e: toMin(c.end), label: c.label || "a commitment" }))
      .filter(b => b.e > S0 && b.s < E0)
      .map(b => ({ s: Math.max(b.s, S0), e: Math.min(Math.max(b.e, b.s + GAP), E0), label: b.label }))
      .sort((a, b) => a.s - b.s);
    const segs = []; let cur = S0;
    for (const b of busy) { if (b.s > cur) segs.push({ s: cur, e: b.s }); cur = Math.max(cur, b.e); }
    if (E0 > cur) segs.push({ s: cur, e: E0 });
    segs.forEach(sg => { const len = sg.e - sg.s; sg.cap = len >= L ? Math.floor((len + GAP) / (L + GAP)) : 0; sg.k = 0; });
    const cap = segs.reduce((a, sg) => a + sg.cap, 0), n = Math.min(want, cap);
    res.removed = want - n;
    if (res.removed) res.reason = busy.length ? "to fit around " + [...new Set(busy.map(b => b.label))].join(" and ") : "there isn't enough time between " + d.start + " and " + d.end;
    // Share the blocks between free stretches: in order for back-to-back, by free time for spread out.
    for (let i = 0; i < n; i++) {
      let best = null;
      for (const sg of segs) {
        if (sg.k >= sg.cap) continue;
        if (S.arrange === "pack") { best = sg; break; }
        if (!best || (sg.e - sg.s) / (sg.k + 1) > (best.e - best.s) / (best.k + 1)) best = sg;
      }
      best.k++;
    }
    for (const sg of segs) {
      if (!sg.k) continue;
      let step = L + GAP;
      if (S.arrange !== "pack" && sg.k > 1) step += Math.floor((sg.e - sg.s - sg.k * L - (sg.k - 1) * GAP) / (sg.k - 1) / 5) * 5;
      for (let i = 0; i < sg.k; i++) { const s = sg.s + i * step; res.blocks.push({ start: toTime(s), end: toTime(s + L) }); }
    }
    res.blocks.sort((a, b) => a.start.localeCompare(b.start));
    return res;
  }
  const allSchedules = () => S.days.map((_, di) => scheduleDay(di));

  /* ---------- Plan building ---------- */
  function allocate(n, active) {
    const tot = active.reduce((a, k) => a + WEIGHT[S.subjects[k].priority], 0);
    const raw = active.map(k => { const q = n * WEIGHT[S.subjects[k].priority] / tot; return { k, c: Math.floor(q), rem: q - Math.floor(q) }; });
    let left = n - raw.reduce((a, r) => a + r.c, 0);
    raw.slice().sort((a, b) => b.rem - a.rem || WEIGHT[S.subjects[b.k].priority] - WEIGHT[S.subjects[a.k].priority] || Math.random() - .5)
      .forEach(r => { if (left > 0) { r.c++; left--; } });
    return Object.fromEntries(raw.map(r => [r.k, r.c]));
  }
  const topicFields = t => ({ unit: t.unit, baseUnit: t.baseUnit, topic: t.topic, higher: !!t.higher, triple: !!t.triple, sci: t.sci || null });
  function pickTopic(subject, format, avoid) {
    const pool = G.pool(subject, tierFor(subject), optsFor(subject));
    const fresh = pool.filter(t => !avoid.has(t.unit + "|" + t.topic));
    const candidates = fresh.length ? fresh : pool;
    const ready = candidates.filter(t => isReady(Object.assign({ subject }, t), format));
    const from = ready.length ? ready : candidates;
    return from[rand(from.length)];
  }
  let uid = 0;
  const newId = () => "b" + Date.now().toString(36) + (uid++);
  function chooseSubject(remaining, target, usedToday, prev, active) {
    let best = null, bestScore = -1e9;
    for (const k of active) {
      if (remaining[k] <= 0) continue;
      let sc = remaining[k] / Math.max(1, target[k]) + remaining[k] * 0.15;
      if (usedToday[k]) sc -= 1.2 * usedToday[k];
      if (prev === k) sc -= 2;
      sc += Math.random() * 0.1;
      if (sc > bestScore) { bestScore = sc; best = k; }
    }
    return best;
  }
  function nextFormat(subject) {
    const counts = [0, 0, 0];
    (PLAN || []).filter(b => b.subject === subject).forEach(b => counts[G.FORMATS.indexOf(b.format)]++);
    const min = Math.min(...counts), opts = [0, 1, 2].filter(i => counts[i] === min);
    return G.FORMATS[opts[rand(opts.length)]];
  }
  function buildPlan() {
    const sched = allSchedules(), active = activeSubjects();
    const slots = sched.flatMap((r, di) => r.blocks.map(b => Object.assign({ day: di }, b)));
    PLAN = [];
    if (!slots.length || !active.length) { save(); return; }
    const target = allocate(slots.length, active), remaining = Object.assign({}, target);
    const used = {}; active.forEach(k => used[k] = new Set());
    const today = {}; let prev = null;
    for (const sl of slots) {
      today[sl.day] = today[sl.day] || {};
      const k = chooseSubject(remaining, target, today[sl.day], prev, active);
      remaining[k]--; today[sl.day][k] = (today[sl.day][k] || 0) + 1; prev = k;
      const format = nextFormat(k);
      const t = pickTopic(k, format, used[k]); used[k].add(t.unit + "|" + t.topic);
      PLAN.push(Object.assign({ id: newId(), day: sl.day, start: sl.start, end: sl.end, subject: k, format, version: 0 }, topicFields(t)));
    }
    save();
  }
  /* When times or commitments change, move the existing blocks instead of starting again:
     each day keeps its blocks in order; spare blocks are removed, new slots get the subject furthest below its share. */
  function retimePlan() {
    if (!PLAN) return;
    const sched = allSchedules(), active = activeSubjects();
    const total = sched.reduce((a, r) => a + r.blocks.length, 0);
    const next = [];
    sched.forEach((r, di) => {
      const old = PLAN.filter(b => b.day === di && active.includes(b.subject)).sort((a, b) => a.start.localeCompare(b.start));
      r.blocks.forEach((slot, i) => { if (old[i]) next.push(Object.assign(old[i], slot)); else next.push(Object.assign({ day: di, pending: true }, slot)); });
    });
    const target = active.length ? allocate(total, active) : {};
    const have = {}; next.filter(b => !b.pending).forEach(b => have[b.subject] = (have[b.subject] || 0) + 1);
    const remaining = {}; active.forEach(k => remaining[k] = Math.max(0, (target[k] || 0) - (have[k] || 0)));
    PLAN = next.filter(b => !b.pending);
    for (const b of next.filter(x => x.pending)) {
      if (!active.length) break;
      const today = {}; PLAN.filter(x => x.day === b.day).forEach(x => today[x.subject] = (today[x.subject] || 0) + 1);
      let k = chooseSubject(remaining, target, today, null, active) || active[rand(active.length)];
      if (remaining[k] > 0) remaining[k]--;
      const format = nextFormat(k);
      const used = new Set(PLAN.filter(x => x.subject === k).map(x => x.unit + "|" + x.topic));
      PLAN.push(Object.assign({ id: newId(), day: b.day, start: b.start, end: b.end, subject: k, format, version: 0 }, topicFields(pickTopic(k, format, used))));
    }
    PLAN.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    save();
  }
  function rerollTopic(b) {
    const used = new Set(PLAN.filter(x => x.subject === b.subject).map(x => x.unit + "|" + x.topic));
    used.add(b.unit + "|" + b.topic);
    Object.assign(b, topicFields(pickTopic(b.subject, b.format, used)), { version: 0 });
  }

  /* ---------- Changes from the settings panels ---------- */
  function timesChanged() { retimePlan(); save(); renderDays(); renderSummaries(); renderWeek(); }
  function subjectsChanged() { $("#stale").hidden = !PLAN; save(); renderSummaries(); }
  function fmtDate(iso, add) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + add); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  function renderSummaries() {
    const n = allSchedules().reduce((a, r) => a + r.blocks.length, 0);
    $("#sumBlocks").textContent = n + " blocks";
    $("#sumCommit").textContent = S.commitments.length + " added";
    $("#sumSubj").textContent = activeSubjects().length + " on";
  }

  /* ---------- Week and revision blocks ---------- */
  const LENGTHS = [30, 45, 60];
  function dayFields(prefix, d, attrs) {
    return `<div class="dayfields">
      <label class="f" for="${prefix}-start">Start<input type="time" id="${prefix}-start" value="${esc(d.start)}" ${attrs("start")}></label>
      <label class="f" for="${prefix}-end">End<input type="time" id="${prefix}-end" value="${esc(d.end)}" ${attrs("end")}></label>
      <label class="f" for="${prefix}-count">Blocks<input type="number" min="0" max="10" inputmode="numeric" id="${prefix}-count" value="${+d.count}" ${attrs("count")}></label>
      <label class="f" for="${prefix}-len">Length<select id="${prefix}-len" ${attrs("len")}>${LENGTHS.map(l => `<option value="${l}" ${+d.len === l ? "selected" : ""}>${l} min</option>`).join("")}</select></label>
    </div>`;
  }
  function renderDays() {
    const t = S.template;
    const sched = allSchedules();
    $("#dayEditor").innerHTML = `
      <div class="template">
        <b>Quick fill</b>
        ${dayFields("tpl", t, k => `data-tpl="${k}"`)}
        <div class="row"><span class="hint">Copy to:</span>
          <button class="btn" type="button" data-apply="weekdays">Mon–Fri</button>
          <button class="btn" type="button" data-apply="weekend">Sat–Sun</button>
          <button class="btn" type="button" data-apply="all">Every day</button></div>
      </div>
      <div class="arrange row"><span class="hint">Arrange blocks:</span>
        <div class="seg" role="radiogroup" aria-label="Arrange blocks">
          <label><input type="radio" name="arrange" id="arr-spread" value="spread" data-arrange ${S.arrange !== "pack" ? "checked" : ""}>Spread out</label>
          <label><input type="radio" name="arrange" id="arr-pack" value="pack" data-arrange ${S.arrange === "pack" ? "checked" : ""}>Back to back</label>
        </div></div>
      ${S.days.map((d, di) => {
        const r = sched[di];
        return `<div class="dayrow ${d.off ? "off" : ""}">
          <div class="dayhead"><b>${DAYNAMES[di]}</b><label class="toggle"><input type="checkbox" id="off-${di}" data-off="${di}" ${d.off ? "checked" : ""}> Day off</label></div>
          ${d.off ? "" : dayFields("d" + di, d, k => `data-d="${di}" data-k="${k}"`) + `
          <div class="times">${r.blocks.length ? r.blocks.map(b => `<span class="tchip">${b.start}–${b.end}</span>`).join("") : '<span class="hint">No blocks</span>'}</div>
          ${r.removed ? `<p class="warnnote">${r.removed} block${r.removed > 1 ? "s" : ""} removed ${esc(r.reason.startsWith("to ") ? r.reason : "because " + r.reason)}.</p>` : ""}`}
        </div>`;
      }).join("")}`;
  }
  $("#dayEditor").addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    const val = (k, v) => k === "count" ? Math.max(0, Math.min(10, parseInt(v, 10) || 0)) : k === "len" ? +v : v;
    if (d.off !== undefined) { S.days[+d.off].off = t.checked; return timesChanged(); }
    if (d.tpl) { S.template[d.tpl] = val(d.tpl, t.value); save(); return; }
    if (d.d !== undefined) { S.days[+d.d][d.k] = val(d.k, t.value); return timesChanged(); }
    if (d.arrange !== undefined) { S.arrange = t.value; return timesChanged(); }
  });
  $("#dayEditor").addEventListener("click", e => {
    const b = e.target.closest("[data-apply]"); if (!b) return;
    const which = { weekdays: [0,1,2,3,4], weekend: [5,6], all: [0,1,2,3,4,5,6] }[b.dataset.apply];
    which.forEach(i => Object.assign(S.days[i], { start: S.template.start, end: S.template.end, count: S.template.count, len: S.template.len }));
    timesChanged();
  });
  $("#weekStart").addEventListener("change", e => { S.weekStart = e.target.value || nextMonday(); save(); renderWeek(); });

  /* ---------- Commitments ---------- */
  const SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  function renderCommits() {
    $("#commitEditor").innerHTML = S.commitments.length ? S.commitments.map((c, i) => {
      const days = commitDays(c), every = days.length === 7;
      return `<div class="commit">
        <div class="row">
          <input type="text" id="c-label-${i}" value="${esc(c.label)}" data-ci="${i}" data-k="label" placeholder="e.g. Meal time" aria-label="Commitment name" maxlength="40">
          <button class="x" type="button" data-crm="${i}" aria-label="Remove ${esc(c.label || "commitment")}">×</button>
        </div>
        <div class="row">
          <input type="time" id="c-start-${i}" value="${esc(c.start)}" data-ci="${i}" data-k="start" aria-label="Starts">
          <span class="hint">to</span>
          <input type="time" id="c-end-${i}" value="${esc(c.end)}" data-ci="${i}" data-k="end" aria-label="Ends">
        </div>
        <fieldset class="daypick"><legend class="sr">Repeats on</legend>
          <label class="every"><input type="checkbox" id="c-every-${i}" data-every="${i}" ${every ? "checked" : ""}>Every day</label>
          <span class="dchips">${SHORT.map((n, di) => `<label class="dchip"><input type="checkbox" id="c-d-${i}-${di}" data-cday="${i}" data-di="${di}" ${days.includes(di) ? "checked" : ""}><span>${n}</span></label>`).join("")}</span>
        </fieldset>
      </div>`;
    }).join("") : '<p class="hint">No commitments yet.</p>';
  }
  $("#commitEditor").addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.every !== undefined) { S.commitments[+d.every].days = t.checked ? [0,1,2,3,4,5,6] : []; renderCommits(); return timesChanged(); }
    if (d.cday !== undefined) {
      const c = S.commitments[+d.cday], di = +d.di, set = new Set(commitDays(c));
      if (t.checked) set.add(di); else set.delete(di);
      c.days = [...set].sort(); renderCommits(); return timesChanged();
    }
    if (d.ci === undefined) return;
    S.commitments[+d.ci][d.k] = t.value;
    if (d.k === "label") { save(); renderWeek(); return; }
    timesChanged();
  });
  $("#commitEditor").addEventListener("click", e => {
    const t = e.target.closest("[data-crm]"); if (!t) return;
    S.commitments.splice(+t.dataset.crm, 1); renderCommits(); timesChanged();
  });
  $("#addCommit").addEventListener("click", () => {
    S.commitments.push({ label: "", days: [0], start: "18:00", end: "19:00" }); renderCommits(); timesChanged();
    const el = document.getElementById("c-label-" + (S.commitments.length - 1)); if (el) el.focus();
  });

  /* ---------- Subjects ---------- */
  function priSeg(k, name) {
    return `<div class="seg" role="radiogroup" aria-label="${name} priority">${["high","medium","low"].map(p => `<label><input type="radio" name="pri-${k}" id="pri-${k}-${p}" value="${p}" data-pri="${k}" ${S.subjects[k].priority === p ? "checked" : ""}>${p[0].toUpperCase() + p.slice(1)}</label>`).join("")}</div>`;
  }
  function subjCard(s, extra) {
    const c = S.subjects[s.key];
    return `<div class="subj ${c.on ? "" : "off"}">
      <div class="head">
        <label><input type="checkbox" id="on-${s.key}" data-on="${s.key}" ${c.on ? "checked" : ""}><span class="sw" style="background:var(--${s.key})"></span>${s.name}</label>
        <span class="code">${{ "Pearson Edexcel": "Edexcel", "WJEC Eduqas": "Eduqas" }[s.board] || s.board} ${s.code}</span>
      </div>
      <div class="opts">${extra || ""}${priSeg(s.key, s.name)}</div>
    </div>`;
  }
  const tierSelect = (id, val, attr) => `<select id="${id}" ${attr} aria-label="Tier"><option value="higher" ${val === "higher" ? "selected" : ""}>Higher tier</option><option value="foundation" ${val === "foundation" ? "selected" : ""}>Foundation tier</option></select>`;
  function renderSubjects() {
    const S_ = G.SUBJ, route = S.science.route;
    $("#subjEditor").innerHTML =
      subjCard(S_.maths, `<div class="row">${tierSelect("tier-maths", S.subjects.maths.tier, 'data-mtier="1"')}</div>`) +
      subjCard(S_.englang) +
      subjCard(S_.englit, `<p class="hint">Romeo and Juliet, Jekyll and Hyde, An Inspector Calls, Power and Conflict poetry and unseen poetry.</p>`) +
      `<div class="route">
        <div class="row" style="justify-content:space-between"><b>Science</b>${tierSelect("tier-sci", S.science.tier, 'data-stier="1"')}</div>
        <div class="seg" role="radiogroup" aria-label="Science course">
          <label><input type="radio" name="route" id="route-combined" value="combined" data-route ${route === "combined" ? "checked" : ""}>Combined Science</label>
          <label><input type="radio" name="route" id="route-separate" value="separate" data-route ${route === "separate" ? "checked" : ""}>Separate sciences</label>
        </div>
        ${route === "combined" ? subjCard(S_.combined) : SCIENCES.map(k => subjCard(S_[k])).join("")}
      </div>
      <h3 class="subhead">Option subjects</h3>
      ${G.SUBJECTS.filter(x => x.other).map(x => subjCard(x, optionFields(x))).join("")}`;
  }
  function optionFields(x) {
    const c = S.subjects[x.key];
    let html = "";
    if (x.tiered) html += `<div class="row">${tierSelect("tier-" + x.key, c.tier || "higher", `data-otier="${x.key}"`)}</div>`;
    if (x.options.length) html += `<div class="optfields">${x.options.map(o => `<label class="f" for="opt-${x.key}-${o.key}">${esc(o.label)}<select id="opt-${x.key}-${o.key}" data-osub="${x.key}" data-okey="${o.key}">${o.choices.map(ch => `<option ${optsFor(x.key)[o.key] === ch ? "selected" : ""}>${esc(ch)}</option>`).join("")}</select></label>`).join("")}</div>`;
    return html;
  }
  $("#subjEditor").addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.on) { S.subjects[d.on].on = t.checked; renderSubjects(); }
    else if (d.pri) S.subjects[d.pri].priority = t.value;
    else if (d.mtier) S.subjects.maths.tier = t.value;
    else if (d.stier) S.science.tier = t.value;
    else if (d.route !== undefined) { S.science.route = t.value; renderSubjects(); }
    else if (d.otier) S.subjects[d.otier].tier = t.value;
    else if (d.osub) { const c = S.subjects[d.osub]; c.opts = Object.assign(optsFor(d.osub), { [d.okey]: t.value }); }
    subjectsChanged();
  });

  /* ---------- Collapsible sidebar ---------- */
  function applyRail() {
    document.body.classList.toggle("rail-collapsed", !!S.railCollapsed);
    $("#railToggle").setAttribute("aria-expanded", String(!S.railCollapsed));
    $("#railToggle").setAttribute("aria-label", S.railCollapsed ? "Show settings" : "Hide settings");
  }
  $("#railToggle").addEventListener("click", () => { S.railCollapsed = !S.railCollapsed; save(); applyRail(); });
  document.querySelectorAll("[data-railopen]").forEach(b => b.addEventListener("click", () => {
    S.railCollapsed = false; save(); applyRail();
    const p = document.getElementById(b.dataset.railopen); if (p) { p.open = true; p.scrollIntoView({ block: "start" }); p.querySelector("summary").focus(); }
  }));
  $("#railBuild").addEventListener("click", () => $("#buildBtn").click());

  /* ---------- Week view ---------- */
  function renderWeek() {
    const w = $("#week");
    if (!PLAN) { w.innerHTML = '<div class="empty">Set up your week, then choose Build my week.</div>'; return; }
    const sched = allSchedules();
    const counts = {}; PLAN.forEach(b => counts[b.subject] = (counts[b.subject] || 0) + 1);
    const max = Math.max(1, ...Object.values(counts));
    const mins = PLAN.reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0);
    const removed = sched.reduce((a, r) => a + r.removed, 0);
    const head = codeBoxHTML() + `<div class="weekhead">
        <h2>Week of ${fmtDate(S.weekStart, 0)}</h2>
        <div class="row">
          <span class="meta">${PLAN.length} blocks · ${Math.floor(mins / 60)} h${mins % 60 ? " " + mins % 60 + " min" : ""}${removed ? ` · ${removed} removed for commitments` : ""}</span>
          <button class="btn" type="button" id="shuffleAll">Shuffle all topics</button>
          <button class="btn" type="button" id="printPlan">Print plan</button>
        </div>
      </div>`;
    const balance = PLAN.length ? `<section class="balance" aria-label="Blocks per subject"><h3>Blocks per subject</h3>
        <div class="bars">${G.SUBJECTS.filter(s => counts[s.key]).map(s => `
          <span>${s.name}<span class="pri">${S.subjects[s.key].priority}</span></span>
          <span class="bar"><i style="width:${counts[s.key] / max * 100}%;background:var(--${s.key})"></i></span>
          <span class="n">${counts[s.key]}</span>`).join("")}</div></section>` : "";
    const days = S.days.map((d, di) => {
      const items = [
        ...PLAN.filter(b => b.day === di).map(b => ({ t: b.start, html: card(b) })),
        ...commitsOn(di).map(c => ({ t: c.start, html: `<div class="commitcard"><time>${esc(c.start)}–${esc(c.end)}</time><b>${esc(c.label || "Commitment")}</b></div>` }))
      ].sort((a, b) => a.t.localeCompare(b.t));
      const r = sched[di];
      const inner = d.off ? '<div class="dayoff">Day off</div>' + items.filter(i => i.html.startsWith('<div class="commitcard"')).map(i => i.html).join("")
        : items.length ? items.map(i => i.html).join("") : '<div class="dayoff">No blocks</div>';
      return `<section class="day" aria-label="${DAYNAMES[di]}"><header><b>${DAYNAMES[di].slice(0, 3)}</b><span>${fmtDate(S.weekStart, di)}</span></header>
        ${r.removed && !d.off ? `<p class="daynote">${r.removed} removed ${esc(r.reason.startsWith("to ") ? r.reason : "(not enough time)")}</p>` : ""}
        <div class="list">${inner}</div></section>`;
    }).join("");
    w.innerHTML = head + balance + (PLAN.length ? `<div class="days">${days}</div>` : '<div class="empty">No revision blocks fit this week. Add blocks or move a commitment.</div>');
  }
  function card(b) {
    const ready = isReady(b);
    return `<article class="card">
      <div class="tag" style="background:var(--${b.subject})"><time>${esc(b.start)}–${esc(b.end)}</time><span>${esc(G.SUBJ[b.subject].name)}</span></div>
      <div class="body">
        <div class="topic">${esc(b.topic)}</div>
        <div class="unit">${esc(b.unit)}</div>
        <div class="chips"><span class="chip fmt">${esc(b.format)}</span>${b.higher ? '<span class="chip">Higher</span>' : ""}${b.triple ? '<span class="chip">Separate science</span>' : ""}${ready ? "" : '<span class="chip wait">Not ready yet</span>'}</div>
      </div>
      <div class="acts">
        <button class="btn open" type="button" data-open="${b.id}">Open worksheet</button>
        <button class="btn icon" type="button" data-reroll="${b.id}" title="Random new topic" aria-label="Random new topic">⟳</button>
        <button class="btn icon" type="button" data-pick="${b.id}" title="Choose a topic" aria-label="Choose a topic">☰</button>
      </div>
    </article>`;
  }
  $("#week").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "printPlan") return printPlan();
    if (t.id === "copyCode") return copyCode(t);
    if (t.id === "retryCode") return createCode();
    if (t.id === "shuffleAll") {
      const used = {}; PLAN.forEach(b => { used[b.subject] = used[b.subject] || new Set(); const x = pickTopic(b.subject, b.format, used[b.subject]); used[b.subject].add(x.unit + "|" + x.topic); Object.assign(b, topicFields(x), { version: 0 }); });
      save(); renderWeek(); return;
    }
    const id = t.dataset.open || t.dataset.reroll || t.dataset.pick; const b = PLAN && PLAN.find(x => x.id === id); if (!b) return;
    if (t.dataset.reroll) { rerollTopic(b); save(); renderWeek(); }
    if (t.dataset.pick) openPicker(b);
    if (t.dataset.open) openWorksheet(b);
  });

  /* ---------- Topic picker ---------- */
  let lastFocus = null;
  function modal(html) {
    lastFocus = document.activeElement;
    $("#modalRoot").innerHTML = `<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = $("#modalRoot").querySelector("select,button,input"); if (first) first.focus();
  }
  function closeModal() { $("#modalRoot").innerHTML = ""; if (lastFocus) lastFocus.focus(); }
  $("#modalRoot").addEventListener("click", e => { if (e.target.id === "scrim" || e.target.closest("[data-close]")) closeModal(); });
  function openPicker(b) {
    const pool = G.pool(b.subject, tierFor(b.subject), optsFor(b.subject));
    const units = [...new Set(pool.map(p => p.unit))];
    const optionsFor = fmt => units.map(u => `<optgroup label="${esc(u)}">${pool.map((p, i) => p.unit === u ? `<option value="${i}" ${p.topic === b.topic && p.unit === b.unit ? "selected" : ""}>${esc(p.topic)}${isReady(Object.assign({ subject: b.subject }, p), fmt) ? "" : " (not ready yet)"}</option>` : "").join("")}</optgroup>`).join("");
    modal(`<h3>Choose a ${esc(G.SUBJ[b.subject].name)} topic</h3>
      <label class="f" for="pickFormat">Worksheet format
        <select id="pickFormat">${G.FORMATS.map(f => `<option ${f === b.format ? "selected" : ""}>${f}</option>`).join("")}</select>
      </label>
      <label class="f" for="pickTopic">Topic<select id="pickTopic">${optionsFor(b.format)}</select></label>
      <div class="row end"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="pickSave">Use this topic</button></div>`);
    $("#pickFormat").addEventListener("change", () => { const v = $("#pickTopic").value; $("#pickTopic").innerHTML = optionsFor($("#pickFormat").value); $("#pickTopic").value = v; });
    $("#pickSave").addEventListener("click", () => {
      Object.assign(b, topicFields(pool[+$("#pickTopic").value]), { format: $("#pickFormat").value, version: 0 });
      save(); closeModal(); renderWeek();
    });
  }

  /* ---------- Worksheet view ---------- */
  const WS = { b: null, spec: null, data: null, versions: [], vi: 0, timer: null, left: 1800, running: false, quiz: [] };
  async function openWorksheet(b) {
    lastFocus = document.activeElement;
    WS.b = b; WS.spec = specFor(b); WS.versions = visibleVersions(WS.spec.id); WS.vi = (b.version || 0) % Math.max(1, WS.versions.length);
    WS.left = 1800; WS.running = false; clearInterval(WS.timer);
    const w = WS.spec;
    $("#wsRoot").innerHTML = `<div class="ws" role="dialog" aria-modal="true" aria-label="Worksheet">
      <div class="ws-bar"><div class="in">
        <button class="btn" type="button" id="wsClose">← Back to my week</button>
        <div class="row"><span class="timer" id="wsTimer">30:00</span><button class="btn" type="button" id="wsTimerBtn">Start timer</button><button class="btn" type="button" id="wsTimerReset">Reset</button></div>
        <div class="row"><button class="btn" type="button" id="wsNext" hidden>Another version</button><button class="btn" type="button" id="wsPrint" hidden>Print</button></div>
      </div></div>
      <div class="ws-main">
        <div class="ws-head">
          <span class="eyebrow">${esc(w.format)} · 30 minutes · ${esc(w.subjectLabel)} · ${esc(w.specLabel)}${w.tier ? " · " + esc(w.tier[0].toUpperCase() + w.tier.slice(1)) : ""}</span>
          <h2>${esc(w.topic)}</h2>
          <p>${esc(b.unit)}. ${esc(G.FORMAT_INFO[w.format])}</p>
        </div>
        <div id="wsBody"><div class="paper state"><p class="small">Loading worksheet…</p></div></div>
      </div>
    </div>`;
    $("#wsClose").focus();
    await loadVersion();
  }
  async function loadVersion() {
    const body = $("#wsBody");
    if (!WS.versions.length) {
      body.innerHTML = `<div class="paper state"><h3>This worksheet isn't ready yet</h3><p class="small">Your teachers are still checking worksheets for this topic. Choose another topic with ⟳ or ☰ on the plan, or use a different format.</p></div>`;
      return;
    }
    const v = WS.versions[WS.vi];
    try {
      const r = await fetch("worksheets/" + v.file, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const file = await r.json(); WS.data = file.data;
      body.innerHTML = (v.status !== "approved" ? '<p class="small" style="color:var(--warn)">Not yet checked by a teacher.</p>' : "") + G.worksheetHTML(WS.spec, WS.data);
      $("#wsPrint").hidden = false; $("#wsNext").hidden = WS.versions.length < 2;
    } catch (e) {
      body.innerHTML = `<div class="paper state"><h3>This worksheet couldn't be loaded</h3><p class="small">The file is missing from the server. Tell your teacher the worksheet ID: ${esc(WS.spec.id)}</p></div>`;
    }
  }
  function closeWorksheet() { clearInterval(WS.timer); $("#wsRoot").innerHTML = ""; $("#printArea").innerHTML = ""; if (lastFocus) lastFocus.focus(); }
  function tick() {
    const el = $("#wsTimer"); if (!el) return;
    el.textContent = String(Math.floor(WS.left / 60)).padStart(2, "0") + ":" + String(WS.left % 60).padStart(2, "0");
    el.classList.toggle("done", WS.left === 0);
    if (WS.left === 0) { el.textContent = "Time's up"; WS.running = false; clearInterval(WS.timer); $("#wsTimerBtn").textContent = "Start timer"; }
  }
  $("#wsRoot").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "wsClose") closeWorksheet();
    if (t.id === "wsTimerBtn") {
      WS.running = !WS.running; t.textContent = WS.running ? "Pause" : "Resume";
      clearInterval(WS.timer); if (WS.running) WS.timer = setInterval(() => { if (WS.left > 0) WS.left--; tick(); }, 1000);
    }
    if (t.id === "wsTimerReset") { WS.left = 1800; WS.running = false; clearInterval(WS.timer); $("#wsTimerBtn").textContent = "Start timer"; tick(); }
    if (t.id === "wsNext") { WS.vi = (WS.vi + 1) % WS.versions.length; WS.b.version = WS.vi; save(); loadVersion(); }
    if (t.id === "wsPrint") { doPrint(G.printHTML(WS.spec, WS.data), "portrait"); }
    if (t.dataset.tab) {
      t.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === t ? "true" : "false"));
      const scope = t.closest(".paper") || $("#wsBody");
      scope.querySelectorAll(":scope [data-pane]").forEach(p => p.hidden = p.dataset.pane !== t.dataset.tab);
    }
    if (t.id === "recallStart") {
      $("#reviewContent").hidden = true; $("#recallBox").hidden = false; t.hidden = true; $("#recallText").focus();
      if (!WS.running) { WS.left = Math.min(WS.left, 15 * 60); $("#wsTimerBtn").click(); }
    }
    if (t.id === "recallCheck") { $("#reviewContent").hidden = false; t.hidden = true; $("#recallNote").hidden = false; }
    if (t.dataset.show !== undefined) { const r = t.closest(".qrow"); r.querySelector(".a").hidden = false; r.querySelector(".mark").hidden = false; t.hidden = true; }
    if (t.dataset.mark) quizMark(t);
    if (t.dataset.retry !== undefined) quizRetry(+t.dataset.retry);
    if (t.id === "flipBtn") { const ms = $("#markScheme"); ms.hidden = !ms.hidden; t.textContent = ms.hidden ? "Turn over: show the mark scheme" : "Hide the mark scheme"; if (!ms.hidden) ms.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  $("#wsRoot").addEventListener("input", e => {
    if (e.target.dataset.score === undefined) return;
    let tot = 0; document.querySelectorAll("[data-score]").forEach(i => tot += Math.max(0, +i.value || 0));
    $("#scoreTotal").textContent = tot;
  });
  function quizMark(t) {
    const n = +t.dataset.n, r = $("#qr" + n), ok = t.dataset.mark === "right";
    WS.quiz[n] = ok; r.classList.toggle("right", ok); r.classList.toggle("wrong", !ok);
    r.querySelector(".mark").innerHTML = `<span class="pill ${ok ? "ok" : "bad"}">${ok ? "Got it" : "Missed it"}</span>`;
    const si = Math.floor(n / 5), rows = [...$("#set" + si).querySelectorAll(".qrow")].map(x => +x.id.slice(2));
    if (rows.every(i => WS.quiz[i] === true || WS.quiz[i] === false)) {
      const wrong = rows.filter(i => !WS.quiz[i]);
      $("#setStatus" + si).textContent = `${rows.length - wrong.length} of ${rows.length} correct`;
      $("#setFoot" + si).innerHTML = wrong.length ? `<button class="btn primary" type="button" data-retry="${si}">Repeat the ${wrong.length} you missed</button>` : '<span class="pill ok">Set complete</span>';
    }
  }
  function quizRetry(si) {
    $("#set" + si).querySelectorAll(".qrow").forEach(r => {
      const i = +r.id.slice(2); if (WS.quiz[i]) return;
      WS.quiz[i] = null; r.classList.remove("wrong");
      r.querySelector("[data-show]").hidden = false; r.querySelector(".a").hidden = true;
      const m = r.querySelector(".mark"); m.hidden = true;
      m.innerHTML = `<button class="btn" type="button" data-mark="right" data-n="${i}">Got it</button><button class="btn" type="button" data-mark="wrong" data-n="${i}">Missed it</button>`;
    });
    $("#setFoot" + si).innerHTML = ""; $("#setStatus" + si).textContent = "Repeating the ones you missed";
    const first = $("#set" + si).querySelector(".qrow:not(.right) [data-show]"); if (first) first.focus();
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if ($("#scrim")) closeModal(); else if ($(".ws")) closeWorksheet();
  });


  /* ---------- Plan codes (stored online by the site's /api/plans function) ---------- */
  const API = "api/plans";
  let SYNC = { state: CODE ? "saved" : "idle", timer: null, msg: "" };
  const fmtCode = c => c ? c.slice(0, 3) + "-" + c.slice(3) : "";
  function setSync(state, msg) { SYNC.state = state; SYNC.msg = msg || ""; const el = document.getElementById("codeBox"); if (el) el.outerHTML = codeBoxHTML(); }
  function codeBoxHTML() {
    if (!PLAN || !PLAN.length) return '<div id="codeBox" hidden></div>';
    if (SYNC.state === "unavailable") return `<div id="codeBox" class="codebox muted"><span>Plan codes aren't switched on for this site yet. Your plan is saved in this browser.</span></div>`;
    if (!CODE) {
      const busy = SYNC.state === "saving";
      return `<div id="codeBox" class="codebox"><span>${busy ? "Making your plan code…" : esc(SYNC.msg || "This plan doesn't have a code yet.")}</span>${busy ? "" : '<button class="btn" type="button" id="retryCode">Get a plan code</button>'}</div>`;
    }
    const status = { saving: "Saving…", saved: "Saved", error: SYNC.msg || "Not saved yet. Check your connection." }[SYNC.state] || "";
    return `<div id="codeBox" class="codebox">
      <span class="codelabel">Your plan code</span><b class="code-big">${fmtCode(CODE)}</b>
      <button class="btn" type="button" id="copyCode">Copy</button>
      <span class="codehelp">Write it down: type it into “Open a saved plan” on any device to come back to this week.</span>
      <span class="codestatus ${SYNC.state}">${esc(status)}</span>
    </div>`;
  }
  async function api(method, code, body) {
    const r = await fetch(API + (code ? "?code=" + encodeURIComponent(code) : ""), {
      method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store"
    });
    const type = r.headers.get("content-type") || "";
    if (!type.includes("application/json")) { const e = new Error("unavailable"); e.unavailable = true; throw e; }
    const data = await r.json();
    if (!r.ok) { const e = new Error(data.error || "Something went wrong."); e.status = r.status; throw e; }
    return data;
  }
  const payload = () => ({ settings: S, plan: PLAN });
  async function createCode() {
    if (!PLAN || !PLAN.length) return;
    setSync("saving");
    try { const { code } = await api("POST", null, payload()); CODE = code; save(true); setSync("saved"); }
    catch (e) { setSync(e.unavailable ? "unavailable" : "idle", e.unavailable ? "" : "Couldn't make a plan code. Check your connection and try again."); }
  }
  function scheduleSync() {
    clearTimeout(SYNC.timer);
    SYNC.timer = setTimeout(async () => {
      if (!CODE) return;
      setSync("saving");
      try { await api("PUT", CODE, payload()); setSync("saved"); }
      catch (e) { if (e.status === 404) { CODE = null; save(true); return createCode(); } setSync(e.unavailable ? "unavailable" : "error"); }
    }, 1200);
  }
  async function copyCode(btn) {
    try { await navigator.clipboard.writeText(fmtCode(CODE)); btn.textContent = "Copied"; }
    catch (e) { const el = document.querySelector(".code-big"); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected"; }
    setTimeout(() => { if (btn.isConnected) btn.textContent = "Copy"; }, 2000);
  }
  async function openCode() {
    const input = $("#openCode"), msg = $("#openMsg");
    const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) { msg.textContent = "Plan codes have 6 letters and numbers, like K7P-3QX."; msg.className = "openmsg bad"; return; }
    msg.textContent = "Opening…"; msg.className = "openmsg";
    try {
      const data = await api("GET", code);
      S = Object.assign(defaults(), data.settings); migrate(S); PLAN = data.plan; CODE = code; save(true);
      SYNC.state = "saved";
      $("#weekStart").value = S.weekStart;
      applyRail(); renderDays(); renderCommits(); renderSubjects(); renderSummaries(); renderWeek();
      $("#stale").hidden = true; input.value = "";
      msg.textContent = "Opened plan " + fmtCode(code) + "."; msg.className = "openmsg ok";
    } catch (e) {
      msg.textContent = e.unavailable ? "Plan codes aren't switched on for this site yet." : e.status === 404 ? "No plan has that code. Check it and try again." : e.message;
      msg.className = "openmsg bad";
    }
  }
  $("#openBtn").addEventListener("click", openCode);
  $("#openCode").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); openCode(); } });

  /* ---------- Printing ---------- */
  function doPrint(html, orientation) {
    $("#printArea").innerHTML = html;
    document.body.classList.toggle("print-plan", orientation === "landscape");
    let st = document.getElementById("pageSize");
    if (!st) { st = document.createElement("style"); st.id = "pageSize"; document.head.appendChild(st); }
    st.textContent = `@page{size:A4 ${orientation};margin:${orientation === "landscape" ? "9mm" : "14mm"}}`;
    window.print();
  }
  function printPlan() {
    const sched = allSchedules();
    const used = G.SUBJECTS.filter(s => PLAN.some(b => b.subject === s.key));
    const maxItems = Math.max(1, ...S.days.map((_, di) => PLAN.filter(b => b.day === di).length + commitsOn(di).length));
    const size = maxItems > 9 ? "xs" : maxItems > 6 ? "s" : "m";
    const cols = S.days.map((d, di) => {
      const items = [
        ...PLAN.filter(b => b.day === di).map(b => ({ t: b.start, html: `<div class="pp-b" style="border-left-color:var(--${b.subject})"><span class="pp-t">${esc(b.start)}–${esc(b.end)}</span><span class="pp-s">${esc(G.SUBJ[b.subject].name)}</span><span class="pp-topic">${esc(b.topic)}</span><span class="pp-f">${esc(b.format)}</span><span class="pp-tick" aria-hidden="true"></span></div>` })),
        ...commitsOn(di).map(c => ({ t: c.start, html: `<div class="pp-c"><span class="pp-t">${esc(c.start)}–${esc(c.end)}</span><span>${esc(c.label || "Commitment")}</span></div>` }))
      ].sort((a, b) => a.t.localeCompare(b.t)).map(i => i.html).join("");
      return `<div class="pp-day"><div class="pp-dh"><b>${DAYNAMES[di]}</b><span>${fmtDate(S.weekStart, di)}</span></div>${d.off ? '<div class="pp-off">Day off</div>' : ""}${items || (d.off ? "" : '<div class="pp-off">No blocks</div>')}</div>`;
    }).join("");
    const mins = PLAN.reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0);
    doPrint(`<div class="pp pp-size-${size}">
      <header class="pp-head">
        <div><small>GCSE Plan &amp; Pass</small><h1>Week of ${fmtDate(S.weekStart, 0)}</h1></div>
        <div class="pp-meta">${PLAN.length} revision blocks · ${Math.floor(mins / 60)} h${mins % 60 ? " " + mins % 60 + " min" : ""}${CODE ? `<br>Plan code <b>${fmtCode(CODE)}</b>` : ""}</div>
      </header>
      <div class="pp-grid">${cols}</div>
      <footer class="pp-foot"><span class="pp-key">${used.map(s => `<span><i style="background:var(--${s.key})"></i>${s.name}</span>`).join("")}</span><span>Tick each block when it's done. Open the worksheets on the website.</span></footer>
    </div>`, "landscape");
  }
  window.addEventListener("afterprint", () => { document.body.classList.remove("print-plan"); });

  /* ---------- Boot ---------- */
  $("#buildBtn").addEventListener("click", () => { buildPlan(); $("#stale").hidden = true; CODE = null; save(true); createCode(); renderWeek(); });
  async function boot() {
    $("#railIntro").textContent = CFG.intro || "";
    $("#weekStart").value = S.weekStart;
    applyRail(); renderDays(); renderCommits(); renderSubjects(); renderSummaries();
    try {
      const r = await fetch("worksheets/manifest.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      MANIFEST = await r.json();
    } catch (e) {
      const b = $("#banner"); b.hidden = false;
      b.textContent = location.protocol === "file:"
        ? "Worksheets can't load when this page is opened as a file. Open it through the web server instead."
        : "The worksheet bank couldn't be loaded. Plans still work, but worksheets won't open until it's available.";
    }
    if (!PLAN) buildPlan();
    renderWeek();
  }
  boot();
})();

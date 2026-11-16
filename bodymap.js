// フィジカルログ：運動特性評価エンジン（exengine.js）で、運動名から各能力の要求度を推定し、6つの系統の六角形に反映する
// 保存先は docs テーブルの区分（bodylog・exprofiles）だけ。既存のデータには書き込まない。
(function () {
  const E = window.ExEngine;
  const ORDER = ["msk", "cv", "neuro", "sense", "endo", "mental"];
  const AXES = ORDER.map((k) => ({ k, n: E.RULES[k].n, items: Object.keys(E.RULES[k].items), low: !!E.RULES[k].low }));
  const AX = Object.fromEntries(AXES.map((a) => [a.k, a]));
  const CLS = Object.fromEntries(AXES.flatMap((a) => a.items.map((i) => [i, E.RULES[a.k].items[i][1]])));
  const SELF = Object.keys(CLS).filter((i) => CLS[i] === "self");
  const FK = Object.keys(E.FEATURES);
  const MAIN_F = FK.slice(0, 19), SENSE_F = FK.slice(19);
  const NOTE = "この点数は能力の実測値ではなく、運動で能力を使った度合いを推定した独自のスコアです。使ったことと、能力が伸びたことは別です。";

  // 一覧にない運動のための質問（答えから特性を決める）
  const QS = [
    { q: "力の強さは？", o: ["軽い", "中くらい", "全力に近い"], set: { int: [2, 5, 9] } },
    { q: "続け方は？", o: ["短く区切る", "ときどき休む", "休まず続ける"], set: { dur: [2, 5, 9] } },
    { q: "速い動き・瞬発的な動きは？", o: ["ほとんどない", "ときどき", "多い"], set: { rfd: [2, 5, 9], spd: [2, 5, 9] } },
    { q: "関節を大きく動かす？", o: ["あまり動かさない", "ふつう", "大きく動かす"], set: { rom: [2, 5, 9] } },
    { q: "着地や衝撃、体にかかる重さの負担は？", o: ["ほとんどない", "少しある", "大きい"], set: { impact: [1, 4, 8], _load: [2, 5, 9] } },
    { q: "動きの複雑さ・覚えることは？", o: ["単純", "ふつう", "複雑"], set: { cmplx: [2, 5, 9], coord: [3, 5, 8], _cog: [2, 4, 7], repro: [9, 6, 4] } },
    { q: "バランスは？", o: ["ほとんど使わない", "不安定な足場や片足がある", "回転や逆さまがある"], set: { post: [2, 6, 9], rot: [1, 2, 9], _sens: [3, 6, 8] } },
    { q: "相手・ボール・合図への反応は？", o: ["ない", "少しある", "多い"], set: { ext: [1, 5, 9], pred: [1, 5, 9], track: [0, 4, 8], vis: [2, 5, 9], dist: [1, 4, 8], _cog: [2, 5, 8] } },
    { q: "毎回の状況は変わる？（屋外・自然・対人など）", o: ["毎回ほぼ同じ", "少し変わる", "大きく変わる"], set: { unc: [1, 5, 9], nov: [2, 4, 7] } },
    { q: "息は上がる？", o: ["ほとんど上がらない", "少し上がる", "かなり上がる"], set: { cardio: [2, 5, 9] } },
    { q: "一緒にやる人は？", o: ["ひとり", "ときどき関わる", "チームや相手と"], set: { soc: [1, 5, 9] } },
    { q: "呼吸や体の感覚に意識を向ける？", o: ["あまり向けない", "ときどき", "とても向ける"], set: { inner: [2, 5, 9], _sens: [3, 5, 8] } },
    { q: "怖さ・緊張・プレッシャーは？", o: ["ない", "少しある", "大きい"], set: { psy: [1, 5, 9] } },
  ];
  const CHECKS = [["therm", "屋外・水中・暑さ寒さの中で行う", 7, 1], ["aud", "音楽や音の合図を使う", 7, 1], ["touch", "手や道具で、物・地面・人をつかむ・触れる", 7, 2]];

  let C = null, EX = null;
  const D = { bodylog: [], exprofiles: [] }, got = {};
  const S = { sub: "today", date: today(), axis: null, range: 7, draft: null, wiz: null, prof: null, lq: "", msg: "", sure: null, busy: false };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function today(off = 0) { const d = new Date(); d.setDate(d.getDate() + off); return d.toLocaleDateString("sv-SE"); }
  const ready = () => got.bodylog && got.exprofiles && EX;
  const can = () => !!(C && C.canEdit());
  const r1 = (v) => Math.round(v * 10) / 10;
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); const w = "日月火水木金土"[new Date(+y, m - 1, +d).getDay()]; return `${+m}月${+d}日（${w}）`; };
  const norm = (s) => String(s || "").toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s（）()・\-]/g, "");

  // ---------- 運動の特性プロファイル ----------
  function profiles() {
    const saved = Object.fromEntries(D.exprofiles.map((x) => [x.id, x]));
    const base = EX.list.map((x) => {
      const f = Object.fromEntries(EX.keys.map((k, i) => [k, x.f[i]]));
      const o = saved[x.id] || {};
      return { id: x.id, name: x.name, aka: x.aka, f: o.f ? { ...f, ...o.f } : f, ov: o.ov || {}, src: "list", edited: !!(o.f || (o.ov && Object.keys(o.ov).length)), conf: "中", hidden: !!o.hidden };
    });
    const extra = D.exprofiles.filter((x) => x.custom).map((x) => ({ ...x, aka: x.aka || [], ov: x.ov || {}, src: "quiz" }));
    return [...base, ...extra].filter((p) => !p.hidden);
  }
  const profById = (id) => profiles().find((p) => p.id === id) || D.exprofiles.find((p) => p.id === id && p.custom);
  function search(q) {
    const n = norm(q); if (!n) return [];
    const sc = (p) => { const names = [p.name, ...(p.aka || [])].map(norm); if (names.some((x) => x === n)) return 3; if (names.some((x) => x.startsWith(n))) return 2; if (names.some((x) => x.includes(n) || (x.length >= 2 && n.includes(x)))) return 1; return 0; };
    return profiles().map((p) => [p, sc(p)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1] || a[0].name.length - b[0].name.length).map(([p]) => p);
  }
  function why(p) {
    if (p.why) return p.why;
    const top = MAIN_F.filter((k) => p.f[k] != null).sort((a, b) => p.f[b] - p.f[a]).slice(0, 4).map((k) => E.FEATURES[k]);
    const low = MAIN_F.filter((k) => p.f[k] != null && p.f[k] <= 1).slice(0, 3).map((k) => E.FEATURES[k]);
    return `Claudeの見立てで、${top.join("・")}が高い運動としています。${low.length ? `${low.join("・")}はほとんどないとしています。` : ""}`;
  }

  // ---------- 点数の計算 ----------
  function entryPts(e) {
    if (e.v === 3) { const p = profById(e.pid); return p ? E.sessionPoints(p.f, e.s || {}, e.self || {}, p.ov || {}) : (e.pts || {}); }
    // 前の形式の記録：今ある項目の点数だけ使う
    const o = {}; for (const [k, v] of Object.entries(e.pts || {})) if (CLS[k] && +v > 0) o[k] = +v; return o;
  }
  const entriesOn = (date) => D.bodylog.filter((x) => x.date === date).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  // 1日：項目ごとに「いちばん高い記録 ＋ ほかの記録の4分の1」（10点まで）。記録を重ねても一気に満点にならないようにする。
  // 一度も評価されていない項目は未評価(null)
  function dayItems(date) {
    const v = {};
    for (const e of entriesOn(date)) for (const [k, x] of Object.entries(entryPts(e))) { if (x == null || !CLS[k]) continue; (v[k] = v[k] || []).push(+x); }
    const t = {};
    for (const [k, xs] of Object.entries(v)) { xs.sort((a, b) => b - a); t[k] = Math.min(10, xs[0] + 0.25 * xs.slice(1).reduce((s, x) => s + x, 0)); }
    return t;
  }
  // 期間：1日あたりの平均（自己評価の項目は、入れた日の平均）
  function rangeItems(days) {
    const t = {}, selfN = {};
    for (let i = 0; i < days; i++) { const d = dayItems(today(-i)); for (const [k, v] of Object.entries(d)) { t[k] = (t[k] || 0) + v; if (CLS[k] === "self") selfN[k] = (selfN[k] || 0) + 1; } }
    for (const k in t) t[k] = CLS[k] === "self" ? t[k] / selfN[k] : t[k] / days;
    return t;
  }
  // 系統の点数：評価できた項目のうち、点数の高いほうから半分の平均
  function axisScore(items, k) {
    const xs = AX[k].items.map((i) => items[i]).filter((v) => v != null).sort((a, b) => b - a);
    if (!xs.length) return 0;
    const m = Math.ceil(xs.length / 2); return xs.slice(0, m).reduce((s, v) => s + v, 0) / m;
  }

  function listen() {
    for (const k of ["bodylog", "exprofiles"]) {
      C.db.collection(k).onSnapshot((snap) => { D[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); got[k] = true; if (C.active()) C.rerender(); },
        () => { got[k] = true; if (C.active()) C.rerender(); });
    }
    fetch("exercises.json").then((r) => r.json()).then((j) => { EX = j; if (C.active()) C.rerender(); }).catch(() => { EX = { keys: FK, list: [] }; if (C.active()) C.rerender(); });
  }

  // ---------- 六角形 ----------
  function hexagon(items) {
    const W = 360, H = 330, cx = W / 2, cy = H / 2 + 4, R = 124;
    const pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [cx + R * (v / 10) * Math.cos(a), cy + R * (v / 10) * Math.sin(a)]; };
    const poly = (v) => AXES.map((_, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
    const sc = AXES.map((a) => axisScore(items, a.k));
    const rings = [...Array(10)].map((_, j) => `<polygon points="${poly(j + 1)}" class="hx-ring ${j === 4 || j === 9 ? "major" : ""}"/>`).join("");
    const spokes = AXES.map((_, i) => { const [x, y] = pt(i, 10); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="hx-spoke"/>`; }).join("");
    const nums = [2, 4, 6, 8, 10].map((v) => { const [x, y] = pt(0, v); return `<text x="${x + 4}" y="${y + 3}" class="hx-num">${v}</text>`; }).join("");
    const shape = `<polygon points="${AXES.map((_, i) => pt(i, sc[i]).map((n) => n.toFixed(1)).join(",")).join(" ")}" class="hx-val"/>` +
      sc.map((v, i) => { const [x, y] = pt(i, v); return `<circle cx="${x}" cy="${y}" r="3.5" class="hx-dot"/>`; }).join("");
    const labels = AXES.map((a, i) => {
      const [x, y] = pt(i, 12.0), anchor = Math.abs(x - cx) < 5 ? "middle" : x > cx ? "start" : "end", dx = anchor === "start" ? -14 : anchor === "end" ? 14 : 0;
      return `<g class="hx-lab ${S.axis === a.k ? "sel" : ""}" data-bm-axis="${a.k}" role="button" tabindex="0" aria-label="${esc(a.n)} ${r1(sc[i])}点">
        <rect x="${anchor === "middle" ? x - 38 : anchor === "start" ? x + dx - 6 : x + dx - 70}" y="${y - 18}" width="76" height="36" rx="8"/>
        <text x="${x + dx}" y="${y - 2}" text-anchor="${anchor}" class="hx-ln">${esc(a.n)}${a.low ? "*" : ""}</text>
        <text x="${x + dx}" y="${y + 13}" text-anchor="${anchor}" class="hx-ls">${r1(sc[i])}</text></g>`;
    }).join("");
    return `<svg class="hx-svg" viewBox="-20 -4 ${W + 40} ${H + 8}" role="img" aria-label="6つの系統の六角形">${rings}${spokes}${shape}${nums}${labels}</svg>
      <p class="hint bm-c">＊内分泌系は、分泌量ではなく「分泌を促しやすい運動をしたか」の目安です（確信度は低め）。</p>`;
  }
  function axisTabs(items) {
    return `<div class="hx-tabs">${AXES.map((a) => `<button type="button" data-bm-axis="${a.k}" aria-pressed="${S.axis === a.k}">${esc(a.n)}<b>${r1(axisScore(items, a.k))}</b></button>`).join("")}</div>`;
  }
  function detail(items, list) {
    if (!S.axis) return `<p class="hint bm-c">系統の名前を押すと、その中の細かい項目の点数が出ます。</p>`;
    const a = AX[S.axis];
    const rows = a.items.map((i) => {
      const v = items[i], f = Math.round(v || 0), self = CLS[i] === "self";
      const from = list ? list.map((e) => [e.name, entryPts(e)[i]]).filter(([, x]) => x).map(([n, x]) => `${n} ${r1(x)}`) : [];
      return `<div class="hx-row ${v ? "" : "zero"}"><span class="hx-in">${esc(i)}${self ? `<small class="bm-self">自己評価</small>` : ""}</span><span class="hx-cells">${[...Array(10)].map((_, j) => `<i class="${j < f ? "on" : ""}"></i>`).join("")}</span><em>${v == null ? "未評価" : r1(v)}</em>${from.length ? `<small>${esc(from.join("、"))}</small>` : ""}</div>`;
    }).join("");
    return `<div class="bm-panel"><div class="bm-ph"><b>${esc(a.n)}　${r1(axisScore(items, a.k))}点</b><button type="button" class="linkish" data-bm-axis="${a.k}">閉じる</button></div>
      <p class="hint">${a.items.length}項目。六角形の点数は、評価できた項目のうち点数の高いほうから半分の平均です。${a.low ? "この系統は分泌量ではなく、刺激の目安です。" : ""}${a.k === "mental" ? "「自己評価」の項目は、記録のときに自分で入れた日だけ点数が入ります。" : ""}</p>${rows}</div>`;
  }

  // ---------- 日ごとの記録 ----------
  function viewToday() {
    const list = entriesOn(S.date), items = dayItems(S.date);
    return `<div class="bm-page">
      <div class="bm-day"><button type="button" class="btn ghost small" data-bm-day="-1" aria-label="前の日">‹</button><b>${S.date === today() ? "今日 " : ""}${fmtDate(S.date)}</b><button type="button" class="btn ghost small" data-bm-day="1" aria-label="次の日" ${S.date >= today() ? "disabled" : ""}>›</button></div>
      ${hexagon(items)}${axisTabs(items)}${detail(items, list)}
      <div class="ls-mhead"><h3>この日の運動 ${list.length}件</h3>${can() && !S.draft ? `<button type="button" class="btn primary small" data-bm-a="new">＋ 運動を記録</button>` : ""}</div>
      ${S.wiz ? wizard() : S.draft ? form() : ""}
      ${list.length ? list.map(entry).join("") : `<div class="empty">まだ記録がありません。${can() ? "「＋ 運動を記録」から、運動の名前を入れてください。" : ""}</div>`}
      <p class="bm-note">${NOTE}</p>
    </div>`;
  }
  function axisChips(pts) {
    return `<div class="bm-axc">${AXES.map((a) => { const v = axisScore(pts, a.k); return `<span class="${v >= 1 ? "" : "zero"}">${esc(a.n.replace("系", ""))} <b>${r1(v)}</b></span>`; }).join("")}</div>`;
  }
  const S_LABEL = { intensity: { low: "強度 低", mid: "強度 中", high: "強度 高" }, difficulty: { easy: "易しい", mid: "難しさ 普通", hard: "難しい" }, exp: { new: "初めて", some: "少し経験あり", used: "慣れている" }, env: { regular: "環境 決まっている", irregular: "環境 変化が多い" }, people: { solo: "一人", group: "複数人" } };
  function entry(e) {
    const pts = entryPts(e), p = e.v === 3 ? profById(e.pid) : null;
    const top = Object.entries(pts).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const conds = e.s ? [e.s.min ? e.s.min + "分" : "", ...Object.keys(S_LABEL).map((k) => (S_LABEL[k] || {})[e.s[k]] || "")].filter(Boolean) : [];
    return `<article class="card bm-entry"><div class="bm-eh"><h3>${esc(e.name)}</h3>${conds.length ? `<span class="hint">${esc(conds.join("・"))}</span>` : ""}</div>
      ${e.v === 3 && !p ? `<p class="hint">運動の一覧から外されたため、保存したときの点数で数えています。</p>` : ""}
      ${e.v !== 3 ? `<p class="hint">前の形式の記録です（今ある項目の点数だけ数えています）。</p>` : ""}
      ${axisChips(pts)}
      ${top.length ? `<div class="bm-pts">${top.map(([k, v]) => `<span class="bm-pt">${esc(k)} <b>${r1(v)}</b></span>`).join("")}</div>` : ""}
      ${e.memo ? `<div class="ls-notes">${esc(e.memo).replace(/\n/g, "<br>")}</div>` : ""}
      ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-bm-edit="${esc(e.id)}">直す</button></div>` : ""}</article>`;
  }
  function chipSet(key, opts) {
    const cur = S.draft.s[key];
    return `<div class="bm-opt"><span>${{ intensity: "強度", difficulty: "難しさ", exp: "経験", env: "環境", people: "人数" }[key]}</span>${opts.map(([v, t]) => `<button type="button" class="chip" data-bm-s="${key}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join("")}</div>`;
  }
  function form() {
    const d = S.draft, p = d.pid ? profById(d.pid) : null, hits = !p && d.name ? search(d.name).slice(0, 8) : [];
    const pts = p ? E.sessionPoints(p.f, d.s, d.self, p.ov || {}) : null;
    return `<div class="ls-form bm-form"><h3>${d.id ? "記録を直す" : "運動を記録"}</h3>
      <label class="f"><span>運動の名前</span><input data-bm-f="name" value="${esc(d.name)}" placeholder="例：ランニング、キャッチボール、登山" autocomplete="off"></label>
      ${p ? `<div class="bm-picked"><b>${esc(p.name)}</b><span class="ls-tag">${p.src === "quiz" ? "質問から分析" : "運動の一覧"}</span><button type="button" class="linkish" data-bm-a="unpick">選び直す</button></div>` : ""}
      ${!p && hits.length ? `<div class="f"><span>一覧から選んでください</span><div class="chips">${hits.map((h) => `<button type="button" class="chip" data-bm-pick="${esc(h.id)}">${esc(h.name)}</button>`).join("")}</div></div>` : ""}
      ${!p && d.name && norm(d.name).length >= 1 ? `<div class="bm-new"><span>${hits.length ? "この中にない場合は" : `「${esc(d.name)}」は一覧にありません。`}</span><button type="button" class="btn ghost small" data-bm-a="wiz">質問に答えて分析する</button></div>` : ""}
      ${!p && !d.name ? `<p class="hint">名前の一部を入れると、一覧から候補が出ます。</p>` : ""}
      <details class="bm-ax" ${S.openMore ? "open" : ""} data-bm-more="1"><summary>くわしく入れる<span>なくても大丈夫</span></summary><div class="bm-more">
        <label class="bm-opt"><span>時間（分）</span><input data-bm-min inputmode="numeric" value="${esc(d.s.min || "")}" style="max-width:6em"></label>
        ${chipSet("intensity", [["low", "低"], ["mid", "中"], ["high", "高"]])}
        ${chipSet("difficulty", [["easy", "易しい"], ["mid", "普通"], ["hard", "難しい"]])}
        ${chipSet("exp", [["new", "初めて"], ["some", "少しある"], ["used", "慣れている"]])}
        ${chipSet("env", [["regular", "決まっている"], ["irregular", "変化が多い"]])}
        ${chipSet("people", [["solo", "一人"], ["group", "複数人"]])}</div></details>
      <details class="bm-ax" ${S.openSelf ? "open" : ""} data-bm-selfopen="1"><summary>メンタルなどの自己評価<span>入れなければ未評価</span></summary><div class="bm-steps" style="padding:0 8px 8px">
        ${SELF.map((i) => { const v = d.self[i]; return `<div class="bm-step ${v != null ? "on" : ""}"><span>${esc(i)}${i === "侵害受容" ? "（痛み）" : ""}</span><button type="button" data-bm-self="${esc(i)}" data-v="-1" aria-label="${esc(i)}を1減らす">−</button><b>${v == null ? "—" : v}</b><button type="button" data-bm-self="${esc(i)}" data-v="1" aria-label="${esc(i)}を1増やす">＋</button></div>`; }).join("")}
        <p class="hint" style="grid-column:1/-1">「−」を押すと0から、「＋」を押すと1から入ります。</p></div></details>
      ${pts ? `<div class="f"><span>この記録で入る点数（推定）</span>${axisChips(pts)}</div>` : ""}
      <label class="f"><span>メモ</span><textarea rows="2" data-bm-f="memo">${esc(d.memo)}</textarea></label>
      <div class="acts"><button type="button" class="btn ghost" data-bm-a="cancel">やめる</button>${d.id ? `<button type="button" class="btn ghost" data-bm-a="del">${S.sure === d.id ? "本当に削除する" : "削除"}</button>` : ""}<button type="button" class="btn primary" data-bm-a="save" ${S.busy || !p ? "disabled" : ""}>保存</button></div></div>`;
  }
  function wizard() {
    const w = S.wiz, n = w.ans.filter((x) => x != null).length;
    return `<div class="ls-form bm-form"><h3>「${esc(w.name)}」を分析する</h3>
      <p class="hint">${QS.length}個の質問に、近いものを選んでください。わからない質問は飛ばして大丈夫です（その特性は未評価になります）。答えは保存されるので、次からは名前だけで使えます。</p>
      ${QS.map((q, i) => `<div class="bm-q"><b>${i + 1}. ${esc(q.q)}</b><div class="chips">${q.o.map((o, j) => `<button type="button" class="chip" data-bm-qa="${i}" data-v="${j}" aria-pressed="${w.ans[i] === j}">${esc(o)}</button>`).join("")}</div></div>`).join("")}
      <div class="bm-q"><b>${QS.length + 1}. 当てはまるものに印を</b>${CHECKS.map(([k, t]) => `<label class="bm-keep"><input type="checkbox" data-bm-chk="${k}" ${w.chk[k] ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div>
      <p class="hint">${n}/${QS.length}問に答えました。</p>
      <div class="acts"><button type="button" class="btn ghost" data-bm-a="wizcancel">もどる</button><button type="button" class="btn primary" data-bm-a="wizsave" ${n < 4 || S.busy ? "disabled" : ""}>分析して保存</button></div></div>`;
  }
  function wizFeatures(w) {
    const f = Object.fromEntries(FK.map((k) => [k, null])), why = [], tmp = { _load: [], _cog: [], _sens: [] };
    QS.forEach((q, i) => {
      const a = w.ans[i]; if (a == null) return;
      why.push(`「${q.q}」→「${q.o[a]}」`);
      for (const [k, vals] of Object.entries(q.set)) { if (k[0] === "_") tmp[k].push(vals[a]); else f[k] = f[k] == null ? vals[a] : Math.max(f[k], vals[a]); }
    });
    if (tmp._cog.length) f.cog = Math.max(...tmp._cog);
    if (tmp._sens.length) f.sens = Math.max(...tmp._sens);
    if (tmp._load.length) f.load = Math.round((tmp._load[0] + (f.int ?? tmp._load[0])) / 2);
    for (const [k, , on, off] of CHECKS) f[k] = w.chk[k] ? on : off;
    if (w.chk.aud) why.push("音楽や音の合図を使う"); if (w.chk.therm) why.push("屋外・水中・暑さ寒さの中"); if (w.chk.touch) why.push("手や道具でつかむ・触れる");
    const n = w.ans.filter((x) => x != null).length;
    return { f, conf: n >= 11 ? "中" : "低", why: `質問への答えから推定しました：${why.join("、")}。` };
  }

  // ---------- 振り返り ----------
  function viewReview() {
    const days = S.range, items = days === 1 ? dayItems(today()) : rangeItems(days);
    const from = today(-(days - 1)), list = D.bodylog.filter((x) => x.date >= from && x.date <= today());
    const ev = Object.keys(CLS).filter((i) => CLS[i] !== "self");
    const used = ev.filter((i) => (items[i] || 0) >= 2), rare = ev.filter((i) => (items[i] || 0) < 1);
    const top = ev.filter((i) => items[i]).sort((a, b) => items[b] - items[a]).slice(0, 5);
    const sc = AXES.map((a) => [a.n, axisScore(items, a.k)]).sort((a, b) => b[1] - a[1]);
    const kinds = new Set(list.map((e) => e.pid || e.name)).size;
    const wk = []; for (let i = 6; i >= 0 && days === 7; i--) wk.push(today(-i));
    return `<div class="bm-page">
      <div class="chips bm-c">${[[1, "今日"], [7, "この7日"], [30, "この30日"]].map(([n, t]) => `<button type="button" class="chip" data-bm-range="${n}" aria-pressed="${days === n}">${t}</button>`).join("")}</div>
      <p class="hint bm-c">${list.length}件の記録。${days === 1 ? "今日の合計です。" : "1日あたりの平均です。"}</p>
      ${hexagon(items)}${axisTabs(items)}${detail(items, list)}
      ${list.length ? `<div class="bm-stats">
        <div class="bm-stat"><b>多様性</b><p><em>${used.length}</em> / ${ev.length}項目に刺激（2点以上）が入りました。運動の種類は${kinds}種類です。</p></div>
        <div class="bm-stat"><b>偏り</b><p>いちばん高いのは${esc(sc[0][0])}（${r1(sc[0][1])}）、いちばん低いのは${esc(sc[5][0])}（${r1(sc[5][1])}）で、差は${r1(sc[0][1] - sc[5][1])}点です。</p></div>
        <div class="bm-stat"><b>よく使っている能力</b><div class="bm-pts">${top.map((i) => `<span class="bm-pt">${esc(i)} <b>${r1(items[i])}</b></span>`).join("")}</div></div>
        <div class="bm-stat"><b>使う機会が少ない能力（1点未満）</b>${AXES.map((a) => { const xs = a.items.filter((i) => rare.includes(i)); return xs.length ? `<div class="bm-grp"><b>${esc(a.n)}</b>${xs.map((i) => `<span class="bm-pt dim">${esc(i)}</span>`).join("")}</div>` : ""; }).join("") || `<p>ありません。</p>`}</div>
      </div>` : ""}
      ${wk.length ? `<div class="bm-week">${wk.map((d) => { const n = entriesOn(d).length; return `<button type="button" data-bm-go="${d}"><span>${fmtDate(d).replace(/^\d+月/, "")}</span><b>${n}</b></button>`; }).join("")}</div><p class="hint">数字はその日の記録の件数です。日にちを押すと、その日の記録が開きます。</p>` : ""}
      <p class="bm-note">${NOTE}</p>
    </div>`;
  }

  // ---------- 運動の一覧 ----------
  function viewList() {
    if (S.prof) return viewProf();
    const ps = S.lq ? search(S.lq) : profiles();
    return `<div class="bm-page">
      <p class="ls-note">一覧の${EX.list.length}種類は、Claudeが運動の特性を見立てて入れたものです（確信度：中）。質問から分析した運動もここに入ります。数字は向さんの感覚に合わせて直せます。</p>
      <input class="bm-lq" data-bm-lq value="${esc(S.lq)}" placeholder="運動の名前で探す">
      <p class="hint">${ps.length}件</p>
      ${ps.map((p) => `<article class="card bm-entry bm-li" data-bm-prof="${esc(p.id)}"><div class="bm-eh"><h3>${esc(p.name)}</h3><span class="ls-tag">${p.src === "quiz" ? "質問から" : p.edited ? "直した" : "一覧"}</span></div>${axisChips(E.sessionPoints(p.f, {}, {}, p.ov || {}))}</article>`).join("")}
    </div>`;
  }
  function viewProf() {
    const e = S.prof, base = E.baseScores(e.f);
    const st = (k, v, attr) => `<div class="bm-step ${v != null ? "on" : ""}"><span>${esc(k)}</span>${can() ? `<button type="button" ${attr}="${esc(k)}" data-v="-1">−</button>` : "<i></i>"}<b>${v == null ? "—" : r1(v)}</b>${can() ? `<button type="button" ${attr}="${esc(k)}" data-v="1">＋</button>` : "<i></i>"}</div>`;
    return `<div class="bm-page"><div class="ls-form">
      <div class="bm-ph"><b>${esc(e.name)}</b><button type="button" class="linkish" data-bm-a="profclose">一覧にもどる</button></div>
      <p class="hint">分析のしかた：${e.src === "quiz" ? "質問への答え" : "Claudeの見立て（運動の一覧）"}　確信度：${esc(e.conf || "中")}</p>
      <p class="bm-why">${esc(why(e))}</p>
      ${axisChips(E.sessionPoints(e.f, {}, {}, e.ov))}
      <details class="bm-ax" open><summary>運動の特性（0〜10）<span>ここを直すと、全項目が共通ルールで計算し直されます</span></summary><div class="bm-steps" style="padding:0 8px 8px">${MAIN_F.map((k) => st(E.FEATURES[k], e.f[k], "data-bm-pf")).join("")}</div></details>
      <details class="bm-ax"><summary>感覚の内訳（0〜10）<span>感覚器系の計算に使います</span></summary><div class="bm-steps" style="padding:0 8px 8px">${SENSE_F.map((k) => st(E.FEATURES[k], e.f[k], "data-bm-pf")).join("")}</div></details>
      ${AXES.map((a) => `<details class="bm-ax"><summary>${esc(a.n)}の項目を直接直す<span>${a.items.filter((i) => e.ov[i] != null).length ? "直した項目あり" : "共通ルールのまま"}</span></summary><div class="bm-steps" style="padding:0 8px 8px">${a.items.filter((i) => CLS[i] !== "self").map((i) => st(i + (e.ov[i] != null ? "（直した）" : ""), e.ov[i] ?? base[i], "data-bm-pov")).join("")}</div></details>`).join("")}
      ${can() ? `<div class="acts">${e.src === "list" && e.edited ? `<button type="button" class="btn ghost" data-bm-a="profreset">${S.sure === "r:" + e.id ? "本当に元に戻す" : "Claudeの見立てに戻す"}</button>` : ""}${e.src === "quiz" ? `<button type="button" class="btn ghost" data-bm-a="profhide">${S.sure === "h:" + e.id ? "本当に一覧から外す" : "一覧から外す"}</button>` : ""}<button type="button" class="btn primary" data-bm-a="profsave">保存</button></div>` : ""}
    </div></div>`;
  }

  function render(L) {
    if (!C.db) { L.innerHTML = `<div class="empty">書庫に接続できません。</div>`; return; }
    if (!ready()) { L.innerHTML = `<div class="empty">フィジカルログを読み込んでいます…</div>`; return; }
    const tabs = [["today", "日ごとの記録"], ["review", "振り返り"], ["list", "運動の一覧"]];
    const ae = document.activeElement, keep = ae && ae.closest && ae.closest("#bodymap") && (ae.dataset.bmF || ae.hasAttribute("data-bm-lq")) ? [ae.dataset.bmF || "lq", ae.selectionStart] : null;
    L.innerHTML = `<div id="bodymap">
      ${S.msg ? `<div class="at-msg">${esc(S.msg)}<button type="button" class="linkish" data-bm-a="msgoff">閉じる</button></div>` : ""}
      <div class="ls-tabs">${tabs.map(([k, n]) => `<button type="button" data-bm-sub="${k}" aria-pressed="${S.sub === k}">${esc(n)}</button>`).join("")}</div>
      ${S.sub === "today" ? viewToday() : S.sub === "review" ? viewReview() : viewList()}</div>`;
    if (keep) { const el = L.querySelector(keep[0] === "lq" ? "[data-bm-lq]" : `[data-bm-f="${keep[0]}"]`); if (el) { el.focus(); try { el.setSelectionRange(keep[1], keep[1]); } catch {} } }
  }

  // ---------- 保存 ----------
  async function saveEntry() {
    const d = S.draft, p = profById(d.pid);
    if (!p) { S.msg = "運動を一覧から選ぶか、質問に答えて分析してください。"; C.rerender(); return; }
    S.busy = true; C.rerender();
    const id = d.id || uid(), t = new Date().toISOString();
    const s = Object.fromEntries(Object.entries(d.s).filter(([, v]) => v !== "" && v != null));
    const self = Object.fromEntries(Object.entries(d.self).filter(([, v]) => v != null));
    const pts = Object.fromEntries(Object.entries(E.sessionPoints(p.f, s, self, p.ov || {})).filter(([, v]) => v != null));
    const data = { v: 3, date: d.date, name: p.name, pid: p.id, s, self, pts, memo: d.memo || "", createdAt: d.createdAt || t, updatedAt: t };
    try { await C.db.collection("bodylog").doc(id).set(data); S.draft = null; S.msg = "保存しました。"; }
    catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.busy = false; C.rerender();
  }
  async function saveWiz() {
    const w = S.wiz, r = wizFeatures(w), id = "c" + uid(), t = new Date().toISOString();
    S.busy = true; C.rerender();
    try {
      await C.db.collection("exprofiles").doc(id).set({ custom: true, name: w.name.trim(), aka: [], f: r.f, ov: {}, conf: r.conf, why: r.why, answers: w.ans, checks: w.chk, createdAt: t, updatedAt: t });
      D.exprofiles.push({ id, custom: true, name: w.name.trim(), aka: [], f: r.f, ov: {}, conf: r.conf, why: r.why });
      S.wiz = null; S.draft.pid = id; S.draft.name = w.name.trim(); S.msg = `「${w.name.trim()}」を分析して、運動の一覧に保存しました。`;
    } catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.busy = false; C.rerender();
  }
  async function saveProf(kind) {
    const e = S.prof, t = new Date().toISOString();
    try {
      if (e.src === "quiz") {
        const prev = D.exprofiles.find((x) => x.id === e.id) || {};
        await C.db.collection("exprofiles").doc(e.id).set({ ...prev, id: undefined, custom: true, f: e.f, ov: e.ov, hidden: kind === "hide", updatedAt: t });
      } else {
        const orig = EX.list.find((x) => x.id === e.id), f0 = Object.fromEntries(EX.keys.map((k, i) => [k, orig.f[i]]));
        const fd = kind === "reset" ? null : Object.fromEntries(Object.entries(e.f).filter(([k, v]) => v !== f0[k]));
        await C.db.collection("exprofiles").doc(e.id).set({ f: fd && Object.keys(fd).length ? fd : null, ov: kind === "reset" ? {} : e.ov, updatedAt: t });
      }
      S.prof = null; S.msg = kind === "hide" ? "一覧から外しました（これまでの記録はそのまま残ります）。" : kind === "reset" ? "Claudeの見立てに戻しました。" : "保存しました。これまでの記録にも反映されます。";
    } catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.sure = null; C.rerender();
  }

  const clamp = (v) => Math.max(0, Math.min(10, v));
  function bind() {
    document.addEventListener("toggle", (ev) => { const el = ev.target; if (!el.dataset) return; if (el.dataset.bmMore) S.openMore = el.open; if (el.dataset.bmSelfopen) S.openSelf = el.open; }, true);
    document.addEventListener("click", async (ev) => {
      if (!C.active() || !ev.target.closest("#bodymap")) return;
      const t = (s) => ev.target.closest(s);
      let b;
      if ((b = t("[data-bm-sub]"))) { S.sub = b.dataset.bmSub; S.axis = null; S.draft = null; S.wiz = null; S.prof = null; C.rerender(); return; }
      if ((b = t("[data-bm-axis]"))) { S.axis = S.axis === b.dataset.bmAxis ? null : b.dataset.bmAxis; C.rerender(); return; }
      if ((b = t("[data-bm-day]"))) { const [y, m, d] = S.date.split("-").map(Number); const s = new Date(y, m - 1, d + +b.dataset.bmDay).toLocaleDateString("sv-SE"); if (s <= today()) { S.date = s; S.draft = null; S.wiz = null; } C.rerender(); return; }
      if ((b = t("[data-bm-range]"))) { S.range = +b.dataset.bmRange; C.rerender(); return; }
      if ((b = t("[data-bm-go]"))) { S.date = b.dataset.bmGo; S.sub = "today"; C.rerender(); return; }
      if ((b = t("[data-bm-pick]")) && S.draft) { const p = profById(b.dataset.bmPick); if (p) { S.draft.pid = p.id; S.draft.name = p.name; } C.rerender(); return; }
      if ((b = t("[data-bm-s]")) && S.draft) { const k = b.dataset.bmS; S.draft.s[k] = S.draft.s[k] === b.dataset.v ? "" : b.dataset.v; C.rerender(); return; }
      if ((b = t("[data-bm-self]")) && S.draft) { const k = b.dataset.bmSelf, v = S.draft.self[k], dv = +b.dataset.v; S.draft.self[k] = v == null ? (dv > 0 ? 1 : 0) : clamp(v + dv); C.rerender(); return; }
      if ((b = t("[data-bm-qa]")) && S.wiz) { const i = +b.dataset.bmQa, v = +b.dataset.v; S.wiz.ans[i] = S.wiz.ans[i] === v ? null : v; C.rerender(); return; }
      if ((b = t("[data-bm-prof]"))) { const p = profById(b.dataset.bmProf); if (p) { S.prof = JSON.parse(JSON.stringify({ ...p, ov: p.ov || {} })); S.sure = null; C.rerender(); window.scrollTo({ top: document.querySelector("#bodymap").offsetTop - 80 }); } return; }
      if ((b = t("[data-bm-pf]")) && S.prof && can()) { const lbl = b.dataset.bmPf, k = FK.find((x) => E.FEATURES[x] === lbl); const v = S.prof.f[k]; S.prof.f[k] = clamp((v == null ? 5 : v) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-pov]")) && S.prof && can()) { const k = b.dataset.bmPov.replace("（直した）", ""); const cur = S.prof.ov[k] ?? E.baseScores(S.prof.f)[k] ?? 5; S.prof.ov[k] = clamp(Math.round(cur) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-edit]"))) { const x = D.bodylog.find((y) => y.id === b.dataset.bmEdit); if (x) { S.draft = { id: x.id, date: x.date, createdAt: x.createdAt, name: x.name, pid: x.v === 3 ? x.pid : null, s: { ...(x.s || {}) }, self: { ...(x.self || {}) }, memo: x.memo || "" }; S.wiz = null; S.sure = null; C.rerender(); document.querySelector(".bm-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-bm-a]"))) {
        const a = b.dataset.bmA;
        if (a === "msgoff") S.msg = "";
        if (a === "new") { S.draft = { date: S.date, name: "", pid: null, s: {}, self: {}, memo: "" }; S.wiz = null; S.sure = null; S.openMore = false; S.openSelf = false; }
        if (a === "cancel") S.draft = null;
        if (a === "unpick") { S.draft.pid = null; }
        if (a === "wiz") { S.wiz = { name: S.draft.name.trim(), ans: QS.map(() => null), chk: {} }; }
        if (a === "wizcancel") S.wiz = null;
        if (a === "wizsave") { await saveWiz(); return; }
        if (a === "save") { await saveEntry(); return; }
        if (a === "del") {
          if (S.sure !== S.draft.id) { S.sure = S.draft.id; C.rerender(); return; }
          try { await C.db.collection("bodylog").doc(S.draft.id).delete(); S.draft = null; S.msg = "削除しました。"; } catch { S.msg = "削除できませんでした。"; }
          S.sure = null;
        }
        if (a === "profclose") { S.prof = null; S.sure = null; }
        if (a === "profsave") { await saveProf("save"); return; }
        if (a === "profreset") { if (S.sure !== "r:" + S.prof.id) { S.sure = "r:" + S.prof.id; C.rerender(); return; } await saveProf("reset"); return; }
        if (a === "profhide") { if (S.sure !== "h:" + S.prof.id) { S.sure = "h:" + S.prof.id; C.rerender(); return; } await saveProf("hide"); return; }
        C.rerender();
      }
    });
    document.addEventListener("change", (ev) => { const el = ev.target; if (C.active() && S.wiz && el.dataset && el.dataset.bmChk) { S.wiz.chk[el.dataset.bmChk] = el.checked; } });
    document.addEventListener("keydown", (ev) => { const g = ev.target.closest?.("#bodymap g[data-bm-axis]"); if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
    document.addEventListener("input", (ev) => {
      if (!C.active()) return;
      const el = ev.target;
      if (el.dataset.bmF && S.draft) { S.draft[el.dataset.bmF] = el.value; if (el.dataset.bmF === "name") { S.draft.pid = null; C.rerender(); } }
      if (el.hasAttribute("data-bm-min") && S.draft) S.draft.s.min = el.value.replace(/[^\d]/g, "");
      if (el.hasAttribute("data-bm-lq")) { S.lq = el.value; C.rerender(); }
    });
  }

  const CSS = `
#bodymap{display:grid;gap:12px}
.bm-page{display:grid;gap:12px}
.bm-c{justify-self:center;text-align:center;margin:0}
.bm-day{display:flex;gap:10px;align-items:center;justify-content:center}
.bm-day b{font-size:15px;min-width:9em;text-align:center}
.bm-note{margin:0;font-size:12px;color:var(--ink-3);border-top:1px solid var(--line);padding-top:8px}
.hx-svg{width:100%;max-width:440px;justify-self:center;display:block;overflow:visible}
.hx-ring{fill:none;stroke:var(--line);stroke-width:.7}
.hx-ring.major{stroke:var(--ink-3);stroke-width:1}
.hx-spoke{stroke:var(--line);stroke-width:.8}
.hx-num{font-size:9px;fill:var(--ink-3);font-family:var(--mono)}
.hx-val{fill:color-mix(in srgb,var(--teal) 28%,transparent);stroke:var(--teal);stroke-width:2;stroke-linejoin:round}
.hx-dot{fill:var(--teal)}
.hx-lab{cursor:pointer}
.hx-lab rect{fill:transparent;stroke:none}
.hx-lab.sel rect{fill:var(--teal-soft);stroke:var(--teal)}
.hx-ln{font-size:13px;font-weight:700;fill:var(--ink)}
.hx-ls{font-size:12px;fill:var(--teal);font-family:var(--mono);font-weight:700}
.hx-lab:focus{outline:none}.hx-lab:focus rect{stroke:var(--ink)}
.hx-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.hx-tabs button{font:inherit;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.hx-tabs button b{font-family:var(--mono);color:var(--teal)}
.hx-tabs button[aria-pressed="true"]{background:var(--teal);border-color:var(--teal);color:#fff}
.hx-tabs button[aria-pressed="true"] b{color:#fff}
.bm-panel{background:var(--surface);border:1px solid var(--teal);border-radius:10px;padding:12px 14px;display:grid;gap:7px}
.bm-ph{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bm-ph b{font-size:15px}
.bm-panel .hint{margin:0}
.hx-row{display:grid;grid-template-columns:8.2em 1fr 3em;gap:4px 8px;align-items:center;font-size:13px}
.hx-row.zero{color:var(--ink-3)}
.hx-in{display:grid}
.bm-self{font-size:10px;color:var(--amber)}
.hx-cells{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}
.hx-cells i{height:12px;border-radius:2px;background:var(--sunk);border:1px solid var(--line)}
.hx-cells i.on{background:var(--teal);border-color:var(--teal)}
.hx-row em{font-style:normal;font-family:var(--mono);text-align:right;font-size:12px}
.hx-row small{grid-column:2/4;font-size:11px;color:var(--ink-3);margin-top:-3px}
.bm-entry{display:grid;gap:6px}
.bm-li{cursor:pointer}
.bm-eh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.bm-eh h3{margin:0;font-size:15px;flex:1 1 auto}
.bm-axc{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 8px;font-size:12px;color:var(--ink-2)}
.bm-axc span{display:flex;justify-content:space-between;border-bottom:1px dotted var(--line)}
.bm-axc b{font-family:var(--mono);color:var(--teal)}
.bm-axc .zero b{color:var(--ink-3)}
.bm-grp{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.bm-grp>b{font-size:11.5px;color:var(--ink-3);margin-right:2px;min-width:5.2em}
.bm-pts{display:flex;gap:5px;flex-wrap:wrap}
.bm-pt{font-size:12px;border:1px solid var(--teal);color:var(--teal);border-radius:4px;padding:1px 7px;background:var(--surface)}
.bm-pt.dim{border-color:var(--line);color:var(--ink-3)}
.bm-pt b{font-family:var(--mono)}
.bm-picked{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--teal-soft);border-radius:8px;padding:8px 12px}
.bm-new{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px}
.bm-ax{border:1px solid var(--line);border-radius:8px;background:var(--paper)}
.bm-ax summary{cursor:pointer;padding:8px 12px;font-weight:600;font-size:14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.bm-ax summary span{font-weight:400;font-size:12px;color:var(--ink-3)}
.bm-more{display:grid;gap:8px;padding:0 12px 10px}
.bm-opt{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13.5px}
.bm-opt>span{min-width:4.5em;color:var(--ink-2);font-size:12.5px}
.bm-opt input{font:inherit;font-size:15px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink)}
.bm-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}
.bm-step{display:grid;grid-template-columns:1fr 34px 30px 34px;align-items:center;gap:4px;font-size:13px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:4px 6px 4px 10px}
.bm-step.on{border-color:var(--teal);background:var(--teal-soft)}
.bm-step button{font:inherit;font-size:17px;line-height:1;height:32px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.bm-step b{text-align:center;font-family:var(--mono)}
.bm-q{display:grid;gap:6px;padding:8px 0;border-top:1px solid var(--line)}
.bm-q>b{font-size:14px}
.bm-keep{display:flex;gap:6px;align-items:center;font-size:13.5px}
.bm-why{margin:0;font-size:13.5px;background:var(--sunk);border-radius:6px;padding:8px 10px}
.bm-lq{font:inherit;font-size:15px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
.bm-stats{display:grid;gap:8px}
.bm-stat{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:grid;gap:6px}
.bm-stat>b{font-size:14px}
.bm-stat p{margin:0;font-size:13.5px}
.bm-stat em{font-style:normal;font-family:var(--mono);font-size:18px;color:var(--teal);font-weight:700}
.bm-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.bm-week button{font:inherit;display:grid;gap:2px;justify-items:center;padding:6px 2px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;color:var(--ink)}
.bm-week span{font-size:11px;color:var(--ink-3)}
.bm-week b{font-family:var(--mono);font-size:14px}
`;

  window.BodyMap = {
    init(ctx) { C = ctx; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); bind(); listen(); },
    render(L) { render(L); },
    count() { return ready() ? entriesOn(today()).length : null; },
  };
})();

// 体のマップ：6つの系統の六角形（10点満点）と、その日の運動・食事で項目ごとに貯まるポイント
// 保存先は docs テーブルの区分（bodylog・bodypresets）だけ。既存のデータには書き込まない。
(function () {
  const AXES = [
    { k: "msk", n: "筋骨格系", items: ["筋持久力", "筋力", "パワー", "モビリティ", "組織耐性"] },
    { k: "cv", n: "循環器系", items: ["心肺持久力", "血流"] },
    { k: "neuro", n: "脳神経系", items: ["運動制御能力", "運動学習能力", "運動計画能力", "協調性", "反応能力", "予測能力", "姿勢制御能力", "感覚統合能力", "運動適応能力", "神経筋動員能力", "認知機能", "運動の自動化"] },
    { k: "sense", n: "感覚器系", items: ["視覚", "聴覚", "前庭覚", "固有受容覚", "触覚", "圧覚", "振動覚", "温度覚", "侵害受容", "内受容感覚", "関節位置覚", "運動覚", "力覚", "空間認識能力", "動体視力", "深視力", "身体認識能力"] },
    { k: "mental", n: "メンタル", items: ["集中力", "注意切り替え能力", "自己効力感", "自己肯定感", "感情調整能力", "ストレス耐性", "レジリエンス", "モチベーション", "自己制御能力", "心理的柔軟性", "忍耐力", "チャレンジ精神", "マインドフルネス", "リラクゼーション能力", "社会的つながり"] },
    { k: "nutr", n: "栄養", items: ["タンパク質", "脂質", "糖質", "ビタミン", "ミネラル"] },
  ];
  const ITEM_AXIS = Object.fromEntries(AXES.flatMap((a) => a.items.map((i) => [i, a.k])));
  const AX = Object.fromEntries(AXES.map((a) => [a.k, a]));
  const P = (s) => Object.fromEntries(s.trim().split(/\s+/).map((x) => { const m = x.match(/^(.+?)(\d+)$/); return [m[1], +m[2]]; }));
  // 下書きの点数（1回分・0〜10）。向さんが自由に直せる。
  const PRESETS = [
    { id: "acro", name: "アクロバット", pts: P("パワー6 筋力4 組織耐性5 モビリティ3 心肺持久力2 運動制御能力8 運動学習能力6 運動計画能力7 協調性7 反応能力5 予測能力5 姿勢制御能力7 感覚統合能力7 運動適応能力5 神経筋動員能力8 運動の自動化4 前庭覚9 固有受容覚8 関節位置覚6 運動覚8 空間認識能力9 視覚5 身体認識能力7 力覚5 圧覚4 集中力8 チャレンジ精神8 自己効力感6 忍耐力4") },
    { id: "pilates", name: "ピラティス", pts: P("筋持久力5 筋力3 モビリティ5 血流3 運動制御能力8 運動学習能力5 協調性5 姿勢制御能力7 感覚統合能力6 神経筋動員能力5 運動の自動化4 固有受容覚7 関節位置覚6 運動覚6 内受容感覚5 身体認識能力8 触覚3 集中力7 マインドフルネス6 リラクゼーション能力4 自己効力感3") },
    { id: "frc", name: "FRC（モビリティ）", pts: P("モビリティ8 組織耐性5 筋力4 血流2 運動制御能力7 神経筋動員能力6 運動学習能力3 関節位置覚7 固有受容覚6 運動覚5 力覚5 身体認識能力6 集中力6 忍耐力5") },
    { id: "strength", name: "筋トレ（重め）", pts: P("筋力8 パワー4 組織耐性6 筋持久力3 心肺持久力2 神経筋動員能力9 運動制御能力5 姿勢制御能力4 力覚6 固有受容覚4 圧覚3 自己効力感6 忍耐力6 集中力6") },
    { id: "jump", name: "ジャンプ・スプリント", pts: P("パワー8 筋力4 組織耐性6 心肺持久力3 神経筋動員能力8 反応能力6 協調性6 運動制御能力5 予測能力4 固有受容覚5 力覚5 圧覚4 空間認識能力4 チャレンジ精神5 集中力5") },
    { id: "run", name: "ランニング（ゆっくり長め）", pts: P("筋持久力7 組織耐性4 心肺持久力8 血流7 運動の自動化6 姿勢制御能力3 内受容感覚5 固有受容覚3 温度覚3 忍耐力7 ストレス耐性5 マインドフルネス3 感情調整能力4") },
    { id: "hiit", name: "HIIT（短く強く）", pts: P("筋持久力6 パワー5 心肺持久力8 血流6 神経筋動員能力5 協調性3 内受容感覚5 温度覚3 忍耐力8 ストレス耐性6 チャレンジ精神5 自己制御能力4") },
    { id: "ball", name: "球技・対人スポーツ", pts: P("パワー5 筋持久力4 心肺持久力6 血流4 反応能力8 予測能力8 協調性7 運動適応能力7 運動計画能力6 認知機能7 視覚8 動体視力8 深視力7 空間認識能力8 聴覚5 注意切り替え能力8 社会的つながり8 チャレンジ精神6 集中力6") },
    { id: "walk", name: "ウォーキング", pts: P("筋持久力3 心肺持久力3 血流5 運動の自動化4 姿勢制御能力3 視覚3 聴覚3 固有受容覚2 リラクゼーション能力4 感情調整能力4 マインドフルネス3 注意切り替え能力2") },
    { id: "yoga", name: "ヨガ・ストレッチ", pts: P("モビリティ7 血流3 姿勢制御能力5 運動制御能力4 身体認識能力6 内受容感覚7 固有受容覚5 触覚3 マインドフルネス8 リラクゼーション能力8 感情調整能力5 心理的柔軟性4") },
    { id: "breath", name: "呼吸エクササイズ", pts: P("血流3 心肺持久力2 運動制御能力2 内受容感覚8 リラクゼーション能力9 マインドフルネス7 感情調整能力6 ストレス耐性4 集中力4") },
    { id: "medit", name: "瞑想", pts: P("認知機能3 内受容感覚6 マインドフルネス9 集中力7 感情調整能力7 心理的柔軟性5 リラクゼーション能力7") },
    { id: "sauna", name: "サウナ・入浴", pts: P("血流6 心肺持久力2 温度覚8 内受容感覚4 触覚3 リラクゼーション能力8 ストレス耐性3") },
    { id: "meal", name: "食事（主食・主菜・副菜そろう）", pts: P("タンパク質6 脂質5 糖質6 ビタミン6 ミネラル6") },
    { id: "meal-p", name: "食事（タンパク質多め）", pts: P("タンパク質9 脂質4 ミネラル3") },
    { id: "veg", name: "野菜・果物", pts: P("ビタミン8 ミネラル6 糖質3") },
    { id: "protein", name: "プロテイン", pts: P("タンパク質6") },
  ];

  let C = null;
  const D = { bodylog: [], bodypresets: [] }, got = {};
  const S = { sub: "today", date: today(), axis: null, range: 7, draft: null, msg: "", sure: null, busy: false, editPre: null };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function today(off = 0) { const d = new Date(); d.setDate(d.getDate() + off); return d.toLocaleDateString("sv-SE"); }
  const ready = () => got.bodylog && got.bodypresets;
  const can = () => !!(C && C.canEdit());
  const clean = (pts) => Object.fromEntries(Object.entries(pts || {}).filter(([k, v]) => ITEM_AXIS[k] && +v > 0).map(([k, v]) => [k, +v]));
  const r1 = (v) => Math.round(v * 10) / 10;

  function presets() {
    const saved = Object.fromEntries(D.bodypresets.filter((x) => x.v === 2).map((x) => [x.id, x]));
    const base = PRESETS.filter((p) => !(saved[p.id] && saved[p.id].hidden)).map((p) => saved[p.id] ? { ...p, ...saved[p.id], edited: true } : p);
    const extra = D.bodypresets.filter((x) => x.v === 2 && !PRESETS.find((p) => p.id === x.id) && !x.hidden).map((x) => ({ ...x, custom: true }));
    return [...base, ...extra];
  }
  const entriesOn = (date) => D.bodylog.filter((x) => x.date === date).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  // 1日の項目の点数：その日の合計（10点まで）
  function dayItems(date) { const t = {}; for (const e of entriesOn(date)) for (const [k, v] of Object.entries(clean(e.pts))) t[k] = (t[k] || 0) + v; for (const k in t) t[k] = Math.min(10, t[k]); return t; }
  // 期間の項目の点数：1日あたりの平均
  function rangeItems(days) { const t = {}; for (let i = 0; i < days; i++) { const d = dayItems(today(-i)); for (const k in d) t[k] = (t[k] || 0) + d[k]; } for (const k in t) t[k] = t[k] / days; return t; }
  // 系統の点数：中の項目の平均（10点満点）
  const axisScore = (items, a) => AX[a].items.reduce((s, i) => s + (items[i] || 0), 0) / AX[a].items.length;
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); const w = "日月火水木金土"[new Date(+y, m - 1, +d).getDay()]; return `${+m}月${+d}日（${w}）`; };
  const ptsTotal = (p) => Object.values(clean(p)).reduce((a, b) => a + b, 0);

  function listen() {
    for (const k of ["bodylog", "bodypresets"]) {
      C.db.collection(k).onSnapshot((snap) => { D[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); got[k] = true; if (C.active()) C.rerender(); },
        () => { got[k] = true; if (C.active()) C.rerender(); });
    }
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
        <rect x="${(anchor === "middle" ? x - 38 : anchor === "start" ? x + dx - 6 : x + dx - 70)}" y="${y - 18}" width="76" height="36" rx="8"/>
        <text x="${x + dx}" y="${y - 2}" text-anchor="${anchor}" class="hx-ln">${esc(a.n)}</text>
        <text x="${x + dx}" y="${y + 13}" text-anchor="${anchor}" class="hx-ls">${r1(sc[i])}</text></g>`;
    }).join("");
    return `<svg class="hx-svg" viewBox="-20 -4 ${W + 40} ${H + 8}" role="img" aria-label="6つの系統の六角形">${rings}${spokes}${shape}${nums}${labels}</svg>`;
  }
  function axisTabs(items) {
    return `<div class="hx-tabs">${AXES.map((a) => `<button type="button" data-bm-axis="${a.k}" aria-pressed="${S.axis === a.k}">${esc(a.n)}<b>${r1(axisScore(items, a.k))}</b></button>`).join("")}</div>`;
  }
  function detail(items, list) {
    if (!S.axis) return `<p class="hint bm-c">系統の名前を押すと、その中の細かい項目の点数が出ます。</p>`;
    const a = AX[S.axis];
    const rows = a.items.map((i) => {
      const v = items[i] || 0, f = Math.round(v);
      const from = list ? list.filter((e) => clean(e.pts)[i]).map((e) => e.name) : [];
      return `<div class="hx-row ${v ? "" : "zero"}"><span class="hx-in">${esc(i)}</span><span class="hx-cells">${[...Array(10)].map((_, j) => `<i class="${j < f ? "on" : ""}"></i>`).join("")}</span><em>${r1(v)}</em>${from.length ? `<small>${esc(from.join("、"))}</small>` : ""}</div>`;
    }).join("");
    return `<div class="bm-panel"><div class="bm-ph"><b>${esc(a.n)}　${r1(axisScore(items, a.k))}点</b><button type="button" class="linkish" data-bm-axis="${a.k}">閉じる</button></div>
      <p class="hint">${a.items.length}項目。六角形の点数は、この${a.items.length}項目の平均です。</p>${rows}</div>`;
  }

  // ---------- 日ごとの記録 ----------
  function viewToday() {
    const list = entriesOn(S.date), items = dayItems(S.date);
    return `<div class="bm-page">
      <div class="bm-day"><button type="button" class="btn ghost small" data-bm-day="-1" aria-label="前の日">‹</button><b>${S.date === today() ? "今日 " : ""}${fmtDate(S.date)}</b><button type="button" class="btn ghost small" data-bm-day="1" aria-label="次の日" ${S.date >= today() ? "disabled" : ""}>›</button></div>
      ${hexagon(items)}${axisTabs(items)}${detail(items, list)}
      <div class="ls-mhead"><h3>この日の記録 ${list.length}件</h3>${can() && !S.draft ? `<button type="button" class="btn primary small" data-bm-a="new">＋ 運動・食事を記録</button>` : ""}</div>
      ${S.draft ? form() : ""}
      ${list.length ? list.map(entry).join("") : `<div class="empty">まだ記録がありません。${can() ? "「＋ 運動・食事を記録」から入れてください。" : ""}</div>`}
    </div>`;
  }
  function chipsOf(pts) {
    const c = clean(pts);
    return AXES.map((a) => { const xs = a.items.filter((i) => c[i]); return xs.length ? `<div class="bm-grp"><b>${esc(a.n)}</b>${xs.map((i) => `<span class="bm-pt">${esc(i)} <b>${c[i]}</b></span>`).join("")}</div>` : ""; }).join("");
  }
  function entry(e) {
    const old = Object.keys(e.pts || {}).length && !Object.keys(clean(e.pts)).length;
    return `<article class="card bm-entry"><div class="bm-eh"><h3>${esc(e.name)}</h3>${e.min ? `<span class="hint">${esc(e.min)}分</span>` : ""}</div>
      ${old ? `<p class="hint">前の形式の記録です。「直す」から新しい項目で点数を入れ直せます。</p>` : chipsOf(e.pts)}
      ${e.memo ? `<div class="ls-notes">${esc(e.memo).replace(/\n/g, "<br>")}</div>` : ""}
      ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-bm-edit="${esc(e.id)}">直す</button></div>` : ""}</article>`;
  }
  function steppers(pts, attr) {
    return AXES.map((a) => { const n = a.items.filter((i) => pts[i]).length;
      return `<details class="bm-ax" ${S.open && S.open[a.k] ? "open" : ""} data-bm-open="${a.k}"><summary>${esc(a.n)}<span>${n ? n + "項目に点数あり" : "なし"}</span></summary>
        <div class="bm-steps">${a.items.map((i) => { const v = pts[i] || 0; return `<div class="bm-step ${v ? "on" : ""}"><span>${esc(i)}</span><button type="button" ${attr}="${esc(i)}" data-v="-1" aria-label="${esc(i)}を1減らす">−</button><b>${v}</b><button type="button" ${attr}="${esc(i)}" data-v="1" aria-label="${esc(i)}を1増やす">＋</button></div>`; }).join("")}</div></details>`; }).join("");
  }
  function form() {
    const d = S.draft, ps = presets();
    return `<div class="ls-form bm-form"><h3>${d.id ? "記録を直す" : "運動・食事を記録"}</h3>
      ${d.id ? "" : `<div class="f"><span>① 選ぶ（点数が自動で入ります）</span><div class="chips">${ps.map((p) => `<button type="button" class="chip" data-bm-pre="${esc(p.id)}" aria-pressed="${d.pre === p.id}">${esc(p.name)}</button>`).join("")}<button type="button" class="chip" data-bm-pre="" aria-pressed="${d.pre === ""}">その他（自分で入れる）</button></div></div>`}
      <label class="f"><span>名前</span><input data-bm-f="name" value="${esc(d.name)}" placeholder="例：バク転の練習"></label>
      <label class="f"><span>時間（分・なくても大丈夫）</span><input data-bm-f="min" inputmode="numeric" value="${esc(d.min)}"></label>
      <div class="f"><span>② 項目ごとのポイント（系統の名前を押すと開きます。−と＋で0〜10）</span>${steppers(d.pts, "data-bm-step")}</div>
      <label class="f"><span>メモ</span><textarea rows="2" data-bm-f="memo">${esc(d.memo)}</textarea></label>
      ${d.id ? "" : `<label class="bm-keep"><input type="checkbox" data-bm-keep ${d.keep ? "checked" : ""}> これと点数を、次からも選べるようにする</label>`}
      <div class="acts"><button type="button" class="btn ghost" data-bm-a="cancel">やめる</button>${d.id ? `<button type="button" class="btn ghost" data-bm-a="del">${S.sure === d.id ? "本当に削除する" : "削除"}</button>` : ""}<button type="button" class="btn primary" data-bm-a="save" ${S.busy ? "disabled" : ""}>保存</button></div></div>`;
  }

  // ---------- 振り返り ----------
  function viewReview() {
    const items = rangeItems(S.range), days = [];
    const list = D.bodylog.filter((x) => x.date >= today(-(S.range - 1)) && x.date <= today());
    for (let i = 6; i >= 0 && S.range === 7; i--) days.push(today(-i));
    const low = AXES.filter((a) => axisScore(items, a.k) < 1).map((a) => a.n);
    return `<div class="bm-page">
      <div class="chips bm-c">${[[7, "この7日"], [30, "この30日"]].map(([n, t]) => `<button type="button" class="chip" data-bm-range="${n}" aria-pressed="${S.range === n}">${t}</button>`).join("")}</div>
      <p class="hint bm-c">${list.length}件の記録の、1日あたりの平均です。</p>
      ${hexagon(items)}${axisTabs(items)}${detail(items, list)}
      ${list.length && low.length ? `<p class="ls-note">この期間、${low.join("・")}は1点未満でした。足りていないところを足すきっかけにしてみてはいかがでしょうか？</p>` : ""}
      ${days.length ? `<div class="bm-week">${days.map((d) => { const it = dayItems(d), avg = AXES.reduce((s, a) => s + axisScore(it, a.k), 0) / 6; return `<button type="button" data-bm-go="${d}"><span>${fmtDate(d).replace(/^\d+月/, "")}</span><b>${r1(avg)}</b></button>`; }).join("")}</div><p class="hint">数字はその日の6系統の平均です。日にちを押すと、その日の記録が開きます。</p>` : ""}
    </div>`;
  }

  // ---------- 点数表 ----------
  function viewTable() {
    const ps = presets(), e = S.editPre;
    return `<div class="bm-page">
      <p class="ls-note">点数は Claude が作った下書きです（運動は1回30〜60分、食事は1食を想定）。研究で決まった数字ではないので、向さんの感覚に合わせて直してください。</p>
      ${e ? `<div class="ls-form"><h3>「${esc(e.name)}」の点数を直す</h3>
        <label class="f"><span>名前</span><input data-bm-pf="name" value="${esc(e.name)}"></label>
        ${steppers(e.pts, "data-bm-pstep")}
        <div class="acts"><button type="button" class="btn ghost" data-bm-a="pcancel">やめる</button><button type="button" class="btn ghost" data-bm-a="phide">${S.sure === "p:" + e.id ? "本当に一覧から外す" : "一覧から外す"}</button><button type="button" class="btn primary" data-bm-a="psave">保存</button></div></div>` : ""}
      ${ps.map((p) => `<article class="card bm-entry"><div class="bm-eh"><h3>${esc(p.name)}</h3>${p.custom ? `<span class="ls-tag">自分で追加</span>` : p.edited ? `<span class="ls-tag">直した</span>` : `<span class="ls-tag">下書き</span>`}</div>
        ${chipsOf(p.pts)}
        ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-bm-pedit="${esc(p.id)}">点数を直す</button></div>` : ""}</article>`).join("")}
    </div>`;
  }

  function render(L) {
    if (!C.db) { L.innerHTML = `<div class="empty">書庫に接続できません。</div>`; return; }
    if (!ready()) { L.innerHTML = `<div class="empty">体のマップを読み込んでいます…</div>`; return; }
    const tabs = [["today", "日ごとの記録"], ["review", "振り返り"], ["table", "点数表"]];
    L.innerHTML = `<div id="bodymap">
      ${S.msg ? `<div class="at-msg">${esc(S.msg)}<button type="button" class="linkish" data-bm-a="msgoff">閉じる</button></div>` : ""}
      <div class="ls-tabs">${tabs.map(([k, n]) => `<button type="button" data-bm-sub="${k}" aria-pressed="${S.sub === k}">${esc(n)}</button>`).join("")}</div>
      ${S.sub === "today" ? viewToday() : S.sub === "review" ? viewReview() : viewTable()}</div>`;
  }

  const clamp = (v) => Math.max(0, Math.min(10, v));
  const openFor = (pts) => { const c = clean(pts); S.open = Object.fromEntries(AXES.map((a) => [a.k, a.items.some((i) => c[i])])); };
  async function saveEntry() {
    const d = S.draft;
    if (!String(d.name || "").trim()) { S.msg = "名前を入れてください。"; C.rerender(); return; }
    S.busy = true; C.rerender();
    const id = d.id || uid(), t = new Date().toISOString(), pts = clean(d.pts);
    const data = { v: 2, date: d.date, name: d.name.trim(), pre: d.pre || "", pts, min: String(d.min || "").trim(), memo: d.memo || "", createdAt: d.createdAt || t, updatedAt: t };
    try {
      await C.db.collection("bodylog").doc(id).set(data);
      if (d.keep && !d.id) await C.db.collection("bodypresets").doc("c" + uid()).set({ v: 2, name: data.name, pts, updatedAt: t });
      S.draft = null; S.msg = "保存しました。";
    } catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.busy = false; C.rerender();
  }
  async function savePreset(hide) {
    const e = S.editPre;
    const data = { v: 2, name: String(e.name || "").trim() || "（名前なし）", pts: clean(e.pts), updatedAt: new Date().toISOString() };
    if (hide) data.hidden = true;
    try { await C.db.collection("bodypresets").doc(e.id).set(data); S.editPre = null; S.msg = hide ? "一覧から外しました（これまでの記録はそのまま残ります）。" : "点数表を保存しました。"; }
    catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.sure = null; C.rerender();
  }

  function bind() {
    document.addEventListener("toggle", (ev) => { const el = ev.target; if (el.dataset && el.dataset.bmOpen) { S.open = S.open || {}; S.open[el.dataset.bmOpen] = el.open; } }, true);
    document.addEventListener("click", async (ev) => {
      if (!C.active() || !ev.target.closest("#bodymap")) return;
      const t = (s) => ev.target.closest(s);
      let b;
      if ((b = t("[data-bm-sub]"))) { S.sub = b.dataset.bmSub; S.axis = null; S.draft = null; S.editPre = null; C.rerender(); return; }
      if ((b = t("[data-bm-axis]"))) { S.axis = S.axis === b.dataset.bmAxis ? null : b.dataset.bmAxis; C.rerender(); return; }
      if ((b = t("[data-bm-day]"))) { const [y, m, d] = S.date.split("-").map(Number); const s = new Date(y, m - 1, d + +b.dataset.bmDay).toLocaleDateString("sv-SE"); if (s <= today()) { S.date = s; S.draft = null; } C.rerender(); return; }
      if ((b = t("[data-bm-range]"))) { S.range = +b.dataset.bmRange; C.rerender(); return; }
      if ((b = t("[data-bm-go]"))) { S.date = b.dataset.bmGo; S.sub = "today"; C.rerender(); return; }
      if ((b = t("[data-bm-pre]")) && S.draft) {
        const id = b.dataset.bmPre, p = presets().find((x) => x.id === id);
        S.draft.pre = id;
        if (p) { S.draft.name = p.name; S.draft.pts = { ...clean(p.pts) }; } else { S.draft.name = ""; S.draft.pts = {}; }
        openFor(S.draft.pts); C.rerender(); return;
      }
      if ((b = t("[data-bm-step]")) && S.draft) { const k = b.dataset.bmStep; S.draft.pts[k] = clamp((S.draft.pts[k] || 0) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-pstep]")) && S.editPre) { const k = b.dataset.bmPstep; S.editPre.pts[k] = clamp((S.editPre.pts[k] || 0) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-edit]"))) { const x = D.bodylog.find((y) => y.id === b.dataset.bmEdit); if (x) { S.draft = JSON.parse(JSON.stringify({ ...x, pts: clean(x.pts) })); openFor(S.draft.pts); S.sure = null; C.rerender(); document.querySelector(".bm-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-bm-pedit]"))) { const p = presets().find((x) => x.id === b.dataset.bmPedit); if (p) { S.editPre = { id: p.id, name: p.name, pts: { ...clean(p.pts) } }; openFor(S.editPre.pts); S.sure = null; C.rerender(); document.querySelector("#bodymap .ls-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-bm-a]"))) {
        const a = b.dataset.bmA;
        if (a === "msgoff") S.msg = "";
        if (a === "new") { S.draft = { date: S.date, name: "", pre: null, pts: {}, min: "", memo: "", keep: false }; S.open = {}; S.sure = null; }
        if (a === "cancel") S.draft = null;
        if (a === "save") { await saveEntry(); return; }
        if (a === "del") {
          if (S.sure !== S.draft.id) { S.sure = S.draft.id; C.rerender(); return; }
          try { await C.db.collection("bodylog").doc(S.draft.id).delete(); S.draft = null; S.msg = "削除しました。"; } catch { S.msg = "削除できませんでした。"; }
          S.sure = null;
        }
        if (a === "pcancel") { S.editPre = null; S.sure = null; }
        if (a === "psave") { await savePreset(false); return; }
        if (a === "phide") { if (S.sure !== "p:" + S.editPre.id) { S.sure = "p:" + S.editPre.id; C.rerender(); return; } await savePreset(true); return; }
        C.rerender();
      }
    });
    document.addEventListener("keydown", (ev) => { const g = ev.target.closest?.("#bodymap g[data-bm-axis]"); if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
    document.addEventListener("input", (ev) => {
      if (!C.active()) return;
      const el = ev.target;
      if (el.dataset.bmF && S.draft) S.draft[el.dataset.bmF] = el.value;
      if (el.dataset.bmPf && S.editPre) S.editPre[el.dataset.bmPf] = el.value;
      if (el.hasAttribute("data-bm-keep") && S.draft) S.draft.keep = el.checked;
    });
  }

  const CSS = `
#bodymap{display:grid;gap:12px}
.bm-page{display:grid;gap:12px}
.bm-c{justify-self:center;text-align:center;margin:0}
.bm-day{display:flex;gap:10px;align-items:center;justify-content:center}
.bm-day b{font-size:15px;min-width:9em;text-align:center}
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
.bm-ph{display:flex;justify-content:space-between;align-items:center}
.bm-ph b{font-size:15px}
.bm-panel .hint{margin:0}
.hx-row{display:grid;grid-template-columns:8.2em 1fr 2.4em;gap:4px 8px;align-items:center;font-size:13px}
.hx-row.zero{color:var(--ink-3)}
.hx-cells{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}
.hx-cells i{height:12px;border-radius:2px;background:var(--sunk);border:1px solid var(--line)}
.hx-cells i.on{background:var(--teal);border-color:var(--teal)}
.hx-row em{font-style:normal;font-family:var(--mono);text-align:right}
.hx-row small{grid-column:2/4;font-size:11px;color:var(--ink-3);margin-top:-3px}
.bm-entry{display:grid;gap:6px}
.bm-eh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.bm-eh h3{margin:0;font-size:15px;flex:1 1 auto}
.bm-grp{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.bm-grp>b{font-size:11.5px;color:var(--ink-3);margin-right:2px;min-width:5.2em}
.bm-pt{font-size:12px;border:1px solid var(--teal);color:var(--teal);border-radius:4px;padding:1px 7px;background:var(--surface)}
.bm-pt b{font-family:var(--mono)}
.bm-ax{border:1px solid var(--line);border-radius:8px;background:var(--paper)}
.bm-ax summary{cursor:pointer;padding:8px 12px;font-weight:600;font-size:14px;display:flex;justify-content:space-between;gap:8px}
.bm-ax summary span{font-weight:400;font-size:12px;color:var(--ink-3)}
.bm-ax .bm-steps{padding:0 8px 8px}
.bm-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}
.bm-step{display:grid;grid-template-columns:1fr 34px 26px 34px;align-items:center;gap:4px;font-size:13px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:4px 6px 4px 10px}
.bm-step.on{border-color:var(--teal);background:var(--teal-soft)}
.bm-step button{font:inherit;font-size:17px;line-height:1;height:32px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.bm-step b{text-align:center;font-family:var(--mono)}
.bm-keep{display:flex;gap:6px;align-items:center;font-size:13.5px}
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

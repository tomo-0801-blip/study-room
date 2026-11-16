// 体のマップ：体の系統のマインドマップと、その日の運動で系統ごとに貯まるポイント
// 保存先は docs テーブルの新しい区分（bodylog・bodypresets）だけ。既存のデータには書き込まない。
(function () {
  const SYS = [
    { k: "msk", n: "筋骨格系", s: "筋骨格", d: "体を支え、動かす。骨・関節・筋肉・腱など", c: ["骨", "関節・軟骨", "筋肉", "腱", "靭帯", "筋膜"] },
    { k: "nerv", n: "神経系", s: "神経", d: "動きを考え、組み立て、調整する。感覚の受け取りもここ", c: ["脳（運動の計画）", "小脳（タイミング・調整）", "脊髄・反射", "末梢神経", "固有感覚（関節・筋の位置感覚）", "前庭（バランス・回転）", "視覚"] },
    { k: "auto", n: "自律神経系", s: "自律神経", d: "意識しなくても体を整える。緊張とリラックスの切り替え", c: ["交感神経（活動モード）", "副交感神経（休息モード）", "心拍のゆらぎ", "睡眠・回復"] },
    { k: "cardio", n: "心肺系", s: "心肺", d: "酸素を取り込み、全身に届ける。心臓・血管・肺", c: ["心臓", "血管・血流", "肺・ガス交換", "呼吸筋（横隔膜など）", "持久力"] },
    { k: "meta", n: "代謝・エネルギー系", s: "代謝", d: "動くためのエネルギーをつくる", c: ["瞬発的なエネルギー（ATP-PCr）", "解糖系（短く強い運動）", "有酸素系（長い運動）", "糖の代謝", "脂肪の代謝"] },
    { k: "endo", n: "内分泌系", s: "内分泌", d: "ホルモンで体の働きを調整する", c: ["成長ホルモン", "テストステロン・エストロゲン", "コルチゾール（ストレス）", "インスリン", "甲状腺ホルモン"] },
    { k: "lymph", n: "リンパ・体液系", s: "リンパ", d: "体の水分を巡らせる。むくみとも関係", c: ["リンパの流れ", "静脈の戻り（筋ポンプ）", "細胞の外の水分", "むくみ"] },
    { k: "immune", n: "免疫系", s: "免疫", d: "体を守り、傷んだ組織を回復させる", c: ["炎症と回復", "感染への抵抗力", "白血球"] },
    { k: "thermo", n: "皮膚・体温調節系", s: "体温", d: "熱をつくり、逃がし、体温を保つ", c: ["発汗", "皮膚の血流", "熱をつくる（筋肉）", "暑さ・寒さへの慣れ"] },
    { k: "digest", n: "消化器系", s: "消化", d: "食べたものを分解し、吸収する", c: ["胃・腸の動き", "栄養の吸収", "肝臓", "腸内環境"] },
    { k: "urin", n: "泌尿器系", s: "泌尿器", d: "水分と老廃物を体の外に出す", c: ["腎臓", "水分のバランス", "骨盤底（排尿のコントロール）"] },
    { k: "repro", n: "生殖器系", s: "生殖器", d: "性ホルモンとも深く関わる", c: ["性ホルモン", "月経周期", "骨盤まわり"] },
  ];
  const SK = Object.fromEntries(SYS.map((x) => [x.k, x]));
  // 下書きの点数（1回分・0〜10）。向さんが自由に直せる。
  const PRESETS = [
    { id: "acro", name: "アクロバット", pts: { msk: 5, nerv: 8, cardio: 1 } },
    { id: "pilates", name: "ピラティス", pts: { msk: 5, nerv: 6, auto: 3, cardio: 1, urin: 1 } },
    { id: "frc", name: "FRC（モビリティ）", pts: { msk: 7, nerv: 5 } },
    { id: "strength", name: "筋トレ（重め）", pts: { msk: 8, nerv: 5, endo: 3, meta: 3, cardio: 2 } },
    { id: "jump", name: "ジャンプ・スプリント", pts: { msk: 6, nerv: 7, meta: 4, cardio: 3 } },
    { id: "run", name: "ランニング（ゆっくり長め）", pts: { cardio: 7, meta: 6, msk: 3, thermo: 3, lymph: 2 } },
    { id: "hiit", name: "HIIT（短く強く）", pts: { cardio: 8, meta: 8, msk: 4, endo: 3, thermo: 4 } },
    { id: "walk", name: "ウォーキング", pts: { cardio: 3, meta: 3, auto: 3, lymph: 3, msk: 2, digest: 1 } },
    { id: "swim", name: "水泳", pts: { cardio: 7, meta: 5, msk: 4, nerv: 3, thermo: 3 } },
    { id: "yoga", name: "ヨガ・ストレッチ", pts: { msk: 4, auto: 5, nerv: 3 } },
    { id: "breath", name: "呼吸エクササイズ", pts: { auto: 7, cardio: 4 } },
    { id: "sauna", name: "サウナ・入浴", pts: { thermo: 7, auto: 4, cardio: 3 } },
  ];

  let C = null;
  const D = { bodylog: [], bodypresets: [] }, got = {};
  const S = { sub: "today", date: today(), sel: null, range: 7, draft: null, msg: "", sure: null, busy: false, editPre: null };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function today(off = 0) { const d = new Date(); d.setDate(d.getDate() + off); return d.toLocaleDateString("sv-SE"); }
  const ready = () => got.bodylog && got.bodypresets;
  const can = () => !!(C && C.canEdit());

  // 保存された点数表があればそちら、なければ下書き
  function presets() {
    const saved = Object.fromEntries(D.bodypresets.map((x) => [x.id, x]));
    const base = PRESETS.filter((p) => !(saved[p.id] && saved[p.id].hidden)).map((p) => saved[p.id] ? { ...p, ...saved[p.id], edited: true } : p);
    const extra = D.bodypresets.filter((x) => !PRESETS.find((p) => p.id === x.id) && !x.hidden).map((x) => ({ ...x, custom: true }));
    return [...base, ...extra];
  }
  const entriesOn = (date) => D.bodylog.filter((x) => x.date === date).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  function sum(list) { const t = {}; for (const e of list) for (const [k, v] of Object.entries(e.pts || {})) if (SK[k]) t[k] = (t[k] || 0) + (+v || 0); return t; }
  function rangeEntries(days) { const from = today(-(days - 1)); return D.bodylog.filter((x) => x.date >= from && x.date <= today()); }
  const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); const w = "日月火水木金土"[new Date(+y, m - 1, +d).getDay()]; return `${+m}月${+d}日（${w}）`; };

  function listen() {
    for (const k of ["bodylog", "bodypresets"]) {
      C.db.collection(k).onSnapshot((snap) => { D[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); got[k] = true; if (C.active()) C.rerender(); },
        () => { got[k] = true; if (C.active()) C.rerender(); });
    }
  }

  // ---------- マインドマップ ----------
  function mindmap(pts, label) {
    const W = 420, cx = W / 2, cy = W / 2, R = 150, max = Math.max(10, ...Object.values(pts));
    const nodes = SYS.map((s, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / SYS.length;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), p = pts[s.k] || 0, r = 24 + (p / max) * 14;
      return { s, x, y, p, r, lv: p ? Math.min(4, 1 + Math.floor((p / max) * 3.999)) : 0 };
    });
    return `<svg class="bm-svg" viewBox="0 0 ${W} ${W}" role="img" aria-label="体の系統のマインドマップ">
      ${nodes.map((n) => `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" class="bm-ln ${n.p ? "on" : ""}" style="stroke-width:${1 + (n.p / max) * 4}"/>`).join("")}
      <circle cx="${cx}" cy="${cy}" r="46" class="bm-core"/>
      <text x="${cx}" y="${cy - 6}" class="bm-ct">からだ</text>
      <text x="${cx}" y="${cy + 14}" class="bm-cs">${esc(label)} ${total(pts)}点</text>
      ${nodes.map((n) => `<g class="bm-node lv${n.lv} ${S.sel === n.s.k ? "sel" : ""}" data-bm-sel="${n.s.k}" tabindex="0" role="button" aria-label="${esc(n.s.n)} ${n.p}点">
        <circle cx="${n.x}" cy="${n.y}" r="${n.r}"/>
        <text x="${n.x}" y="${n.y - (n.p ? 3 : -4)}" class="bm-nt">${esc(n.s.s)}</text>
        ${n.p ? `<text x="${n.x}" y="${n.y + 13}" class="bm-np">${n.p}</text>` : ""}</g>`).join("")}
    </svg>`;
  }
  // 選んだ系統の中身（子のマップ）
  function submap(k, list) {
    const s = SK[k], W = 360, H = 260, cx = W / 2, cy = H / 2, n = s.c.length;
    const kids = s.c.map((c, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return { c, x: cx + 128 * Math.cos(a), y: cy + 92 * Math.sin(a) }; });
    const from = list.filter((e) => (e.pts || {})[k]).map((e) => `${esc(e.name)} ${e.pts[k]}点`);
    return `<div class="bm-panel"><div class="bm-ph"><b>${esc(s.n)}</b><button type="button" class="linkish" data-bm-sel="${k}">閉じる</button></div>
      <p class="hint">${esc(s.d)}</p>
      <svg class="bm-sub" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        ${kids.map((q) => `<line x1="${cx}" y1="${cy}" x2="${q.x}" y2="${q.y}" class="bm-ln on"/>`).join("")}
        <ellipse cx="${cx}" cy="${cy}" rx="52" ry="24" class="bm-core"/><text x="${cx}" y="${cy + 5}" class="bm-st">${esc(s.s)}</text>
        ${kids.map((q) => `<g class="bm-kid">${wrapText(q.c, q.x, q.y)}</g>`).join("")}
      </svg>
      <p class="bm-from">${from.length ? "この期間に働いた運動：" + from.join("、") : "この期間、この系統に入ったポイントはありません。"}</p></div>`;
  }
  function wrapText(t, x, y) {
    const m = t.match(/^(.*?)（(.*)）$/), a = m ? m[1] : t, b = m ? m[2] : "";
    const w = Math.max(a.length, b.length * 0.8) * 12 + 18, h = b ? 36 : 24;
    return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8"/><text x="${x}" y="${y + (b ? -3 : 4)}" class="bm-kt">${esc(a)}</text>${b ? `<text x="${x}" y="${y + 12}" class="bm-ks">${esc(b)}</text>` : ""}`;
  }

  function bars(pts) {
    const max = Math.max(1, ...Object.values(pts));
    return `<div class="bm-bars">${SYS.map((s) => { const p = pts[s.k] || 0; return `<div class="bm-bar ${p ? "" : "zero"}"><span>${esc(s.n)}</span><i><b style="width:${(p / max) * 100}%"></b></i><em>${p}</em></div>`; }).join("")}</div>`;
  }

  // ---------- 今日の記録 ----------
  function viewToday() {
    const list = entriesOn(S.date), pts = sum(list);
    return `<div class="bm-page">
      <div class="bm-day"><button type="button" class="btn ghost small" data-bm-day="-1" aria-label="前の日">‹</button><b>${S.date === today() ? "今日 " : ""}${fmtDate(S.date)}</b><button type="button" class="btn ghost small" data-bm-day="1" aria-label="次の日" ${S.date >= today() ? "disabled" : ""}>›</button></div>
      ${mindmap(pts, S.date === today() ? "今日" : "この日")}
      ${S.sel ? submap(S.sel, list) : `<p class="hint bm-c">丸を押すと、その系統の中身が出ます。ポイントが多い系統ほど、丸が大きく濃くなります。</p>`}
      <div class="ls-mhead"><h3>この日の運動 ${list.length}件</h3>${can() && !S.draft ? `<button type="button" class="btn primary small" data-bm-a="new">＋ 運動を記録</button>` : ""}</div>
      ${S.draft ? form() : ""}
      ${list.length ? list.map(entry).join("") : `<div class="empty">まだ記録がありません。${can() ? "「＋ 運動を記録」から入れてください。" : ""}</div>`}
    </div>`;
  }
  function entry(e) {
    const ps = Object.entries(e.pts || {}).filter(([k, v]) => SK[k] && v).sort((a, b) => b[1] - a[1]);
    return `<article class="card bm-entry"><div class="bm-eh"><h3>${esc(e.name)}</h3>${e.min ? `<span class="hint">${esc(e.min)}分</span>` : ""}<span class="bm-tot">${total(sum([e]))}点</span></div>
      <div class="bm-pts">${ps.map(([k, v]) => `<span class="bm-pt">${esc(SK[k].s)} <b>${v}</b></span>`).join("")}</div>
      ${e.memo ? `<div class="ls-notes">${esc(e.memo).replace(/\n/g, "<br>")}</div>` : ""}
      ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-bm-edit="${esc(e.id)}">直す</button></div>` : ""}</article>`;
  }
  function form() {
    const d = S.draft, ps = presets();
    return `<div class="ls-form bm-form"><h3>${d.id ? "記録を直す" : "運動を記録"}</h3>
      ${d.id ? "" : `<div class="f"><span>① 運動を選ぶ（点数が自動で入ります）</span><div class="chips">${ps.map((p) => `<button type="button" class="chip" data-bm-pre="${esc(p.id)}" aria-pressed="${d.pre === p.id}">${esc(p.name)}</button>`).join("")}<button type="button" class="chip" data-bm-pre="" aria-pressed="${d.pre === ""}">その他（自分で入れる）</button></div></div>`}
      <label class="f"><span>運動の名前</span><input data-bm-f="name" value="${esc(d.name)}" placeholder="例：バク転の練習"></label>
      <label class="f"><span>時間（分・なくても大丈夫）</span><input data-bm-f="min" inputmode="numeric" value="${esc(d.min)}"></label>
      <div class="f"><span>② 系統ごとのポイント（−と＋で直せます。0〜10）</span>
        <div class="bm-steps">${SYS.map((s) => { const v = d.pts[s.k] || 0; return `<div class="bm-step ${v ? "on" : ""}"><span>${esc(s.n)}</span><button type="button" data-bm-step="${s.k}" data-v="-1" aria-label="${esc(s.n)}を1減らす">−</button><b>${v}</b><button type="button" data-bm-step="${s.k}" data-v="1" aria-label="${esc(s.n)}を1増やす">＋</button></div>`; }).join("")}</div>
        <span class="hint">合計 ${total(d.pts)}点</span></div>
      <label class="f"><span>メモ</span><textarea rows="2" data-bm-f="memo">${esc(d.memo)}</textarea></label>
      ${d.id ? "" : `<label class="bm-keep"><input type="checkbox" data-bm-keep ${d.keep ? "checked" : ""}> この運動と点数を、次からも選べるようにする</label>`}
      <div class="acts"><button type="button" class="btn ghost" data-bm-a="cancel">やめる</button>${d.id ? `<button type="button" class="btn ghost" data-bm-a="del">${S.sure === d.id ? "本当に削除する" : "削除"}</button>` : ""}<button type="button" class="btn primary" data-bm-a="save" ${S.busy ? "disabled" : ""}>保存</button></div></div>`;
  }

  // ---------- マップだけ（期間） ----------
  function viewMap() {
    const list = rangeEntries(S.range), pts = sum(list);
    return `<div class="bm-page">
      <div class="chips bm-c">${[[1, "今日"], [7, "この7日"], [30, "この30日"]].map(([n, t]) => `<button type="button" class="chip" data-bm-range="${n}" aria-pressed="${S.range === n}">${t}</button>`).join("")}</div>
      ${mindmap(pts, S.range === 1 ? "今日" : `${S.range}日`)}
      ${S.sel ? submap(S.sel, list) : `<p class="hint bm-c">丸を押すと、その系統の中身（骨・関節・筋肉など）が出ます。</p>`}
    </div>`;
  }

  // ---------- 振り返り ----------
  function viewReview() {
    const list = rangeEntries(S.range), pts = sum(list);
    const zero = SYS.filter((s) => !pts[s.k] && !["urin", "repro", "digest", "immune"].includes(s.k));
    const days = []; for (let i = S.range - 1; i >= 0 && S.range <= 7; i--) days.push(today(-i));
    return `<div class="bm-page">
      <div class="chips">${[[7, "この7日"], [30, "この30日"]].map(([n, t]) => `<button type="button" class="chip" data-bm-range="${n}" aria-pressed="${S.range === n}">${t}</button>`).join("")}</div>
      <p class="hint">${list.length}件の運動で、合計 ${total(pts)}点です。</p>
      ${bars(pts)}
      ${list.length && zero.length ? `<p class="ls-note">この期間、${zero.map((s) => s.n).join("・")}にはポイントが入っていません。足りていないところを足すきっかけにしてみてはいかがでしょうか？</p>` : ""}
      ${days.length ? `<div class="bm-week">${days.map((d) => { const t = total(sum(entriesOn(d))); return `<button type="button" data-bm-go="${d}"><span>${fmtDate(d).replace(/^\d+月/, "")}</span><b>${t}</b></button>`; }).join("")}</div><p class="hint">日にちを押すと、その日の記録が開きます。</p>` : ""}
    </div>`;
  }

  // ---------- 点数表 ----------
  function viewTable() {
    const ps = presets(), e = S.editPre;
    return `<div class="bm-page">
      <p class="ls-note">点数は Claude が作った下書きです（1回・30〜60分くらいを想定）。研究で決まった数字ではないので、向さんの感覚に合わせて直してください。</p>
      ${e ? `<div class="ls-form"><h3>「${esc(e.name)}」の点数を直す</h3>
        <label class="f"><span>運動の名前</span><input data-bm-pf="name" value="${esc(e.name)}"></label>
        <div class="bm-steps">${SYS.map((s) => { const v = e.pts[s.k] || 0; return `<div class="bm-step ${v ? "on" : ""}"><span>${esc(s.n)}</span><button type="button" data-bm-pstep="${s.k}" data-v="-1">−</button><b>${v}</b><button type="button" data-bm-pstep="${s.k}" data-v="1">＋</button></div>`; }).join("")}</div>
        <div class="acts"><button type="button" class="btn ghost" data-bm-a="pcancel">やめる</button><button type="button" class="btn ghost" data-bm-a="phide">${S.sure === "p:" + e.id ? "本当に一覧から外す" : "一覧から外す"}</button><button type="button" class="btn primary" data-bm-a="psave">保存</button></div></div>` : ""}
      ${ps.map((p) => `<article class="card bm-entry"><div class="bm-eh"><h3>${esc(p.name)}</h3>${p.custom ? `<span class="ls-tag">自分で追加</span>` : p.edited ? `<span class="ls-tag">直した</span>` : `<span class="ls-tag">下書き</span>`}<span class="bm-tot">${total(p.pts || {})}点</span></div>
        <div class="bm-pts">${Object.entries(p.pts || {}).filter(([k, v]) => SK[k] && v).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="bm-pt">${esc(SK[k].s)} <b>${v}</b></span>`).join("")}</div>
        ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-bm-pedit="${esc(p.id)}">点数を直す</button></div>` : ""}</article>`).join("")}
    </div>`;
  }

  function render(L) {
    if (!C.db) { L.innerHTML = `<div class="empty">書庫に接続できません。</div>`; return; }
    if (!ready()) { L.innerHTML = `<div class="empty">体のマップを読み込んでいます…</div>`; return; }
    const tabs = [["today", "日ごとの記録"], ["map", "マップ"], ["review", "振り返り"], ["table", "運動の点数表"]];
    L.innerHTML = `<div id="bodymap">
      ${S.msg ? `<div class="at-msg">${esc(S.msg)}<button type="button" class="linkish" data-bm-a="msgoff">閉じる</button></div>` : ""}
      <div class="ls-tabs">${tabs.map(([k, n]) => `<button type="button" data-bm-sub="${k}" aria-pressed="${S.sub === k}">${esc(n)}</button>`).join("")}</div>
      ${S.sub === "today" ? viewToday() : S.sub === "map" ? viewMap() : S.sub === "review" ? viewReview() : viewTable()}</div>`;
  }

  const clamp = (v) => Math.max(0, Math.min(10, v));
  async function saveEntry() {
    const d = S.draft;
    if (!String(d.name || "").trim()) { S.msg = "運動の名前を入れてください。"; C.rerender(); return; }
    S.busy = true; C.rerender();
    const id = d.id || uid(), t = new Date().toISOString();
    const pts = Object.fromEntries(Object.entries(d.pts).filter(([k, v]) => SK[k] && v));
    const data = { date: d.date, name: d.name.trim(), pre: d.pre || "", pts, min: String(d.min || "").trim(), memo: d.memo || "", createdAt: d.createdAt || t, updatedAt: t };
    try {
      await C.db.collection("bodylog").doc(id).set(data);
      if (d.keep && !d.id) await C.db.collection("bodypresets").doc("c" + uid()).set({ name: data.name, pts, updatedAt: t });
      S.draft = null; S.msg = "保存しました。";
    } catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.busy = false; C.rerender();
  }
  async function savePreset(hide) {
    const e = S.editPre;
    const data = { name: String(e.name || "").trim() || "（名前なし）", pts: Object.fromEntries(Object.entries(e.pts).filter(([k, v]) => SK[k] && v)), updatedAt: new Date().toISOString() };
    if (hide) data.hidden = true;
    try { await C.db.collection("bodypresets").doc(e.id).set(data); S.editPre = null; S.msg = hide ? "一覧から外しました（記録はそのまま残ります）。" : "点数表を保存しました。"; }
    catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.sure = null; C.rerender();
  }

  function bind() {
    document.addEventListener("click", async (ev) => {
      if (!C.active() || !ev.target.closest("#bodymap")) return;
      const t = (s) => ev.target.closest(s);
      let b;
      if ((b = t("[data-bm-sub]"))) { S.sub = b.dataset.bmSub; S.sel = null; S.draft = null; S.editPre = null; C.rerender(); return; }
      if ((b = t("[data-bm-sel]"))) { S.sel = S.sel === b.dataset.bmSel ? null : b.dataset.bmSel; C.rerender(); return; }
      if ((b = t("[data-bm-day]"))) { const [y, m, d] = S.date.split("-").map(Number); const x = new Date(y, m - 1, d + +b.dataset.bmDay); const s = x.toLocaleDateString("sv-SE"); if (s <= today()) { S.date = s; S.draft = null; } C.rerender(); return; }
      if ((b = t("[data-bm-range]"))) { S.range = +b.dataset.bmRange; C.rerender(); return; }
      if ((b = t("[data-bm-go]"))) { S.date = b.dataset.bmGo; S.sub = "today"; S.sel = null; C.rerender(); return; }
      if ((b = t("[data-bm-pre]")) && S.draft) {
        const id = b.dataset.bmPre, p = presets().find((x) => x.id === id);
        S.draft.pre = id;
        if (p) { S.draft.name = p.name; S.draft.pts = { ...(p.pts || {}) }; S.draft.keep = false; } else { S.draft.name = ""; S.draft.pts = {}; }
        C.rerender(); return;
      }
      if ((b = t("[data-bm-step]")) && S.draft) { const k = b.dataset.bmStep; S.draft.pts[k] = clamp((S.draft.pts[k] || 0) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-pstep]")) && S.editPre) { const k = b.dataset.bmPstep; S.editPre.pts[k] = clamp((S.editPre.pts[k] || 0) + +b.dataset.v); C.rerender(); return; }
      if ((b = t("[data-bm-edit]"))) { const x = D.bodylog.find((y) => y.id === b.dataset.bmEdit); if (x) { S.draft = JSON.parse(JSON.stringify({ ...x, pts: x.pts || {} })); S.sure = null; C.rerender(); document.querySelector(".bm-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-bm-pedit]"))) { const p = presets().find((x) => x.id === b.dataset.bmPedit); if (p) { S.editPre = { id: p.id, name: p.name, pts: { ...(p.pts || {}) } }; S.sure = null; C.rerender(); document.querySelector("#bodymap .ls-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-bm-a]"))) {
        const a = b.dataset.bmA;
        if (a === "msgoff") S.msg = "";
        if (a === "new") { S.draft = { date: S.date, name: "", pre: null, pts: {}, min: "", memo: "", keep: false }; S.sure = null; }
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
    document.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && C.active() && ev.target.closest?.("#bodymap [data-bm-sel]")) { ev.preventDefault(); ev.target.closest("[data-bm-sel]").dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
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
.bm-svg{width:100%;max-width:460px;justify-self:center;display:block}
.bm-ln{stroke:var(--line);stroke-width:1}
.bm-ln.on{stroke:var(--teal);opacity:.55}
.bm-core{fill:var(--ink);stroke:none}
.bm-ct{fill:var(--paper);font-size:17px;font-weight:700;text-anchor:middle}
.bm-cs{fill:var(--paper);font-size:11.5px;text-anchor:middle;opacity:.85}
.bm-st{fill:var(--paper);font-size:14px;font-weight:700;text-anchor:middle}
.bm-node{cursor:pointer}
.bm-node circle{fill:var(--surface);stroke:var(--line);stroke-width:1.5}
.bm-node.lv1 circle{fill:color-mix(in srgb,var(--teal) 15%,var(--surface));stroke:var(--teal)}
.bm-node.lv2 circle{fill:color-mix(in srgb,var(--teal) 35%,var(--surface));stroke:var(--teal)}
.bm-node.lv3 circle{fill:color-mix(in srgb,var(--teal) 65%,var(--surface));stroke:var(--teal)}
.bm-node.lv4 circle{fill:var(--teal);stroke:var(--teal)}
.bm-node.sel circle{stroke:var(--ink);stroke-width:3}
.bm-nt{font-size:12.5px;font-weight:700;text-anchor:middle;fill:var(--ink)}
.bm-np{font-size:12px;text-anchor:middle;fill:var(--ink-2);font-family:var(--mono)}
.bm-node.lv3 .bm-nt,.bm-node.lv4 .bm-nt,.bm-node.lv3 .bm-np,.bm-node.lv4 .bm-np{fill:#fff}
.bm-node:focus{outline:none}.bm-node:focus circle{stroke:var(--ink);stroke-width:3}
.bm-panel{background:var(--surface);border:1px solid var(--teal);border-radius:10px;padding:12px 14px;display:grid;gap:6px}
.bm-ph{display:flex;justify-content:space-between;align-items:center}
.bm-ph b{font-size:15px}
.bm-panel .hint{margin:0}
.bm-sub{width:100%;max-width:420px;justify-self:center}
.bm-kid rect{fill:var(--paper);stroke:var(--teal);stroke-width:1.2}
.bm-kt{font-size:12px;text-anchor:middle;fill:var(--ink);font-weight:600}
.bm-ks{font-size:9.5px;text-anchor:middle;fill:var(--ink-3)}
.bm-from{margin:0;font-size:13px;color:var(--ink-2)}
.bm-entry{display:grid;gap:6px}
.bm-eh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.bm-eh h3{margin:0;font-size:15px;flex:1 1 auto}
.bm-tot{font-family:var(--mono);font-size:13px;color:var(--teal);font-weight:700}
.bm-pts{display:flex;gap:5px;flex-wrap:wrap}
.bm-pt{font-size:12px;border:1px solid var(--teal);color:var(--teal);border-radius:4px;padding:1px 7px;background:var(--surface)}
.bm-pt b{font-family:var(--mono)}
.bm-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}
.bm-step{display:grid;grid-template-columns:1fr 34px 28px 34px;align-items:center;gap:4px;font-size:13.5px;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:4px 6px 4px 10px}
.bm-step.on{border-color:var(--teal);background:var(--teal-soft)}
.bm-step button{font:inherit;font-size:17px;line-height:1;height:32px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.bm-step b{text-align:center;font-family:var(--mono)}
.bm-keep{display:flex;gap:6px;align-items:center;font-size:13.5px}
.bm-bars{display:grid;gap:6px}
.bm-bar{display:grid;grid-template-columns:8.5em 1fr 2.5em;gap:8px;align-items:center;font-size:13px}
.bm-bar i{height:12px;background:var(--sunk);border-radius:6px;overflow:hidden;display:block}
.bm-bar i b{display:block;height:100%;background:var(--teal);border-radius:6px}
.bm-bar em{font-style:normal;font-family:var(--mono);text-align:right}
.bm-bar.zero{color:var(--ink-3)}
.bm-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.bm-week button{font:inherit;display:grid;gap:2px;justify-items:center;padding:6px 2px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;color:var(--ink)}
.bm-week span{font-size:11px;color:var(--ink-3)}
.bm-week b{font-family:var(--mono);font-size:14px}
`;

  window.BodyMap = {
    init(ctx) { C = ctx; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); bind(); listen(); },
    render(L) { render(L); },
    count() { return ready() ? total(sum(entriesOn(today()))) : null; },
  };
})();

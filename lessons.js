// レッスン：トレーニングの成長ロードマップと、方法ごとのレッスン
// 保存先は docs テーブルの新しい区分（lessons・lessonmap）だけ。既存のデータには書き込まない。
(function () {
  // 上から順に：大きいところ → 土台
  const LAYERS = [
    { key: "L4", name: "競技スキル", desc: "その競技・種目で求められる専門の動き", abilities: [["skill", "競技スキル"]] },
    { key: "L3", name: "日常動作・レクリエーション動作", desc: "立つ・歩く・持ち上げる・遊ぶ・趣味の運動", abilities: [["daily", "日常動作"], ["rec", "レクリエーション動作"]] },
    { key: "L2", name: "それを遂行する力", desc: "動作をやり切るための出力", abilities: [["str", "筋力"], ["pow", "パワー"], ["spd", "瞬発力"]] },
    { key: "L1", name: "土台力", desc: "整ったアトラクター（安定した動きのパターン）と、フラクチュエーター（ゆらぎ・変化）に適応できる能力", abilities: [["mob", "モビリティ"], ["stab", "スタビリティ"], ["env", "環境適応能力"], ["cog", "認知機能"], ["ctrl", "コントロール力"]] },
    { key: "L0", name: "体の状態（前提）", desc: "痛み・けが・病気がトレーニングの妨げにならない状態", abilities: [["pain", "痛み・けがの回復"], ["medical", "病気の診断と治療"]], extra: true },
  ];
  const AB = Object.fromEntries(LAYERS.flatMap((l) => l.abilities.map(([k, n]) => [k, { name: n, layer: l.key }])));
  const METHODS = [
    { key: "pilates", name: "ピラティス" },
    { key: "frc", name: "FRC" },
    { key: "frsc", name: "FRSC" },
    { key: "movement", name: "その他ムーブメント" },
    { key: "manual", name: "徒手" },
    { key: "treatment", name: "治療行為", scope: "資格者（理学療法士・柔道整復師など）が行う領域です。指導者は、つなぐ判断に使います。" },
    { key: "medical", name: "医療行為", scope: "医師などが行う領域です。指導者は、受診をすすめる判断に使います。" },
  ];
  // 下書きの当てはまり度（2＝主に働く、1＝一部働く）。向さんが自由に直せる。
  const DEFAULT_MAP = {
    pilates: { ctrl: 2, stab: 2, mob: 1, cog: 1, daily: 1, str: 1, pain: 1 },
    frc: { mob: 2, ctrl: 2, stab: 1, str: 1 },
    frsc: {},
    movement: { daily: 2, rec: 2, env: 2, cog: 1, ctrl: 1, skill: 1, pow: 1, spd: 1 },
    manual: { pain: 2, mob: 1 },
    treatment: { pain: 2 },
    medical: { medical: 2, pain: 1 },
  };

  let C = null;
  const D = { lessons: [], lessonmap: [] }, got = {};
  const S = { sub: "map", method: "pilates", layer: null, draft: null, msg: "", busy: false };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const uid = () => "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const can = () => !!(C && C.canEdit());
  const ready = () => got.lessons && got.lessonmap;
  const mapOf = (m) => { const d = D.lessonmap.find((x) => x.id === m); return d ? (d.fit || {}) : (DEFAULT_MAP[m] || {}); };
  const isDraftMap = (m) => !D.lessonmap.find((x) => x.id === m);
  const lessonsOf = (m) => D.lessons.filter((x) => x.method === m).sort((a, b) => String(a.title).localeCompare(String(b.title), "ja"));
  const methodName = (k) => (METHODS.find((m) => m.key === k) || {}).name || k;

  function listen() {
    for (const k of ["lessons", "lessonmap"]) {
      C.db.collection(k).onSnapshot((snap) => { D[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); got[k] = true; if (C.active()) C.rerender(); },
        () => { got[k] = true; if (C.active()) C.rerender(); });
    }
  }

  // ---------- ロードマップ ----------
  function roadmap(method, opts = {}) {
    const fit = method ? mapOf(method) : null;
    const all = !method;
    return `<div class="ls-map">${LAYERS.map((l, i) => {
      const width = 56 + i * 11;
      const chips = l.abilities.map(([k, n]) => {
        if (all) {
          const ms = METHODS.filter((m) => mapOf(m.key)[k]).map((m) => `<span class="ls-mtag f${mapOf(m.key)[k]}">${esc(m.name)}</span>`).join("");
          return `<div class="ls-ab"><b>${esc(n)}</b><div class="ls-mtags">${ms || `<span class="hint">まだ当てはまる方法がありません</span>`}</div></div>`;
        }
        const f = fit[k] || 0;
        const n2 = lessonsOf(method).filter((x) => arr(x.abilities).includes(k)).length;
        return `<button type="button" class="ls-chip f${f}" ${opts.edit ? `data-ls-fit="${k}"` : `data-ls-ab="${k}"`} title="${f === 2 ? "主に働く" : f === 1 ? "一部働く" : "あまり働かない"}">${esc(n)}${n2 ? `<small>${n2}</small>` : ""}</button>`;
      }).join("");
      const lv = method ? Math.max(0, ...l.abilities.map(([k]) => fit[k] || 0)) : 0;
      return `<section class="ls-layer ${l.extra ? "extra" : ""} ${method ? "lv" + lv : ""}" style="--w:${width}%">
        <div class="ls-lh"><b>${esc(l.name)}</b><span class="hint">${esc(l.desc)}</span>${l.extra ? `<span class="ls-tag">運動の前提</span>` : ""}</div>
        <div class="ls-chips ${all ? "all" : ""}">${chips}</div></section>`;
    }).join("")}
    <div class="ls-legend">${all ? `<span class="ls-mtag f2">主に働く</span><span class="ls-mtag f1">一部働く</span>` : `<span class="ls-chip f2 sm">主に働く</span><span class="ls-chip f1 sm">一部働く</span><span class="ls-chip f0 sm">あまり働かない</span>`}<span class="hint">上ほど専門的、下ほど土台です。</span></div></div>`;
  }

  function viewMap() {
    const m = S.method === "all" ? null : S.method;
    return `<div class="ls-page">
      <p class="hint">トレーニングの成長ロードマップです。上のタブで方法を選ぶと、その方法がロードマップのどこに働くかが色で出ます。</p>
      <div class="chips ls-mtabs"><button type="button" class="chip" data-ls-method="all" aria-pressed="${!m}">すべての方法</button>${METHODS.map((x) => `<button type="button" class="chip" data-ls-method="${x.key}" aria-pressed="${m === x.key}">${esc(x.name)}</button>`).join("")}</div>
      ${m && isDraftMap(m) ? `<p class="ls-note">${m === "frsc" ? "FRSCの当てはまりはまだ設定されていません。" : "この当てはまりは Claude が作った下書きです。"}${can() ? "「" + esc(methodName(m)) + "」のタブで直せます。" : ""}</p>` : ""}
      ${m && METHODS.find((x) => x.key === m).scope ? `<p class="ls-note scope">${esc(METHODS.find((x) => x.key === m).scope)}</p>` : ""}
      ${roadmap(m)}
      ${m ? `<p class="hint">能力の名前を押すと、その能力に当てはまる「${esc(methodName(m))}」のレッスンが出ます。</p>${S.layer ? abilityList(m, S.layer) : ""}` : ""}
    </div>`;
  }
  function abilityList(m, ab) {
    const xs = lessonsOf(m).filter((x) => arr(x.abilities).includes(ab));
    return `<div class="ls-sub"><h3>${esc(methodName(m))} × ${esc(AB[ab].name)}</h3>${xs.length ? xs.map(card).join("") : `<p class="hint">まだレッスンがありません。</p>`}</div>`;
  }

  // ---------- 方法ごとのタブ ----------
  function card(x) {
    return `<article class="card ls-card"><div class="top"><span class="kind">${esc(methodName(x.method))}</span><h3>${esc(x.title)}</h3></div>
      ${x.purpose ? `<p class="finding">${esc(x.purpose)}</p>` : ""}
      <div class="tags">${arr(x.abilities).filter((k) => AB[k]).map((k) => `<span class="tag">${esc(AB[k].name)}</span>`).join("")}</div>
      ${x.target ? `<div class="hint">対象：${esc(x.target)}</div>` : ""}
      ${x.notes ? `<div class="ls-notes">${esc(x.notes).replace(/\n/g, "<br>")}</div>` : ""}
      ${can() ? `<div class="rowacts"><button type="button" class="btn ghost small" data-ls-edit="${esc(x.id)}">編集</button></div>` : ""}</article>`;
  }
  function viewMethod(m) {
    const meta = METHODS.find((x) => x.key === m), xs = lessonsOf(m);
    const q = (C.q() || "").trim().toLowerCase();
    const list = q ? xs.filter((x) => [x.title, x.purpose, x.notes, x.target].join(" ").toLowerCase().includes(q)) : xs;
    return `<div class="ls-page">
      ${meta.scope ? `<p class="ls-note scope">${esc(meta.scope)}</p>` : ""}
      <div class="ls-mhead"><h3>ロードマップでの位置</h3>${can() ? `<span class="hint">能力の名前を押すたびに「主に働く → 一部働く → あまり働かない」と切り替わります。</span>` : ""}</div>
      ${isDraftMap(m) ? `<p class="ls-note">${m === "frsc" ? "まだ設定されていません。能力の名前を押して設定してください。" : "Claude が作った下書きです。向さんの考えに合わせて直してください。"}</p>` : ""}
      ${roadmap(m, { edit: can() })}
      <div class="ls-mhead"><h3>レッスン ${xs.length}件</h3>${can() ? `<button type="button" class="btn primary small" data-ls-new="${m}">＋ レッスンを追加</button>` : ""}</div>
      ${S.draft ? form() : ""}
      ${list.length ? list.map(card).join("") : `<div class="empty">${q ? "一致するレッスンがありません。" : "まだレッスンがありません。"}</div>`}
    </div>`;
  }
  function form() {
    const d = S.draft;
    return `<div class="ls-form"><h3>${d.id ? "レッスンを編集" : "レッスンを追加"}（${esc(methodName(d.method))}）</h3>
      <label class="f"><span>名前</span><input data-ls-f="title" value="${esc(d.title)}" placeholder="例：ハンドレッド、CARs、ヒップの90/90"></label>
      <label class="f"><span>目的・ねらい</span><textarea rows="2" data-ls-f="purpose">${esc(d.purpose)}</textarea></label>
      <div class="f"><span>ロードマップのどこに働くか（いくつでも）</span><div class="ls-pick">${LAYERS.map((l) => `<div><b>${esc(l.name)}</b>${l.abilities.map(([k, n]) => `<label><input type="checkbox" data-ls-ab-pick="${k}" ${arr(d.abilities).includes(k) ? "checked" : ""}> ${esc(n)}</label>`).join("")}</div>`).join("")}</div></div>
      <label class="f"><span>対象（どんな人・状態に）</span><input data-ls-f="target" value="${esc(d.target)}"></label>
      <label class="f"><span>メモ（強度・回数・声かけなど）</span><textarea rows="3" data-ls-f="notes">${esc(d.notes)}</textarea></label>
      <div class="acts"><button type="button" class="btn ghost" data-ls-a="cancel">やめる</button>${d.id ? `<button type="button" class="btn ghost" data-ls-a="del">${S.sure ? "本当に削除する" : "削除"}</button>` : ""}<button type="button" class="btn primary" data-ls-a="save" ${S.busy ? "disabled" : ""}>保存</button></div></div>`;
  }

  function render(L) {
    if (!C.db) { L.innerHTML = `<div class="empty">書庫に接続できません。</div>`; return; }
    if (!ready()) { L.innerHTML = `<div class="empty">レッスンを読み込んでいます…</div>`; return; }
    const tabs = [["map", "ロードマップ"], ...METHODS.map((m) => [m.key, m.name])];
    L.innerHTML = `<div id="lessons">
      ${S.msg ? `<div class="at-msg">${esc(S.msg)}<button type="button" class="linkish" data-ls-a="msgoff">閉じる</button></div>` : ""}
      <div class="ls-tabs">${tabs.map(([k, n]) => `<button type="button" data-ls-sub="${k}" aria-pressed="${S.sub === k}">${esc(n)}${k !== "map" ? `<span>${lessonsOf(k).length}</span>` : ""}</button>`).join("")}</div>
      ${S.sub === "map" ? viewMap() : viewMethod(S.sub)}</div>`;
  }

  async function saveFit(m, k) {
    const fit = { ...mapOf(m) }; fit[k] = ((fit[k] || 0) + 2) % 3; if (!fit[k]) delete fit[k];
    const prev = D.lessonmap.find((x) => x.id === m);
    if (prev) prev.fit = fit; else D.lessonmap.push({ id: m, fit });
    C.rerender();
    try { await C.db.collection("lessonmap").doc(m).set({ fit, updatedAt: new Date().toISOString() }); } catch { S.msg = "保存できませんでした。通信を確かめてください。"; C.rerender(); }
  }
  async function saveLesson() {
    const d = S.draft; if (!String(d.title || "").trim()) { S.msg = "名前を入れてください。"; C.rerender(); return; }
    S.busy = true; C.rerender();
    const id = d.id || uid(), t = new Date().toISOString();
    const data = { method: d.method, title: d.title.trim(), purpose: d.purpose || "", abilities: arr(d.abilities), target: d.target || "", notes: d.notes || "", updatedAt: t, createdAt: d.createdAt || t };
    try { await C.db.collection("lessons").doc(id).set(data); S.draft = null; S.msg = "保存しました。"; }
    catch { S.msg = "保存できませんでした。通信を確かめてください。"; }
    S.busy = false; C.rerender();
  }

  function bind() {
    document.addEventListener("click", async (e) => {
      if (!C.active() || !e.target.closest("#lessons")) return;
      const t = (s) => e.target.closest(s);
      let b;
      if ((b = t("[data-ls-sub]"))) { S.sub = b.dataset.lsSub; S.layer = null; S.draft = null; C.rerender(); return; }
      if ((b = t("[data-ls-method]"))) { S.method = b.dataset.lsMethod; S.layer = null; C.rerender(); return; }
      if ((b = t("[data-ls-ab]"))) { S.layer = S.layer === b.dataset.lsAb ? null : b.dataset.lsAb; C.rerender(); return; }
      if ((b = t("[data-ls-fit]")) && can()) { await saveFit(S.sub, b.dataset.lsFit); return; }
      if ((b = t("[data-ls-new]"))) { S.draft = { method: b.dataset.lsNew, title: "", purpose: "", abilities: [], target: "", notes: "" }; S.sure = false; C.rerender(); return; }
      if ((b = t("[data-ls-edit]"))) { const x = D.lessons.find((y) => y.id === b.dataset.lsEdit); if (x) { S.draft = JSON.parse(JSON.stringify(x)); S.sure = false; C.rerender(); document.querySelector(".ls-form")?.scrollIntoView({ block: "start" }); } return; }
      if ((b = t("[data-ls-a]"))) {
        const a = b.dataset.lsA;
        if (a === "msgoff") S.msg = "";
        if (a === "cancel") S.draft = null;
        if (a === "save") { await saveLesson(); return; }
        if (a === "del") {
          if (!S.sure) { S.sure = true; C.rerender(); return; }
          try { await C.db.collection("lessons").doc(S.draft.id).delete(); S.draft = null; S.msg = "削除しました。"; } catch { S.msg = "削除できませんでした。"; }
        }
        C.rerender();
      }
    });
    document.addEventListener("input", (e) => {
      if (!C.active() || !S.draft) return;
      const el = e.target;
      if (el.dataset.lsF) S.draft[el.dataset.lsF] = el.value;
      if (el.dataset.lsAbPick) { const k = el.dataset.lsAbPick, s = new Set(arr(S.draft.abilities)); if (el.checked) s.add(k); else s.delete(k); S.draft.abilities = [...s]; }
    });
  }

  const CSS = `
#lessons{display:grid;gap:12px}
.ls-tabs{display:flex;flex-wrap:wrap;gap:6px}
.ls-tabs button{white-space:nowrap;flex:0 0 auto;writing-mode:horizontal-tb;font:inherit;font-size:13.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);cursor:pointer}
.ls-tabs button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.ls-tabs button span{font-family:var(--mono);font-size:11px;margin-left:5px;opacity:.75}
.ls-page{display:grid;gap:12px}
.ls-mtabs{margin:0}
.ls-note{margin:0;font-size:13.5px;padding:8px 12px;border-radius:8px;background:var(--amber-soft);color:var(--amber)}
.ls-note.scope{background:var(--sunk);color:var(--ink-2)}
.ls-map{display:grid;gap:6px;justify-items:center}
.ls-layer{width:min(100%,var(--w));min-width:min(100%,300px);background:var(--surface);border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;display:grid;gap:8px}
.ls-layer.extra{border-style:dashed;background:var(--sunk)}
.ls-layer.lv2{border-color:var(--teal)}
.ls-layer.lv1{border-color:color-mix(in srgb,var(--teal) 45%,var(--line))}
.ls-lh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.ls-lh b{font-size:15px}
.ls-lh .hint{flex:1 1 200px;min-width:0}
.ls-tag{font-size:11px;border:1px solid var(--line);border-radius:4px;padding:0 6px;color:var(--ink-3)}
.ls-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.ls-chips.all{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));justify-content:stretch}
.ls-chip{font:inherit;font-size:13.5px;padding:5px 12px;border-radius:999px;border:1.5px solid var(--line);background:var(--paper);color:var(--ink-3);cursor:pointer}
.ls-chip small{font-family:var(--mono);font-size:10.5px;margin-left:5px;opacity:.8}
.ls-chip.f1{background:var(--teal-soft);border-color:var(--teal);color:var(--teal)}
.ls-chip.f2{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:700}
.ls-chip.sm{font-size:11.5px;padding:1px 9px;cursor:default}
.ls-ab{display:grid;gap:4px;background:var(--paper);border-radius:8px;padding:8px 10px}
.ls-ab b{font-size:13.5px}
.ls-mtags{display:flex;gap:4px;flex-wrap:wrap}
.ls-mtag{font-size:11.5px;border-radius:4px;padding:0 7px;border:1px solid var(--teal);color:var(--teal);background:var(--surface)}
.ls-mtag.f2{background:var(--teal);color:#fff}
.ls-legend{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:4px}
.ls-sub{display:grid;gap:8px}
.ls-sub h3,.ls-mhead h3,.ls-form h3{margin:0;font-size:15px}
.ls-mhead{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:6px}
.ls-card .tags{margin-top:2px}
.ls-notes{font-size:13.5px;color:var(--ink-2);background:var(--sunk);border-radius:6px;padding:6px 10px}
.ls-form{background:var(--surface);border:1px solid var(--teal);border-radius:10px;padding:14px;display:grid;gap:10px}
.ls-form .f{display:grid;gap:4px}
.ls-form .f>span{font-size:12.5px;color:var(--ink-2);font-weight:500}
.ls-form input:not([type=checkbox]),.ls-form textarea{font:inherit;font-size:15px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);width:100%;box-sizing:border-box}
.ls-pick{display:grid;gap:6px;font-size:13.5px}
.ls-pick>div{display:flex;gap:4px 12px;flex-wrap:wrap;align-items:center}
.ls-pick b{font-size:12.5px;color:var(--ink-3);flex-basis:100%}
.ls-pick label{display:flex;gap:4px;align-items:center}
`;

  window.Lessons = {
    init(ctx) { C = ctx; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); bind(); listen(); },
    render(L) { render(L); },
    count() { return ready() ? D.lessons.length : null; },
  };
})();

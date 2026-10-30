// My Knowledge Atlas：自分専用の教科書（カテゴリー → 章 → 記事）
// 保存先は既存の docs テーブルの新しい区分（atlas_*）だけ。既存の論文・本・考察のデータには書き込まない。
(function () {
  const COLS = ["atlas_cats", "atlas_chapters", "atlas_articles", "atlas_sources", "atlas_history"];
  const STATUS = ["未検証", "出典確認済み", "複数資料で確認", "要再検証"];
  const CERTAINTY = ["未評価", "高い", "中程度", "低い", "非常に低い"];
  const SECTIONS = [
    ["definition", "定義", "text"],
    ["mechanism", "基本メカニズム", "text"],
    ["established", "確立された知識", "claims"],
    ["supported", "研究で支持される知見", "claims"],
    ["unresolved", "未解明の点・異なる見解", "claims"],
    ["practice", "実践への応用", "text"],
    ["reflection", "自分の考察", "text"],
  ];
  const CLAIM_KEYS = SECTIONS.filter((s) => s[2] === "claims").map((s) => s[0]);

  let C = null; // 本体アプリから渡される道具
  const D = { atlas_cats: [], atlas_chapters: [], atlas_articles: [], atlas_sources: [], atlas_history: [] };
  const got = {};
  const A = { view: "home", cat: null, art: null, draft: null, src: null, srcDraft: null, tag: null, histView: null, restore: null, msg: "", busy: false };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFKC");
  const arr = (v) => (Array.isArray(v) ? v : []);
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = () => new Date().toISOString();
  const fmt = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const para = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name || a.titleJa || "").localeCompare(String(b.name || b.titleJa || ""), "ja");
  const cats = () => D.atlas_cats.slice().sort(byOrder);
  const chaptersOf = (catId) => D.atlas_chapters.filter((c) => c.catId === catId).sort(byOrder);
  const articlesOf = (chId) => D.atlas_articles.filter((a) => a.chapterId === chId).sort(byOrder);
  const art = (id) => D.atlas_articles.find((a) => a.id === id);
  const chap = (id) => D.atlas_chapters.find((c) => c.id === id);
  const cat = (id) => D.atlas_cats.find((c) => c.id === id);
  const srcDoc = (id) => D.atlas_sources.find((s) => s.id === id);
  const clean = (o) => { const { id, ...rest } = o; return JSON.parse(JSON.stringify(rest)); };
  const can = () => !!(C && C.canEdit());

  // ---------- 出典 ----------
  // 主張の根拠は "s:<出典ID>"（Atlasの出典）か "p:<論文ID>"（論文タブの論文）で持つ
  function srcInfo(key) {
    const [k, id] = [key.slice(0, 1), key.slice(2)];
    if (k === "p") {
      const p = C.papers().find((x) => x.id === id), m = srcDoc("p-" + id) || {};
      if (!p) return { key, missing: true, title: "（論文タブから削除された論文）", verified: false };
      return { key, kind: "論文タブ", title: p.title, authors: p.authors, year: p.year, doi: m.doi || p.doi || "", url: p.url || (id.startsWith("pmid-") ? `https://pubmed.ncbi.nlm.nih.gov/${id.slice(5)}/` : ""),
        design: p.design, subjects: m.subjects || "", results: m.results || p.finding || "", limits: m.limits || "", origin: m.origin || "self", verified: !!m.verified, verifiedAt: m.verifiedAt, doiCheck: m.doiCheck, metaId: "p-" + id };
    }
    const s = srcDoc(id);
    if (!s) return { key, missing: true, title: "（削除された出典）", verified: false };
    return { key, kind: s.kind || "論文", ...s, metaId: s.id };
  }
  const srcLabel = (i) => [i.authors ? String(i.authors).split(/[,、]/)[0] + (String(i.authors).includes(",") || String(i.authors).includes("、") ? " ほか" : "") : "", i.year].filter(Boolean).join(", ");
  function claimState(c) {
    const s = arr(c.src);
    if (!s.length) return "未検証";
    const v = s.map(srcInfo).filter((i) => i.verified).length;
    return v === 0 ? "出典未確認" : v === 1 ? "出典確認済み" : "複数資料で確認";
  }
  const stCls = (s) => ({ "未検証": "ng", "出典未確認": "warn", "要再検証": "warn", "出典確認済み": "ok", "複数資料で確認": "ok2" }[s] || "");
  const badge = (s, title = "") => `<span class="at-st ${stCls(s)}" ${title ? `title="${esc(title)}"` : ""}>${esc(s)}</span>`;
  const allClaims = (a) => CLAIM_KEYS.flatMap((k) => arr(a[k]));
  function refKeys(a) {
    const out = [];
    for (const c of allClaims(a)) for (const k of arr(c.src)) if (!out.includes(k)) out.push(k);
    for (const k of arr(a.refs)) if (!out.includes(k)) out.push(k);
    return out;
  }

  // ---------- 読み込み ----------
  function listen() {
    if (!C.db) return;
    for (const k of COLS) {
      C.db.collection(k).onSnapshot((snap) => {
        D[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        got[k] = true;
        if (C.active()) C.rerender();
      }, () => { got[k] = true; if (C.active()) C.rerender(); });
    }
  }
  const ready = () => COLS.every((k) => got[k]);

  async function put(k, id, data) { await C.db.collection(k).doc(id).set(data); }
  async function putMany(k, rows) {
    if (!rows.length) return;
    if (C.db.batchSet) { for (let i = 0; i < rows.length; i += 200) await C.db.batchSet(k, rows.slice(i, i + 200)); }
    else for (const r of rows) await C.db.collection(k).doc(r.id).set(r.data);
  }
  async function del(k, id) { await C.db.collection(k).doc(id).delete(); }
  function fail(e) { A.busy = false; A.msg = e && e.code === "forbidden" ? "保存する権限がありません。管理者のアカウントで入ってください。" : "保存できませんでした。通信を確かめて、もう一度お試しください。"; C.rerender(); }

  // ---------- 画面 ----------
  function render(L) {
    if (!C.db) { L.innerHTML = `<div class="empty">書庫に接続できません。</div>`; return; }
    if (!ready()) { L.innerHTML = `<div class="empty">My Knowledge Atlas を読み込んでいます…</div>`; return; }
    const q = C.q() || "";
    if (q !== A.lastQ) { A.lastQ = q; if (q.trim() && !["edit", "srcEdit"].includes(A.view)) { A.view = "home"; A.tag = null; } }
    let h = "";
    if (A.view === "article" && art(A.art)) h = viewArticle(art(A.art));
    else if (A.view === "edit" && A.draft) h = viewEdit();
    else if (A.view === "history" && art(A.art)) h = viewHistory(art(A.art));
    else if (A.view === "sources") h = viewSources();
    else if (A.view === "srcEdit" && A.srcDraft) h = viewSrcEdit();
    else if (A.view === "backup") h = viewBackup();
    else if (A.view === "manage") h = viewManage();
    else { A.view = "home"; h = viewHome(); }
    L.innerHTML = `<div id="atlas">${A.msg ? `<div class="at-msg">${esc(A.msg)}<button type="button" class="linkish" data-a="msgOff">閉じる</button></div>` : ""}${h}</div>`;
  }

  function topBar() {
    return `<div class="at-top">
      <button type="button" class="btn ghost small" data-a="sources">出典の一覧</button>
      <button type="button" class="btn ghost small" data-a="backup">書き出し・復元</button>
      ${can() ? `<button type="button" class="btn ghost small" data-a="manage">カテゴリーと章の整理</button><button type="button" class="btn primary small" data-a="newArt">＋ 記事を書く</button>` : ""}
    </div>`;
  }

  function artRow(a) {
    const c = allClaims(a), unv = c.filter((x) => claimState(x) === "未検証").length;
    return `<button type="button" class="at-row" data-open="${esc(a.id)}">
      <span class="at-rt"><b>${esc(a.titleJa || "（無題）")}</b>${a.titleEn ? `<small>${esc(a.titleEn)}</small>` : ""}</span>
      <span class="at-rb">${badge(a.status || "未検証")}${a.aiDraft ? `<span class="at-ai">AI下書き</span>` : ""}${unv ? `<span class="at-cnt" title="根拠のない主張">根拠なし${unv}</span>` : ""}</span></button>`;
  }

  function searchHits(q) {
    const terms = norm(q).split(/[\s　]+/).filter(Boolean);
    const hay = (a) => [
      [a.titleJa, a.titleEn, ...arr(a.tags)].join(" "),
      [a.definition, a.practice].join(" "),
      [a.mechanism, a.reflection, a.limitations, ...allClaims(a).map((c) => c.text)].join(" "),
    ].map(norm);
    return D.atlas_articles.map((a) => {
      const [hi, mid, lo] = hay(a); let s = 0;
      const tt = norm([a.titleJa, a.titleEn].join(" "));
      for (const t of terms) { if (tt.includes(t)) s += 5; if (hi.includes(t)) s += 10; else if (mid.includes(t)) s += 4; else if (lo.includes(t)) s += 2; else return [a, 0]; }
      return [a, s];
    }).filter((p) => p[1] > 0).sort((x, y) => y[1] - x[1]).map((p) => p[0]);
  }

  function viewHome() {
    const cs = cats();
    if (!cs.length) {
      return `<div class="at-hero"><h2>My Knowledge Atlas</h2>
        <p>教えるために固めたいテーマを、カテゴリー → 章 → 記事の形で育てていく場所です。主張ごとに根拠の文献を紐付け、確認できていないものには「未検証」と表示します。</p>
        <p>全部をここに入れる必要はありません。さっと調べるのは「教科書」、文献でじっくり裏付けたいテーマだけ Atlas に、という使い分けがおすすめです。</p>
        ${can() ? `<div class="at-acts"><button type="button" class="btn primary" data-a="newCat">カテゴリーを作って始める</button></div>
          <p class="hint">「教科書」のページの下にある「Atlasで深掘りする」からも始められます（そのページが下書きとして入ります）。</p>` : `<p class="hint">まだ記事がありません。</p>`}</div>`;
    }
    if (!A.cat || !cat(A.cat)) A.cat = cs[0].id;
    const q = (C.q() || "").trim();
    const tags = {}; D.atlas_articles.forEach((a) => arr(a.tags).forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
    let body;
    if (q) {
      const hits = searchHits(q);
      body = `<p class="hint">「${esc(q)}」に関係する記事 ${hits.length}件（すべてのカテゴリーから）</p>` + (hits.length ? `<div class="at-list">${hits.map((a) => {
        const ch = chap(a.chapterId), ct = ch && cat(ch.catId);
        return `<div class="at-hit"><span class="hint">${esc([ct && ct.name, ch && ch.name].filter(Boolean).join(" › "))}</span>${artRow(a)}</div>`; }).join("")}</div>` : `<div class="empty">一致する記事がありません。</div>`);
    } else if (A.tag) {
      const hits = D.atlas_articles.filter((a) => arr(a.tags).includes(A.tag));
      body = `<p class="hint">タグ「${esc(A.tag)}」の記事 ${hits.length}件 <button type="button" class="linkish" data-a="tagOff">タグの絞り込みを外す</button></p><div class="at-list">${hits.map(artRow).join("")}</div>`;
    } else {
      const chs = chaptersOf(A.cat);
      const loose = D.atlas_articles.filter((a) => !chap(a.chapterId));
      body = (chs.length ? chs.map((c) => {
        const as = articlesOf(c.id);
        return `<details class="at-ch" data-ch="${esc(c.id)}" ${A.openCh === c.id ? "open" : ""}><summary><b>${esc(c.name)}</b><span class="hint">${as.length}記事</span></summary>
          <div class="at-list">${as.map(artRow).join("") || `<p class="hint at-pad">まだ記事がありません。</p>`}
          ${can() ? `<button type="button" class="linkish at-pad" data-a="newArt" data-ch="${esc(c.id)}">＋ この章に記事を書く</button>` : ""}</div></details>`;
      }).join("") : `<div class="empty">このカテゴリーにはまだ章がありません。${can() ? "「カテゴリーと章の整理」から章を追加できます。" : ""}</div>`)
      + (loose.length ? `<details class="at-ch"><summary><b>章が決まっていない記事</b><span class="hint">${loose.length}記事</span></summary><div class="at-list">${loose.map(artRow).join("")}</div></details>` : "");
    }
    const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 16);
    return `${topBar()}
      <div class="chips at-cats">${cs.map((c) => `<button type="button" class="chip" data-cat="${esc(c.id)}" aria-pressed="${c.id === A.cat && !q && !A.tag}">${esc(c.name)}</button>`).join("")}</div>
      ${topTags.length && !q ? `<div class="at-tags"><span class="hint">タグ</span>${topTags.map(([t, n]) => `<button type="button" class="tag at-tagbtn" data-tag="${esc(t)}" aria-pressed="${A.tag === t}">${esc(t)}<small>${n}</small></button>`).join("")}</div>` : ""}
      ${body}`;
  }

  function claimHtml(c, nums) {
    const st = claimState(c);
    return `<li class="at-claim"><span>${esc(c.text)}</span> ${arr(c.src).map((k) => `<a class="at-cite" href="#at-ref-${nums[k]}" title="${esc(srcInfo(k).title)}">[${nums[k]}]</a>`).join("")} ${badge(st)}</li>`;
  }

  function viewArticle(a) {
    const ch = chap(a.chapterId), ct = ch && cat(ch.catId);
    const keys = refKeys(a), nums = Object.fromEntries(keys.map((k, i) => [k, i + 1]));
    const counts = { "未検証": 0, "出典未確認": 0 }; allClaims(a).forEach((c) => { const s = claimState(c); if (s in counts) counts[s]++; });
    const rel = arr(a.related).map(art).filter(Boolean);
    const back = D.atlas_articles.filter((x) => x.id !== a.id && arr(x.related).includes(a.id) && !arr(a.related).includes(x.id));
    const sec = ([k, label, type]) => {
      const v = a[k];
      if (type === "claims") return arr(v).length ? `<section class="at-sec"><h3>${label}</h3><ul class="at-claims">${arr(v).map((c) => claimHtml(c, nums)).join("")}</ul></section>` : "";
      if (!v) return "";
      if (k === "reflection") return `<section class="at-sec at-mine"><h3>${label}<span>個人的な解釈</span></h3>${para(v)}</section>`;
      return `<section class="at-sec"><h3>${label}</h3>${para(v)}</section>`;
    };
    return `<div class="at-page">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="home">← ${esc(ch ? ch.name : "目次")}に戻る</button>
        ${can() ? `<button type="button" class="btn ghost small" data-a="edit">編集</button>` : ""}
        <button type="button" class="btn ghost small" data-a="history">変更履歴</button>
        <button type="button" class="btn ghost small" data-a="mdOne">Markdownで書き出す</button></div>
      <div class="hint">${esc([ct && ct.name, ch && ch.name].filter(Boolean).join(" › "))}</div>
      <h2 class="at-h">${esc(a.titleJa || "（無題）")}${a.titleEn ? `<small>${esc(a.titleEn)}</small>` : ""}</h2>
      <div class="at-meta">${badge(a.status || "未検証", "検証ステータス")}<span class="at-cert">エビデンスの確実性：${esc(a.certainty || "未評価")}</span>${a.aiDraft ? `<span class="at-ai">AI下書き</span>` : ""}
        <span class="hint">作成 ${esc(fmt(a.createdAt))} ・ 更新 ${esc(fmt(a.updatedAt))}</span></div>
      ${counts["未検証"] || counts["出典未確認"] ? `<div class="at-warn">根拠の文献がない主張が${counts["未検証"]}件、文献はあるが原文を確認していない主張が${counts["出典未確認"]}件あります。</div>` : ""}
      ${a.aiDraft ? `<div class="at-warn soft">この記事には Claude が作った下書きが含まれています。文献で確かめるまでは、内容を確定したものとして扱わないでください。</div>` : ""}
      ${arr(a.tags).length ? `<div class="at-tags">${arr(a.tags).map((t) => `<button type="button" class="tag at-tagbtn" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
      ${SECTIONS.map(sec).join("")}
      ${a.limitations || (a.certainty && a.certainty !== "未評価") ? `<section class="at-sec at-ev"><h3>エビデンスの確実性と研究の限界</h3><p><b>確実性：</b>${esc(a.certainty || "未評価")}</p>${a.limitations ? para(a.limitations) : ""}</section>` : ""}
      ${keys.length ? `<section class="at-sec"><h3>参考文献</h3><ol class="at-refs">${keys.map((k) => refHtml(srcInfo(k), nums[k])).join("")}</ol></section>` : `<section class="at-sec"><h3>参考文献</h3><p class="hint">まだ文献が紐付いていません。</p></section>`}
      ${rel.length || back.length ? `<section class="at-sec"><h3>関連記事</h3><div class="at-rel">${rel.concat(back).map((x) => `<button type="button" class="at-relbtn" data-open="${esc(x.id)}">${esc(x.titleJa)}</button>`).join("")}</div></section>` : ""}
      ${a.quiz && a.quiz.q ? `<section class="at-sec"><h3>確認問題</h3><p>${esc(a.quiz.q)}</p><details><summary class="linkish">答えを見る</summary><p><b>${esc(a.quiz.ok)}</b>　${esc(a.quiz.ex)}</p></details></section>` : ""}
    </div>`;
  }
  function refHtml(i, n) {
    const st = i.missing ? "未検証" : i.verified ? "出典確認済み" : i.origin === "ai" ? "AI提案・未確認" : "出典未確認";
    const doi = i.doi ? `https://doi.org/${String(i.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}` : "";
    const link = i.url || doi;
    return `<li id="at-ref-${n}"><div>${esc(srcLabel(i))}${srcLabel(i) ? "．" : ""}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(i.title)}</a>` : esc(i.title)} ${badge(st)}${i.kind === "論文タブ" ? `<span class="hint">（論文タブ）</span>` : ""}</div>
      ${[i.design && `研究デザイン：${i.design}`, i.subjects && `対象者：${i.subjects}`, i.results && `主な結果：${i.results}`, i.limits && `限界：${i.limits}`].filter(Boolean).map((t) => `<div class="hint">${esc(t)}</div>`).join("")}
      ${i.doi ? `<div class="hint">DOI：${esc(i.doi)}</div>` : ""}</li>`;
  }

  // ---------- 記事の編集 ----------
  function blankArticle(chId) {
    return { id: null, chapterId: chId || "", titleJa: "", titleEn: "", tags: [], related: [], refs: [], definition: "", mechanism: "", established: [], supported: [], unresolved: [], practice: "", reflection: "", status: "未検証", certainty: "未評価", limitations: "", aiDraft: false };
  }
  function srcOptions() {
    const own = D.atlas_sources.filter((s) => !s.id.startsWith("p-")).sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const papers = C.papers().slice().sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    return `<option value="">＋ 根拠の文献を選ぶ</option>
      ${own.length ? `<optgroup label="Atlasの出典">${own.map((s) => `<option value="s:${esc(s.id)}">${esc(String(s.title).slice(0, 60))}${s.year ? `（${esc(s.year)}）` : ""}</option>`).join("")}</optgroup>` : ""}
      ${papers.length ? `<optgroup label="論文タブの論文">${papers.map((p) => `<option value="p:${esc(p.id)}">${esc(String(p.title).slice(0, 60))}${p.year ? `（${esc(p.year)}）` : ""}</option>`).join("")}</optgroup>` : ""}`;
  }
  function viewEdit() {
    const d = A.draft, opts = srcOptions();
    const chOpts = cats().map((c) => `<optgroup label="${esc(c.name)}">${chaptersOf(c.id).map((h) => `<option value="${esc(h.id)}" ${d.chapterId === h.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</optgroup>`).join("");
    const claims = (k) => `<div class="at-claimed">${arr(d[k]).map((c, i) => `<div class="at-ce">
        <textarea rows="2" data-claim="${k}:${i}" placeholder="1つの主張を1文で">${esc(c.text)}</textarea>
        <div class="at-ce-src">${arr(c.src).map((s, j) => `<span class="at-chip">${esc(String(srcInfo(s).title).slice(0, 40))}<button type="button" data-a="srcRm" data-k="${k}:${i}:${j}" aria-label="外す">×</button></span>`).join("")}
          <select data-addsrc="${k}:${i}">${opts}</select>${badge(claimState(c))}
          <button type="button" class="linkish" data-a="claimRm" data-k="${k}:${i}">この主張を消す</button></div></div>`).join("")}
      <button type="button" class="btn ghost small" data-a="claimAdd" data-k="${k}">＋ 主張を足す</button></div>`;
    const field = ([k, label, type]) => `<div class="at-f"><label>${label}${k === "reflection" ? `<span class="hint">（客観的な事実とは分けて、自分の解釈・仮説・指導経験を書く欄）</span>` : ""}</label>
      ${type === "claims" ? claims(k) : `<textarea rows="${k === "mechanism" ? 7 : 4}" data-f="${k}">${esc(d[k])}</textarea>`}</div>`;
    const others = D.atlas_articles.filter((x) => x.id !== d.id && !arr(d.related).includes(x.id)).sort((a, b) => String(a.titleJa).localeCompare(String(b.titleJa), "ja"));
    return `<div class="at-page at-form">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="cancelEdit">← 保存せずに戻る</button></div>
      <h2 class="at-h">${d.id ? "記事を編集" : "新しい記事"}</h2>
      <div class="at-grid2">
        <div class="at-f"><label>タイトル（日本語）</label><input data-f="titleJa" value="${esc(d.titleJa)}"></div>
        <div class="at-f"><label>タイトル（英語）</label><input data-f="titleEn" value="${esc(d.titleEn)}"></div>
        <div class="at-f"><label>章</label><select data-f="chapterId"><option value="">（章を選ぶ）</option>${chOpts}</select></div>
        <div class="at-f"><label>タグ（「、」で区切る）</label><input data-f="tags" value="${esc(arr(d.tags).join("、"))}"></div>
      </div>
      ${SECTIONS.map(field).join("")}
      <div class="at-f"><label>その他の参考文献（主張に紐付けない文献）</label>
        <div class="at-ce-src">${arr(d.refs).map((s, j) => `<span class="at-chip">${esc(String(srcInfo(s).title).slice(0, 40))}<button type="button" data-a="refRm" data-k="${j}" aria-label="外す">×</button></span>`).join("")}<select data-addref="1">${opts}</select></div>
        <p class="hint">一覧にない文献は、先に「出典の一覧」から登録してください。</p></div>
      <div class="at-f"><label>関連記事</label>
        <div class="at-ce-src">${arr(d.related).map((id, j) => `<span class="at-chip">${esc((art(id) || {}).titleJa || "（削除された記事）")}<button type="button" data-a="relRm" data-k="${j}" aria-label="外す">×</button></span>`).join("")}
        <select data-addrel="1"><option value="">＋ 関連記事を選ぶ</option>${others.map((x) => `<option value="${esc(x.id)}">${esc(x.titleJa)}</option>`).join("")}</select></div></div>
      <div class="at-grid2">
        <div class="at-f"><label>検証ステータス</label><select data-f="status">${STATUS.map((s) => `<option ${d.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <p class="hint">根拠のない主張が残っている間は「未検証」のままにしておくのがおすすめです。</p></div>
        <div class="at-f"><label>エビデンスの確実性</label><select data-f="certainty">${CERTAINTY.map((s) => `<option ${d.certainty === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="at-f"><label>研究上の限界・確実性の理由</label><textarea rows="3" data-f="limitations">${esc(d.limitations)}</textarea></div>
      <label class="at-check"><input type="checkbox" data-f="aiDraft" ${d.aiDraft ? "checked" : ""}> AIが作った下書きを含む（文献で確かめたら外す）</label>
      ${d.id ? `<div class="at-f"><label>変更の理由</label><input data-f="_reason" value="${esc(d._reason || "")}" placeholder="例：文献を足した、定義を直した"></div>` : ""}
      <div class="at-acts"><button type="button" class="btn primary" data-a="saveArt" ${A.busy ? "disabled" : ""}>保存する</button>
        ${d.id ? `<button type="button" class="btn ghost" data-a="delArt">この記事を削除</button>` : ""}</div>
    </div>`;
  }
  async function saveArticle() {
    const d = A.draft; if (!d.titleJa.trim()) { A.msg = "タイトル（日本語）を入れてください。"; C.rerender(); return; }
    A.busy = true; C.rerender();
    try {
      const t = now(), reason = (d._reason || "").trim() || "更新";
      const data = clean({ ...d, _reason: undefined });
      CLAIM_KEYS.forEach((k) => (data[k] = arr(data[k]).filter((c) => String(c.text || "").trim())));
      if (d.id) {
        const prev = art(d.id);
        if (prev) await put("atlas_history", `${d.id}__${Date.now()}`, { articleId: d.id, at: t, reason, title: prev.titleJa, snapshot: clean(prev) });
        data.createdAt = prev ? prev.createdAt : t; data.updatedAt = t;
        await put("atlas_articles", d.id, data);
        A.art = d.id;
      } else {
        const id = uid("a-"); data.createdAt = t; data.updatedAt = t;
        data.order = articlesOf(d.chapterId).length;
        await put("atlas_articles", id, data); A.art = id;
      }
      A.busy = false; A.draft = null; A.view = "article"; A.msg = "保存しました。"; C.rerender();
    } catch (e) { fail(e); }
  }

  // ---------- 変更履歴 ----------
  function viewHistory(a) {
    const hs = D.atlas_history.filter((h) => h.articleId === a.id).sort((x, y) => String(y.at).localeCompare(String(x.at)));
    const v = A.histView && hs.find((h) => h.id === A.histView);
    return `<div class="at-page">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="backArt">← 記事に戻る</button></div>
      <h2 class="at-h">変更履歴<small>${esc(a.titleJa)}</small></h2>
      <p class="hint">保存するたびに、変更する前の内容がここに残ります。いまの内容：${esc(fmt(a.updatedAt))} 更新</p>
      ${hs.length ? `<ol class="at-hist">${hs.map((h) => `<li><b>${esc(fmt(h.at))}</b>　変更の理由：${esc(h.reason || "")}
        <div class="at-acts"><button type="button" class="linkish" data-a="histView" data-k="${esc(h.id)}">この変更の前の内容を見る</button>
        ${can() ? `<button type="button" class="linkish" data-a="histRestore" data-k="${esc(h.id)}">この内容に戻す</button>` : ""}</div></li>`).join("")}</ol>` : `<div class="empty">まだ変更履歴はありません。</div>`}
      ${v ? `<div class="at-old"><div class="hint">${esc(fmt(v.at))} の変更より前の内容</div>${viewArticle({ ...v.snapshot, id: a.id }).replace(/<div class="at-nav">[\s\S]*?<\/div>/, "")}</div>` : ""}
    </div>`;
  }
  async function restoreVersion(hid, label) {
    const h = D.atlas_history.find((x) => x.id === hid); if (!h) return;
    const cur = art(h.articleId), t = now();
    if (!confirm(`${fmt(h.at)} より前の内容に戻します。いまの内容は変更履歴に残ります。よろしいですか？`)) return;
    try {
      if (cur) await put("atlas_history", `${h.articleId}__${Date.now()}`, { articleId: h.articleId, at: t, reason: label || `${fmt(h.at)}より前の版に戻した`, title: cur.titleJa, snapshot: clean(cur) });
      await put("atlas_articles", h.articleId, { ...h.snapshot, createdAt: h.snapshot.createdAt || t, updatedAt: t });
      A.art = h.articleId; A.view = "article"; A.histView = null; A.msg = "以前の版に戻しました。"; C.rerender();
    } catch (e) { fail(e); }
  }

  // ---------- 出典の一覧 ----------
  function viewSources() {
    const used = new Map();
    D.atlas_articles.forEach((a) => refKeys(a).forEach((k) => used.set(k, (used.get(k) || 0) + 1)));
    const own = D.atlas_sources.filter((s) => !s.id.startsWith("p-")).map((s) => "s:" + s.id);
    const paperKeys = [...used.keys()].filter((k) => k.startsWith("p:"));
    const keys = [...own, ...paperKeys];
    return `<div class="at-page">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="home">← 目次に戻る</button>
        ${can() ? `<button type="button" class="btn primary small" data-a="newSrc">＋ 出典を登録</button>` : ""}</div>
      <h2 class="at-h">出典の一覧</h2>
      <p class="hint">「出典確認済み」になるのは、原文（論文そのもの）を自分で確かめて印を付けたものだけです。AIが提案した文献は、確認するまで「AI提案・未確認」と表示されます。論文タブの論文は、記事に紐付けるとここに出てきます。</p>
      ${keys.length ? `<ol class="at-refs at-srclist">${keys.map((k) => { const i = srcInfo(k); return `<li>${refHtml(i, "s").replace(/^<li[^>]*>|<\/li>$/g, "")}
        <div class="hint">${used.get(k) || 0}件の記事で使用</div>
        ${can() && !i.missing ? `<div class="at-acts"><button type="button" class="linkish" data-a="editSrc" data-k="${esc(k)}">編集・確認</button></div>` : ""}</li>`; }).join("")}</ol>` : `<div class="empty">まだ出典がありません。</div>`}
    </div>`;
  }
  function viewSrcEdit() {
    const s = A.srcDraft, fromPaper = !!s.paperId;
    const inp = (k, label, ph = "") => `<div class="at-f"><label>${label}</label><input data-sf="${k}" value="${esc(s[k] || "")}" placeholder="${esc(ph)}" ${fromPaper && ["title", "authors", "year", "design", "url"].includes(k) ? "disabled" : ""}></div>`;
    const ta = (k, label) => `<div class="at-f"><label>${label}</label><textarea rows="3" data-sf="${k}">${esc(s[k] || "")}</textarea></div>`;
    const dc = s.doiCheck;
    return `<div class="at-page at-form">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="sources">← 保存せずに戻る</button></div>
      <h2 class="at-h">${fromPaper ? "論文タブの論文の確認" : s.id ? "出典を編集" : "出典を登録"}</h2>
      ${fromPaper ? `<p class="hint">タイトルなどは論文タブの内容を使います。ここでは確認の記録と、Atlas用の補足だけを保存します。</p>` : ""}
      ${inp("title", "論文タイトル")}
      <div class="at-grid2">${inp("authors", "著者", "例：Bohm S, Mersmann F, Arampatzis A")}${inp("year", "発表年")}${inp("doi", "DOI", "例：10.1186/s40798-015-0009-9")}${inp("url", "URL")}${inp("design", "研究デザイン", "例：系統的レビュー、RCT")}${inp("subjects", "対象者")}</div>
      ${ta("results", "主要な結果")}${ta("limits", "研究の限界")}
      <div class="at-f"><label>この文献をどこで知ったか</label><select data-sf="origin"><option value="self" ${s.origin !== "ai" ? "selected" : ""}>自分で見つけた・確認して入力した</option><option value="ai" ${s.origin === "ai" ? "selected" : ""}>AI（Claude など）が提案した</option></select></div>
      <div class="at-f"><label>DOIの自動チェック</label>
        <div class="at-acts"><button type="button" class="btn ghost small" data-a="doiCheck">DOIを調べる</button>
        ${dc ? `<span class="hint">${dc.ok ? `見つかりました：${esc(dc.title)}（${esc(dc.year || "年不明")}）` : "このDOIは見つかりませんでした。"}　${esc(fmt(dc.at))}</span>` : ""}</div>
        <p class="hint">DOIが実在するかを調べるだけです。見つかっても「確認済み」にはなりません。</p></div>
      <label class="at-check at-verify"><input type="checkbox" data-sf="verified" ${s.verified ? "checked" : ""}> 原文を自分で読み、書誌情報と内容を確認した${s.verifiedAt ? `<span class="hint">（${esc(fmt(s.verifiedAt))}）</span>` : ""}</label>
      <div class="at-acts"><button type="button" class="btn primary" data-a="saveSrc">保存する</button>
        ${s.id && !fromPaper ? `<button type="button" class="btn ghost" data-a="delSrc">この出典を削除</button>` : ""}</div>
    </div>`;
  }
  async function doiCheck() {
    const s = A.srcDraft, doi = String(s.doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    if (!doi) { A.msg = "DOIを入れてください。"; C.rerender(); return; }
    try {
      const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!r.ok) { s.doiCheck = { ok: false, at: now() }; }
      else { const m = (await r.json()).message || {}; s.doiCheck = { ok: true, title: (m.title || [""])[0], year: ((m.issued || {})["date-parts"] || [[""]])[0][0], at: now() }; }
    } catch { A.msg = "DOIを調べられませんでした。通信を確かめてください。"; }
    C.rerender();
  }
  async function saveSource() {
    const s = A.srcDraft;
    if (!s.paperId && !String(s.title || "").trim()) { A.msg = "論文タイトルを入れてください。"; C.rerender(); return; }
    const id = s.paperId ? "p-" + s.paperId : s.id || uid("s-");
    const prev = srcDoc(id) || {};
    const data = clean({ ...s, id: undefined });
    if (s.verified && !prev.verified) data.verifiedAt = now();
    if (!s.verified) data.verifiedAt = null;
    data.updatedAt = now(); data.createdAt = prev.createdAt || data.updatedAt;
    try { await put("atlas_sources", id, data); A.view = "sources"; A.srcDraft = null; A.msg = "出典を保存しました。"; C.rerender(); } catch (e) { fail(e); }
  }

  // ---------- カテゴリーと章の整理 ----------
  function viewManage() {
    const cs = cats();
    const ord = (k, id) => `<button type="button" class="btn ghost small" data-a="up" data-k="${k}:${esc(id)}" aria-label="上へ">↑</button><button type="button" class="btn ghost small" data-a="down" data-k="${k}:${esc(id)}" aria-label="下へ">↓</button>`;
    return `<div class="at-page">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="home">← 目次に戻る</button></div>
      <h2 class="at-h">カテゴリーと章の整理</h2>
      ${cs.map((c) => `<div class="at-mg"><div class="at-mrow"><b>${esc(c.name)}</b>${ord("atlas_cats", c.id)}
          <button type="button" class="btn ghost small" data-a="rename" data-k="atlas_cats:${esc(c.id)}">名前を変える</button>
          <button type="button" class="btn ghost small" data-a="delCat" data-k="${esc(c.id)}">削除</button></div>
        ${chaptersOf(c.id).map((h) => `<div class="at-mrow at-sub"><span>${esc(h.name)}<small class="hint">（${articlesOf(h.id).length}記事）</small></span>${ord("atlas_chapters", h.id)}
          <button type="button" class="btn ghost small" data-a="rename" data-k="atlas_chapters:${esc(h.id)}">名前を変える</button>
          <button type="button" class="btn ghost small" data-a="delCh" data-k="${esc(h.id)}">削除</button></div>`).join("")}
        <button type="button" class="linkish at-sub" data-a="newCh" data-k="${esc(c.id)}">＋ 「${esc(c.name)}」に章を足す</button></div>`).join("")}
      <button type="button" class="btn ghost" data-a="newCat">＋ カテゴリーを足す</button>
      <p class="hint">章やカテゴリーは、中に記事や章が残っていると削除できません（大切な記事を消さないため）。</p>
    </div>`;
  }
  async function move(k, id, dir) {
    const list = k === "atlas_cats" ? cats() : chaptersOf((chap(id) || {}).catId);
    const i = list.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const re = list.slice(); [re[i], re[j]] = [re[j], re[i]];
    try { await putMany(k, re.map((x, n) => ({ id: x.id, data: { ...clean(x), order: n } }))); } catch (e) { fail(e); }
  }

  // ---------- 書き出し・復元 ----------
  function dl(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`; };
  function exportJson() {
    const out = { app: "My Knowledge Atlas", version: 1, exportedAt: now() };
    for (const k of COLS) out[k] = D[k].map((x) => ({ id: x.id, data: clean(x) }));
    dl(`atlas-backup-${stamp()}.json`, JSON.stringify(out, null, 1), "application/json");
  }
  function md(a) {
    const keys = refKeys(a), nums = Object.fromEntries(keys.map((k, i) => [k, i + 1]));
    const ch = chap(a.chapterId), ct = ch && cat(ch.catId);
    let s = `# ${a.titleJa || "（無題）"}${a.titleEn ? `\n\n*${a.titleEn}*` : ""}\n\n`;
    s += `- 場所：${[ct && ct.name, ch && ch.name].filter(Boolean).join(" › ")}\n- 検証ステータス：${a.status || "未検証"}\n- エビデンスの確実性：${a.certainty || "未評価"}\n- タグ：${arr(a.tags).join("、")}\n- 作成：${fmt(a.createdAt)}　更新：${fmt(a.updatedAt)}\n${a.aiDraft ? "- ※ AI（Claude）の下書きを含む。文献で確認するまで確定扱いしない。\n" : ""}\n`;
    for (const [k, label, type] of SECTIONS) {
      const v = a[k];
      if (type === "claims") { if (arr(v).length) s += `## ${label}\n\n${arr(v).map((c) => `- ${c.text} ${arr(c.src).map((x) => `[${nums[x]}]`).join("")}（${claimState(c)}）`).join("\n")}\n\n`; }
      else if (v) s += `## ${label}${k === "reflection" ? "（個人的な解釈）" : ""}\n\n${v}\n\n`;
    }
    if (a.limitations) s += `## エビデンスの確実性と研究の限界\n\n確実性：${a.certainty || "未評価"}\n\n${a.limitations}\n\n`;
    if (keys.length) s += `## 参考文献\n\n${keys.map((k) => { const i = srcInfo(k); return `${nums[k]}. ${srcLabel(i)}. ${i.title}.${i.doi ? ` doi:${i.doi}` : ""}${i.url ? ` ${i.url}` : ""}（${i.verified ? "出典確認済み" : i.origin === "ai" ? "AI提案・未確認" : "出典未確認"}）`; }).join("\n")}\n\n`;
    const rel = arr(a.related).map(art).filter(Boolean);
    if (rel.length) s += `## 関連記事\n\n${rel.map((x) => `- ${x.titleJa}`).join("\n")}\n`;
    return s;
  }
  const fileSafe = (t) => String(t || "article").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  function exportMdAll() {
    let s = `# My Knowledge Atlas\n\n書き出し：${fmt(now())}\n\n`;
    for (const c of cats()) { s += `\n---\n\n# ${c.name}\n\n`; for (const h of chaptersOf(c.id)) { s += `\n# ${c.name} › ${h.name}\n\n`; for (const a of articlesOf(h.id)) s += md(a).replace(/^# /, "## ").replace(/\n## /g, "\n### ") + "\n"; } }
    dl(`atlas-${stamp()}.md`, s, "text/markdown");
  }
  function viewBackup() {
    const n = (k) => D[k].length;
    const r = A.restore;
    const deleted = [...new Set(D.atlas_history.filter((h) => !art(h.articleId)).map((h) => h.articleId))].map((id) => D.atlas_history.filter((h) => h.articleId === id).sort((x, y) => String(y.at).localeCompare(String(x.at)))[0]);
    return `<div class="at-page">
      <div class="at-nav"><button type="button" class="btn ghost small" data-a="home">← 目次に戻る</button></div>
      <h2 class="at-h">書き出し・復元</h2>
      <p class="hint">いまの内容：カテゴリー${n("atlas_cats")}・章${n("atlas_chapters")}・記事${n("atlas_articles")}・出典${n("atlas_sources")}・変更履歴${n("atlas_history")}</p>
      <section class="at-sec"><h3>書き出す（バックアップ）</h3>
        <div class="at-acts"><button type="button" class="btn primary" data-a="expJson">すべてをファイルに保存（JSON）</button>
        <button type="button" class="btn ghost" data-a="expMd">すべての記事をMarkdownで保存</button></div>
        <p class="hint">JSONのファイルは、あとで「復元」に使えます。月に一度くらい保存しておくと安心です。</p></section>
      ${can() ? `<section class="at-sec"><h3>復元する</h3>
        <p class="hint">保存したJSONのファイルを選びます。同じものは上書きされ、ファイルに入っていないものは消さずに残します。復元の前に、いまの内容を自動でファイルに保存します。</p>
        <input type="file" accept="application/json,.json" id="atRestoreFile">
        ${r ? `<div class="at-warn">${r.error ? esc(r.error) : `ファイルの中身：カテゴリー${r.counts.atlas_cats}・章${r.counts.atlas_chapters}・記事${r.counts.atlas_articles}・出典${r.counts.atlas_sources}・変更履歴${r.counts.atlas_history}（${esc(fmt(r.exportedAt))} に保存）
          <div class="at-acts"><button type="button" class="btn primary" data-a="doRestore" ${A.busy ? "disabled" : ""}>この内容で復元する</button></div>`}</div>` : ""}</section>` : ""}
      ${deleted.length ? `<section class="at-sec"><h3>削除した記事</h3><p class="hint">削除した記事も、変更履歴から元に戻せます。</p>
        <ul>${deleted.map((h) => `<li>${esc(h.title || (h.snapshot || {}).titleJa)}（${esc(fmt(h.at))}に削除）${can() ? ` <button type="button" class="linkish" data-a="undelete" data-k="${esc(h.id)}">元に戻す</button>` : ""}</li>`).join("")}</ul></section>` : ""}
    </div>`;
  }
  async function readRestore(file) {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== "My Knowledge Atlas") throw new Error();
      const counts = Object.fromEntries(COLS.map((k) => [k, arr(j[k]).length]));
      A.restore = { data: j, counts, exportedAt: j.exportedAt };
    } catch { A.restore = { error: "My Knowledge Atlas で書き出したJSONのファイルではないようです。" }; }
    C.rerender();
  }
  async function doRestore() {
    const j = A.restore && A.restore.data; if (!j) return;
    if (!confirm("この内容で復元します。よろしいですか？")) return;
    exportJson();
    A.busy = true; C.rerender();
    try {
      for (const k of COLS) await putMany(k, arr(j[k]).filter((r) => r && r.id && r.data).map((r) => ({ id: r.id, data: r.data })));
      A.busy = false; A.restore = null; A.msg = "復元しました。"; A.view = "home"; C.rerender();
    } catch (e) { fail(e); }
  }

  // ---------- 教科書のページから深掘りする ----------
  async function deepen(tbId) {
    const aid = "phys-" + tbId;
    if (art(aid)) { A.art = aid; A.view = "article"; return true; }
    if (!can()) return false;
    try {
      const tb = await C.loadTextbook();
      const ch = tb.chapters.find((c) => c.items.includes(tbId)), it = tb.items[tbId], pg = it && it.page;
      if (!ch || !pg) return false;
      const t = now(), catId = "phys", chId = `phys-ch${ch.n}`;
      if (!cat(catId)) await put("atlas_cats", catId, { name: "生理学", order: cats().length, createdAt: t });
      if (!chap(chId)) await put("atlas_chapters", chId, { catId, name: `第${ch.n}章 ${ch.title}`, order: ch.n, createdAt: t });
      const refsIn = (s) => (String(s).match(/\d{1,2}-\d{1,2}(?= ?参照|[、）)])/g) || []);
      const related = [...new Set([pg.one, ...pg.secs.map((x) => x.b), ...pg.pilates].flatMap(refsIn))].filter((x) => x !== tbId).map((x) => "phys-" + x).filter((x) => art(x));
      await put("atlas_articles", aid, {
        chapterId: chId, order: ch.items.indexOf(tbId), titleJa: it.title, titleEn: "", tags: arr(it.words), related, refs: [],
        definition: pg.one, mechanism: pg.secs.map((x) => `【${x.h}】\n${x.b}`).join("\n\n"),
        established: [], supported: [], unresolved: [],
        practice: pg.pilates.map((x) => "・" + x).join("\n") + (pg.caution ? `\n\n【注意】${pg.caution}` : ""),
        reflection: "", status: "未検証", certainty: "未評価",
        limitations: "Claude が一般的な教科書の知識から作った下書き（教科書 " + tbId + "）。主張ごとの参考文献は付いていない。主張ごとに文献で確かめる必要がある。" + (arr(pg.refs).length ? "\n\n数字や基準の確認に使った公開資料：\n" + pg.refs.map((r) => `・${r.t} ${r.u}`).join("\n") : ""),
        aiDraft: true, fromTextbook: tbId, createdAt: t, updatedAt: t });
      A.art = aid; A.view = "article"; A.cat = catId;
      A.msg = "教科書のページを下書きとして取り込みました。「編集」から主張を1文ずつ書き出して、文献を付けていきましょう。";
      return true;
    } catch (e) { fail(e); return false; }
  }

  // ---------- 操作 ----------
  async function act(a, el) {
    const k = el.dataset.k;
    const d = A.draft;
    switch (a) {
      case "msgOff": A.msg = ""; break;
      case "home": A.view = "home"; A.art = null; break;
      case "sources": A.view = "sources"; A.srcDraft = null; break;
      case "backup": A.view = "backup"; break;
      case "manage": A.view = "manage"; break;
      case "tagOff": A.tag = null; break;
      case "backArt": A.view = "article"; A.histView = null; break;
      case "history": A.view = "history"; A.histView = null; break;
      case "histView": A.histView = k; break;
      case "histRestore": await restoreVersion(k); return;
      case "undelete": await restoreVersion(k, "削除した記事を元に戻した"); return;
      case "newArt": A.draft = blankArticle(el.dataset.ch || (chaptersOf(A.cat)[0] || {}).id); A.view = "edit"; break;
      case "edit": A.draft = JSON.parse(JSON.stringify({ ...blankArticle(), ...art(A.art), id: A.art })); A.view = "edit"; break;
      case "cancelEdit": if (A.draft && A.draft.id) A.view = "article"; else A.view = "home"; A.draft = null; break;
      case "claimAdd": d[k] = arr(d[k]).concat([{ text: "", src: [] }]); break;
      case "claimRm": { const [s, i] = k.split(":"); d[s].splice(Number(i), 1); break; }
      case "srcRm": { const [s, i, j] = k.split(":"); d[s][Number(i)].src.splice(Number(j), 1); break; }
      case "refRm": d.refs.splice(Number(k), 1); break;
      case "relRm": d.related.splice(Number(k), 1); break;
      case "saveArt": await saveArticle(); return;
      case "delArt": {
        if (!confirm("この記事を削除します。削除した記事は「書き出し・復元」の画面から元に戻せます。よろしいですか？")) return;
        try { const cur = art(d.id); await put("atlas_history", `${d.id}__${Date.now()}`, { articleId: d.id, at: now(), reason: "削除", title: cur.titleJa, snapshot: clean(cur) }); await del("atlas_articles", d.id); A.draft = null; A.view = "home"; A.msg = "記事を削除しました。"; } catch (e) { fail(e); return; }
        break;
      }
      case "mdOne": { const x = art(A.art); dl(`${fileSafe(x.titleJa)}.md`, md(x), "text/markdown"); return; }
      case "expJson": exportJson(); return;
      case "expMd": exportMdAll(); return;
      case "doRestore": await doRestore(); return;
      case "newSrc": A.srcDraft = { title: "", origin: "self", verified: false }; A.view = "srcEdit"; break;
      case "editSrc": {
        if (k.startsWith("p:")) { const id = k.slice(2), m = srcDoc("p-" + id) || {}; A.srcDraft = { ...srcInfo(k), ...clean(m), paperId: id, id: "p-" + id }; }
        else A.srcDraft = { ...srcDoc(k.slice(2)) };
        A.view = "srcEdit"; break;
      }
      case "doiCheck": await doiCheck(); return;
      case "saveSrc": await saveSource(); return;
      case "delSrc": {
        const sid = A.srcDraft.id, inUse = D.atlas_articles.filter((x) => refKeys(x).includes("s:" + sid)).length;
        if (inUse) { A.msg = `この出典は${inUse}件の記事で使われているため削除できません。先に記事から外してください。`; break; }
        if (!confirm("この出典を削除します。よろしいですか？")) return;
        try { await del("atlas_sources", sid); A.view = "sources"; A.srcDraft = null; } catch (e) { fail(e); return; }
        break;
      }
      case "newCat": {
        const name = prompt("新しいカテゴリーの名前（例：機能解剖学）"); if (!name || !name.trim()) return;
        const id = uid("c-"); try { await put("atlas_cats", id, { name: name.trim(), order: cats().length, createdAt: now() }); A.cat = id; } catch (e) { fail(e); return; }
        break;
      }
      case "newCh": {
        const name = prompt("新しい章の名前"); if (!name || !name.trim()) return;
        try { await put("atlas_chapters", uid("h-"), { catId: k, name: name.trim(), order: chaptersOf(k).length, createdAt: now() }); } catch (e) { fail(e); return; }
        break;
      }
      case "rename": {
        const [col, id] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
        const cur = D[col].find((x) => x.id === id); const name = prompt("新しい名前", cur.name); if (!name || !name.trim()) return;
        try { await put(col, id, { ...clean(cur), name: name.trim() }); } catch (e) { fail(e); return; }
        break;
      }
      case "delCat": {
        if (chaptersOf(k).length) { A.msg = "章が残っているカテゴリーは削除できません。先に章を移すか削除してください。"; break; }
        if (!confirm("このカテゴリーを削除します。よろしいですか？")) return;
        try { await del("atlas_cats", k); } catch (e) { fail(e); return; }
        break;
      }
      case "delCh": {
        if (articlesOf(k).length) { A.msg = "記事が残っている章は削除できません。先に記事を別の章へ移してください。"; break; }
        if (!confirm("この章を削除します。よろしいですか？")) return;
        try { await del("atlas_chapters", k); } catch (e) { fail(e); return; }
        break;
      }
      case "up": case "down": { const i = k.indexOf(":"); await move(k.slice(0, i), k.slice(i + 1), a === "up" ? -1 : 1); return; }
    }
    C.rerender();
  }

  function bind() {
    document.addEventListener("click", (e) => {
      if (!C.active() || !e.target.closest("#atlas")) return;
      const b = e.target.closest("[data-a]");
      if (b) { e.preventDefault(); act(b.dataset.a, b); return; }
      const o = e.target.closest("[data-open]");
      if (o) { A.art = o.dataset.open; A.view = "article"; C.rerender(); document.getElementById("atlas").scrollIntoView({ block: "start" }); return; }
      const c = e.target.closest("[data-cat]");
      if (c) { A.cat = c.dataset.cat; A.tag = null; C.setQ(""); C.rerender(); return; }
      const t = e.target.closest("[data-tag]");
      if (t) { A.tag = t.dataset.tag; A.view = "home"; C.setQ(""); C.rerender(); return; }
    });
    document.addEventListener("input", (e) => {
      if (!C.active() || !e.target.closest("#atlas")) return;
      const el = e.target;
      if (A.draft && el.dataset.f) { const k = el.dataset.f; A.draft[k] = el.type === "checkbox" ? el.checked : k === "tags" ? el.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : el.value; }
      if (A.draft && el.dataset.claim) { const [s, i] = el.dataset.claim.split(":"); A.draft[s][Number(i)].text = el.value; }
      if (A.srcDraft && el.dataset.sf) A.srcDraft[el.dataset.sf] = el.type === "checkbox" ? el.checked : el.value;
    });
    document.addEventListener("change", (e) => {
      if (!C.active() || !e.target.closest("#atlas")) return;
      const el = e.target, v = el.value;
      if (el.id === "atRestoreFile" && el.files[0]) { readRestore(el.files[0]); return; }
      if (A.draft && el.dataset.f && (el.tagName === "SELECT" || el.type === "checkbox")) { A.draft[el.dataset.f] = el.type === "checkbox" ? el.checked : v; return; }
      if (A.srcDraft && el.dataset.sf && (el.tagName === "SELECT" || el.type === "checkbox")) { A.srcDraft[el.dataset.sf] = el.type === "checkbox" ? el.checked : v; return; }
      if (!v || !A.draft) return;
      if (el.dataset.addsrc) { const [s, i] = el.dataset.addsrc.split(":"); const c = A.draft[s][Number(i)]; c.src = arr(c.src); if (!c.src.includes(v)) c.src.push(v); C.rerender(); }
      else if (el.dataset.addref) { A.draft.refs = arr(A.draft.refs); if (!A.draft.refs.includes(v)) A.draft.refs.push(v); C.rerender(); }
      else if (el.dataset.addrel) { A.draft.related = arr(A.draft.related); if (!A.draft.related.includes(v)) A.draft.related.push(v); C.rerender(); }
    });
    document.addEventListener("toggle", (e) => { const d = e.target; if (d && d.dataset && d.dataset.ch && d.open) A.openCh = d.dataset.ch; }, true);
  }

  const CSS = `
#atlas{display:grid;gap:12px}
.at-msg{display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--teal-soft);color:var(--teal);border-radius:8px;padding:10px 14px;font-size:14px}
.at-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.at-hero{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:20px;display:grid;gap:10px}
.at-hero h2{margin:0;font-family:var(--head);font-size:22px}
.at-hero p{margin:0;line-height:1.8}
.at-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.at-cats{margin-top:2px}
.at-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.at-tagbtn{cursor:pointer;border:1px solid transparent}
.at-tagbtn[aria-pressed="true"]{border-color:var(--teal);color:var(--teal)}
.at-tagbtn small{margin-left:4px;color:var(--ink-3)}
.at-ch{background:var(--surface);border:1px solid var(--line);border-radius:8px}
.at-ch>summary{cursor:pointer;padding:12px 14px;display:flex;gap:8px;align-items:baseline;font-size:15px}
.at-ch>summary .hint{margin-left:auto}
.at-list{display:grid}
.at-ch .at-list{border-top:1px solid var(--line-2)}
.at-pad{padding:10px 14px;margin:0}
.at-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;text-align:left;padding:10px 14px;background:var(--surface);border:0;border-bottom:1px solid var(--line-2);font:inherit;color:var(--ink);cursor:pointer;width:100%}
.at-row:hover{background:var(--sunk)}
.at-rt{display:grid;gap:1px;flex:1 1 220px}
.at-rt b{font-weight:500;font-size:14.5px;line-height:1.5}
.at-rt small,.at-h small{color:var(--ink-3);font-size:12px;font-weight:400}
.at-rb{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.at-hit{display:grid;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 0 0;margin-bottom:8px;overflow:hidden}
.at-hit>.hint{padding:0 14px}
.at-st{font-size:11.5px;font-weight:700;border-radius:4px;padding:1px 7px;white-space:nowrap;background:var(--sunk);color:var(--ink-2)}
.at-st.ng{background:var(--accent-soft);color:var(--accent)}
.at-st.warn{background:var(--amber-soft,#f7ecd9);color:var(--amber,#9a6412)}
.at-st.ok{background:var(--teal-soft);color:var(--teal)}
.at-st.ok2{background:var(--teal);color:var(--surface)}
.at-ai{font-size:11px;border:1px dashed var(--ink-3);color:var(--ink-3);border-radius:4px;padding:0 6px;white-space:nowrap}
.at-cnt{font-size:11px;color:var(--accent);white-space:nowrap}
.at-page{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px;display:grid;gap:12px}
.at-nav{display:flex;gap:8px;flex-wrap:wrap}
.at-h{margin:0;font-size:21px;line-height:1.45;display:grid;gap:2px}
.at-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.at-cert{font-size:12.5px;color:var(--ink-2)}
.at-warn{border:1px solid var(--amber,#b7791f);border-radius:8px;padding:10px 14px;font-size:14px;line-height:1.7;display:grid;gap:8px}
.at-warn.soft{border-style:dashed;color:var(--ink-2)}
.at-sec h3{font-size:15px;margin:6px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--line-2);display:flex;gap:8px;align-items:baseline}
.at-sec p{margin:0 0 8px;line-height:1.85}
.at-mine{background:var(--sunk);border-radius:8px;padding:10px 14px}
.at-mine h3 span{font-size:11px;font-weight:400;color:var(--ink-3);border:1px solid var(--line);border-radius:4px;padding:0 6px}
.at-ev{border-left:3px solid var(--amber,#b7791f);padding-left:12px}
.at-claims{margin:0;padding-left:1.2em;display:grid;gap:6px;line-height:1.75}
.at-cite{font-size:12px;color:var(--teal);text-decoration:none;margin-left:2px}
.at-refs{margin:0;padding-left:1.4em;display:grid;gap:10px;font-size:14px;line-height:1.6}
.at-refs a{color:var(--teal)}
.at-srclist{list-style:none;padding:0}
.at-srclist>li{border-bottom:1px solid var(--line-2);padding-bottom:10px}
.at-rel{display:flex;gap:6px;flex-wrap:wrap}
.at-relbtn{font:inherit;font-size:13px;border:1px solid var(--teal);color:var(--teal);background:var(--surface);border-radius:999px;padding:3px 12px;cursor:pointer}
.at-form .at-f{display:grid;gap:4px}
.at-f label{font-size:13px;font-weight:700;color:var(--ink-2)}
.at-f label .hint{font-weight:400}
.at-f input,.at-f textarea,.at-f select,.at-ce select{font:inherit;font-size:15px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);width:100%;box-sizing:border-box}
.at-f textarea{line-height:1.7;resize:vertical}
.at-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.at-claimed{display:grid;gap:8px}
.at-ce{border:1px solid var(--line-2);border-radius:8px;padding:8px;display:grid;gap:6px;background:var(--paper)}
.at-ce textarea{font:inherit;font-size:15px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;width:100%;box-sizing:border-box;background:var(--surface);color:var(--ink)}
.at-ce-src{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.at-ce-src select{width:auto;max-width:100%;font-size:13px;padding:4px 6px}
.at-chip{display:inline-flex;gap:4px;align-items:center;font-size:12.5px;background:var(--teal-soft);color:var(--teal);border-radius:999px;padding:2px 4px 2px 10px}
.at-chip button{border:0;background:none;color:inherit;font-size:14px;cursor:pointer;padding:0 4px}
.at-check{display:flex;gap:8px;align-items:center;font-size:14px}
.at-verify{background:var(--teal-soft);border-radius:8px;padding:10px 12px;color:var(--teal);font-weight:700}
.at-hist{margin:0;padding-left:1.2em;display:grid;gap:10px;line-height:1.7}
.at-old{border:1px dashed var(--line);border-radius:8px;padding:12px;display:grid;gap:10px}
.at-mg{border:1px solid var(--line-2);border-radius:8px;padding:10px;display:grid;gap:6px}
.at-mrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.at-mrow>b,.at-mrow>span{flex:1 1 160px}
.at-sub{margin-left:16px}
`;

  window.Atlas = {
    init(ctx) {
      C = ctx;
      const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      bind(); listen();
    },
    render(L) { render(L); },
    counts() { return { articles: D.atlas_articles.length, ready: ready() }; },
    has(id) { return !!art(id); },
    deepen(tbId) { return deepen(tbId); },
  };
})();

// ブログ本文の表示（アプリと公開ページで共通）
// 書き方：「■」で始まる行＝見出し、空行＝段落の区切り、【写真1】【参考1】＝写真・参考の差し込み
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
  const toHalf = (s) => String(s).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));

  function refCard(r) {
    if (!r) return "";
    const u = safeUrl(r.url);
    const kind = r.kind === "basics" ? "基礎知識" : r.kind === "summaries" ? "まとめ" : "論文";
    const t = u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title);
    return `<aside class="bref"><span class="bref-k">${kind}</span><div class="bref-t">${t}</div>${r.meta ? `<div class="bref-m">${esc(r.meta)}</div>` : ""}${r.text ? `<p>${esc(r.text)}</p>` : ""}</aside>`;
  }
  function figure(img) {
    const u = safeUrl(img?.url);
    return u ? `<figure class="bimg"><img src="${esc(u)}" alt="${esc(img.caption || "")}" loading="lazy">${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ""}</figure>` : "";
  }

  window.renderPostBody = function (post) {
    const images = Array.isArray(post.images) ? post.images : [];
    const refs = Array.isArray(post.refs) ? post.refs : [];
    const usedI = new Set(), usedR = new Set();
    const blocks = String(post.body || "").replace(/\r/g, "").split(/\n{2,}/);
    const out = [];
    for (const raw of blocks) {
      const lines = raw.split("\n");
      let para = [];
      const flush = () => { if (para.length) { out.push(`<p>${para.join("<br>")}</p>`); para = []; } };
      for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (/^■/.test(l)) { flush(); out.push(`<h2>${esc(l.replace(/^■\s*/, ""))}</h2>`); continue; }
        const only = toHalf(l).match(/^【(写真|参考)(\d+)】$/);
        if (only) {
          flush(); const n = Number(only[2]) - 1;
          if (only[1] === "写真") { usedI.add(n); out.push(figure(images[n])); } else { usedR.add(n); out.push(refCard(refs[n])); }
          continue;
        }
        para.push(esc(l).replace(/【(写真|参考)([0-9０-９]+)】/g, (m, k, d) => {
          const n = Number(toHalf(d)) - 1;
          if (k === "参考" && refs[n]) { usedR.add(n); const u = safeUrl(refs[n].url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(refs[n].title)}</a>` : esc(refs[n].title); }
          return "";
        }));
      }
      flush();
    }
    // 本文に置かれなかった写真・参考は最後にまとめる
    const restI = images.filter((_, i) => !usedI.has(i));
    const restR = refs.filter((_, i) => !usedR.has(i));
    if (restI.length) out.push(restI.map(figure).join(""));
    if (restR.length) out.push(`<h2>参考</h2>${restR.map(refCard).join("")}`);
    return out.join("\n");
  };
  window.blogEsc = esc;
  window.blogSafeUrl = safeUrl;
})();

// 自分の勉強部屋：Supabase とつなぐ層
// アプリ本体は window.claude.use("db" | "user" | "sample") だけを使うので、
// ここで同じ形の窓口を Supabase とAI中継（Edge Function）の上に用意します。
(() => {
  "use strict";
  const CFG = window.STUDY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  window.claude = { use: async (name) => { const ctx = await ready; return ctx ? ctx[name] ?? null : null; } };

  // ---------- 画面（ログイン・案内） ----------
  const gate = document.createElement("div");
  gate.className = "gate";
  gate.innerHTML = `<div class="gbox"><img src="icons/icon-192.png" alt="" width="72" height="72"><h1>自分の勉強部屋</h1><div id="gbody"></div></div>`;
  const showGate = (html) => { gate.hidden = false; gate.querySelector("#gbody").innerHTML = html; };
  const hideGate = () => { gate.hidden = true; };
  document.body.appendChild(gate);

  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
    showGate(`<p>まだ初期設定が終わっていません。<br>config.js に Supabase の URL と anon key を入れると使えるようになります。</p>`);
    resolveReady(null);
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  window.__sb = sb;

  function loginForm(mode = "login", msg = "") {
    const signup = mode === "signup";
    showGate(`<p>${signup ? "はじめて使うときは、登録されたメールアドレスと、自分で決めたパスワード（8文字以上）を入れてください。" : "メールアドレスとパスワードでログインします。"}</p>
      <form id="gform" class="gform">
        <input id="gmail" type="email" required autocomplete="email" placeholder="メールアドレス" aria-label="メールアドレス">
        <input id="gpass" type="password" required minlength="8" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="パスワード" aria-label="パスワード">
        <button class="btn primary" type="submit">${signup ? "登録してはじめる" : "ログイン"}</button>
      </form><div class="gmsg">${msg}</div>
      <button class="btn ghost small" id="gswitch">${signup ? "登録済みの方はこちら（ログイン）" : "はじめての方はこちら（登録）"}</button>`);
    $("#gswitch").addEventListener("click", () => loginForm(signup ? "login" : "signup"));
    $("#gform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#gmail").value.trim().toLowerCase(), password = $("#gpass").value;
      const btn = e.target.querySelector("button"); btn.disabled = true;
      const { data, error } = signup ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) {
        const m = String(error.message || "");
        $(".gmsg").textContent = /already registered|already exists/i.test(m) ? "このアドレスは登録済みです。ログインしてください。"
          : /invalid login/i.test(m) ? "メールアドレスかパスワードが違います。"
          : /password/i.test(m) ? "パスワードは8文字以上にしてください。"
          : "うまくいきませんでした。少し待ってから、もう一度試してください。";
        return;
      }
      if (signup && !data.session) $(".gmsg").textContent = "登録しました。管理者の設定で確認メールが必要になっています。管理者に連絡してください。";
    });
  }

  // ---------- db（collection / doc / onSnapshot） ----------
  const listeners = {};
  const cache = {};
  async function fetchCol(k) {
    const { data, error } = await sb.from("docs").select("id,data").eq("collection", k);
    if (error) throw error;
    cache[k] = data;
    const snap = { docs: data.map((r) => ({ id: r.id, data: () => r.data })) };
    (listeners[k] || []).forEach((l) => l.ok(snap));
  }
  let channel = null;
  function ensureChannel() {
    if (channel) return;
    channel = sb.channel("docs-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => {
        const k = p.new?.collection || p.old?.collection;
        if (k && listeners[k]) fetchCol(k).catch(() => {});
        else Object.keys(listeners).forEach((c) => fetchCol(c).catch(() => {}));
      })
      .subscribe();
  }
  // 画面に戻ったときに最新を取り直す（スマホのスリープ対策）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") Object.keys(listeners).forEach((k) => fetchCol(k).catch(() => {}));
  });
  const fail = (e) => { const err = new Error(e?.message || "error"); err.code = e?.code === "42501" ? "forbidden" : "error"; return err; };
  const db = {
    collection(k) {
      return {
        onSnapshot(ok, bad) {
          (listeners[k] ||= []).push({ ok, bad });
          ensureChannel();
          fetchCol(k).catch((e) => bad && bad(e));
          return () => { listeners[k] = (listeners[k] || []).filter((l) => l.ok !== ok); };
        },
        doc(id) {
          return {
            async set(data) {
              const { error } = await sb.from("docs").upsert({ collection: k, id, data });
              if (error) throw fail(error);
              fetchCol(k).catch(() => {});
            },
            async delete() {
              const { error } = await sb.from("docs").delete().eq("collection", k).eq("id", id);
              if (error) throw fail(error);
              fetchCol(k).catch(() => {});
            },
          };
        },
      };
    },
  };

  // ---------- sample（AI） ----------
  const sample = {
    async json(input, opts = {}) {
      const { data: s } = await sb.auth.getSession();
      let r;
      try {
        r = await fetch(`${CFG.supabaseUrl}/functions/v1/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${s?.session?.access_token || ""}` },
          body: JSON.stringify({ input }),
          signal: opts.signal,
        });
      } catch (e) {
        const err = new Error("network"); err.code = e?.name === "AbortError" ? "cancelled" : "network"; throw err;
      }
      let body = null; try { body = await r.json(); } catch {}
      if (r.ok && body && "result" in body) return body.result;
      const err = new Error(body?.error || "error");
      err.code = r.status === 429 ? "rate_limited"
        : body?.error === "invalid_json" ? "invalid_json"
        : (r.status === 403 || r.status === 401 || body?.error === "not_configured" || r.status === 404) ? "not_granted"
        : "error";
      throw err;
    },
  };

  // ---------- メンバー管理（管理者だけ） ----------
  const ROLE_JA = { viewer: "見る", editor: "見る＋追加・編集", admin: "管理者" };
  async function openMembers(myEmail) {
    const box = document.createElement("div");
    box.className = "sheet"; box.id = "msheet";
    box.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">メンバー</h2>
      <p class="hint">ここに登録したメールアドレスの人だけがログインして使えます。</p>
      <form id="madd" class="madd">
        <input id="memail" type="email" required placeholder="メールアドレス" aria-label="メールアドレス">
        <input id="mname" placeholder="名前（任意）" aria-label="名前">
        <select id="mrole" aria-label="できること"><option value="viewer">見る</option><option value="editor">見る＋追加・編集</option><option value="admin">管理者</option></select>
        <button class="btn primary" type="submit">追加</button>
      </form>
      <div class="err" id="merr"></div>
      <div id="mlist" class="mlist">読み込み中</div>
      <div class="acts"><span style="flex:1"></span><button class="btn" id="mclose">閉じる</button></div></div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector("#mclose").addEventListener("click", close);
    async function load() {
      const { data, error } = await sb.from("members").select("email,role,name").order("created_at");
      if (error) { box.querySelector("#mlist").textContent = "読み込めませんでした。"; return; }
      box.querySelector("#mlist").innerHTML = data.map((m) => `<div class="mrow"><div><b>${esc(m.name || m.email)}</b><span class="hint">${esc(m.name ? m.email : "")}</span></div>
        <select data-role="${esc(m.email)}" ${m.email === myEmail ? "disabled" : ""}>${Object.entries(ROLE_JA).map(([v, l]) => `<option value="${v}" ${v === m.role ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${m.email === myEmail ? `<span class="hint">あなた</span>` : `<button class="btn ghost small" data-del="${esc(m.email)}">外す</button>`}</div>`).join("");
    }
    box.querySelector("#madd").addEventListener("submit", async (e) => {
      e.preventDefault();
      const row = { email: box.querySelector("#memail").value.trim().toLowerCase(), name: box.querySelector("#mname").value.trim() || null, role: box.querySelector("#mrole").value };
      const { error } = await sb.from("members").upsert(row);
      box.querySelector("#merr").textContent = error ? "追加できませんでした。" : "";
      if (!error) { e.target.reset(); load(); }
    });
    box.querySelector("#mlist").addEventListener("change", async (e) => {
      const em = e.target.dataset.role; if (!em) return;
      const { error } = await sb.from("members").update({ role: e.target.value }).eq("email", em);
      box.querySelector("#merr").textContent = error ? "変更できませんでした。" : "";
    });
    box.querySelector("#mlist").addEventListener("click", async (e) => {
      const em = e.target.dataset.del; if (!em) return;
      if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = "本当に外す"; return; }
      const { error } = await sb.from("members").delete().eq("email", em);
      box.querySelector("#merr").textContent = error ? "外せませんでした。" : "";
      load();
    });
    load();
  }

  function accountBar(email, role) {
    const bar = document.createElement("div");
    bar.className = "acct";
    bar.innerHTML = `<span>${esc(email)}</span>${role === "admin" ? `<button class="btn ghost small" id="membersBtn">メンバー</button>` : ""}<button class="btn ghost small" id="logoutBtn">ログアウト</button>`;
    const header = document.querySelector(".wrap header");
    (header || document.body).appendChild(bar);
    bar.querySelector("#logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
    bar.querySelector("#membersBtn")?.addEventListener("click", () => openMembers(email));
  }

  // ---------- 起動 ----------
  let started = false;
  async function start(session) {
    if (started || !session) return;
    const email = (session.user?.email || "").toLowerCase();
    const { data: role, error } = await sb.rpc("my_role");
    if (error || !role) {
      showGate(`<p>${esc(email)} はまだメンバーに登録されていません。<br>管理者に登録を頼んでから、もう一度ログインしてください。</p><button class="btn" id="gout">別のアドレスでログイン</button>`);
      $("#gout").addEventListener("click", async () => { await sb.auth.signOut(); loginForm(); });
      return;
    }
    started = true;
    hideGate();
    accountBar(email, role);
    const user = { canEdit: async () => role === "editor" || role === "admin", isOwner: async () => role === "admin", email, role };
    resolveReady({ db, user, sample: CFG.ai ? sample : null });
  }
  sb.auth.onAuthStateChange((_ev, session) => { if (session) start(session); });
  sb.auth.getSession().then(({ data }) => { if (data.session) start(data.session); else loginForm(); });
})();

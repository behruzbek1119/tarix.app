/* sync.js — natijalarni Supabase'ga yuborish + faqat admin uchun 📊 Natijalar paneli.
   index.html ichida asosiy <script> dan KEYIN ulanadi. Boshqa kodga tegmaydi. */
(function () {
  "use strict";
  var SB_URL = "https://khutbnhzhsmhknztgbcr.supabase.co";
  var SB_KEY = "sb_publishable_HKVmurPHGhoSwXvARH0dJQ_TE6YSSze";
  var TOK = "tarix_tok", QK = "tarix_q", ADM = "tarix_admin";

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* Maxsus havoladagi ?t= tokenni eslab qolamiz (asosiy kod uni manzildan o'chiradi) */
  (function () {
    var m = location.search.match(/[?&]t=([^&]+)/);
    if (m) { try { ls(TOK, decodeURIComponent(m[1])); } catch (e) {} }
    if (/#admin\b/.test(location.hash)) ls(ADM, "1");
  })();

  /* ---------- Supabase RPC ---------- */
  function rpc(fn, body) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SB_KEY },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("HTTP " + r.status));
        return j;
      });
    });
  }

  /* ---------- yuborish (internet yo'q bo'lsa navbatga qo'yiladi) ---------- */
  function getQ() { try { return JSON.parse(ls(QK) || "[]"); } catch (e) { return []; } }
  function setQ(a) { ls(QK, JSON.stringify(a.slice(-30))); }

  function send(item) {
    var tok = ls(TOK);
    if (!tok) return;
    rpc("submit_result", {
      p_t: tok, p_tgid: item.tgid, p_name: item.name, p_cls: item.cls,
      p_test: item.test, p_score: item.score, p_total: item.total, p_wrong: item.wrong
    }).catch(function (e) {
      var msg = String((e && e.message) || "");
      if (/token|natija/i.test(msg)) return;      /* server rad etdi — qayta urinmaymiz */
      var q = getQ(); q.push(item); setQ(q);       /* tarmoq xatosi — keyinroq qayta yuboramiz */
    });
  }
  function flush() {
    if (!ls(TOK)) return;
    var q = getQ();
    if (!q.length) return;
    setQ([]);
    q.forEach(send);
  }

  function who() {
    var uu = null;
    try { uu = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user; } catch (e) {}
    if (uu) {
      return { id: uu.id || 0, name: ((uu.first_name || "") + " " + (uu.last_name || "")).trim() || uu.username || "Nomsiz" };
    }
    /* Telegram'siz (brauzerda): bir marta ism so'raladi va eslab qolinadi */
    var nm = null;
    try { nm = localStorage.getItem("tarix_name"); } catch (e) {}
    if (!nm) {
      try { nm = window.prompt ? prompt("Test natijasi kimniki?\nIsmingizni yozing:", "") : ""; } catch (e) { nm = ""; }
      nm = String(nm || "").trim().slice(0, 40);
      if (nm) { try { localStorage.setItem("tarix_name", nm); } catch (e) {} }
    }
    return { id: 0, name: nm || "Brauzer" };
  }
  function submit(cls, test, score, total, wrong) {
    score = Math.round(score); total = Math.round(total);
    if (!(total >= 1 && total <= 500) || score < 0 || score > total) return;
    var w = who();
    send({ tgid: w.id, name: w.name, cls: String(cls || ""), test: String(test || "Test"),
           score: score, total: total, wrong: wrong || [] });
  }

  /* ---------- mavjud funksiyalarga ulanish ---------- */
  var _sr = window.showResults;
  if (typeof _sr === "function") {
    window.showResults = function () {
      _sr.apply(this, arguments);
      try {
        var all = window.SAVOLLAR[activeEra];
        if (activeIdx.length !== all.length) return;            /* faqat to'liq test */
        var cls = (curCls != null) ? curCls : String(activeEra).replace(/m.*$/, "");
        var title = (typeof mvTitleOf === "function" && mvTitleOf(activeEra)) || "Test";
        var wr = wrongList.slice(0, 40).map(function (w) {
          var q = all[w.idx];
          return { q: q ? String(q.q).slice(0, 120) : "", s: w.sel };
        });
        submit(cls, title, score, activeQuestions.length, wr);
      } catch (e) {}
    };
  }

  var _ge = window.gEnd;
  if (typeof _ge === "function") {
    window.gEnd = function () {
      _ge.apply(this, arguments);
      try {
        if (gN >= 1) submit("oyin", "Vaqt mashinasi · " + gY + "-yil · " + gBall + " ball", gOk, gN, []);
      } catch (e) {}
    };
  }

  var _ac = window.attCheck;
  if (typeof _ac === "function") {
    window.attCheck = function () {
      var wasDone = avDone;
      _ac.apply(this, arguments);
      try {
        if (!wasDone && avDone && avV && avV.a && avV.a.length === avV.questions.length) {
          var el = document.getElementById("av-sum");
          var m = /(\d+)\s*\/\s*(\d+)/.exec(el ? el.textContent : "");
          if (m) submit("attestat", attTitle(avV), +m[1], +m[2], []);
        }
      } catch (e) {}
    };
  }

  setTimeout(flush, 3000);
  window.addEventListener("online", flush);

  /* ---------- 📊 Natijalar paneli (faqat admin) ---------- */
  var rows = [];

  function fmtDate(r) {
    var k = Object.keys(r).filter(function (x) { return /created|time|_at$|date/i.test(x); })[0];
    if (!k || !r[k]) return "";
    try { return new Date(r[k]).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return String(r[k]); }
  }

  function openPanel() {
    var old = document.getElementById("sb-panel");
    if (old) old.remove();
    var p = document.createElement("div");
    p.id = "sb-panel";
    p.style.cssText = "position:fixed;inset:0;z-index:200;background:var(--night);overflow-y:auto;padding:16px 16px 60px;color:var(--ink)";
    p.innerHTML =
      '<div style="max-width:560px;margin:0 auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h2 style="margin:6px 0">📊 Natijalar</h2>' +
      '<button id="sb-x" style="padding:8px 14px;border:1px solid var(--line);border-radius:10px">Yopish</button></div>' +
      '<input id="sb-tok" type="password" class="search" placeholder="Admin tokeni" autocomplete="off">' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<select id="sb-days" class="search" style="margin:0;flex:1">' +
      '<option value="1">Bugun</option><option value="7" selected>7 kun</option>' +
      '<option value="30">30 kun</option><option value="0">Hammasi</option></select>' +
      '<button id="sb-go" class="go" style="flex:1;text-align:center">Yuklash</button></div>' +
      '<input id="sb-f" class="search" placeholder="Ism, sinf yoki test bo\'yicha qidirish" style="margin-top:10px">' +
      '<div id="sb-sum" class="note"></div><div id="sb-list"></div></div>';
    document.body.appendChild(p);
    var tok = p.querySelector("#sb-tok");
    tok.value = ls(TOK) || "";
    p.querySelector("#sb-x").onclick = function () { p.remove(); };
    p.querySelector("#sb-go").onclick = load;
    p.querySelector("#sb-f").oninput = draw;
    if (tok.value) load();
  }

  function load() {
    var tok = document.getElementById("sb-tok").value.trim();
    var days = +document.getElementById("sb-days").value;
    var list = document.getElementById("sb-list");
    if (!tok) { list.innerHTML = '<p class="note">Admin tokenini kiriting.</p>'; return; }
    list.innerHTML = '<div class="load">Yuklanmoqda...</div>';
    rpc("get_results", { p_t: tok, p_days: days }).then(function (d) {
      rows = Array.isArray(d) ? d : [];
      draw();
    }).catch(function (e) {
      list.innerHTML = '<p class="note">Xato: ' + esc(e.message) + '</p>';
    });
  }

  function draw() {
    var q = (document.getElementById("sb-f").value || "").trim().toLowerCase();
    var R = rows.filter(function (r) {
      return !q || (String(r.name) + " " + r.cls + " " + r.test).toLowerCase().indexOf(q) >= 0;
    });
    var avg = R.length ? Math.round(R.reduce(function (s, r) { return s + (+r.pct || 0); }, 0) / R.length) : 0;
    var ppl = {};
    R.forEach(function (r) { ppl[String(r.tg_id || r.name || "?")] = 1; });
    document.getElementById("sb-sum").textContent =
      Object.keys(ppl).length + " o'quvchi · " + R.length + " ta natija · o'rtacha " + avg + "%";
    document.getElementById("sb-list").innerHTML = R.map(function (r) {
      var w = Array.isArray(r.wrong) ? r.wrong : [];
      var col = r.pct >= 80 ? "#2FD0A0" : r.pct >= 50 ? "var(--gold)" : "#E0586E";
      return '<div class="card" data-rid="' + esc(r.id) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(r.name) + '</b>' +
        '<b style="color:' + col + '">' + esc(r.score) + '/' + esc(r.total) + ' · ' + esc(r.pct) + '%</b></div>' +
        '<div class="sub">' + esc(r.cls) + ' · ' + esc(r.test) + '</div>' +
        '<div class="sub">' + esc(fmtDate(r)) + (r.tg_id ? ' · ID ' + esc(r.tg_id) : '') + '</div>' +
        (w.length ? '<details style="margin-top:6px"><summary class="sub">Xatolar: ' + w.length + '</summary>' +
          w.map(function (x) { return '<div class="sub" style="margin-top:4px">• ' + esc(x.q) + '</div>'; }).join("") + '</details>' : '') +
        '<button data-del="' + esc(r.id) + '" style="margin-top:8px;color:#E0586E;font-size:13px">🗑 O\'chirish</button></div>';
    }).join("") || '<p class="note">Natija topilmadi.</p>';
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-del]");
    if (!b) return;
    if (!confirm("Bu natijani o'chirasizmi?")) return;
    var id = b.getAttribute("data-del");
    rpc("delete_result", { p_t: document.getElementById("sb-tok").value.trim(), p_id: +id }).then(function () {
      rows = rows.filter(function (r) { return String(r.id) !== String(id); });
      draw();
    }).catch(function (err) { alert("Xato: " + err.message); });
  });

  /* ---------- 🏆 Umumiy reyting (Supabase) ----------
     Serverdan o'quvchilar o'rtachasini olib, Reyting bo'limida chiqaramiz. */
  var _dr = window.drawRating, _rc = null, _rf = false, _rd = false;

  function renderRating(list) {
    var el = document.getElementById("ranks");
    if (!el || !list || !list.length) return;
    var me = (typeof u !== "undefined" && u && u.first_name) ? u.first_name : "Siz";
    var rows = list.slice(0, 10).map(function (r, i) {
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
      var mine = String(r.name) === me ? ' style="border-color:var(--gold)"' : "";
      return '<div class="rk"' + mine + '><b>' + medal + '</b><span>' + esc(r.name) +
        '</span><b>' + esc(r.avg_pct) + '%</b></div>';
    }).join("");
    var myLine = (P && P.tries) ? '<p class="note" style="margin-top:8px">Siz: o\'rtacha ' +
      Math.round(P.sumPct / P.tries) + '% · ' + P.tries + ' test · ' + P.pts + ' ball</p>' : "";
    el.innerHTML = rows +
      '<p class="note" style="margin-top:8px">Umumiy reyting — o\'rtacha foiz bo\'yicha (barcha testlar asosida).</p>' +
      myLine;
  }

  if (typeof _dr === "function") {
    window.drawRating = function () {
      try { _dr.apply(this, arguments); } catch (e) {}
      if (_rd) { renderRating(_rc); return; }
      if (_rf) return;
      _rf = true;
      rpc("rating_top", {}).then(function (d) {
        _rc = Array.isArray(d) ? d : [];
        _rd = true; _rf = false;
        renderRating(_rc);
      }).catch(function () { _rf = false; });
    };
  }

  /* ---------- 📊 tugma: faqat o'qituvchi (admin) tokenida chiqadi ----------
     #admin bilan ochilgan bo'lsa ham ko'rinadi (zaxira yo'l). */
  var ADM_HASH = "6f2ed54e24513909c985ff20617167f1abf7aa62cca33788603d4f16bbe6d609";

  function showBtn() {
    if (document.getElementById("sb-btn")) return;
    var btn = document.createElement("button");
    btn.id = "sb-btn";
    btn.textContent = "📊";
    btn.setAttribute("aria-label", "Natijalar");
    btn.style.cssText = "position:fixed;right:14px;bottom:calc(86px + env(safe-area-inset-bottom,0));z-index:40;width:46px;height:46px;border-radius:50%;background:var(--lapis);border:2px solid var(--gold);font-size:20px;text-align:center";
    btn.onclick = openPanel;
    document.body.appendChild(btn);
  }

  function checkAdmin() {
    if (ls(ADM) === "1") { showBtn(); return; }        /* #admin bilan ochilgan */
    var tok = ls(TOK);
    if (!tok || !window.crypto || !crypto.subtle || !crypto.subtle.digest) return;
    try {
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok)).then(function (buf) {
        var hex = Array.from(new Uint8Array(buf)).map(function (x) {
          return x.toString(16).padStart(2, "0");
        }).join("");
        if (hex === ADM_HASH) showBtn();               /* o'qituvchi tokeni */
      }).catch(function () {});
    } catch (e) {}
  }
  checkAdmin();
  window.addEventListener("online", checkAdmin);
})();

/* ============================================================
   InnovationAMP · Оценка на обученията — админ панел
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const NQ = CONFIG.QUESTIONS.length;
  const PWD_KEY = "innovationamp_admin_pwd";
  const RESET_WORD = "ИЗТРИЙ";

  let password = "";
  let rows = [];
  let filter = "all";

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toFixed(2).replace(".", ",");
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const rowMean = (r) => mean(r.scores);
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const visible = () => filter === "all" ? rows : rows.filter(r => r.training === filter);
  const shownTrainings = () => CONFIG.TRAININGS.filter(t => filter === "all" || t.key === filter);

  function toast(text, isError) {
    const el = $("toast");
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    el.classList.add("is-on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("is-on"), 3600);
  }

  /* ---------- вход ---------- */
  async function load(pwd, silent) {
    const res = await API.list(pwd);
    if (!res.ok) {
      if (res.error === "auth" || res.error === "nopassword") {
        sessionStorage.removeItem(PWD_KEY);
        showLogin(silent ? "" : res.message);
      } else if ($("dash").hidden) {
        showLogin(res.message);
      } else {
        toast(res.message, true);
      }
      return false;
    }
    password = pwd;
    sessionStorage.setItem(PWD_KEY, pwd);
    rows = (res.rows || []).filter(r => CONFIG.trainingByKey(r.training))
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    $("login").hidden = true;
    $("dash").hidden = false;
    $("updated").textContent = "Обновено: " + fmtDate(new Date().toISOString());
    render();
    return true;
  }

  function showLogin(msg) {
    $("dash").hidden = true;
    $("login").hidden = false;
    $("loginMsg").textContent = msg || "";
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Вход";
  }

  $("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginBtn").disabled = true;
    $("loginBtn").innerHTML = '<span class="spinner"></span> Проверка…';
    $("loginMsg").textContent = "";
    const ok = await load($("pwd").value, false);
    if (ok) $("pwd").value = "";
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(PWD_KEY);
    password = ""; rows = [];
    showLogin("");
  });

  /* ---------- рендер ---------- */
  function render() {
    renderFilters();
    renderKpis();
    renderAvg();
    renderDist();
    renderComments();
    renderTable();
  }

  function renderFilters() {
    const box = $("filters");
    const count = (k) => rows.filter(r => r.training === k).length;
    box.innerHTML =
      '<button class="chip" type="button" data-f="all" aria-pressed="' + (filter === "all") + '">Всички обучения · ' + rows.length + '</button>' +
      CONFIG.TRAININGS.map(t =>
        '<button class="chip" type="button" data-f="' + t.key + '" aria-pressed="' + (filter === t.key) + '" style="--c:' + t.color + '">' +
        '<i></i>' + esc(t.short) + ' · ' + count(t.key) + '</button>').join("");
    box.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
  }

  function renderKpis() {
    const v = visible();
    const forms = new Set(v.map(r => r.submission)).size;
    const all = v.flatMap(r => r.scores);
    const m = mean(all);
    const comments = v.filter(r => r.comment).length;
    const top = all.length ? Math.round(all.filter(s => s >= 4).length / all.length * 100) : null;
    const tile = (label, value, sub) =>
      '<div class="card kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + '</div><div class="kpi-sub">' + sub + '</div></div>';
    $("kpis").innerHTML =
      tile("Участници (формуляри)", forms, "изпратени анонимни формуляра") +
      tile("Оценени обучения", v.length, "общо оценки на обучения") +
      tile("Обща средна оценка", m === null ? "—" : fmt(m) + "<small>/ 5</small>", "по всички въпроси") +
      tile("Положителни отговори", top === null ? "—" : top + "<small>%</small>", "дял на оценките 4 и 5") +
      tile("Коментари", comments, "от " + v.length + " оценки");
  }

  /* Средни оценки: групирани хоризонтални ленти (въпрос -> обучения). */
  function renderAvg() {
    const box = $("avgChart");
    const ts = shownTrainings().filter(t => rows.some(r => r.training === t.key));
    if (!ts.length) { box.innerHTML = '<div class="empty">Все още няма отговори.</div>'; return; }

    const groups = CONFIG.QUESTIONS.map((q, qi) => ({ label: (qi + 1) + ". " + q.short, full: q.text, pick: (r) => [r.scores[qi]] }));
    groups.push({ label: "Средно за обучението", full: "Средна оценка по всички въпроси", pick: (r) => r.scores });

    let html = "";
    if (ts.length > 1) {
      html += '<div class="legend">' + ts.map(t => '<span><i style="--c:' + t.color + '"></i>' + esc(t.short) + '</span>').join("") + '</div>';
    }
    html += '<div class="bars">';
    groups.forEach(g => {
      html += '<div><div class="bar-group-label">' + esc(g.label) + '</div>';
      ts.forEach(t => {
        const mine = rows.filter(r => r.training === t.key);
        const m = mean(mine.flatMap(g.pick));
        html += '<div class="bar-row" data-tip="' + esc(t.short) + '" data-tip2="' + esc(g.full) + ' · средно ' + fmt(m) + ' от ' + mine.length + ' оценки">' +
          '<div class="bar-track"><div class="bar-fill" style="--c:' + t.color + '" data-w="' + (m / 5 * 100) + '"></div></div>' +
          '<div class="bar-val">' + fmt(m) + '</div></div>';
      });
      html += '</div>';
    });
    html += '</div><div class="bar-axis"><div><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><span></span></div>';
    box.innerHTML = html;
    requestAnimationFrame(() => box.querySelectorAll(".bar-fill").forEach(f => { f.style.width = f.dataset.w + "%"; }));
  }

  /* Разпределение: 100% подредени ленти с дивергираща палитра. */
  function renderDist() {
    const box = $("distChart");
    const ts = shownTrainings().filter(t => rows.some(r => r.training === t.key));
    if (!ts.length) { box.innerHTML = '<div class="empty">Все още няма отговори.</div>'; return; }

    let html = '<div class="legend">' + [1, 2, 3, 4, 5].map(v =>
      '<span><i data-v="' + v + '"></i>' + v + ' — ' + esc(CONFIG.SCALE[v]) + '</span>').join("") + '</div><div class="dist">';
    ts.forEach(t => {
      const mine = rows.filter(r => r.training === t.key);
      html += '<div><div class="dist-title" style="--c:' + t.color + '"><i></i>' + esc(t.short) +
        ' <small>· ' + mine.length + ' оценки</small></div>';
      CONFIG.QUESTIONS.forEach((q, qi) => {
        const counts = [0, 0, 0, 0, 0];
        mine.forEach(r => { const s = r.scores[qi]; if (s >= 1 && s <= 5) counts[s - 1]++; });
        html += '<div class="dist-row"><span>' + esc(q.short) + '</span><div class="stack">';
        counts.forEach((c, i) => {
          if (!c) return;
          const pct = c / mine.length * 100;
          html += '<div class="seg" data-v="' + (i + 1) + '" style="flex:' + c + ' 1 0" data-tip="' + (i + 1) + ' — ' + esc(CONFIG.SCALE[i + 1]) +
            '" data-tip2="' + esc(q.short) + ' · ' + c + ' от ' + mine.length + ' (' + Math.round(pct) + '%)">' +
            (pct >= 12 ? Math.round(pct) + "%" : "") + '</div>';
        });
        html += '</div></div>';
      });
      html += '</div>';
    });
    box.innerHTML = html + '</div>';
  }

  function tag(key) {
    const t = CONFIG.trainingByKey(key);
    return '<span class="tag" style="--c:' + t.color + '"><i></i>' + esc(t.short) + '</span>';
  }
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>';

  function renderComments() {
    const list = visible().filter(r => r.comment);
    $("commentCount").textContent = "· " + list.length;
    $("comments").innerHTML = list.length
      ? '<div class="comments">' + list.map(r =>
          '<div class="comment"><div class="comment-meta">' + tag(r.training) +
          '<span>' + esc(fmtDate(r.ts)) + '</span><span>средна оценка ' + fmt(rowMean(r)) + '</span></div>' +
          '<p>' + esc(r.comment) + '</p></div>').join("") + '</div>'
      : '<div class="empty">Няма коментари.</div>';
  }

  function renderTable() {
    const v = visible();
    $("rowCount").textContent = "· " + v.length;
    if (!v.length) { $("table").innerHTML = '<div class="empty">Няма записани отговори.</div>'; return; }
    $("table").innerHTML =
      '<div class="table-wrap"><table><thead><tr><th>Дата и час</th><th>Обучение</th>' +
      CONFIG.QUESTIONS.map((q, i) => '<th class="num" title="' + esc(q.text) + '">В' + (i + 1) + '</th>').join("") +
      '<th class="num">Средно</th><th>Коментар</th><th><span style="position:absolute;left:-9999px">Действия</span></th></tr></thead><tbody>' +
      v.map(r =>
        '<tr><td class="nowrap">' + esc(fmtDate(r.ts)) + '</td><td>' + tag(r.training) + '</td>' +
        r.scores.map(s => '<td class="num">' + esc(s) + '</td>').join("") +
        '<td class="num">' + fmt(rowMean(r)) + '</td><td class="cmt">' + esc(r.comment || "—") + '</td>' +
        '<td><button class="icon-btn" type="button" data-del="' + esc(r.id) + '" aria-label="Изтрий този отговор" title="Изтрий този отговор">' + TRASH + '</button></td></tr>'
      ).join("") + '</tbody></table></div>';
    $("table").querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => askDelete(b.dataset.del)));
  }

  /* ---------- tooltip ---------- */
  const tip = $("tip");
  document.addEventListener("mousemove", (e) => {
    const el = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!el) { tip.classList.remove("is-on"); return; }
    tip.innerHTML = esc(el.dataset.tip) + (el.dataset.tip2 ? "<small>" + esc(el.dataset.tip2) + "</small>" : "");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.classList.add("is-on");
  });

  /* ---------- модал ---------- */
  function confirmModal(opts) {
    return new Promise(resolve => {
      const m = $("modal"), input = $("modalInput"), ok = $("modalOk");
      $("modalTitle").textContent = opts.title;
      $("modalText").textContent = opts.text;
      ok.textContent = opts.ok || "Изтрий";
      input.hidden = !opts.word;
      input.value = "";
      ok.disabled = !!opts.word;
      m.hidden = false;
      (opts.word ? input : $("modalCancel")).focus();

      const onInput = () => { ok.disabled = input.value.trim().toUpperCase() !== opts.word; };
      const close = (val) => {
        m.hidden = true;
        input.removeEventListener("input", onInput);
        ok.removeEventListener("click", yes);
        $("modalCancel").removeEventListener("click", no);
        document.removeEventListener("keydown", onKey);
        resolve(val);
      };
      const yes = () => close(true), no = () => close(false);
      const onKey = (e) => { if (e.key === "Escape") no(); };
      input.addEventListener("input", onInput);
      ok.addEventListener("click", yes);
      $("modalCancel").addEventListener("click", no);
      document.addEventListener("keydown", onKey);
    });
  }

  async function askDelete(id) {
    const r = rows.find(x => x.id === id);
    if (!r) return;
    const yes = await confirmModal({
      title: "Изтриване на отговор",
      text: "Ще бъде изтрита оценката за „" + CONFIG.trainingByKey(r.training).short + "“ от " + fmtDate(r.ts) + ". Действието е необратимо."
    });
    if (!yes) return;
    const res = await API.remove(password, id);
    if (!res.ok) { toast(res.message, true); return; }
    toast("Отговорът е изтрит.");
    load(password, true);
  }

  $("resetBtn").addEventListener("click", async () => {
    if (!rows.length) { toast("Базата вече е празна."); return; }
    const yes = await confirmModal({
      title: "Изтриване на цялата база",
      text: "Ще бъдат изтрити безвъзвратно всички " + rows.length + " записа — за всички обучения, независимо от избрания филтър. Препоръчваме първо да изтеглите CSV. За потвърждение напишете " + RESET_WORD + ".",
      word: RESET_WORD,
      ok: "Изтрий всичко"
    });
    if (!yes) return;
    const res = await API.reset(password);
    if (!res.ok) { toast(res.message, true); return; }
    toast("Базата е изчистена (" + res.deleted + " записа).");
    filter = "all";
    load(password, true);
  });

  $("refreshBtn").addEventListener("click", async () => {
    $("refreshBtn").disabled = true;
    if (await load(password, true)) toast("Данните са обновени.");
    $("refreshBtn").disabled = false;
  });

  /* ---------- CSV (разделител „;“ + BOM — отваря се директно в Excel) ---------- */
  $("csvBtn").addEventListener("click", () => {
    const v = visible();
    if (!v.length) { toast("Няма данни за експорт."); return; }
    const cell = (x) => {
      let s = String(x === null || x === undefined ? "" : x);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;            // срещу формули в Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const head = ["ID", "Формуляр", "Дата и час", "Обучение"]
      .concat(CONFIG.QUESTIONS.map((q, i) => "В" + (i + 1) + " " + q.short)).concat(["Средно", "Коментар"]);
    const lines = [head.map(cell).join(";")].concat(v.map(r =>
      [r.id, r.submission, fmtDate(r.ts), CONFIG.trainingByKey(r.training).title]
        .concat(r.scores).concat([fmt(rowMean(r)), r.comment]).map(cell).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "innovationamp-ocenki-" + new Date().toISOString().slice(0, 10) + (filter === "all" ? "" : "-" + filter) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* ---------- демо ---------- */
  if (API.demoMode()) {
    $("demoPill").hidden = false;
    $("demoHint").hidden = false;
    $("seedBtn").hidden = false;
    $("seedBtn").addEventListener("click", async () => {
      await API.seed(password);
      toast("Добавени са примерни отговори.");
      load(password, true);
    });
  }

  /* ---------- старт ---------- */
  const saved = sessionStorage.getItem(PWD_KEY);
  if (saved) load(saved, true);
})();

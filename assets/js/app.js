/* ============================================================
   InnovationAMP · Оценка на обученията — логика на формата
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const NQ = CONFIG.QUESTIONS.length;

  const ICONS = {
    ai:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    iot:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7.2l3.8 3M18 7.2l-3.8 3M6 16.8l3.8-3M18 16.8l-3.8-3"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></svg>'
  };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- състояние ---------- */
  const state = {
    selected: [],          // ключове на избраните обучения, в реда от CONFIG
    answers: {},           // key -> { scores:[null x5], comment:"" }
    active: null,          // ключ на отворения таб
    showErrors: false,
    sending: false
  };
  CONFIG.TRAININGS.forEach(t => { state.answers[t.key] = { scores: Array(NQ).fill(null), comment: "" }; });

  const missingOf = (key) => {
    const a = state.answers[key];
    const m = a.scores.map((s, i) => (s === null ? i : -1)).filter(i => i >= 0);
    if (CONFIG.COMMENT_REQUIRED && !a.comment.trim()) m.push(NQ);
    return m;
  };
  const answeredOf = (key) => state.answers[key].scores.filter(s => s !== null).length;
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  /* ---------- стъпки ---------- */
  function goStage(name) {
    document.querySelectorAll(".stage").forEach(s => s.classList.toggle("is-active", s.id === "stage-" + name));
    const order = ["select", "rate", "done"];
    const idx = order.indexOf(name);
    document.querySelectorAll("#steps li").forEach((li, i) => {
      li.classList.toggle("is-current", i === idx);
      li.classList.toggle("is-done", idx > -1 && i < idx);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(text, isError) {
    const el = $("toast");
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    el.classList.add("is-on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("is-on"), 4200);
  }

  /* ---------- 1 · избор ---------- */
  function buildPick() {
    const box = $("pick");
    CONFIG.TRAININGS.forEach(t => {
      const label = document.createElement("label");
      label.className = "pick-card";
      label.style.setProperty("--c", t.color);
      label.style.setProperty("--g", t.glow);
      label.innerHTML =
        '<input type="checkbox" name="training" value="' + t.key + '">' +
        '<span class="pick-body">' +
          '<span class="pick-icon">' + ICONS[t.key] + '</span>' +
          '<span><span class="pick-title"></span><span class="pick-sub">Обучение на Институт GATE</span></span>' +
          '<span class="pick-check">' + CHECK + '</span>' +
        '</span>';
      label.querySelector(".pick-title").textContent = t.title;
      label.querySelector(".pick-title").style.display = "block";
      label.querySelector(".pick-sub").style.display = "block";
      label.querySelector("input").addEventListener("change", onPickChange);
      box.appendChild(label);
    });
  }

  function onPickChange() {
    const checked = Array.from(document.querySelectorAll('#pick input:checked')).map(i => i.value);
    state.selected = CONFIG.TRAININGS.map(t => t.key).filter(k => checked.includes(k));
    const n = state.selected.length;
    $("toRate").disabled = n === 0;
    $("pickHint").textContent = n === 0
      ? "Изберете поне едно обучение."
      : "Избрани: " + plural(n, "обучение", "обучения") + " · " + plural(n * NQ, "въпрос", "въпроса");
  }

  /* ---------- 2 · табове и панели ---------- */
  function buildRate() {
    const tabs = $("tabs"), panels = $("panels");
    tabs.innerHTML = ""; panels.innerHTML = "";
    state.showErrors = false;
    $("formMsg").textContent = "";

    state.selected.forEach((key, i) => {
      const t = CONFIG.trainingByKey(key);

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab";
      tab.id = "tab-" + key;
      tab.dataset.key = key;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "panel-" + key);
      tab.style.setProperty("--c", t.color);
      tab.style.setProperty("--g", t.glow);
      tab.innerHTML =
        '<span class="ring"><svg viewBox="0 0 40 40"><circle class="ring-bg" cx="20" cy="20" r="16"/><circle class="ring-fg" cx="20" cy="20" r="16"/></svg><span></span></span>' +
        '<span class="tab-label"><span class="tab-name"></span><small></small></span>';
      tab.querySelector(".tab-name").textContent = t.short;
      tab.addEventListener("click", () => activate(key, true));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const j = (state.selected.indexOf(key) + (e.key === "ArrowRight" ? 1 : -1) + state.selected.length) % state.selected.length;
        activate(state.selected[j], true);
        $("tab-" + state.selected[j]).focus();
      });
      tabs.appendChild(tab);

      const panel = document.createElement("div");
      panel.className = "panel";
      panel.id = "panel-" + key;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "tab-" + key);
      panel.style.setProperty("--c", t.color);
      panel.style.setProperty("--g", t.glow);
      panel.hidden = true;

      const title = document.createElement("div");
      title.className = "panel-title";
      title.innerHTML = "<i></i><h3></h3>";
      title.querySelector("h3").textContent = t.title;
      panel.appendChild(title);

      CONFIG.QUESTIONS.forEach((q, qi) => panel.appendChild(buildQuestion(key, qi, q)));
      panel.appendChild(buildComment(key));
      panels.appendChild(panel);
    });

    if (!state.selected.includes(state.active)) state.active = state.selected[0];
    activate(state.active, false);
    refresh();
  }

  function buildQuestion(key, qi, q) {
    const card = document.createElement("div");
    card.className = "card q";
    card.id = "q-" + key + "-" + qi;
    const labelId = "ql-" + key + "-" + qi;
    card.innerHTML =
      '<div class="q-head"><span class="q-num">' + (qi + 1) + '</span><span class="q-text" id="' + labelId + '"></span></div>' +
      '<div class="scale" role="slider" tabindex="0" aria-labelledby="' + labelId + '" aria-valuemin="1" aria-valuemax="5" aria-valuetext="Няма избрана оценка">' +
        '<div class="scale-rail"><div class="scale-fill"></div>' +
          [1, 2, 3, 4, 5].map(v => '<span class="scale-stop" style="left:' + (v - 1) * 25 + '%">' + v + '</span>').join("") +
          '<div class="scale-thumb"></div>' +
        '</div>' +
        '<div class="scale-ends"><span>Напълно несъгласен</span><span>Напълно съгласен</span></div>' +
        '<div class="scale-value">Плъзнете или изберете оценка</div>' +
      '</div>' +
      '<div class="q-error">Моля, поставете оценка от 1 до 5.</div>';
    card.querySelector(".q-text").textContent = q.text;

    const scale = card.querySelector(".scale");
    const rail = card.querySelector(".scale-rail");

    const set = (v) => {
      v = Math.max(1, Math.min(5, v));
      if (state.answers[key].scores[qi] === v) return;
      state.answers[key].scores[qi] = v;
      paintScale(card, v);
      refresh();
    };
    const fromEvent = (e) => {
      const r = rail.getBoundingClientRect();
      return Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 4) + 1;
    };

    rail.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button > 0) return;
      scale.classList.add("is-dragging");
      try { rail.setPointerCapture(e.pointerId); } catch (err) { /* синтетично събитие */ }
      set(fromEvent(e));
      scale.focus({ preventScroll: true });
    });
    rail.addEventListener("pointermove", (e) => {
      if (scale.classList.contains("is-dragging")) set(fromEvent(e));
    });
    const stop = () => scale.classList.remove("is-dragging");
    rail.addEventListener("pointerup", stop);
    rail.addEventListener("pointercancel", stop);

    scale.addEventListener("keydown", (e) => {
      const cur = state.answers[key].scores[qi];
      let v = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") v = cur === null ? 3 : cur + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = cur === null ? 3 : cur - 1;
      else if (e.key === "Home") v = 1;
      else if (e.key === "End") v = 5;
      else if (/^[1-5]$/.test(e.key)) v = Number(e.key);
      if (v === null) return;
      e.preventDefault();
      set(v);
    });

    paintScale(card, state.answers[key].scores[qi]);
    return card;
  }

  function paintScale(card, v) {
    const scale = card.querySelector(".scale");
    const has = v !== null;
    scale.classList.toggle("has-value", has);
    card.classList.toggle("is-answered", has);
    if (!has) return;
    const pct = (v - 1) * 25;
    card.querySelector(".scale-thumb").style.left = pct + "%";
    card.querySelector(".scale-thumb").textContent = v;
    card.querySelector(".scale-fill").style.width = "calc(" + pct + "% + 10px)";
    card.querySelectorAll(".scale-stop").forEach((s, i) => s.classList.toggle("is-on", i + 1 <= v));
    card.querySelector(".scale-value").textContent = v + " — " + CONFIG.SCALE[v];
    scale.setAttribute("aria-valuenow", v);
    scale.setAttribute("aria-valuetext", v + " — " + CONFIG.SCALE[v]);
  }

  function buildComment(key) {
    const card = document.createElement("div");
    card.className = "card q";
    card.id = "q-" + key + "-" + NQ;
    const id = "c-" + key;
    card.innerHTML =
      '<div class="q-head"><span class="q-num">' + (NQ + 1) + '</span>' +
      '<label class="q-text" for="' + id + '">Коментари и предложения' +
      (CONFIG.COMMENT_REQUIRED ? "" : '<span class="optional">по желание</span>') + '</label></div>' +
      '<textarea id="' + id + '" maxlength="' + CONFIG.COMMENT_MAX + '" placeholder="Какво Ви хареса? Какво бихте променили?"></textarea>' +
      '<div class="counter"><span>До ' + CONFIG.COMMENT_MAX + ' знака</span><span><b>0</b> / ' + CONFIG.COMMENT_MAX + '</span></div>' +
      '<div class="q-error">Моля, напишете кратък коментар.</div>';
    const ta = card.querySelector("textarea");
    const counter = card.querySelector(".counter");
    const sync = () => {
      state.answers[key].comment = ta.value;
      counter.querySelector("b").textContent = ta.value.length;
      counter.classList.toggle("is-near", ta.value.length > CONFIG.COMMENT_MAX * 0.9);
      card.classList.toggle("is-answered", ta.value.trim().length > 0);
    };
    ta.value = state.answers[key].comment;
    ta.addEventListener("input", () => { sync(); refresh(); });
    sync();
    return card;
  }

  function activate(key, scroll) {
    state.active = key;
    state.selected.forEach(k => {
      const on = k === key;
      const tab = $("tab-" + k), panel = $("panel-" + k);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      panel.classList.toggle("is-active", on);
    });
    $("tab-" + key).scrollIntoView({ block: "nearest", inline: "nearest" });
    if (scroll) $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
    refresh();
  }

  /* Обновява пръстените, лентата за напредък и маркировката на пропуските. */
  function refresh() {
    if (!state.selected.length) return;
    let done = 0;
    state.selected.forEach(key => {
      const n = answeredOf(key);
      const missing = missingOf(key);
      done += n;
      const tab = $("tab-" + key);
      if (!tab) return;
      tab.querySelector(".ring-fg").style.strokeDashoffset = 100.5 * (1 - n / NQ);
      tab.querySelector(".ring span").innerHTML = missing.length === 0 ? CHECK : n + "/" + NQ;
      tab.querySelector("small").textContent = missing.length === 0
        ? "Попълнено"
        : (n === 0 ? "Очаква оценка" : "Остават " + plural(NQ - n, "въпрос", "въпроса"));
      if (missing.length === 0) tab.classList.remove("is-warn");
      for (let qi = 0; qi <= NQ; qi++) {
        const card = $("q-" + key + "-" + qi);
        if (card) card.classList.toggle("is-missing", state.showErrors && missing.includes(qi));
      }
    });
    const total = state.selected.length * NQ;
    $("progressBar").style.width = (done / total * 100) + "%";
    $("progressText").innerHTML = "Попълнени <b>" + done + " от " + total + "</b> въпроса";

    const idx = state.selected.indexOf(state.active);
    const next = $("nextTab");
    next.hidden = !(state.selected.length > 1 && idx < state.selected.length - 1);

    if (state.showErrors && state.selected.every(k => missingOf(k).length === 0)) $("formMsg").textContent = "";
  }

  /* ---------- изпращане ---------- */
  async function onSubmit() {
    if (state.sending) return;
    const incomplete = state.selected.filter(k => missingOf(k).length > 0);

    if (incomplete.length) {
      state.showErrors = true;
      const names = incomplete.map(k => "„" + CONFIG.trainingByKey(k).short + "“ (" +
        plural(missingOf(k).length, "въпрос", "въпроса") + ")");
      $("formMsg").textContent = "Оценката не е пълна. Остава да довършите: " + names.join(", ") + ".";
      incomplete.forEach(k => {
        const tab = $("tab-" + k);
        tab.classList.remove("is-warn");
        void tab.offsetWidth;                       // рестартира анимацията
        tab.classList.add("is-warn");
      });
      /* Връщаме участника към първото недовършено обучение и първия пропуснат въпрос. */
      const target = incomplete.includes(state.active) ? state.active : incomplete[0];
      activate(target, false);
      const first = $("q-" + target + "-" + missingOf(target)[0]);
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = first.querySelector(".scale, textarea");
      if (focusable) focusable.focus({ preventScroll: true });
      toast("Моля, довършете оценката за всички избрани обучения.", true);
      return;
    }

    const answers = state.selected.map(k => ({
      training: k,
      scores: state.answers[k].scores.slice(),
      comment: state.answers[k].comment.trim().slice(0, CONFIG.COMMENT_MAX)
    }));

    const btn = $("submitBtn");
    state.sending = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Изпращане…';
    const res = await API.submit(answers);
    state.sending = false;
    btn.disabled = false;
    btn.textContent = "Изпрати оценката";

    if (!res || !res.ok) {
      const msg = (res && res.message) || "Възникна грешка. Опитайте отново.";
      $("formMsg").textContent = msg + " Отговорите Ви са запазени на екрана — опитайте пак.";
      toast(msg, true);
      return;
    }
    showDone();
  }

  function showDone() {
    const list = $("doneList");
    list.innerHTML = "";
    state.selected.forEach(k => {
      const t = CONFIG.trainingByKey(k);
      const li = document.createElement("li");
      li.style.setProperty("--c", t.color);
      li.style.setProperty("--g", t.glow);
      li.textContent = "✓ " + t.short;
      list.appendChild(li);
    });
    goStage("done");
    $("doneTitle").focus({ preventScroll: true });
    confetti();
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#a99cff", "#3ad6c2", "#f2b53c", "#ffffff", "#8878ee"];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", (Math.random() * 30 - 15) + "vw");
      p.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
      p.style.animationDuration = (2.2 + Math.random() * 2) + "s";
      p.style.animationDelay = (Math.random() * 0.6) + "s";
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  }

  function resetAll() {
    CONFIG.TRAININGS.forEach(t => { state.answers[t.key] = { scores: Array(NQ).fill(null), comment: "" }; });
    state.selected = []; state.active = null; state.showErrors = false;
    document.querySelectorAll("#pick input").forEach(i => { i.checked = false; });
    onPickChange();
    goStage("select");
  }

  /* ---------- старт ---------- */
  if (API.demoMode()) $("demoPill").hidden = false;

  if (!CONFIG.FORM_OPEN) {
    $("steps").hidden = true;
    document.querySelectorAll(".stage").forEach(s => s.classList.toggle("is-active", s.id === "stage-closed"));
    return;
  }

  buildPick();
  $("toRate").addEventListener("click", () => {
    if (!state.selected.length) return;
    buildRate();
    goStage("rate");
    $("rateTitle").focus({ preventScroll: true });
  });
  $("backToSelect").addEventListener("click", () => goStage("select"));
  $("nextTab").addEventListener("click", () => {
    const i = state.selected.indexOf(state.active);
    if (i < state.selected.length - 1) activate(state.selected[i + 1], true);
  });
  $("submitBtn").addEventListener("click", onSubmit);
  $("again").addEventListener("click", resetAll);

  /* Предупреждение при затваряне с недовършена оценка. */
  window.addEventListener("beforeunload", (e) => {
    const started = state.selected.some(k => answeredOf(k) > 0 || state.answers[k].comment.trim());
    const onRate = $("stage-rate").classList.contains("is-active");
    if (started && onRate) { e.preventDefault(); e.returnValue = ""; }
  });
})();

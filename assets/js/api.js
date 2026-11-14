/* ============================================================
   Адаптер към бекенда.
   - Ако CONFIG.API_URL сочи към внедрен Apps Script Web App,
     всяка заявка отива там (Google Sheet = база данни).
   - Иначе се ползва локален демо бекенд върху localStorage.

   Всяка заявка връща обект: { ok:true, ... } или
                             { ok:false, error:"код", message:"..." }
   ============================================================ */

const API = (function () {

  const DEMO_KEY = "innovationamp_feedback_demo";
  const DEMO_PASSWORD = "demo";

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  /* Обща проверка на един формуляр — същата логика е и в Code.gs. */
  function validate(answers) {
    if (!Array.isArray(answers) || !answers.length || answers.length > CONFIG.TRAININGS.length) {
      return "Не е избрано нито едно обучение.";
    }
    const seen = {};
    for (const a of answers) {
      if (!a || !CONFIG.trainingByKey(a.training) || seen[a.training]) return "Непознато обучение.";
      seen[a.training] = true;
      if (!Array.isArray(a.scores) || a.scores.length !== CONFIG.QUESTIONS.length) return "Липсват оценки.";
      for (const s of a.scores) {
        if (!Number.isInteger(s) || s < 1 || s > 5) return "Липсват оценки.";
      }
      if (String(a.comment || "").length > CONFIG.COMMENT_MAX) return "Коментарът е твърде дълъг.";
    }
    return null;
  }

  /* ---------- демо бекенд (localStorage) ---------- */
  const Demo = {
    read() {
      try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
      catch (e) { return []; }
    },
    write(rows) { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); },

    handle(p) {
      const rows = Demo.read();

      if (p.action === "submit") {
        const err = validate(p.answers);
        if (err) return { ok: false, error: "invalid", message: err };
        const submission = uid();
        const ts = new Date().toISOString();
        p.answers.forEach(a => rows.push({
          id: uid(), submission: submission, ts: ts, training: a.training,
          scores: a.scores.slice(), comment: String(a.comment || "").trim()
        }));
        Demo.write(rows);
        return { ok: true, saved: p.answers.length, demo: true };
      }

      if (p.action === "list" || p.action === "delete" || p.action === "reset" || p.action === "seed") {
        if (p.password !== DEMO_PASSWORD) {
          return { ok: false, error: "auth", message: "Грешна парола." };
        }
      }

      if (p.action === "list") return { ok: true, rows: rows, demo: true };

      if (p.action === "delete") {
        const left = rows.filter(r => r.id !== p.id);
        if (left.length === rows.length) return { ok: false, error: "notfound", message: "Записът не е намерен." };
        Demo.write(left);
        return { ok: true, deleted: 1, demo: true };
      }

      if (p.action === "reset") {
        Demo.write([]);
        return { ok: true, deleted: rows.length, demo: true };
      }

      if (p.action === "seed") {           /* само в демо режим */
        const comments = ["Много полезно, благодаря!", "Бих искал повече практически примери.", "",
                          "Отличен лектор.", "", "Времето не стигна за въпроси.", "", ""];
        for (let i = 0; i < 24; i++) {
          const submission = uid();
          const ts = new Date(Date.now() - Math.random() * 6 * 864e5).toISOString();
          CONFIG.TRAININGS.forEach((t, ti) => {
            if (Math.random() < 0.62) rows.push({
              id: uid(), submission: submission, ts: ts, training: t.key,
              scores: CONFIG.QUESTIONS.map((q, qi) =>
                Math.max(1, Math.min(5, Math.round(4.3 - ti * 0.3 - (qi === 4 ? 0.7 : 0) + (Math.random() - 0.5) * 2.6)))),
              comment: comments[Math.floor(Math.random() * comments.length)]
            });
          });
        }
        Demo.write(rows);
        return { ok: true, demo: true };
      }

      return { ok: false, error: "unknown", message: "Непознато действие." };
    }
  };

  /* ---------- реален бекенд (Apps Script) ---------- */
  async function live(payload) {
    /* text/plain държи заявката „проста“, така че браузърът пропуска
       CORS pre-flight, на който Apps Script не може да отговори. */
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return JSON.parse(await res.text());
  }

  async function call(payload) {
    if (!CONFIG.isConfigured()) {
      await new Promise(r => setTimeout(r, 450));
      return Demo.handle(payload);
    }
    try {
      return await live(payload);
    } catch (err) {
      return { ok: false, error: "network",
               message: "Няма връзка със сървъра. Проверете интернет връзката и опитайте отново." };
    }
  }

  return {
    demoMode: () => !CONFIG.isConfigured(),
    validate: validate,
    submit: (answers)  => call({ action: "submit", answers: answers }),
    list:   (pwd)      => call({ action: "list",   password: pwd }),
    remove: (pwd, id)  => call({ action: "delete", password: pwd, id: id }),
    reset:  (pwd)      => call({ action: "reset",  password: pwd }),
    seed:   (pwd)      => call({ action: "seed",   password: pwd })
  };
})();

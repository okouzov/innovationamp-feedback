/* ============================================================
   InnovationAMP · Оценка на обученията :: БЕКЕНД
   Google Apps Script Web App + Google Sheet като база данни.

   КАК СЕ ВНЕДРЯВА (подробно в README.md):
     1. Нова Google таблица -> Extensions -> Apps Script.
     2. Поставете този файл на мястото на Code.gs.
     3. СМЕНЕТЕ ADMIN_PASSWORD по-долу (само тук, в редактора на
        Apps Script — НЕ в публичното GitHub хранилище!).
     4. Deploy -> New deployment -> Web app,
        Execute as: Me, Who has access: Anyone.
     5. Копирайте /exec адреса в assets/js/config.js -> API_URL.

   При ВСЯКА промяна тук: Deploy -> Manage deployments -> Edit ->
   Version: New version. Иначе работи старата версия.
   ============================================================ */

const ADMIN_PASSWORD = 'СМЕНИ-МЕ';          // <-- сменете преди Deploy
const PASSWORD_PLACEHOLDER = 'СМЕНИ-МЕ';

const FORM_OPEN   = true;                   // false -> не се приемат нови отговори
const SHEET_NAME  = 'Отговори';
const COMMENT_MAX = 1024;
const QUESTION_COUNT = 5;

/* Ключовете трябва да съвпадат с assets/js/config.js */
const TRAININGS = {
  ai:   'Изкуствен интелект на работното място',
  iot:  'Интернет на нещата (IoT) за умна община',
  data: 'Пространства за данни и големи данни'
};

const HEADERS = ['ID', 'Формуляр', 'Дата и час (UTC)', 'Ключ', 'Обучение',
                 'В1 Ясни цели', 'В2 Полезно съдържание', 'В3 Компетентен лектор',
                 'В4 Добри материали', 'В5 Достатъчно време', 'Коментар'];
const COL_COMMENT = 11;

/* ---------- входни точки ---------- */

function doGet() {
  return json_({ ok: true, service: 'InnovationAMP feedback', open: FORM_OPEN });
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'badrequest', message: 'Невалидна заявка.' });
  }
  try {
    switch (p.action) {
      case 'submit': return json_(submit_(p));
      case 'list':   return json_(admin_(p, list_));
      case 'delete': return json_(admin_(p, delete_));
      case 'reset':  return json_(admin_(p, reset_));
      default:       return json_({ ok: false, error: 'unknown', message: 'Непознато действие.' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'server', message: 'Сървърна грешка: ' + err.message });
  }
}

/* ---------- действия ---------- */

function submit_(p) {
  if (!FORM_OPEN) return { ok: false, error: 'closed', message: 'Анкетата е затворена.' };

  const answers = p.answers;
  if (!Array.isArray(answers) || !answers.length || answers.length > Object.keys(TRAININGS).length) {
    return { ok: false, error: 'invalid', message: 'Не е избрано нито едно обучение.' };
  }
  const seen = {};
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    if (!a || !TRAININGS.hasOwnProperty(a.training) || seen[a.training]) {
      return { ok: false, error: 'invalid', message: 'Непознато обучение.' };
    }
    seen[a.training] = true;
    if (!Array.isArray(a.scores) || a.scores.length !== QUESTION_COUNT) {
      return { ok: false, error: 'incomplete', message: 'Липсват оценки.' };
    }
    for (let j = 0; j < QUESTION_COUNT; j++) {
      const s = a.scores[j];
      if (typeof s !== 'number' || s !== Math.floor(s) || s < 1 || s > 5) {
        return { ok: false, error: 'incomplete', message: 'Липсват оценки.' };
      }
    }
    if (String(a.comment || '').length > COMMENT_MAX) {
      return { ok: false, error: 'invalid', message: 'Коментарът е твърде дълъг.' };
    }
  }

  const submission = shortId_();
  const ts = new Date().toISOString();
  const rows = answers.map(function (a) {
    return [shortId_(), submission, ts, a.training, TRAININGS[a.training]]
      .concat(a.scores)
      .concat([safeText_(String(a.comment || '').trim())]);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sheet_();
    const start = sheet.getLastRow() + 1;
    /* Текстов формат ПРЕДИ записа: иначе Sheets „поправя“ стойности
       (дати, числа) и може да изпълни коментар, започващ с „=“. */
    sheet.getRange(start, 1, rows.length, 5).setNumberFormat('@');
    sheet.getRange(start, COL_COMMENT, rows.length, 1).setNumberFormat('@');
    sheet.getRange(start, 1, rows.length, HEADERS.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, saved: rows.length };
}

function list_() {
  const sheet = sheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const rows = values.filter(function (v) { return String(v[0]).trim() !== ''; }).map(function (v) {
    return {
      id: String(v[0]),
      submission: String(v[1]),
      ts: v[2] instanceof Date ? v[2].toISOString() : String(v[2]),
      training: String(v[3]),
      scores: [v[5], v[6], v[7], v[8], v[9]].map(Number),
      comment: String(v[10] || '').trim()
    };
  });
  return { ok: true, rows: rows };
}

function delete_(p) {
  const id = String(p.id || '');
  if (!id) return { ok: false, error: 'notfound', message: 'Записът не е намерен.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sheet_();
    const last = sheet.getLastRow();
    if (last >= 2) {
      const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id) {
          sheet.deleteRow(i + 2);
          return { ok: true, deleted: 1 };
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: false, error: 'notfound', message: 'Записът не е намерен.' };
}

function reset_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sheet_();
    const last = sheet.getLastRow();
    const n = Math.max(0, last - 1);
    if (n > 0) {
      /* Не може да се изтрият всички незамразени редове — оставяме един празен. */
      if (sheet.getMaxRows() <= last) sheet.insertRowAfter(last);
      sheet.deleteRows(2, n);
    }
    return { ok: true, deleted: n };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- помощни ---------- */

function admin_(p, fn) {
  if (ADMIN_PASSWORD === PASSWORD_PLACEHOLDER) {
    return { ok: false, error: 'nopassword',
             message: 'Админ паролата не е зададена. Сменете ADMIN_PASSWORD в Code.gs и внедрете нова версия.' };
  }
  if (String(p.password || '') !== ADMIN_PASSWORD) {
    Utilities.sleep(600);                    // забавя налучкването на паролата
    return { ok: false, error: 'auth', message: 'Грешна парола.' };
  }
  return fn(p);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* Коментар, който започва с = + - @, се записва с водещ интервал,
   за да не бъде изтълкуван като формула (интервалът се маха при четене). */
function safeText_(s) {
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

function shortId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Пуснете веднъж от редактора (Run -> setup), за да създадете листа
   и да дадете разрешенията преди първото внедряване. */
function setup() {
  sheet_();
}

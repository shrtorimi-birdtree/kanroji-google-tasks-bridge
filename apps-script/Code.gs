const TIMEZONE = 'Asia/Tokyo';
const DEFAULT_TASKLIST_ID = '@default';
const SECRET_PROPERTY_NAME = 'KANROJI_TASKS_SECRET';
const TASKLIST_PROPERTY_NAME = 'KANROJI_TASKLIST_ID';

function doPost(e) {
  try {
    const body = parseBody_(e);
    const auth = validateSecret_(body.secret);

    if (!auth.ok) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    switch (body.action) {
      case 'list_today_tomorrow':
        return json_(listTodayTomorrow_());
      case 'create_task':
        return json_(createTask_(body));
      case 'update_due':
        return json_(updateDue_(body));
      case 'audit_snapshot':
        return json_(auditSnapshot_());
      default:
        return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'kanroji-google-tasks-bridge', status: 'ready' });
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  return JSON.parse(e.postData.contents);
}

function validateSecret_(providedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY_NAME);

  if (!expectedSecret) {
    return { ok: false, reason: 'server_secret_not_configured' };
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return { ok: false, reason: 'invalid_secret' };
  }

  return { ok: true };
}

function getTaskListId_() {
  return PropertiesService.getScriptProperties().getProperty(TASKLIST_PROPERTY_NAME) || DEFAULT_TASKLIST_ID;
}

function listTodayTomorrow_() {
  const range = getTodayTomorrowRange_();
  const tasks = listTasksInRange_(range.dueMin, range.dueMax);

  return {
    ok: true,
    generatedAt: nowJst_(),
    timezone: TIMEZONE,
    dueMin: range.dueMin,
    dueMax: range.dueMax,
    tasks: tasks.map(normalizeTask_)
  };
}

function createTask_(body) {
  const title = String(body.title || '').trim();
  const due = String(body.due || '').trim();
  const notes = body.notes ? String(body.notes) : '';

  if (!title) {
    return { ok: false, error: 'title_required' };
  }

  if (title.indexOf('｜') === -1) {
    return { ok: false, error: 'invalid_title_format', message: 'Title must include the full-width separator: 邸名｜行動' };
  }

  if (!due) {
    return { ok: false, error: 'due_required' };
  }

  if (!isYyyyMmDd_(due)) {
    return { ok: false, error: 'invalid_due_format', message: 'Use YYYY-MM-DD.' };
  }

  const task = {
    title: title,
    notes: notes,
    due: toGoogleTasksDue_(due)
  };

  const created = Tasks.Tasks.insert(task, getTaskListId_());

  return {
    ok: true,
    task: normalizeTask_(created)
  };
}

function updateDue_(body) {
  const taskId = String(body.taskId || '').trim();
  const due = String(body.due || '').trim();

  if (!taskId) {
    return { ok: false, error: 'taskId_required' };
  }

  if (!due) {
    return { ok: false, error: 'due_required' };
  }

  if (!isYyyyMmDd_(due)) {
    return { ok: false, error: 'invalid_due_format', message: 'Use YYYY-MM-DD.' };
  }

  const patch = {
    due: toGoogleTasksDue_(due)
  };

  const updated = Tasks.Tasks.patch(patch, getTaskListId_(), taskId);

  return {
    ok: true,
    task: normalizeTask_(updated)
  };
}

function auditSnapshot_() {
  const range = getTodayTomorrowRange_();
  const todayTomorrow = listTasksInRange_(range.dueMin, range.dueMax).map(normalizeTask_);
  const datelessCandidates = listDatelessCandidates_().map(normalizeTask_);
  const warnings = [];

  warnings.push('Dateless task detection is best-effort and depends on Google Tasks API list behavior and accessible task list scope.');

  return {
    ok: true,
    generatedAt: nowJst_(),
    timezone: TIMEZONE,
    todayTomorrow: todayTomorrow,
    datelessCandidates: datelessCandidates,
    warnings: warnings
  };
}

function listTasksInRange_(dueMin, dueMax) {
  const params = {
    showCompleted: false,
    showDeleted: false,
    dueMin: dueMin,
    dueMax: dueMax,
    maxResults: 100
  };

  return listAllTasks_(params);
}

function listDatelessCandidates_() {
  const params = {
    showCompleted: false,
    showDeleted: false,
    maxResults: 100
  };

  return listAllTasks_(params).filter(function (task) {
    return !task.due;
  });
}

function listAllTasks_(params) {
  const taskListId = getTaskListId_();
  const items = [];
  let pageToken;

  do {
    const requestParams = Object.assign({}, params);
    if (pageToken) {
      requestParams.pageToken = pageToken;
    }

    const response = Tasks.Tasks.list(taskListId, requestParams);
    const responseItems = response.items || [];

    responseItems.forEach(function (task) {
      items.push(task);
    });

    pageToken = response.nextPageToken;
  } while (pageToken);

  return items;
}

function getTodayTomorrowRange_() {
  const today = new Date();
  const todayYmd = Utilities.formatDate(today, TIMEZONE, 'yyyy-MM-dd');
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowYmd = Utilities.formatDate(tomorrow, TIMEZONE, 'yyyy-MM-dd');

  return {
    today: todayYmd,
    tomorrow: tomorrowYmd,
    dueMin: toGoogleTasksDue_(todayYmd),
    dueMax: toGoogleTasksDueEnd_(tomorrowYmd)
  };
}

function toGoogleTasksDue_(yyyyMmDd) {
  return yyyyMmDd + 'T00:00:00.000Z';
}

function toGoogleTasksDueEnd_(yyyyMmDd) {
  return yyyyMmDd + 'T23:59:59.999Z';
}

function isYyyyMmDd_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function nowJst_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function normalizeTask_(task) {
  return {
    id: task.id || '',
    title: task.title || '',
    notes: task.notes || '',
    due: task.due || '',
    status: task.status || '',
    updated: task.updated || ''
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

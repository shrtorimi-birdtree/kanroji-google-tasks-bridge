const DEFAULT_APPS_SCRIPT_EXEC_URL = 'https://script.google.com/macros/s/AKfycbzwvxsV6KmS68Ntdsn3C4bserFCU1pFZPzICpSXabwX0UTE5B00LHTpzdTaWb-DqUxn/exec';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return json_({ ok: true });
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/exec') {
      return json_({
        ok: false,
        error: 'not_found',
        message: 'Use /exec for the Google Tasks bridge proxy.'
      });
    }

    const appsScriptUrl = getAppsScriptExecUrl_(env);
    if (!appsScriptUrl) {
      return json_({
        ok: false,
        error: 'worker_not_configured',
        message: 'Set APPS_SCRIPT_EXEC_URL to the Apps Script Web App /exec URL.'
      });
    }

    if (request.method === 'GET') {
      return await proxyGet_(appsScriptUrl);
    }

    if (request.method === 'POST') {
      return await proxyPost_(request, appsScriptUrl);
    }

    return json_({
      ok: false,
      error: 'method_not_allowed',
      message: 'Supported methods: GET, POST.'
    });
  } catch (error) {
    return json_({
      ok: false,
      error: 'worker_error',
      message: String(error && error.message ? error.message : error)
    });
  }
}

function getAppsScriptExecUrl_(env) {
  const configuredUrl = env && typeof env.APPS_SCRIPT_EXEC_URL === 'string'
    ? env.APPS_SCRIPT_EXEC_URL.trim()
    : '';

  return configuredUrl || DEFAULT_APPS_SCRIPT_EXEC_URL;
}

async function proxyGet_(appsScriptUrl) {
  const response = await fetch(appsScriptUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      accept: 'application/json'
    }
  });

  return jsonFromUpstream_(response);
}

async function proxyPost_(request, appsScriptUrl) {
  const body = await request.text();
  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: body
  });

  return jsonFromUpstream_(response);
}

async function jsonFromUpstream_(response) {
  const text = await response.text();

  try {
    return json_(JSON.parse(text));
  } catch (error) {
    return json_({
      ok: false,
      error: 'upstream_non_json',
      upstreamStatus: response.status,
      upstreamContentType: response.headers.get('content-type') || '',
      bodyPreview: text.slice(0, 500)
    });
  }
}

function json_(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: JSON_HEADERS
  });
}

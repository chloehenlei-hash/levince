const BACKEND_URL = "https://script.google.com/macros/s/AKfycbx_GUEtP6MUKq_jVcD_anhO946CE0hH0TgCoeMkCNmUvQT7h6og98OLZyWSTt6qo-kH/exec";
const SYSTEM_USER = "Levince";
const REQUEST_TIMEOUT_MS = 30000;

export function isWorkflowReady() {
  return BACKEND_URL.startsWith("https://script.google.com/");
}

export async function callWorkflowApi(action, payload = {}) {
  if (!isWorkflowReady()) {
    throw new Error("Google Sheet connection is not ready yet.");
  }

  return submitViaIframe({
    action,
    user: SYSTEM_USER,
    transport: "iframe",
    ...payload,
  });
}

function submitViaIframe(payload) {
  return new Promise((resolve, reject) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frameName = `levince-workflow-${requestId}`;
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const input = document.createElement("input");
    let settled = false;

    iframe.name = frameName;
    iframe.style.display = "none";
    form.method = "POST";
    form.action = BACKEND_URL;
    form.target = frameName;
    form.style.display = "none";
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify({ ...payload, requestId });
    form.appendChild(input);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      iframe.remove();
      form.remove();
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const timeout = window.setTimeout(() => {
      finish(reject, new Error("Google Sheet request timed out."));
    }, REQUEST_TIMEOUT_MS);
    function onMessage(event) {
      const message = event.data || {};
      if (message.source !== "levince-workflow" || message.requestId !== requestId) return;
      window.clearTimeout(timeout);
      const data = message.data || {};
      if (!data.ok) finish(reject, new Error(data.error || "Backend request failed."));
      else finish(resolve, data);
    }

    window.addEventListener("message", onMessage);
    document.body.append(iframe, form);
    form.submit();
  });
}

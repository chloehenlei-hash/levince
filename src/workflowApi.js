const BACKEND_URL = "";
const SYSTEM_USER = "Levince";

export function isWorkflowReady() {
  return BACKEND_URL.startsWith("https://script.google.com/");
}

export async function callWorkflowApi(action, payload = {}) {
  if (!isWorkflowReady()) {
    throw new Error("Google Sheet connection is not ready yet.");
  }

  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action,
      user: SYSTEM_USER,
      ...payload,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Backend did not return JSON: ${text.slice(0, 180)}`);
  }

  if (!data.ok) {
    throw new Error(data.error || "Backend request failed.");
  }

  return data;
}

const STORAGE_KEY = "levinceInvoiceWorkflowConnection";

export function readConnection() {
  try {
    return {
      apiUrl: "",
      pin: "",
      user: "Chloe",
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return {
      apiUrl: "",
      pin: "",
      user: "Chloe",
    };
  }
}

export function saveConnection(connection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export async function callWorkflowApi(connection, action, payload = {}) {
  if (!connection.apiUrl) {
    throw new Error("System is not connected yet. Open Setup once and paste the private connection link.");
  }

  const response = await fetch(connection.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action,
      pin: connection.pin,
      user: connection.user,
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

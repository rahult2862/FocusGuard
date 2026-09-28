const API_BASE = "http://localhost:4000/api/v1";
const POLICY_ALARM = "focusguard-policy-sync";
const USAGE_ALARM = "focusguard-usage-flush";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLICY_ALARM, { periodInMinutes: 1 });
  chrome.alarms.create(USAGE_ALARM, { periodInMinutes: 1 });
  void refreshPolicy();
  void syncActiveTab();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLICY_ALARM, { periodInMinutes: 1 });
  chrome.alarms.create(USAGE_ALARM, { periodInMinutes: 1 });
  void refreshPolicy();
  void syncActiveTab();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLICY_ALARM) void refreshPolicy();
  if (alarm.name === USAGE_ALARM) void flushUsage();
});

chrome.tabs.onActivated.addListener(() => void syncActiveTab());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) void syncActiveTab(tab);
});
chrome.windows.onFocusChanged.addListener(() => void syncActiveTab());
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "focusguard-refresh") {
    Promise.all([refreshPolicy(), syncActiveTab()]).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "focusguard-status") {
    chrome.storage.local.get(["token", "lastSync", "blockedCount"], (data) => sendResponse({ signedIn: Boolean(data.token), lastSync: data.lastSync ?? null, blockedCount: data.blockedCount ?? 0 }));
    return true;
  }
});

function getDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.hostname === "localhost" || !parsed.hostname.includes(".")) return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

async function activeTabInfo() {
  const windows = await chrome.windows.getLastFocused({ populate: true });
  if (windows.focused === false || windows.type === "devtools") return null;
  const active = windows.tabs?.find((tab) => tab.active);
  const domain = getDomain(active?.url);
  return domain ? { domain } : null;
}

async function syncActiveTab() {
  const now = Date.now();
  await flushUsage();
  const next = await activeTabInfo().catch(() => null);
  await chrome.storage.local.set({ tracking: next ? { domain: next.domain, startedAt: now } : null });
}

async function flushUsage() {
  const data = await chrome.storage.local.get(["token", "tracking"]);
  const tracking = data.tracking;
  if (!data.token || !tracking?.domain || !tracking?.startedAt) return;
  const now = Date.now();
  const seconds = Math.min(60, Math.floor((now - tracking.startedAt) / 1000));
  if (seconds < 1) return;

  try {
    const response = await fetch(`${API_BASE}/extension/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ domain: tracking.domain, durationSeconds: seconds, startedAt: new Date(tracking.startedAt).toISOString() })
    });
    if (response.ok) await chrome.storage.local.set({ tracking: { domain: tracking.domain, startedAt: tracking.startedAt + seconds * 1000 } });
    else if (response.status === 401) await chrome.storage.local.remove("token");
  } catch { /* Keep the time segment to retry after the API is available. */ }
}

async function refreshPolicy() {
  const data = await chrome.storage.local.get(["token"]);
  if (!data.token) return;
  try {
    const response = await fetch(`${API_BASE}/extension/policy`, { headers: { Authorization: `Bearer ${data.token}` } });
    if (response.status === 401) {
      await chrome.storage.local.remove(["token", "tracking"]);
      await replaceRules([]);
      return;
    }
    if (!response.ok) return;
    const policy = await response.json();
    const domains = [...new Set(policy.blockingDomains)].slice(0, 2000);
    await replaceRules(domains);
    await chrome.storage.local.set({ lastSync: new Date().toISOString(), blockedCount: domains.length });
  } catch { /* Network may be offline; existing rules remain active. */ }
}

async function replaceRules(domains) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: current.map((rule) => rule.id), addRules });
}

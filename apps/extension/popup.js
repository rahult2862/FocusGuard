const API_BASE = "http://localhost:4000/api/v1";
const signedOut = document.getElementById("signed-out");
const signedIn = document.getElementById("signed-in");
const errorBox = document.getElementById("error");
const statusDot = document.getElementById("status-dot");

async function showState() {
  const data = await chrome.storage.local.get(["token", "lastSync", "blockedCount"]);
  const connected = Boolean(data.token);
  signedOut.classList.toggle("hidden", connected);
  signedIn.classList.toggle("hidden", !connected);
  statusDot.classList.toggle("on", connected);
  if (connected) {
    document.getElementById("blocked-count").textContent = String(data.blockedCount ?? 0);
    const lastSync = data.lastSync ? new Date(data.lastSync) : null;
    document.getElementById("last-sync").textContent = lastSync ? relativeTime(lastSync) : "Waiting…";
  }
}

function relativeTime(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (!minutes) return "Just now";
  return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  const submit = document.getElementById("submit");
  submit.disabled = true;
  submit.textContent = "Connecting…";
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("email").value, password: document.getElementById("password").value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to sign in");
    await chrome.storage.local.remove("tracking");
    await chrome.storage.local.set({ token: result.token });
    await chrome.runtime.sendMessage({ type: "focusguard-refresh" });
    await showState();
  } catch (error) {
    errorBox.textContent = error instanceof Error ? error.message : "Could not connect to FocusGuard";
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Sign in to FocusGuard <span>↗</span>';
  }
});

document.getElementById("sign-out").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "tracking", "lastSync", "blockedCount"]);
  await chrome.runtime.sendMessage({ type: "focusguard-refresh" }).catch(() => {});
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map((rule) => rule.id) });
  await showState();
});

void showState();

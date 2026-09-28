const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
const TOKEN_KEY = "focusguard.token";

export type User = { id: string; email: string; timezone: string };
export type Schedule = { id: string; name: string; startTime: string; endTime: string; daysOfWeek: number[]; enabled: boolean; _count?: { rules: number } };
export type Rule = { id: string; domain: string; type: "BLOCK" | "ALLOW"; enabled: boolean; scheduleId: string | null; dailyLimitMinutes: number | null; schedule?: Schedule | null };
export type Analytics = { todaySeconds: number; focusSecondsToday: number; activeRules: number; daily: { date: string; totalSeconds: number }[]; topDomains: { domain: string; totalSeconds: number }[] };
export type FocusSession = { id: string; title: string; plannedMins: number; startedAt: string; endedAt: string | null };

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function saveToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) clearToken();
    throw new Error(payload.error ?? "Request failed. Please try again.");
  }
  return payload as T;
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

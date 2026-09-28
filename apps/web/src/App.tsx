import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, clearToken, formatDuration, getToken, saveToken, type Analytics, type FocusSession, type Rule, type Schedule, type User } from "./api";

const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Page = "overview" | "rules" | "schedules";

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h8v8H3z M14 3h7v5h-7z M14 11h7v10h-7z M3 14h8v7H3z",
    shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z M9 12l2 2 4-4",
    clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
    chart: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
    plus: "M12 5v14 M5 12h14",
    check: "M20 6 9 17l-5-5",
    arrow: "M7 17 17 7 M7 7h10v10",
    trash: "M3 6h18 M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6",
    play: "m7 4 14 8-14 8z",
    stop: "M6 6h12v12H6z",
    chevron: "m9 18 6-6-6-6"
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? "M3 3h18v18H3z"} /></svg>;
}

function Logo() { return <div className="brand-mark"><Icon name="shield" /></div>; }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [page, setPage] = useState<Page>("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);

  const reload = useCallback(async () => {
    const [ruleResult, scheduleResult, analyticsResult, focusResult] = await Promise.all([
      api<{ rules: Rule[] }>("/rules"), api<{ schedules: Schedule[] }>("/schedules"),
      api<Analytics>("/analytics/summary"), api<{ session: FocusSession | null }>("/focus/current")
    ]);
    setRules(ruleResult.rules); setSchedules(scheduleResult.schedules); setAnalytics(analyticsResult); setFocusSession(focusResult.session);
  }, []);

  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    api<{ user: User }>("/auth/me").then((result) => { setUser(result.user); return reload(); })
      .catch(() => { clearToken(); setUser(null); }).finally(() => setBooting(false));
  }, [reload]);

  async function handleAuth(email: string, password: string, mode: "login" | "register") {
    setBusy(true); setError("");
    try {
      const result = await api<{ token: string; user: User }>(`/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      saveToken(result.token); setUser(result.user); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }

  async function mutate(work: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await work(); await reload(); setNotice(message); window.setTimeout(() => setNotice(""), 2600); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); }
  }

  function signOut() { clearToken(); setUser(null); setRules([]); setSchedules([]); }

  if (booting) return <div className="boot-screen"><div className="boot-logo"><Logo /></div><span>Preparing your focus space…</span></div>;
  if (!user) return <AuthScreen onSubmit={handleAuth} busy={busy} error={error} />;

  const title = page === "overview" ? "Your focus, at a glance" : page === "rules" ? "Distraction rules" : "Focus schedules";
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><Logo /><div><strong>focus<span>guard</span></strong><small>MAKE SPACE TO THINK</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={page === "overview" ? "nav-item active" : "nav-item"} onClick={() => setPage("overview")}><Icon name="grid" />Overview</button>
        <button className={page === "rules" ? "nav-item active" : "nav-item"} onClick={() => setPage("rules")}><Icon name="shield" />Block rules<span className="nav-count">{rules.filter((rule) => rule.type === "BLOCK" && rule.enabled).length}</span></button>
        <button className={page === "schedules" ? "nav-item active" : "nav-item"} onClick={() => setPage("schedules")}><Icon name="clock" />Schedules</button>
      </nav>
      <div className="side-spacer" />
      <div className="sidebar-promo"><div className="promo-orbit">✳</div><strong>Small steps, deep focus.</strong><p>Make room for the work that matters today.</p></div>
      <div className="profile"><div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div><div className="profile-text"><strong>{user.email.split("@")[0]}</strong><span>Personal workspace</span></div><button className="icon-button" title="Sign out" onClick={signOut}>↗</button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <Icon name="chevron" /><strong>{page === "overview" ? "Overview" : page === "rules" ? "Block rules" : "Schedules"}</strong></div><div className="topbar-right"><span className="today-pill"><span className="online-dot" />Your focus space is active</span><div className="top-avatar">{user.email.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase()}</div><h1>{title}</h1><p>{page === "overview" ? "A little more intention can change the shape of your day." : page === "rules" ? "Choose what gets your attention during focus time." : "Give your focus a rhythm that works for you."}</p></div>{page === "rules" && <button className="button button-primary" onClick={() => document.getElementById("new-rule-domain")?.focus()}><Icon name="plus" />Add a rule</button>}</div>
        {error && <div className="toast toast-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="toast toast-success" role="status"><Icon name="check" />{notice}</div>}
        {page === "overview" && <Overview analytics={analytics} rules={rules} schedules={schedules} focusSession={focusSession} onFocusChange={async (active) => { await mutate(() => api(active ? "/focus/stop" : "/focus/start", { method: "POST", body: active ? undefined : JSON.stringify({ title: "Focus session", plannedMins: 25 }) }), active ? "Focus session completed" : "Focus session started"); }} onPage={setPage} />}
        {page === "rules" && <RulesPage rules={rules} schedules={schedules} onAdd={(body) => mutate(() => api("/rules", { method: "POST", body: JSON.stringify(body) }), "Rule added")} onToggle={(rule) => mutate(() => api(`/rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !rule.enabled }) }), "Rule updated")} onDelete={(rule) => mutate(() => api(`/rules/${rule.id}`, { method: "DELETE" }), "Rule removed")} />}
        {page === "schedules" && <SchedulesPage schedules={schedules} onAdd={(body) => mutate(() => api("/schedules", { method: "POST", body: JSON.stringify(body) }), "Schedule created")} onToggle={(schedule) => mutate(() => api(`/schedules/${schedule.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !schedule.enabled }) }), "Schedule updated")} onDelete={(schedule) => mutate(() => api(`/schedules/${schedule.id}`, { method: "DELETE" }), "Schedule removed")} />}
        <footer className="page-footer"><span>FOCUSGUARD · YOUR TIME IS YOURS</span><span>Protected by design <span className="footer-heart">♥</span></span></footer>
      </div>
    </main>
  </div>;
}

function AuthScreen({ onSubmit, busy, error }: { onSubmit: (email: string, password: string, mode: "login" | "register") => Promise<void>; busy: boolean; error: string }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); void onSubmit(email, password, mode); }
  return <div className="auth-layout"><div className="auth-story"><div className="brand-lockup"><Logo /><div><strong>focus<span>guard</span></strong><small>MAKE SPACE TO THINK</small></div></div><div className="story-copy"><div className="eyebrow">A QUIETER KIND OF PRODUCTIVITY</div><h1>Find your way<br />back to <em>focus.</em></h1><p>Build a calmer relationship with your screen. Set gentle boundaries, follow your own rhythm, and protect time for what matters.</p><div className="story-points"><div><span>01</span> Set your boundaries</div><div><span>02</span> Make time for deep work</div><div><span>03</span> See your progress grow</div></div></div><div className="story-note">“The secret of getting ahead is getting started.” <span>— Mark Twain</span></div></div><div className="auth-panel"><div className="auth-card"><div className="mobile-brand"><Logo /></div><div className="auth-kicker">WELCOME TO YOUR FOCUS SPACE</div><h2>{mode === "register" ? "Start with a clear mind." : "Welcome back."}</h2><p className="auth-subtitle">{mode === "register" ? "Create an account and make today count." : "Sign in to pick up where you left off."}</p><form onSubmit={submit} className="auth-form"><label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "register" ? "Create your account" : "Sign in"}<Icon name="arrow" /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : "New to FocusGuard?"}<button onClick={() => setMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Sign in" : "Create an account"}</button></div><div className="auth-privacy"><Icon name="shield" />Your data stays yours. Always.</div></div></div></div>;
}

function Overview({ analytics, rules, schedules, focusSession, onFocusChange, onPage }: { analytics: Analytics | null; rules: Rule[]; schedules: Schedule[]; focusSession: FocusSession | null; onFocusChange: (active: boolean) => void; onPage: (page: Page) => void }) {
  const today = analytics?.todaySeconds ?? 0;
  const focus = analytics?.focusSecondsToday ?? 0;
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setClockNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const focusElapsed = focusSession ? Math.max(0, Math.floor((clockNow - new Date(focusSession.startedAt).getTime()) / 1000)) : 0;
  const focusRemaining = focusSession ? Math.max(0, focusSession.plannedMins * 60 - focusElapsed) : 0;
  const autoStopped = useRef(false);
  useEffect(() => {
    if (!focusSession) { autoStopped.current = false; return; }
    if (focusRemaining === 0 && !autoStopped.current) {
      autoStopped.current = true;
      onFocusChange(true);
    }
  }, [focusSession, focusRemaining, onFocusChange]);
  const recent = analytics?.daily ?? [];
  const weekTotal = recent.reduce((sum, item) => sum + item.totalSeconds, 0);
  const days = useMemo(() => recent.map((item) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${item.date}T12:00:00`))), [recent]);

  return <>
    <section className="welcome-banner"><div className="welcome-copy"><div className="welcome-overline"><span className="sparkle">✳</span> YOUR DAY, YOUR PACE</div><h2>Make today a little<br />more <em>intentional.</em></h2><p>Every focused minute is a small win. You're building something good.</p><button className="banner-button" onClick={() => onFocusChange(Boolean(focusSession))}>{focusSession ? <><Icon name="stop" />End focus session</> : <><Icon name="play" />Start a focus session <span>25 min</span></>}</button></div><div className="banner-art" aria-hidden="true"><div className="sun-core">✳</div><div className="sun-ring ring-one" /><div className="sun-ring ring-two" /><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" /><span className="art-caption">PAUSE · BREATHE · BEGIN</span></div><div className="banner-footer"><span><i /> {schedules.filter((item) => item.enabled).length} schedules active</span><span>{rules.filter((rule) => rule.enabled && rule.type === "BLOCK").length} boundaries set</span></div></section>
    <section className="stats-grid"><StatCard label="SCREEN TIME TODAY" value={formatDuration(today)} detail="Across your tracked sites" tone="blue" icon="clock" /><StatCard label="FOCUS TIME TODAY" value={formatDuration(focus)} detail={focusSession ? "Your focus session is running" : "Time spent in focus sessions"} tone="green" icon="chart" /><StatCard label="SITES PROTECTED" value={String(analytics?.activeRules ?? 0)} detail="Your active block rules" tone="purple" icon="shield" /></section>
    <section className="content-grid"><div className="panel weekly-panel"><div className="panel-head"><div><div className="section-eyebrow">YOUR RHYTHM</div><h3>Screen time this week</h3></div><div className="week-total"><strong>{formatDuration(weekTotal)}</strong><span>LAST 7 DAYS</span></div></div><div className="chart-wrap"><div className="chart-y"><span>4h</span><span>3h</span><span>2h</span><span>1h</span><span>0</span></div><div className="bar-chart">{recent.map((item, index) => <div className="bar-group" key={item.date}><div className="bar-track"><div className={`bar-fill ${index === recent.length - 1 ? "today-bar" : ""}`} style={{ height: `${Math.min(100, Math.max(item.totalSeconds ? 4 : 0, (item.totalSeconds / (4 * 3600)) * 100))}%` }} title={formatDuration(item.totalSeconds)} /></div><span>{days[index]}</span></div>)}</div></div><div className="chart-legend"><span><i className="legend-dot" />Screen time</span><span>Less can be more <b>↗</b></span></div></div>
      <div className="panel focus-panel"><div className="panel-head"><div><div className="section-eyebrow">A MOMENT FOR YOU</div><h3>{focusSession ? "Stay in the zone" : "Ready to focus?"}</h3></div><div className="round-icon focus-icon"><Icon name="clock" /></div></div><div className="timer-face"><div className={focusSession ? "timer-progress running" : "timer-progress"}><div><strong>{focusSession ? `${String(Math.floor(focusRemaining / 60)).padStart(2, "0")}:${String(focusRemaining % 60).padStart(2, "0")}` : "25:00"}</strong><span>{focusSession ? "TIME LEFT" : "MINUTES"}</span></div></div></div><div className="focus-bottom"><div><strong>{focusSession ? "Focus session in progress" : "Take one thing at a time."}</strong><span>{focusSession ? "Your distracting sites are protected." : "A short session is a good start."}</span></div><button className="focus-action" onClick={() => onFocusChange(Boolean(focusSession))} aria-label={focusSession ? "Stop focus session" : "Start focus session"}>{focusSession ? <Icon name="stop" /> : <Icon name="play" />}</button></div></div></section>
    <section className="panel domains-panel"><div className="panel-head"><div><div className="section-eyebrow">YOUR ATTENTION, SPENT WELL</div><h3>Most visited today</h3></div><button className="text-link" onClick={() => onPage("rules")}>Manage rules <Icon name="arrow" /></button></div>{analytics?.topDomains.length ? <div className="domain-list">{analytics.topDomains.slice(0, 5).map((item, index) => <div className="domain-row" key={item.domain}><div className={`domain-favicon favicon-${index}`}>{item.domain.replace(/^www\./, "").slice(0, 1).toUpperCase()}</div><div className="domain-info"><strong>{item.domain}</strong><div className="domain-progress"><i style={{ width: `${Math.max(5, (item.totalSeconds / Math.max(...analytics.topDomains.map((domain) => domain.totalSeconds))) * 100)}%` }} /></div></div><span className="domain-time">{formatDuration(item.totalSeconds)}</span></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Icon name="chart" /></div><strong>Your day is just getting started</strong><span>Tracked browsing will show up here once the browser extension is connected.</span></div>}</section>
  </>;
}

function StatCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: string; icon: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon} /></div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><div className="stat-detail"><span className={`detail-mark ${tone}`} />{detail}</div></div>;
}

function RulesPage({ rules, schedules, onAdd, onToggle, onDelete }: { rules: Rule[]; schedules: Schedule[]; onAdd: (body: unknown) => void; onToggle: (rule: Rule) => void; onDelete: (rule: Rule) => void }) {
  const [domain, setDomain] = useState(""); const [type, setType] = useState<"BLOCK" | "ALLOW">("BLOCK"); const [scheduleId, setScheduleId] = useState(""); const [dailyLimit, setDailyLimit] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!domain.trim()) return; onAdd({ domain, type, enabled: true, scheduleId: type === "BLOCK" ? scheduleId || null : null, dailyLimitMinutes: type === "BLOCK" && dailyLimit ? Number(dailyLimit) : null }); setDomain(""); setDailyLimit(""); }
  return <div className="management-grid"><section className="panel management-panel"><div className="panel-head"><div><div className="section-eyebrow">PERSONALIZE YOUR BOUNDARIES</div><h3>Your domain rules</h3></div><span className="count-badge">{rules.length} {rules.length === 1 ? "rule" : "rules"}</span></div><div className="table-head"><span>WEBSITE</span><span>RULE</span><span>WHEN</span><span>STATUS</span><span /></div>{rules.length ? <div className="rule-list">{rules.map((rule) => <div className="rule-row" key={rule.id}><div className="rule-domain"><div className="domain-favicon small-favicon">{rule.domain.slice(0, 1).toUpperCase()}</div><strong>{rule.domain}</strong></div><span className={`type-pill ${rule.type.toLowerCase()}`}>{rule.type === "BLOCK" ? "Block" : "Allow"}</span><span className="rule-when">{rule.schedule?.name ?? (rule.dailyLimitMinutes ? "Usage limit" : "Always")}{rule.dailyLimitMinutes ? ` · ${rule.dailyLimitMinutes}m/day` : ""}</span><button className={`toggle ${rule.enabled ? "on" : ""}`} onClick={() => onToggle(rule)} aria-label={`Turn ${rule.enabled ? "off" : "on"} ${rule.domain}`}><i /></button><button className="delete-button" onClick={() => onDelete(rule)} aria-label={`Delete ${rule.domain}`}><Icon name="trash" /></button></div>)}</div> : <div className="empty-state compact"><div className="empty-icon"><Icon name="shield" /></div><strong>No rules yet</strong><span>Add a site below to start building your boundaries.</span></div>}</section><section className="panel form-panel"><div className="form-panel-icon"><Icon name="plus" /></div><div className="section-eyebrow">SET A BOUNDARY</div><h3>Add a website</h3><p>Enter a domain to choose how it fits into your focus space.</p><form onSubmit={submit} className="stack-form"><label>Website domain<input id="new-rule-domain" placeholder="e.g. social.example" value={domain} onChange={(event) => setDomain(event.target.value)} required /></label><label>Rule<select value={type} onChange={(event) => setType(event.target.value as "BLOCK" | "ALLOW")}><option value="BLOCK">Block this site</option><option value="ALLOW">Allow this site</option></select></label>{type === "BLOCK" && <><label>Apply when<select value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">{dailyLimit ? "After daily limit" : "Always"}</option>{schedules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span className="field-label-row">Daily usage limit <span className="optional-label">(optional)</span></span><input type="number" min="1" max="1440" step="1" placeholder="Minutes before blocking" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} /></label></>}<button className="button button-primary form-submit"><Icon name="plus" />Add website</button></form><div className="form-hint"><Icon name="shield" />Rules sync to Chrome when the extension is signed in.</div></section></div>;
}

function SchedulesPage({ schedules, onAdd, onToggle, onDelete }: { schedules: Schedule[]; onAdd: (body: unknown) => void; onToggle: (schedule: Schedule) => void; onDelete: (schedule: Schedule) => void }) {
  const [name, setName] = useState(""); const [startTime, setStartTime] = useState("09:00"); const [endTime, setEndTime] = useState("17:00"); const [daysOfWeek, setDays] = useState([1, 2, 3, 4, 5]);
  function submit(event: FormEvent) { event.preventDefault(); onAdd({ name, startTime, endTime, daysOfWeek, enabled: true }); setName(""); }
  return <div className="management-grid"><section className="panel management-panel"><div className="panel-head"><div><div className="section-eyebrow">YOUR WEEK, YOUR WAY</div><h3>Weekly schedules</h3></div><span className="count-badge">{schedules.length} total</span></div>{schedules.length ? <div className="schedule-list">{schedules.map((schedule) => <article className="schedule-card" key={schedule.id}><div className="schedule-card-top"><div className="schedule-glyph"><Icon name="clock" /></div><div className="schedule-meta"><strong>{schedule.name}</strong><span>{schedule.startTime} — {schedule.endTime}</span></div><button className={`toggle ${schedule.enabled ? "on" : ""}`} onClick={() => onToggle(schedule)} aria-label={`Turn ${schedule.name} ${schedule.enabled ? "off" : "on"}`}><i /></button><button className="delete-button" onClick={() => onDelete(schedule)} aria-label={`Delete ${schedule.name}`}><Icon name="trash" /></button></div><div className="day-chips">{week.map((day, index) => <span key={day} className={schedule.daysOfWeek.includes(index) ? "day-chip selected" : "day-chip"}>{day}</span>)}</div><div className="schedule-foot"><span><span className="online-dot" />{schedule.enabled ? "Active schedule" : "Paused"}</span><span>{schedule._count?.rules ?? 0} rules linked</span></div></article>)}</div> : <div className="empty-state compact"><div className="empty-icon"><Icon name="clock" /></div><strong>No schedules set up</strong><span>Create a weekly rhythm, then connect block rules to it.</span></div>}</section><section className="panel form-panel schedule-form-panel"><div className="form-panel-icon warm"><Icon name="clock" /></div><div className="section-eyebrow">FIND YOUR RHYTHM</div><h3>New schedule</h3><p>Pick the times you'd like your scheduled rules to take effect.</p><form onSubmit={submit} className="stack-form"><label>Schedule name<input placeholder="e.g. Morning deep work" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label><div className="time-fields"><label>Starts<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label><label>Ends<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label></div><fieldset className="days-field"><legend>Repeat on</legend><div className="day-picker">{week.map((day, index) => <button type="button" key={day} className={daysOfWeek.includes(index) ? "day-option chosen" : "day-option"} onClick={() => setDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort())}>{day.slice(0, 1)}</button>)}</div></fieldset><button className="button button-primary form-submit" disabled={!daysOfWeek.length}><Icon name="plus" />Create schedule</button></form><div className="form-hint"><Icon name="clock" />Scheduled rules follow your account timezone.</div></section></div>;
}

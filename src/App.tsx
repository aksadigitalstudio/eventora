import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { CONFIG, eventDate } from "./config";
import {
  cloud,
  incompleteConfig,
  initializeCloud,
  repo,
  supabase,
} from "./store";
import type { Data, PublicData } from "./types";
import { Attendees, Dashboard, Scanner, Settings, Statistics } from "./Admin";
import { EventPage, Lookup, Registration, TicketPage } from "./Public";
import { Brand, Button, Field, Loading } from "./ui";
export default function App() {
  const [path, setPath] = useState(location.pathname),
    [publicData, setPublicData] = useState<PublicData | null>(null),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [session, setSession] = useState<boolean | null>(cloud ? null : true),
    [menu, setMenu] = useState(false);
  const admin = path.startsWith("/admin");
  useEffect(() => {
    const route = () => {
      setPath(location.pathname);
      setMenu(false);
      window.scrollTo(0, 0);
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (
        !a ||
        e.defaultPrevented ||
        e.button ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        a.target ||
        a.hasAttribute("download")
      )
        return;
      const u = new URL(a.href);
      if (u.origin !== location.origin || u.hash) return;
      e.preventDefault();
      history.pushState({}, "", u.href);
      route();
    };
    document.addEventListener("click", link);
    window.addEventListener("popstate", route);
    return () => {
      document.removeEventListener("click", link);
      window.removeEventListener("popstate", route);
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(Boolean(session)),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (incompleteConfig)
        throw Error(
          "Both Supabase environment variables are required. Complete the cloud configuration or remove both to use Demo Mode.",
        );
      const p = await repo.publicData();
      if (!p) throw Error("The organizer has not initialized this event yet.");
      setPublicData(p);
      if (admin && session) setData(await repo.load());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [admin, session]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!admin || !session) return;
    const id = setInterval(() => {
      void refresh();
    }, 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", focus);
    };
  }, [admin, session, refresh]);
  if (admin && session === null)
    return <Loading text="Checking organizer access…" />;
  if (admin && cloud && !session) return <Login />;
  const ticketMatch = path.match(/^\/ticket\/([^/]+)\/?$/);
  let page: React.ReactNode;
  if (ticketMatch)
    page = (
      <TicketPage
        key={ticketMatch[1]}
        token={decodeURIComponent(ticketMatch[1])}
      />
    );
  else if (path === "/lookup") page = <Lookup />;
  else if (admin) {
    if (error && !data)
      page = (
        <div className="error-page">
          <h1>Workspace unavailable.</h1>
          <p role="alert">{error}</p>
          {cloud && (
            <Button
              onClick={() => {
                void initializeCloud()
                  .then(refresh)
                  .catch((e) => setError(e.message));
              }}
            >
              Initialize configured event
            </Button>
          )}
          <Button variant="outline" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      );
    else if (!data) page = <Loading />;
    else if (path === "/admin/scanner")
      page = <Scanner data={data} refresh={refresh} />;
    else if (path === "/admin/attendees")
      page = <Attendees data={data} refresh={refresh} />;
    else if (path === "/admin/statistics") page = <Statistics data={data} />;
    else if (path === "/admin/settings")
      page = <Settings data={data} refresh={refresh} />;
    else page = <Dashboard data={data} />;
  } else if (error)
    page = (
      <div className="error-page">
        <h1>The event is being prepared.</h1>
        <p role="alert">{error}</p>
        <a className="button" href="/admin">
          Organizer sign-in
        </a>
        <Button variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  else if (!publicData) page = <Loading />;
  else if (path === "/register")
    page = <Registration key={location.search} data={publicData} />;
  else if (path === "/") page = <EventPage data={publicData} />;
  else
    page = (
      <div className="error-page">
        <h1>Page not found.</h1>
        <a className="button" href="/">
          Back to the event
        </a>
      </div>
    );
  const nav = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Attendees", href: "/admin/attendees", icon: Users },
    { label: "Check-in scanner", href: "/admin/scanner", icon: ScanLine },
    {
      label: "Attendance",
      href: "/admin/statistics",
      icon: ChartNoAxesCombined,
    },
    { label: "Event settings", href: "/admin/settings", icon: Settings2 },
  ];
  return (
    <>
      {!admin && repo.mode === "demo" && (
        <div className="demo-ribbon">
          <span>DEMO MODE</span> Explore the event, register and try staff
          check-in. Data stays in this browser.
        </div>
      )}
      {admin ? (
        <div className="admin-shell">
          <aside className={"admin-sidebar " + (menu ? "open" : "")}>
            <Brand light />
            <a className="event-workspace" href="/">
              <span>FC</span>
              <div>
                <small>EVENT WORKSPACE</small>
                <strong>{publicData?.event.title || CONFIG.event.title}</strong>
              </div>
              <ArrowUpRight size={16} />
            </a>
            <div className="eyebrow">ORGANIZER TOOLS</div>
            <nav aria-label="Organizer navigation">
              {nav.map((n) => (
                <a
                  key={n.href}
                  className={path === n.href ? "active" : ""}
                  href={n.href}
                >
                  <n.icon size={19} />
                  {n.label}
                  {path === n.href && <span className="active-dot" />}
                </a>
              ))}
            </nav>
            <div className="sidebar-note">
              <span>✳</span>
              <h3>
                A little less admin.
                <br />A little more connection.
              </h3>
              <p>Every great event starts with a warm welcome.</p>
            </div>
            <div className="staff-identity">
              <span className="avatar">A</span>
              <div>
                <strong>
                  {repo.mode === "demo" ? "Demo staff" : "Authorized staff"}
                </strong>
                <small>
                  {repo.mode === "demo"
                    ? "Local demo workspace"
                    : "Authenticated workspace"}
                </small>
              </div>
              {cloud && (
                <button
                  aria-label="Sign out"
                  className="icon-button"
                  onClick={() => void supabase!.auth.signOut()}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </aside>
          {menu && (
            <button
              className="nav-overlay"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            />
          )}
          <div className="admin-content">
            <header className="admin-header">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X /> : <Menu />}
              </button>
              <div>
                <span>Workspace</span>
                <span> / </span>
                <strong>
                  {nav.find((n) => n.href === path)?.label || "Overview"}
                </strong>
              </div>
              <div>
                <span className="mode-pill">
                  {repo.mode === "demo"
                    ? "Demo mode · this browser"
                    : "Organizer access"}
                </span>
                <a href="/" className="text-link">
                  View event <ArrowUpRight size={15} />
                </a>
              </div>
            </header>
            <main className="admin-main">{page}</main>
            <footer className="admin-footer">
              <span>
                {CONFIG.appName} /{" "}
                {publicData?.event.organizer || CONFIG.event.organizer}
              </span>
              <span>
                {repo.mode === "demo"
                  ? "Sample attendees + browser-persistent demo registrations"
                  : "Secure organizer workspace"}{" "}
                · Single-entry tickets
              </span>
            </footer>
          </div>
        </div>
      ) : (
        page
      )}
    </>
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <Brand />
      <div className="eyebrow">THE ORGANIZER WORKSPACE</div>
      <h1>
        Behind every
        <br />
        great gathering.
      </h1>
      <p>Authorized organizer and staff access only.</p>
      <form onSubmit={submit}>
        <Field label="Organizer email">
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <Button type="submit" variant="coral full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in securely"}
          <ShieldCheck size={17} />
        </Button>
      </form>
      <a className="text-link" href="/">
        ← Back to the public event
      </a>
    </main>
  );
}

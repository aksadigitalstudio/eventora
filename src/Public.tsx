import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Check,
  Ticket as TicketIcon,
  Download,
  Printer,
  Copy,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  CONFIG,
  eventDate,
  money,
  posterSVG,
  zoneLabel,
  programmeTime,
} from "./config";
import {
  isToken,
  portableLink,
  portableTicket,
  tokenFromPayload,
  uuid,
} from "./domain";
import { repo } from "./store";
import type { PublicData, RegisterInput, Ticket } from "./types";
import { Brand, Button, Empty, Field, Loading, NextIcon, Status } from "./ui";
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Public navigation">
        <a href="/#about">The experience</a>
        <a href="/#schedule">Programme</a>
        <a href="/lookup">My ticket</a>
      </nav>
      <a className="button small" href="/#tickets">
        Get your ticket <NextIcon />
      </a>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Brand />
      <p>Good ideas deserve a room full of people.</p>
      <a href="/lookup">
        Find your ticket <ArrowUpRight size={15} />
      </a>
      <a href="/admin">
        Organizer workspace <ArrowUpRight size={15} />
      </a>
      <span>
        © {new Date().getFullYear()} {CONFIG.appName}
      </span>
    </footer>
  );
}
export function Availability({
  remaining,
  capacity,
  open,
}: {
  remaining: number;
  capacity: number;
  open: boolean;
}) {
  return (
    <Status
      tone={
        remaining <= 0
          ? "sold"
          : !open
            ? "muted"
            : remaining <= Math.max(5, capacity * 0.1)
              ? "warning"
              : "success"
      }
    >
      {remaining <= 0
        ? "SOLD OUT"
        : !open
          ? "REGISTRATION CLOSED"
          : remaining <= Math.max(5, capacity * 0.1)
            ? "LOW AVAILABILITY"
            : "AVAILABLE"}
    </Status>
  );
}
export function EventPage({ data }: { data: PublicData }) {
  const e = data.event;
  const [email, setEmail] = useState("");
  return (
    <>
      <PublicHeader />
      <main className="event-main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✳</span> A GATHERING OF CURIOUS MINDS{" "}
              <span>{e.date.slice(0, 4)}</span>
            </div>
            <h1>{e.title}</h1>
            <p className="hero-description">
              Where creative minds meet
              <br />
              what comes next.
            </p>
            <div className="hero-meta">
              <span>
                <CalendarDays size={18} />
                {eventDate(e.date)}
              </span>
              <span>
                <Clock3 size={18} />
                {e.start} — {e.end} {zoneLabel(e.timeZone)}
              </span>
              <span>
                <MapPin size={18} />
                {e.venue}, {e.city}
              </span>
            </div>
            <div className="hero-actions">
              <a className="button coral" href="#tickets">
                Find your place <ArrowUpRight size={21} />
              </a>
              <span className="small-note">
                One day. New perspectives.
                <br />A whole lot of possibility.
              </span>
            </div>
            <div className="organizer-line">
              <span className="organizer-monogram">A↗</span>
              <div>
                <small>THOUGHTFULLY ORGANIZED BY</small>
                <strong>{e.organizer}</strong>
              </div>
              <span className="organizer-type">{e.type}</span>
            </div>
          </div>
          <div className="poster-wrap">
            <div className="poster-label">
              <span>THE NEXT CHAPTER STARTS HERE</span>
              <span>01 / 01</span>
            </div>
            <img
              className="event-poster"
              src={e.poster || posterSVG(e)}
              alt={e.title + " event poster"}
            />
            <div className="poster-bottom">
              <span>IN PERSON. IN GOOD COMPANY.</span>
              <ArrowUpRight size={22} />
            </div>
          </div>
        </section>
        <div className="event-strip">
          <span>{e.type.toUpperCase()}</span>
          <span>✳</span>
          <span>IDEAS WORTH SHARING</span>
          <span>✳</span>
          <span>{e.city.toUpperCase()}</span>
          <span>✳</span>
          <span>CREATIVE CONNECTIONS</span>
        </div>
        <section className="about-section" id="about">
          <div>
            <div className="eyebrow">01 / THE EXPERIENCE</div>
            <h2>
              A room full of
              <br />
              what’s possible<span className="coral-text">.</span>
            </h2>
          </div>
          <div>
            <p className="lead">{e.description}</p>
            <div className="experience-grid">
              <div>
                <span>↗</span>
                <h3>Fresh perspectives</h3>
                <p>
                  Explore creative practice, emerging tools and a more
                  thoughtful future.
                </p>
              </div>
              <div>
                <span>✳</span>
                <h3>Real connections</h3>
                <p>
                  Meet the makers, thinkers and collaborators shaping what comes
                  next.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="programme-section" id="schedule">
          <header>
            <div>
              <div className="eyebrow">02 / THE PROGRAMME</div>
              <h2>Make a day of it.</h2>
            </div>
            <span className="section-note">
              {eventDate(e.date)}
              <br />
              {e.start}—{e.end} {zoneLabel(e.timeZone)}
            </span>
          </header>
          {[
            {
              time: e.start,
              label: "Doors open & a warm welcome",
              type: "CHECK-IN",
            },
            {
              time: programmeTime(e.start, e.end, 0.125),
              label: "Creativity in an age of new possibilities",
              type: "OPENING SESSION",
            },
            {
              time: programmeTime(e.start, e.end, 0.3125),
              label: "From emerging tools to meaningful ideas",
              type: "TECHNOLOGY & DESIGN",
            },
            {
              time: programmeTime(e.start, e.end, 0.4375),
              label: "A pause. A conversation. A new connection.",
              type: "LUNCH BREAK",
            },
            {
              time: programmeTime(e.start, e.end, 0.625),
              label: "The creative practice of tomorrow",
              type: "PANEL & CONVERSATION",
            },
            {
              time: programmeTime(e.start, e.end, 0.875),
              label: "What will you make next?",
              type: "NETWORKING & CLOSING",
            },
          ].map((row, i) => (
            <div className="programme-row" key={i}>
              <span>{row.time}</span>
              <h3>{row.label}</h3>
              <small>{row.type}</small>
              <ArrowUpRight size={20} />
            </div>
          ))}
          <p className="small-note">
            Proposed programme · session details may be refined by the
            organizer.
          </p>
        </section>
        <section className="venue-section" id="venue">
          <div className="venue-visual">
            <div className="building-art" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <i>{e.venue.split(" ")[0].toUpperCase()}</i>
            </div>
            <span className="venue-stamp">
              A PLACE FOR
              <br />
              BIG IDEAS ↗
            </span>
          </div>
          <div>
            <div className="eyebrow">03 / THE VENUE</div>
            <h2>{e.venue}</h2>
            <p>{e.address}</p>
            <p className="lead">
              Come for the summit.
              <br />
              Stay for the conversations.
            </p>
            <a
              className="text-link"
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(e.address)
              }
              target="_blank"
              rel="noreferrer"
            >
              View venue on map <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <section className="tickets-section" id="tickets">
          <header>
            <div>
              <div className="eyebrow">04 / YOUR INVITATION</div>
              <h2>There’s a seat for you.</h2>
            </div>
            <p>
              Choose how you’ll join us.
              <br />
              All tickets include a full day of inspiration.
            </p>
          </header>
          <div className="ticket-options">
            {data.categories.map((c, i) => {
              const remaining = c.capacity - c.registered;
              const open = c.open && e.registrationOpen;
              return (
                <article
                  className={"ticket-option " + (i === 2 ? "featured" : "")}
                  key={c.id}
                >
                  <div className="option-top">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <Availability
                      remaining={remaining}
                      capacity={c.capacity}
                      open={open}
                    />
                  </div>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <div className="price">
                    {money(c.price)}
                    <small>/ person</small>
                  </div>
                  <ul>
                    {c.benefits.map((b) => (
                      <li key={b}>
                        <Check size={15} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="capacity">
                    <span>
                      {remaining} of {c.capacity} places left
                    </span>
                    <div>
                      <i
                        style={{
                          width:
                            (100 * c.registered) / Math.max(c.capacity, 1) +
                            "%",
                        }}
                      />
                    </div>
                  </div>
                  {remaining > 0 && open ? (
                    <a
                      className={"button " + (i === 2 ? "coral" : "outline")}
                      href={"/register?category=" + c.id}
                    >
                      Select {c.name}
                      <ArrowUpRight size={18} />
                    </a>
                  ) : (
                    <Button disabled>
                      {remaining <= 0 ? "Sold out" : "Registration closed"}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="ticket-footnote">
            <ShieldCheck size={15} />
            Secure, unique QR ticket for every registration. Prices are in
            Indonesian Rupiah.
          </p>
        </section>
        <section className="final-cta">
          <span>✳</span>
          <div>
            <div className="eyebrow">BRING YOUR CURIOSITY</div>
            <h2>
              The future has room
              <br />
              for your ideas.
            </h2>
          </div>
          <a className="button ivory" href="#tickets">
            Join the summit <NextIcon />
          </a>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
export function Registration({ data }: { data: PublicData }) {
  const query = new URLSearchParams(location.search).get("category");
  const [form, setForm] = useState<RegisterInput>({
    requestId: uuid(),
    categoryId: query || data.categories[0]?.id || "",
    name: "",
    email: "",
    phone: "",
    organization: "",
    jobTitle: "",
    notes: "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const selected = data.categories.find((c) => c.id === form.categoryId);
  const set = (field: keyof RegisterInput, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!accepted)
        throw Error("Confirm the entry instructions before registering.");
      const ticket = await repo.register(form);
      const url =
        repo.mode === "demo"
          ? await portableLink(ticket)
          : location.origin + "/ticket/" + ticket.token;
      location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <PublicHeader />
      <main className="registration-layout">
        <div className="registration-copy">
          <a href="/#tickets" className="text-link">
            ← Back to tickets
          </a>
          <div className="eyebrow">YOUR NEXT GREAT CONVERSATION</div>
          <h1>
            Let’s save
            <br />
            your seat<span className="coral-text">.</span>
          </h1>
          <p>
            You bring the curiosity.
            <br />
            We’ll bring the creative company.
          </p>
          <img
            src={data.event.poster || posterSVG(data.event)}
            alt="Event poster"
          />
          <h3>{data.event.title}</h3>
          <p>
            {eventDate(data.event.date)} · {data.event.city}
          </p>
        </div>
        <form className="registration-form" onSubmit={submit}>
          <div className="eyebrow">REGISTRATION / ONE ATTENDEE</div>
          <h2>A few details, then you’re in.</h2>
          <Field label="Ticket category">
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              required
            >
              {data.categories.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={!c.open || c.registered >= c.capacity}
                >
                  {c.name} · {money(c.price)}{" "}
                  {c.registered >= c.capacity ? "· Sold out" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Full name">
              <input
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                maxLength={100}
                placeholder="As you’d like it on your ticket"
              />
            </Field>
            <Field label="Email address">
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
                maxLength={150}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Phone / WhatsApp (optional)">
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={25}
                placeholder="+62 …"
              />
            </Field>
            <Field label="Organization / company (optional)">
              <input
                value={form.organization}
                onChange={(e) => set("organization", e.target.value)}
                maxLength={150}
                placeholder="Where you create"
              />
            </Field>
            <Field label="Job title (optional)">
              <input
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                maxLength={100}
                placeholder="What you do"
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Anything the organizer should know?"
            />
          </Field>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
            />
            <span>
              I understand that my QR ticket admits one person and can be
              checked in once. I’ll keep my ticket link safe.
            </span>
          </label>
          <div className="order-summary">
            <span>1 × {selected?.name || "Ticket"}</span>
            <strong>{money(selected?.price || 0)}</strong>
          </div>
          {repo.mode === "demo" && (
            <p className="notice small-note">
              Demo registration. No payment is collected. Your information is
              saved only in this browser.
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="coral full"
            disabled={
              busy ||
              !data.event.registrationOpen ||
              !selected ||
              !selected.open ||
              selected.registered >= selected.capacity
            }
          >
            {busy ? "Creating your ticket…" : "Confirm registration"}
            <ArrowRight size={18} />
          </Button>
          <p className="small-note center">
            Your ticket opens immediately after registration. Email delivery is
            not enabled; save your ticket link.
          </p>
        </form>
      </main>
      <PublicFooter />
    </>
  );
}
export function TicketPage({ token }: { token: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!isToken(token)) throw Error("This ticket link is invalid.");
        let t = await repo.ticket(token);
        if (!t && repo.mode === "demo") t = await portableTicket(token);
        if (active) {
          setTicket(t);
          if (t)
            setQr(
              await QRCode.toDataURL(location.origin + "/ticket/" + t.token, {
                width: 360,
                margin: 3,
                errorCorrectionLevel: "M",
                color: { dark: "#181917", light: "#ffffff" },
              }),
            );
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        repo.mode === "demo"
          ? await portableLink(ticket!)
          : location.href.split("#")[0],
      );
      setSaved("Ticket link copied. Keep it private.");
    } catch {
      setSaved("Copy the full ticket address from your browser.");
    }
  }
  async function download() {
    setBusy(true);
    try {
      await document.fonts.ready;
      const data = await toPng(ref.current!, {
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: CONFIG.style.ivory,
      });
      const link = document.createElement("a");
      link.download = ticket!.number + ".png";
      const objectURL = URL.createObjectURL(await (await fetch(data)).blob());
      link.href = objectURL;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 1500);
      setSaved(
        "Ticket image prepared for download. If saving is blocked, use Print ticket → Save as PDF.",
      );
    } catch {
      setSaved(
        "Image download is unavailable. Use Print ticket → Save as PDF.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PublicHeader />
      <main className="ticket-page">
        {!loaded ? (
          <Loading text="Preparing your ticket…" />
        ) : !ticket ? (
          <Empty
            title="Ticket not found"
            text={
              error ||
              "Check your complete ticket link or contact the organizer."
            }
          />
        ) : (
          <>
            <div className="ticket-success">
              <CheckCircle2 />
              <div>
                <div className="eyebrow">REGISTRATION CONFIRMED</div>
                <h1>You’re on the guest list.</h1>
                <p>Save this ticket. Bring your curiosity.</p>
              </div>
            </div>
            <div ref={ref} className="digital-ticket" id="print-ticket">
              <div className="ticket-art">
                <img
                  src={ticket.event.poster || posterSVG(ticket.event)}
                  alt={ticket.event.title + " poster"}
                />
                <span className="ticket-art-label">
                  YOUR INVITATION TO WHAT’S NEXT
                </span>
              </div>
              <div className="ticket-body">
                <div className="ticket-brand">
                  <span>{ticket.event.organizer}</span>
                  <Status>{ticket.demo ? "DEMO TICKET" : "E-TICKET"}</Status>
                </div>
                <h2>{ticket.event.title}</h2>
                <div className="ticket-attendee">
                  <small>THIS SEAT BELONGS TO</small>
                  <h3>{ticket.name}</h3>
                  <span>{ticket.category}</span>
                </div>
                <div className="ticket-event-details">
                  <div>
                    <CalendarDays />
                    <span>{eventDate(ticket.event.date)}</span>
                  </div>
                  <div>
                    <Clock3 />
                    <span>
                      {ticket.event.start}—{ticket.event.end}{" "}
                      {zoneLabel(ticket.event.timeZone)}
                    </span>
                  </div>
                  <div>
                    <MapPin />
                    <span>
                      {ticket.event.venue}
                      <br />
                      {ticket.event.city}
                    </span>
                  </div>
                </div>
                <div className="qr-zone">
                  <div>
                    {qr ? (
                      <img src={qr} alt="Unique ticket QR code" />
                    ) : (
                      <Loading text="Generating QR…" />
                    )}
                  </div>
                  <section>
                    <small>REGISTRATION NUMBER</small>
                    <strong>{ticket.number}</strong>
                    <p>
                      Show this QR code at the entrance. One ticket. One
                      check-in.
                    </p>
                    {ticket.benefits.some((b) => /priority/i.test(b)) && (
                      <Status tone="warning">PRIORITY SEATING</Status>
                    )}
                  </section>
                </div>
                <div className="ticket-instructions">
                  <ShieldCheck size={17} />
                  <span>
                    Keep this link private. Have your ticket ready and bring
                    identification if your category requires it.
                    {ticket.demo
                      ? " Demo tickets are browser examples, not verified admission records."
                      : ""}
                  </span>
                </div>
                {ticket.sample && (
                  <div className="sample-label">
                    SAMPLE REGISTRATION · DEMONSTRATION ONLY
                  </div>
                )}
              </div>
            </div>
            <div className="ticket-actions">
              <Button onClick={() => window.print()} variant="outline">
                <Printer size={17} />
                Print ticket
              </Button>
              <Button onClick={download} disabled={busy}>
                <Download size={17} />
                {busy ? "Saving…" : "Save ticket image"}
              </Button>
              <Button onClick={copy} variant="outline">
                <Copy size={17} />
                Copy ticket link
              </Button>
            </div>
            <p className="small-note center" role="status">
              {saved ||
                "Your ticket link is your personal access key. Share it only with event staff."}
            </p>
            {repo.mode === "demo" && (
              <div className="demo-guide">
                <span>TRY THE COMPLETE WORKFLOW</span>
                <p>
                  Open the staff scanner in this browser, then paste this
                  ticket’s QR payload.
                </p>
                <div className="payload-box">
                  <code>{location.origin + "/ticket/" + ticket.token}</code>
                  <a className="text-link" href="/admin/scanner">
                    Open staff scanner <ArrowUpRight size={17} />
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
export function Lookup() {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = tokenFromPayload(value);
    if (!token) {
      setError("Enter your saved ticket URL or complete ticket token.");
      return;
    }
    try {
      const t = await repo.ticket(token);
      if (!t && repo.mode === "cloud") {
        setError("No ticket matches this link. Contact the organizer.");
        return;
      }
      if (value.includes("#demo=")) location.assign(value);
      else location.assign("/ticket/" + token);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PublicHeader />
      <main className="lookup-page">
        <TicketIcon size={36} />
        <div className="eyebrow">YOUR INVITATION, WITHIN REACH</div>
        <h1>Find your ticket.</h1>
        <p>
          Paste your personal ticket link or token.
          <br />
          For privacy, public lookup does not search by name or email.
        </p>
        <form onSubmit={submit}>
          <Field label="Ticket URL or token">
            <input
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste your saved ticket link"
            />
          </Field>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="coral">
            Open my ticket <NextIcon />
          </Button>
        </form>
        <p className="small-note">
          Lost your link? Contact the event organizer for identity-verified
          assistance.
        </p>
      </main>
      <PublicFooter />
    </>
  );
}

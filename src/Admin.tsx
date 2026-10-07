import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Users,
  ScanLine,
  CheckCircle2,
  Ticket,
  TrendingUp,
  Search,
  Camera,
  Upload,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Download,
  Plus,
  Trash2,
  Save,
  MapPin,
} from "lucide-react";
import jsQR from "jsqr";
import { CONFIG, eventDate, money, posterSVG, timestamp } from "./config";
import { tokenFromPayload, uuid } from "./domain";
import { repo } from "./store";
import type { Attendee, Category, Data, ScanResult } from "./types";
import { Button, Empty, Field, Modal, Status } from "./ui";
const checked = (d: Data, a: Attendee) =>
  d.checkins.find((c) => c.registrationId === a.id);
const category = (d: Data, a: Attendee) =>
  d.categories.find((c) => c.id === a.categoryId)!;
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="stat">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function MetricCards({ data }: { data: Data }) {
  const count = data.attendees.length,
    inside = data.checkins.length,
    cap = data.categories.reduce((n, c) => n + c.capacity, 0);
  return (
    <div className="stats-grid">
      <Stat
        label="Registered"
        value={count}
        detail={`of ${cap} total places`}
        icon={<Users />}
      />
      <Stat
        label="Checked in"
        value={inside}
        detail="Verified physical attendance"
        icon={<CheckCircle2 />}
      />
      <Stat
        label="Awaiting arrival"
        value={count - inside}
        detail={`${cap - count} tickets remaining`}
        icon={<Clock3 />}
      />
      <Stat
        label="Attendance rate"
        value={(count ? (inside / count) * 100 : 0).toFixed(1) + "%"}
        detail="Checked in / registered"
        icon={<TrendingUp />}
      />
    </div>
  );
}
function CategoryBars({ data }: { data: Data }) {
  return (
    <div className="category-bars">
      {data.categories.map((c) => {
        const regs = data.attendees.filter((a) => a.categoryId === c.id),
          inside = data.checkins.filter((ch) =>
            regs.some((a) => a.id === ch.registrationId),
          ).length;
        return (
          <div key={c.id}>
            <header>
              <strong>{c.name}</strong>
              <span>
                {inside} checked in / {regs.length} registered
              </span>
            </header>
            <div className="bar-track">
              <i
                className="bar-registered"
                style={{
                  width: (regs.length / Math.max(1, c.capacity)) * 100 + "%",
                }}
              />
              <i
                className="bar-checked"
                style={{
                  width: (inside / Math.max(1, c.capacity)) * 100 + "%",
                }}
              />
            </div>
            <footer>
              <span>
                {money(c.price)} · {c.capacity} capacity
              </span>
              <span>{c.capacity - regs.length} places left</span>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
export function Dashboard({ data }: { data: Data }) {
  return (
    <>
      <PageTitle
        eyebrow="ORGANIZER OVERVIEW"
        title="Good ideas. Great company."
        description={data.event.title}
        action={
          <a href="/admin/scanner" className="button coral">
            <ScanLine size={18} />
            Open check-in
          </a>
        }
      />
      <MetricCards data={data} />
      <div className="dashboard-grid">
        <section className="panel">
          <header>
            <div>
              <div className="eyebrow">WHO’S JOINING US</div>
              <h2>Every seat tells a story.</h2>
            </div>
            <Status>LIVE WORKSPACE</Status>
          </header>
          <CategoryBars data={data} />
          <div className="chart-legend">
            <span>
              <i className="coral-dot" />
              Registered
            </span>
            <span>
              <i className="dark-dot" />
              Checked in
            </span>
          </div>
        </section>
        <section className="attendance-card">
          <div className="eyebrow">THE ROOM IS COMING TO LIFE</div>
          <h2>
            Ready for
            <br />a full house.
          </h2>
          <div
            className="attendance-ring"
            style={
              {
                "--progress": `${(data.attendees.length ? data.checkins.length / data.attendees.length : 0) * 360}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{data.checkins.length}</strong>
              <span>in the room</span>
            </div>
          </div>
          <a className="text-link" href="/admin/statistics">
            Explore attendance <ArrowUpRight size={17} />
          </a>
        </section>
      </div>
      <div className="dashboard-grid recent-grid">
        <section className="panel">
          <header>
            <div>
              <div className="eyebrow">RECENT REGISTRATIONS</div>
              <h2>The guest list is growing.</h2>
            </div>
            <a href="/admin/attendees" className="text-link">
              View all <ArrowUpRight size={17} />
            </a>
          </header>
          {[...data.attendees]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((a) => (
              <div className="recent-person" key={a.id}>
                <span className="avatar">
                  {a.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {category(data, a).name}{" "}
                    {a.sample ? "· Sample" : "· New registration"}
                  </small>
                </div>
                <small>{timestamp(a.createdAt, data.event.timeZone)}</small>
              </div>
            ))}
          {!data.attendees.length && (
            <Empty
              title="Your first guest is next"
              text="Share the public event page to start registrations."
            />
          )}
        </section>
        <section className="panel">
          <header>
            <div>
              <div className="eyebrow">RECENT ARRIVALS</div>
              <h2>A warm welcome.</h2>
            </div>
            <ScanLine size={20} />
          </header>
          {[...data.checkins]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((ch) => {
              const a = data.attendees.find((a) => a.id === ch.registrationId)!;
              return (
                <div className="recent-person" key={ch.id}>
                  <span className="avatar arrival">
                    <CheckCircle2 size={19} />
                  </span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {ch.method === "QR" ? "QR scan" : "Manual check-in"} ·{" "}
                      {category(data, a).name}
                    </small>
                  </div>
                  <small>{timestamp(ch.createdAt, data.event.timeZone)}</small>
                </div>
              );
            })}
          {!data.checkins.length && (
            <Empty
              title="Doors haven’t opened yet"
              text="Validated check-ins will appear here."
            />
          )}
        </section>
      </div>
    </>
  );
}
export function ManualConfirm({
  attendee,
  data,
  close,
  onResult,
}: {
  attendee: Attendee;
  data: Data;
  close: () => void;
  onResult: (r: ScanResult) => Promise<void>;
}) {
  const old = checked(data, attendee),
    [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const result = await repo.checkin(
        attendee.token,
        "manual",
        Boolean(old),
        reason,
      );
      await onResult(result);
      close();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={old ? "Confirm entry override" : "Confirm manual check-in"}
      close={close}
    >
      <div className="confirm-person">
        <Users />
        <h3>{attendee.name}</h3>
        <p>
          {attendee.number} · {category(data, attendee).name}
        </p>
      </div>
      {old ? (
        <>
          <p className="notice">
            Already checked in at{" "}
            {timestamp(old.createdAt, data.event.timeZone)}. An override
            reconfirms entry and adds an audit note. It preserves the original
            attendance record and count.
          </p>
          <Field label="Override reason">
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why staff are reconfirming entry"
            />
          </Field>
        </>
      ) : (
        <p className="notice">
          Verify the attendee’s identity and ticket category before confirming
          admission.
        </p>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        <span>
          {old
            ? "I explicitly confirm this entry override."
            : "I have verified this attendee’s identity."}
        </span>
      </label>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="coral"
          onClick={submit}
          disabled={
            busy || !confirm || (Boolean(old) && reason.trim().length < 5)
          }
        >
          {busy ? "Saving…" : old ? "Confirm override" : "Confirm check-in"}
        </Button>
      </div>
    </Modal>
  );
}
export function Attendees({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState(""),
    [cat, setCat] = useState(""),
    [state, setState] = useState(""),
    [sort, setSort] = useState("newest"),
    [detail, setDetail] = useState<Attendee | null>(null),
    [manual, setManual] = useState<Attendee | null>(null),
    [message, setMessage] = useState("");
  const list = useMemo(
    () =>
      data.attendees
        .filter(
          (a) =>
            (!cat || a.categoryId === cat) &&
            (!state || Boolean(checked(data, a)) === (state === "checked")) &&
            [a.name, a.number, a.email, a.phone]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "oldest"
              ? a.createdAt.localeCompare(b.createdAt)
              : b.createdAt.localeCompare(a.createdAt),
        ),
    [data, search, cat, state, sort],
  );
  function exportCSV() {
    const esc = (v: string) =>
      '"' +
      (v.startsWith("=") ||
      v.startsWith("+") ||
      v.startsWith("-") ||
      v.startsWith("@")
        ? "'"
        : "") +
      v.replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Registration",
        "Name",
        "Email",
        "Phone",
        "Ticket",
        "Registered at",
        "Status",
        "Check-in time",
        "Demo record",
      ],
      ...list.map((a) => [
        a.number,
        a.name,
        a.email,
        a.phone,
        category(data, a).name,
        a.createdAt,
        checked(data, a) ? "Checked in" : "Awaiting arrival",
        checked(data, a)?.createdAt || "",
        a.sample ? "Sample" : "New registration",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "eventora-attendees.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle
        eyebrow="THE PEOPLE BEHIND THE NUMBERS"
        title="Your guest list."
        description="Find a guest, verify their details and make their arrival easy."
        action={
          <Button variant="outline" onClick={exportCSV}>
            <Download size={17} />
            Export filtered CSV
          </Button>
        }
      />
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search attendees"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone or registration…"
          />
        </div>
        <select
          aria-label="Filter ticket category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">All ticket categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter check-in status"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All arrival statuses</option>
          <option value="checked">Checked in</option>
          <option value="pending">Awaiting arrival</option>
        </select>
        <select
          aria-label="Sort attendees"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <div className="table-caption">
        <span>{list.length} attendees</span>
        <span>
          Sample records are marked. Demo additions remain local to this
          browser.
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Registration</th>
              <th>Ticket</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Check-in time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>
                  <button className="table-name" onClick={() => setDetail(a)}>
                    {a.name}
                  </button>
                  <small>{a.email}</small>
                  <small>{a.phone || "No phone provided"}</small>
                  {a.sample && <span className="sample-badge">SAMPLE</span>}
                </td>
                <td>
                  <code>{a.number}</code>
                </td>
                <td>{category(data, a).name}</td>
                <td>{timestamp(a.createdAt, data.event.timeZone)}</td>
                <td>
                  <Status tone={checked(data, a) ? "success" : "muted"}>
                    {checked(data, a) ? "Checked in" : "Awaiting arrival"}
                  </Status>
                </td>
                <td>
                  {checked(data, a)
                    ? timestamp(
                        checked(data, a)!.createdAt,
                        data.event.timeZone,
                      )
                    : "—"}
                </td>
                <td>
                  <button
                    className="icon-button"
                    onClick={() => setDetail(a)}
                    aria-label={"View attendee " + a.name}
                  >
                    <ArrowUpRight size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title="No matching guests"
            text="Try a different search or clear your filters."
          />
        )}
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {detail && (
        <Modal title="Attendee details" close={() => setDetail(null)}>
          <div className="detail-heading">
            <span className="avatar">{detail.name[0]}</span>
            <div>
              <h3>{detail.name}</h3>
              <p>{category(data, detail).name}</p>
            </div>
            <Status tone={checked(data, detail) ? "success" : "muted"}>
              {checked(data, detail) ? "Checked in" : "Awaiting arrival"}
            </Status>
          </div>
          <dl className="detail-grid">
            <dt>Registration</dt>
            <dd>{detail.number}</dd>
            <dt>Email</dt>
            <dd>{detail.email}</dd>
            <dt>Phone</dt>
            <dd>{detail.phone || "Not supplied"}</dd>
            <dt>Organization</dt>
            <dd>{detail.organization || "Not supplied"}</dd>
            <dt>Job title</dt>
            <dd>{detail.jobTitle || "Not supplied"}</dd>
            <dt>Registered</dt>
            <dd>{timestamp(detail.createdAt, data.event.timeZone)}</dd>
            <dt>QR ticket</dt>
            <dd>Valid opaque ticket token</dd>
            <dt>Check-in</dt>
            <dd>
              {checked(data, detail)
                ? timestamp(
                    checked(data, detail)!.createdAt,
                    data.event.timeZone,
                  ) +
                  " · " +
                  checked(data, detail)!.method
                : "Not yet checked in"}
            </dd>
            <dt>Notes</dt>
            <dd>{detail.notes || "None"}</dd>
            <dt>Record</dt>
            <dd>
              {detail.sample
                ? "Sample demonstration attendee"
                : repo.mode === "demo"
                  ? "New demo registration"
                  : "Registered attendee"}
            </dd>
          </dl>
          {data.audit
            .filter((a) => a.registrationId === detail.id)
            .map((a) => (
              <p key={a.id} className="audit-note">
                {a.action} · {timestamp(a.createdAt, data.event.timeZone)} ·{" "}
                {a.actor}
                <br />
                {a.reason}
              </p>
            ))}
          <div className="modal-actions">
            <a
              className="button outline"
              href={"/ticket/" + detail.token}
              target="_blank"
              rel="noreferrer"
            >
              View e-ticket <ArrowUpRight size={17} />
            </a>
            {(!checked(data, detail) || data.event.allowOverride) && (
              <Button
                variant="coral"
                onClick={() => {
                  setManual(detail);
                  setDetail(null);
                }}
              >
                {checked(data, detail)
                  ? "Review entry override"
                  : "Manual check-in"}
              </Button>
            )}
          </div>
        </Modal>
      )}
      {manual && (
        <ManualConfirm
          attendee={manual}
          data={data}
          close={() => setManual(null)}
          onResult={async (r) => {
            await refresh();
            setMessage(
              r.status === "override"
                ? "Entry reconfirmed. The original check-in time is preserved."
                : "Manual check-in successful for " + r.attendee?.name,
            );
          }}
        />
      )}
    </>
  );
}
export function Scanner({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => Promise<void>;
}) {
  const [payload, setPayload] = useState(""),
    [result, setResult] = useState<ScanResult | null>(null),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false),
    [cameraReady, setCameraReady] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [search, setSearch] = useState(""),
    [manual, setManual] = useState<Attendee | null>(null),
    [uploading, setUploading] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    lock = useRef(false),
    scanRef = useRef<(raw: string) => Promise<void>>(async () => {});
  async function scan(raw: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const token = tokenFromPayload(raw);
      const r = token
        ? await repo.checkin(token, "QR")
        : {
            status: "invalid" as const,
            message: "The QR payload is not a valid ticket for this site.",
          };
      setResult(r);
      if (r.status === "success") await refresh();
    } catch (e) {
      setResult({ status: "invalid", message: (e as Error).message });
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  scanRef.current = scan;
  useEffect(() => {
    if (!camera || result) return;
    let stream: MediaStream | null = null,
      frame = 0,
      active = true,
      last = 0;
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    async function begin() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Camera scanning is unavailable in this browser. Use token entry or attendee search below.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        setCameraReady(true);
        const decode = (time: number) => {
          if (!active) return;
          if (
            time - last > 180 &&
            video.current?.readyState === 4 &&
            !lock.current
          ) {
            last = time;
            const v = video.current;
            const scale = Math.min(1, 720 / v.videoWidth);
            canvas.width = v.videoWidth * scale;
            canvas.height = v.videoHeight * scale;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
              code = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });
            if (code) {
              void scanRef.current(code.data);
              return;
            }
          }
          frame = requestAnimationFrame(decode);
        };
        frame = requestAnimationFrame(decode);
      } catch (e) {
        if (active) {
          setCameraError(
            (e as Error).name === "NotAllowedError"
              ? "Camera permission was denied. Use token entry or attendee search below."
              : (e as Error).message,
          );
          setCamera(false);
        }
      }
    }
    void begin();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      setCameraReady(false);
    };
  }, [camera, Boolean(result)]);
  async function imageScan(file: File) {
    setUploading(true);
    setCameraError("");
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 8 * 1024 * 1024
      )
        throw Error(
          "Choose a QR image in PNG, JPEG or WebP format under 8 MB.",
        );
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
        code = jsQR(image.data, image.width, image.height);
      if (!code)
        throw Error("No readable QR was found in this image. Try token entry.");
      await scan(code.data);
    } catch (e) {
      setCameraError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const matches = search.trim()
    ? data.attendees
        .filter((a) =>
          [a.name, a.email, a.phone, a.number]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  return (
    <>
      <PageTitle
        eyebrow="AT THE DOOR"
        title="A great day starts here."
        description="Scan. Validate. Welcome. One verified arrival at a time."
      />
      <div className="scanner-layout">
        <section className="scanner-panel">
          <div className="scanner-top">
            <span>
              <ScanLine size={19} />
              TICKET CHECK-IN
            </span>
            <Status tone={cameraReady ? "success" : "muted"}>
              {cameraReady ? "CAMERA LIVE" : "READY FOR A TICKET"}
            </Status>
          </div>
          {result ? (
            <div
              className={"scan-result " + result.status}
              role="status"
              aria-live="polite"
            >
              {result.status === "success" ? (
                <CheckCircle2 size={56} />
              ) : result.status === "duplicate" ||
                result.status === "override" ? (
                <AlertTriangle size={56} />
              ) : (
                <XCircle size={56} />
              )}
              <h2>
                {result.status === "success"
                  ? "CHECK-IN SUCCESSFUL"
                  : result.status === "duplicate"
                    ? "ALREADY CHECKED IN"
                    : result.status === "override"
                      ? "ENTRY RECONFIRMED"
                      : "INVALID TICKET"}
              </h2>
              {result.attendee && (
                <>
                  <h3>{result.attendee.name}</h3>
                  <p>{result.category?.name}</p>
                  <code>{result.attendee.number}</code>
                </>
              )}
              <p>{result.message}</p>
              {result.checkin && (
                <div className="result-time">
                  <small>
                    {result.status === "success"
                      ? "CHECK-IN TIME"
                      : "ORIGINAL CHECK-IN TIME"}
                  </small>
                  <strong>
                    {timestamp(result.checkin.createdAt, data.event.timeZone)}
                  </strong>
                </div>
              )}
              <Button
                variant={result.status === "success" ? "" : "coral"}
                onClick={() => {
                  setResult(null);
                  setPayload("");
                }}
              >
                Next attendee <ArrowUpRight size={18} />
              </Button>
            </div>
          ) : (
            <>
              <div className="scan-area">
                <video
                  ref={video}
                  playsInline
                  muted
                  aria-label="Live QR camera preview"
                  className={cameraReady ? "live" : ""}
                />
                <div className="scan-frame">
                  <i />
                  <i />
                  <i />
                  <i />
                  {!cameraReady && (
                    <>
                      <ScanLine size={70} strokeWidth={1} />
                      <p>
                        {camera
                          ? "Starting camera…"
                          : "A ticket is an invitation."}
                        <br />
                        Let’s give it a warm welcome.
                      </p>
                    </>
                  )}
                </div>
                <div className="scan-area-caption">
                  {cameraReady
                    ? "Position one QR code inside the frame"
                    : "Camera is off · token entry works without a camera"}
                </div>
              </div>
              <div className="scanner-controls">
                <Button
                  variant="coral"
                  onClick={() => {
                    setCameraError("");
                    setCamera((v) => !v);
                  }}
                  disabled={busy}
                >
                  <Camera size={18} />
                  {camera ? "Stop camera" : "Start camera"}
                </Button>
                <label className="button outline upload-button">
                  <Upload size={18} />
                  {uploading ? "Reading…" : "Scan QR image"}
                  <input
                    aria-label="Upload QR image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading || busy}
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void imageScan(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void scan(payload);
                }}
                className="scan-form"
              >
                <Field label="QR payload or ticket token">
                  <textarea
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    rows={2}
                    required
                    placeholder="Paste the QR payload or opaque ticket token"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="full"
                  disabled={busy || !payload.trim()}
                >
                  {busy ? "Validating…" : "Validate & check in"}
                  <ShieldCheck size={17} />
                </Button>
              </form>
            </>
          )}
          {cameraError && (
            <p className="error-message" role="alert">
              {cameraError}
            </p>
          )}
        </section>
        <aside>
          <div className="panel door-progress">
            <div className="eyebrow">LIVE ARRIVAL PROGRESS</div>
            <strong>
              {data.checkins.length}
              <span>/ {data.attendees.length}</span>
            </strong>
            <p>guests checked in</p>
            <div className="bar-track">
              <i
                className="bar-checked"
                style={{
                  width:
                    (data.attendees.length
                      ? (data.checkins.length / data.attendees.length) * 100
                      : 0) + "%",
                }}
              />
            </div>
            <small>
              {(data.attendees.length
                ? (data.checkins.length / data.attendees.length) * 100
                : 0
              ).toFixed(1)}
              % attendance · {data.attendees.length - data.checkins.length}{" "}
              awaiting arrival
            </small>
          </div>
          <div className="panel manual-search">
            <div className="eyebrow">NO QR? NO PROBLEM.</div>
            <h2>Find their invitation.</h2>
            <Field label="Manual attendee search">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, phone or registration"
              />
            </Field>
            {matches.map((a) => (
              <button
                className="manual-person"
                key={a.id}
                onClick={() => setManual(a)}
                disabled={
                  Boolean(checked(data, a)) && !data.event.allowOverride
                }
              >
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {a.number} · {category(data, a).name}
                  </small>
                  <Status tone={checked(data, a) ? "warning" : "muted"}>
                    {checked(data, a)
                      ? "Already checked in"
                      : "Awaiting arrival"}
                  </Status>
                </div>
                <ArrowUpRight size={18} />
              </button>
            ))}
            {search && !matches.length && (
              <p className="small-note">
                No matching attendees. Try another detail.
              </p>
            )}
            <p className="small-note">
              Manual admission requires identity verification and confirmation.
              Overrides preserve the original attendance record.
            </p>
          </div>
          <div className="scanner-rule">
            <ShieldCheck size={22} />
            <p>
              One ticket. One check-in.
              <br />
              <small>Duplicate scans never add attendance.</small>
            </p>
          </div>
        </aside>
      </div>
      {manual && (
        <ManualConfirm
          attendee={manual}
          data={data}
          close={() => setManual(null)}
          onResult={async (r) => {
            setResult(r);
            await refresh();
          }}
        />
      )}
    </>
  );
}
export function Statistics({ data }: { data: Data }) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: data.checkins.filter(
        (ch) =>
          Number(
            new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              hourCycle: "h23",
              timeZone: data.event.timeZone,
            }).format(new Date(ch.createdAt)),
          ) === hour,
      ).length,
    })).filter((x, i) => i >= 6 && i <= 20),
    max = Math.max(1, ...hourly.map((h) => h.count));
  return (
    <>
      <PageTitle
        eyebrow="ATTENDANCE, NOT JUST REGISTRATIONS"
        title="See the room take shape."
        description="Live attendance from validated arrivals. Each guest is counted once."
      />
      <MetricCards data={data} />
      <div className="dashboard-grid">
        <section className="panel">
          <header>
            <div>
              <div className="eyebrow">BY TICKET CATEGORY</div>
              <h2>Different tickets. One community.</h2>
            </div>
          </header>
          <CategoryBars data={data} />
          <div className="chart-legend">
            <span>
              <i className="coral-dot" />
              Registered
            </span>
            <span>
              <i className="dark-dot" />
              Checked in
            </span>
          </div>
        </section>
        <section className="panel">
          <header>
            <div>
              <div className="eyebrow">ARRIVAL TIMES</div>
              <h2>A rhythm to the day.</h2>
            </div>
          </header>
          <div
            className="hour-chart"
            role="img"
            aria-label={hourly
              .map((h) => `${h.hour}:00: ${h.count} arrivals`)
              .join("; ")}
          >
            {hourly.map((h) => (
              <div key={h.hour} title={`${h.hour}:00 · ${h.count} guests`}>
                <span>{h.count || ""}</span>
                <i style={{ height: (h.count / max) * 140 + 2 + "px" }} />
                <small>{String(h.hour).padStart(2, "0")}</small>
              </div>
            ))}
          </div>
          <p className="small-note">
            All recorded check-ins, grouped by hour in {data.event.timeZone}.
          </p>
        </section>
      </div>
      <section className="panel">
        <header>
          <div>
            <div className="eyebrow">REGISTRATION & ATTENDANCE</div>
            <h2>The detail behind the day.</h2>
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket category</th>
                <th>Capacity</th>
                <th>Registered</th>
                <th>Checked in</th>
                <th>Not checked in</th>
                <th>Attendance</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => {
                const count = data.attendees.filter(
                    (a) => a.categoryId === c.id,
                  ).length,
                  inside = data.checkins.filter((ch) =>
                    data.attendees.some(
                      (a) =>
                        a.id === ch.registrationId && a.categoryId === c.id,
                    ),
                  ).length;
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.capacity}</td>
                    <td>{count}</td>
                    <td>{inside}</td>
                    <td>{count - inside}</td>
                    <td>{(count ? (inside / count) * 100 : 0).toFixed(1)}%</td>
                    <td>{c.capacity - count} remaining</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small-note">
          {data.attendees.filter((a) => a.sample).length} sample attendees ·{" "}
          {data.attendees.filter((a) => !a.sample).length}{" "}
          {repo.mode === "demo" ? "new demo registrations" : "registrations"}.
          Overrides are audited without changing attendance counts.
        </p>
      </section>
    </>
  );
}
export function Settings({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => Promise<void>;
}) {
  const [event, setEvent] = useState(structuredClone(data.event)),
    [categories, setCategories] = useState(structuredClone(data.categories)),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [remove, setRemove] = useState<Category | null>(null);
  const set = (key: keyof typeof event, value: string | boolean) =>
    setEvent((e) => ({ ...e, [key]: value }));
  function update(id: string, key: keyof Category, value: unknown) {
    setCategories((cs) =>
      cs.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await repo.saveEvent(event, categories);
      await refresh();
      setMessage(
        "Event settings saved. Public pages, new tickets and capacity rules are updated.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      set("poster", await repo.upload(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE THE EVENT YOURS"
        title="The details make the difference."
        description="Manage the event identity, invitation and entry rules in one place."
      />
      <form onSubmit={save}>
        <div className="settings-layout">
          <div>
            <section className="panel">
              <header>
                <h2>Event identity</h2>
              </header>
              <div className="form-grid">
                <Field label="Event title">
                  <input
                    required
                    value={event.title}
                    maxLength={160}
                    onChange={(e) => set("title", e.target.value)}
                  />
                </Field>
                <Field label="Organizer">
                  <input
                    required
                    value={event.organizer}
                    maxLength={100}
                    onChange={(e) => set("organizer", e.target.value)}
                  />
                </Field>
                <Field label="Event type">
                  <input
                    value={event.type}
                    maxLength={100}
                    onChange={(e) => set("type", e.target.value)}
                  />
                </Field>
                <Field label="Event date">
                  <input
                    type="date"
                    required
                    value={event.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </Field>
                <Field label="Start time">
                  <input
                    type="time"
                    required
                    value={event.start}
                    onChange={(e) => set("start", e.target.value)}
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    required
                    value={event.end}
                    onChange={(e) => set("end", e.target.value)}
                  />
                </Field>
                <Field label="Time zone">
                  <input
                    required
                    value={event.timeZone}
                    onChange={(e) => set("timeZone", e.target.value)}
                  />
                </Field>
                <Field label="Venue">
                  <input
                    required
                    maxLength={200}
                    value={event.venue}
                    onChange={(e) => set("venue", e.target.value)}
                  />
                </Field>
                <Field label="City">
                  <input
                    required
                    maxLength={100}
                    value={event.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </Field>
                <Field label="Venue address">
                  <input
                    maxLength={300}
                    value={event.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Event description">
                <textarea
                  rows={5}
                  value={event.description}
                  maxLength={3000}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </section>
            <section className="panel">
              <header>
                <div>
                  <h2>Ticket categories</h2>
                  <p className="small-note">
                    Prices in IDR. Capacity cannot be below existing
                    registrations.
                  </p>
                </div>
                <Button
                  variant="outline small"
                  onClick={() =>
                    setCategories((cs) => [
                      ...cs,
                      {
                        id: uuid(),
                        name: "New ticket",
                        description: "",
                        price: 0,
                        capacity: 20,
                        open: true,
                        benefits: [],
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  Add category
                </Button>
              </header>
              {categories.map((c) => (
                <div className="category-editor" key={c.id}>
                  <div className="category-edit-top">
                    <Status>
                      {
                        data.attendees.filter((a) => a.categoryId === c.id)
                          .length
                      }{" "}
                      REGISTERED
                    </Status>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={"Remove category " + c.name}
                      onClick={() => setRemove(c)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label="Ticket name">
                      <input
                        required
                        value={c.name}
                        maxLength={100}
                        onChange={(e) => update(c.id, "name", e.target.value)}
                      />
                    </Field>
                    <Field label="Ticket price (IDR)">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={c.price}
                        onChange={(e) =>
                          update(c.id, "price", Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Capacity">
                      <input
                        type="number"
                        min={
                          data.attendees.filter((a) => a.categoryId === c.id)
                            .length
                        }
                        max={100000}
                        step="1"
                        required
                        value={c.capacity}
                        onChange={(e) =>
                          update(c.id, "capacity", Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Ticket description">
                      <input
                        value={c.description}
                        maxLength={200}
                        onChange={(e) =>
                          update(c.id, "description", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Benefits (one per line)">
                    <textarea
                      rows={3}
                      value={c.benefits.join("\n")}
                      maxLength={1500}
                      onChange={(e) =>
                        update(c.id, "benefits", e.target.value.split("\n"))
                      }
                    />
                  </Field>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={c.open}
                      onChange={(e) => update(c.id, "open", e.target.checked)}
                    />
                    <span>Open for registration</span>
                  </label>
                </div>
              ))}
            </section>
          </div>
          <aside>
            <section className="panel poster-settings">
              <header>
                <h2>The event poster</h2>
              </header>
              <img
                src={event.poster || posterSVG(event)}
                alt="Event poster preview"
              />
              <label className="button outline upload-button">
                <Upload size={16} />
                {uploading ? "Processing…" : "Replace poster"}
                <input
                  type="file"
                  aria-label="Upload event poster"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="small-note">
                PNG, JPEG or WebP · up to 8 MB. Images are resized to 1400 px
                and optimized.
              </p>
              {event.poster && (
                <Button
                  variant="outline small"
                  onClick={() => set("poster", "")}
                >
                  Use generated event poster
                </Button>
              )}
            </section>
            <section className="panel">
              <h2>Registration & entry</h2>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={event.registrationOpen}
                  onChange={(e) => set("registrationOpen", e.target.checked)}
                />
                <span>Public registration is open</span>
              </label>
              <p className="notice">
                <ShieldCheck size={16} /> Single-entry tickets are enforced.
                Duplicate scans never create another attendance record.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={event.allowOverride}
                  onChange={(e) => set("allowOverride", e.target.checked)}
                />
                <span>Allow staff entry overrides after confirmation</span>
              </label>
              <p className="small-note">
                An override needs a reason and explicit confirmation. The first
                check-in timestamp is preserved for audit.
              </p>
            </section>
          </aside>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice success">
            {message}
          </p>
        )}
        <div className="settings-save">
          <p>
            Changes apply to this event. Existing registration identifiers and
            QR tokens remain stable.
          </p>
          <Button type="submit" variant="coral" disabled={busy || uploading}>
            <Save size={17} />
            {busy ? "Saving…" : "Save event settings"}
          </Button>
        </div>
      </form>
      {remove && (
        <Modal title="Remove ticket category?" close={() => setRemove(null)}>
          <p>
            {data.attendees.some((a) => a.categoryId === remove.id)
              ? "This category has registrations and cannot be removed. Close registration for it instead."
              : "Remove " +
                remove.name +
                " from the event? This change will apply when you save settings."}
          </p>
          <div className="modal-actions">
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="coral"
              disabled={data.attendees.some((a) => a.categoryId === remove.id)}
              onClick={() => {
                setCategories((cs) => cs.filter((c) => c.id !== remove.id));
                setRemove(null);
              }}
            >
              Remove category
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

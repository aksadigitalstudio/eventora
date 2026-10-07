import type { EventInfo, Category } from "./types";
// The supplied five configuration values live here. Initial data and all views derive from these values.
export const CONFIG = {
  appName: "Eventora",
  event: {
    id: "bc0e0a42-40f8-4820-991a-a098638f721a",
    title: "Future Creative Summit 2026",
    organizer: "AKSA Studio",
    type: "Creative technology seminar",
    date: "2026-11-21",
    start: "09:00",
    end: "17:00",
    timeZone: "Asia/Jakarta",
    venue: "Aruna Convention Hall",
    city: "Yogyakarta",
    address: "Aruna Convention Hall, Yogyakarta, Indonesia",
    description:
      "A day for curious minds, ambitious makers and the ideas that connect them. Explore the intersection of creativity and technology through thoughtful talks, hands-on perspectives and conversations that continue long after the stage goes quiet.",
    poster: "",
    registrationOpen: true,
    singleEntry: true,
    allowOverride: true,
  } satisfies EventInfo,
  tickets: [
    {
      id: "730ed7dd-6e94-4598-830e-c7a10d81a501",
      name: "General Admission",
      description: "Your place in the conversation.",
      price: 150000,
      capacity: 150,
      open: true,
      benefits: [
        "Full-day seminar access",
        "Networking sessions",
        "Digital participation certificate",
      ],
    },
    {
      id: "730ed7dd-6e94-4598-830e-c7a10d81a502",
      name: "Student Pass",
      description: "Big ideas for the next generation.",
      price: 75000,
      capacity: 75,
      open: true,
      benefits: [
        "Full-day seminar access",
        "Student ID required at entry",
        "Digital participation certificate",
      ],
    },
    {
      id: "730ed7dd-6e94-4598-830e-c7a10d81a503",
      name: "VIP Pass",
      description: "A little closer to what’s next.",
      price: 300000,
      capacity: 25,
      open: true,
      benefits: [
        "Priority seating",
        "Full-day seminar access",
        "Networking sessions",
        "Digital participation certificate",
      ],
    },
  ] satisfies Category[],
  rules: { singleEntry: true, overrideConfirmation: true },
  style: {
    ink: "#181917",
    ivory: "#f6f3eb",
    coral: "#ed7965",
    gold: "#b7a16e",
    muted: "#666760",
    line: "#dddacf",
  },
};
export const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
export const zoneLabel = (zone: string) =>
  zone === "Asia/Jakarta" ? "WIB" : zone;
export function programmeTime(start: string, end: string, fraction: number) {
  const toMinutes = (v: string) =>
    Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const value = Math.round(
    toMinutes(start) + (toMinutes(end) - toMinutes(start)) * fraction,
  );
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}
export const eventDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
export const timestamp = (v: string, timeZone = CONFIG.event.timeZone) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(new Date(v));
export function posterSVG(
  event: Pick<
    EventInfo,
    | "title"
    | "organizer"
    | "date"
    | "start"
    | "end"
    | "venue"
    | "city"
    | "timeZone"
  >,
) {
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 900"><rect width="740" height="900" fill="${CONFIG.style.ink}"/><g fill="${CONFIG.style.ivory}" font-family="Arial,sans-serif"><text x="50" y="62" font-size="18" letter-spacing="5">${escape(event.organizer.toUpperCase())} PRESENTS</text><text x="50" y="130" font-size="16" letter-spacing="3">CREATIVITY × TECHNOLOGY × WHAT’S NEXT</text></g><g fill="none" stroke="${CONFIG.style.coral}" stroke-width="2.5" transform="translate(365 405) rotate(-25)">${Array.from({ length: 17 }, (_, i) => `<ellipse rx="${62 + i * 13}" ry="${204 - i * 6}" transform="rotate(${i * 6})"/>`).join("")}</g><circle cx="585" cy="240" r="14" fill="${CONFIG.style.gold}"/><g fill="${CONFIG.style.ivory}" font-family="Arial,sans-serif" font-weight="800"><text x="45" y="640" font-size="66">${escape(event.title.split(" ").slice(0, 2).join(" "))}</text><text x="45" y="718" font-size="70">${escape(event.title.split(" ").slice(2).join(" "))}</text></g><path d="M50 766H690" stroke="${CONFIG.style.gold}"/><g fill="${CONFIG.style.ivory}" font-family="Arial,sans-serif"><text x="50" y="804" font-size="22">${escape(eventDate(event.date).toUpperCase())}</text><text x="50" y="838" font-size="17">${event.start}—${event.end} ${escape(zoneLabel(event.timeZone))} · ${escape(event.city.toUpperCase())}</text><text x="50" y="869" font-size="14">${escape(event.venue.toUpperCase())}</text></g><text x="615" y="105" fill="${CONFIG.style.coral}" font-family="Arial,sans-serif" font-size="55">↗</text></svg>`,
    )
  );
}

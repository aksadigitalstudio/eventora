import { CONFIG } from "./config";
import type { Data, Ticket, RegisterInput } from "./types";
export const uuid = () => crypto.randomUUID();
export const isToken = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function tokenFromPayload(raw: string) {
  const value = raw.trim();
  if (isToken(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/ticket\/([\w-]+)\/?$/);
    return url.origin === location.origin && match && isToken(match[1])
      ? match[1].toLowerCase()
      : null;
  } catch {
    return null;
  }
}
export function validateRegistration(input: RegisterInput) {
  if (input.name.trim().length < 2 || input.name.length > 100)
    throw Error("Enter a full name of 2–100 characters.");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    input.email.length > 150
  )
    throw Error("Enter a valid email address.");
  if (input.phone && !/^\+?[\d\s().-]{7,25}$/.test(input.phone))
    throw Error("Enter a valid phone number, or leave it blank.");
  if (
    input.organization.length > 150 ||
    input.jobTitle.length > 100 ||
    input.notes.length > 1000
  )
    throw Error("One of the optional fields is too long.");
  if (!isToken(input.requestId)) throw Error("Invalid registration request.");
}
export function ticketFrom(data: Data, token: string): Ticket | null {
  const a = data.attendees.find((a) => a.token === token);
  if (!a) return null;
  const c = data.categories.find((c) => c.id === a.categoryId)!;
  const e = data.event;
  return {
    event: {
      id: e.id,
      title: e.title,
      organizer: e.organizer,
      date: e.date,
      start: e.start,
      end: e.end,
      timeZone: e.timeZone,
      venue: e.venue,
      city: e.city,
      poster: e.poster,
    },
    name: a.name,
    number: a.number,
    category: c.name,
    benefits: c.benefits,
    token: a.token,
    demo: true,
    sample: a.sample,
  };
}
export function seed(): Data {
  const names = [
    "Amelia Putri",
    "Bima Pratama",
    "Clara Wijaya",
    "Dimas Saputra",
    "Elena Santoso",
    "Farhan Aziz",
    "Gita Maharani",
    "Hana Kusuma",
    "Irfan Rahman",
    "Jessica Tan",
    "Kevin Hartono",
    "Laras Wulandari",
    "Maya Saraswati",
    "Nadia Siregar",
    "Oscar Lim",
    "Putra Aditya",
    "Qiana Lestari",
    "Raka Nugroho",
    "Sofia Anindya",
    "Tara Dewi",
    "Umar Hakim",
    "Vania Anggraini",
    "Wahyu Setiawan",
    "Yasmin Aulia",
    "Zaki Mahendra",
    "Alia Nirmala",
    "Bagas Kurnia",
    "Citra Permata",
  ];
  const e = structuredClone(CONFIG.event);
  const day = new Date().toISOString().slice(0, 10);
  const attendees = names.map((name, i) => ({
    id: uuid(),
    eventId: e.id,
    token: uuid(),
    requestId: uuid(),
    number: `EVT-${day.replaceAll("-", "")}-${String(i + 1).padStart(4, "0")}`,
    categoryId: CONFIG.tickets[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0].id,
    name,
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    phone: "+628120000" + String(1000 + i),
    organization: [
      "Independent",
      "Studio Collective",
      "Creative Campus",
      "Design Lab",
    ][i % 4],
    jobTitle: ["Designer", "Creative developer", "Student", "Art director"][
      i % 4
    ],
    notes: "",
    createdAt: new Date(Date.now() - (28 - i) * 3600000).toISOString(),
    sample: true,
  }));
  const checkins = attendees
    .slice(0, 11)
    .map((a, i) => ({
      id: uuid(),
      registrationId: a.id,
      createdAt: new Date(Date.now() - (11 - i) * 210000).toISOString(),
      method: (i % 4 === 0 ? "manual" : "QR") as "QR" | "manual",
      actor: "Demo staff",
    }));
  return {
    event: e,
    categories: structuredClone(CONFIG.tickets),
    attendees,
    checkins,
    audit: [],
  };
}
export async function imageData(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("Upload a PNG, JPEG or WebP image.");
  if (file.size > 8 * 1024 * 1024) throw Error("Choose an image under 8 MB.");
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * ratio);
  canvas.height = Math.round(bmp.height * ratio);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/webp", 0.85);
}
export async function portableLink(ticket: Ticket) {
  const clean = structuredClone(ticket);
  if (clean.event.poster.length > 80000) clean.event.poster = "";
  const bytes = new TextEncoder().encode(JSON.stringify(clean));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let str = "";
  compressed.forEach((b) => (str += String.fromCharCode(b)));
  return `${location.origin}/ticket/${ticket.token}#demo=${btoa(str).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}
export async function portableTicket(token: string): Promise<Ticket | null> {
  try {
    const encoded = new URLSearchParams(location.hash.slice(1)).get("demo");
    if (!encoded || encoded.length > 150000) return null;
    const bytes = Uint8Array.from(
      atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    const raw = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).text();
    if (raw.length > 200000) return null;
    const t = JSON.parse(raw) as Ticket;
    if (
      t.token !== token ||
      !isToken(t.token) ||
      t.event.id !== CONFIG.event.id ||
      typeof t.name !== "string" ||
      typeof t.event.title !== "string" ||
      typeof t.category !== "string" ||
      !Array.isArray(t.benefits) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.event.date)
    )
      return null;
    t.demo = true;
    if (
      !/^data:image\/(webp|png|jpeg);base64,/.test(t.event.poster) &&
      !/^https:\/\//.test(t.event.poster)
    )
      t.event.poster = "";
    return t;
  } catch {
    return null;
  }
}

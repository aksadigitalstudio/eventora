import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "./config";
import {
  imageData,
  isToken,
  seed,
  ticketFrom,
  uuid,
  validateRegistration,
} from "./domain";
import type {
  Category,
  Data,
  EventInfo,
  RegisterInput,
  Repository,
  ScanResult,
} from "./types";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = Boolean(url && key);
export const incompleteConfig = Boolean(url) !== Boolean(key);
export const supabase = cloud ? createClient(url, key) : null;
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("eventora-demo-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("documents");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        Error(
          "Browser storage is unavailable. Enable site storage to use Demo Mode.",
        ),
      );
  }));
}
async function mutate<T>(action: (data: Data) => T): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite"),
      store = tx.objectStore("documents"),
      r = store.get("state");
    let value: T, failure: unknown;
    r.onsuccess = () => {
      try {
        const data: Data = r.result || seed();
        value = action(data);
        store.put(data, "state");
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () =>
      reject(failure || Error("Nothing was saved. Please try again."));
  });
}
export function validateSettings(
  event: EventInfo,
  categories: Category[],
  data?: Data,
) {
  if (
    !event.title.trim() ||
    !event.organizer.trim() ||
    !event.venue.trim() ||
    !event.city.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
    Number.isNaN(Date.parse(event.date + "T12:00:00Z")) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.start) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.end) ||
    event.start >= event.end
  )
    throw Error(
      "Complete the event identity and choose a valid one-day time range.",
    );
  if (!event.singleEntry)
    throw Error("This event requires one attendance record per ticket.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: event.timeZone });
  } catch {
    throw Error("Enter a valid IANA time zone.");
  }
  if (
    !categories.length ||
    categories.length > 20 ||
    new Set(categories.map((c) => c.id)).size !== categories.length
  )
    throw Error("Keep between 1 and 20 unique ticket categories.");
  for (const c of categories) {
    if (
      !c.name.trim() ||
      !isToken(c.id) ||
      !Number.isInteger(c.price) ||
      c.price < 0 ||
      !Number.isInteger(c.capacity) ||
      c.capacity < 0 ||
      c.capacity > 100000
    )
      throw Error(
        "Ticket names, whole-rupiah prices and capacities must be valid.",
      );
    const count =
      data?.attendees.filter((a) => a.categoryId === c.id).length || 0;
    if (c.capacity < count)
      throw Error(
        `${c.name} already has ${count} registrations. Capacity cannot be lower.`,
      );
  }
  if (
    data?.attendees.some((a) => !categories.some((c) => c.id === a.categoryId))
  )
    throw Error(
      "A category with registrations cannot be removed. Close its sales instead.",
    );
}
const demo: Repository = {
  mode: "demo",
  async load() {
    return mutate((d) => structuredClone(d));
  },
  async publicData() {
    return mutate((d) => ({
      event: structuredClone(d.event),
      categories: d.categories.map((c) => ({
        ...structuredClone(c),
        registered: d.attendees.filter((a) => a.categoryId === c.id).length,
      })),
    }));
  },
  async register(input) {
    validateRegistration(input);
    return mutate((data) => {
      const old = data.attendees.find((a) => a.requestId === input.requestId);
      if (old) return ticketFrom(data, old.token)!;
      if (!data.event.registrationOpen)
        throw Error("Registration is currently closed.");
      const c = data.categories.find((c) => c.id === input.categoryId);
      if (!c || !c.open)
        throw Error("This ticket is not open for registration.");
      if (
        data.attendees.filter((a) => a.categoryId === c.id).length >= c.capacity
      )
        throw Error("This ticket category is sold out. Choose another ticket.");
      if (
        data.attendees.some(
          (a) => a.email.toLowerCase() === input.email.trim().toLowerCase(),
        )
      )
        throw Error(
          "This email already has a registration. Use your saved ticket link or contact the organizer.",
        );
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: data.event.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .format(new Date())
        .replaceAll("-", "");
      let n = data.attendees.length + 1;
      while (
        data.attendees.some(
          (a) => a.number === `EVT-${date}-${String(n).padStart(4, "0")}`,
        )
      )
        n++;
      const a = {
        ...input,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        id: uuid(),
        eventId: data.event.id,
        token: uuid(),
        number: `EVT-${date}-${String(n).padStart(4, "0")}`,
        createdAt: new Date().toISOString(),
        sample: false,
      };
      data.attendees.push(a);
      return ticketFrom(data, a.token)!;
    });
  },
  async ticket(token) {
    return mutate((d) => ticketFrom(d, token));
  },
  async checkin(token, method, override = false, reason = "") {
    return mutate((d) => {
      const a = d.attendees.find(
        (a) => a.token === token && a.eventId === d.event.id,
      );
      if (!a)
        return {
          status: "invalid",
          message: "No valid ticket for this event was found.",
        };
      const c = d.categories.find((c) => c.id === a.categoryId)!;
      const old = d.checkins.find((ch) => ch.registrationId === a.id);
      if (old) {
        if (override) {
          if (
            method !== "manual" ||
            !d.event.allowOverride ||
            reason.trim().length < 5
          )
            throw Error(
              "An override requires explicit confirmation and a reason of at least 5 characters.",
            );
          d.audit.push({
            id: uuid(),
            registrationId: a.id,
            createdAt: new Date().toISOString(),
            action: "manual_override",
            actor: "Demo staff",
            reason: reason.trim(),
          });
          return {
            status: "override",
            message:
              "Entry reconfirmed. Original attendance time is preserved.",
            attendee: a,
            category: c,
            checkin: old,
          };
        }
        return {
          status: "duplicate",
          message:
            "This ticket has already been used. No additional attendance was recorded.",
          attendee: a,
          category: c,
          checkin: old,
        };
      }
      const ch = {
        id: uuid(),
        registrationId: a.id,
        createdAt: new Date().toISOString(),
        method,
        actor: "Demo staff",
      };
      d.checkins.push(ch);
      d.audit.push({
        id: uuid(),
        registrationId: a.id,
        createdAt: ch.createdAt,
        action: "checkin_" + method,
        actor: ch.actor,
        reason:
          method === "manual" ? "Attendee identity confirmed by staff" : "",
      });
      return {
        status: "success",
        message: "Ticket validated. Welcome to the event.",
        attendee: a,
        category: c,
        checkin: ch,
      };
    });
  },
  async saveEvent(event, categories) {
    return mutate((d) => {
      validateSettings(event, categories, d);
      d.event = structuredClone(event);
      d.categories = structuredClone(categories);
    });
  },
  upload: imageData,
};
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw Error("Cloud mode is unavailable.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Error(error.message);
  return data as T;
}
const backend: Repository = {
  mode: "cloud",
  publicData: () => rpc("get_event_public", { p_event: CONFIG.event.id }),
  load: () => rpc("get_event_admin", { p_event: CONFIG.event.id }),
  async register(input) {
    validateRegistration(input);
    return rpc("register_attendee", {
      p_event: CONFIG.event.id,
      p_input: input,
    });
  },
  ticket: (token) => rpc("get_public_ticket", { p_token: token }),
  checkin: (token, method, override = false, reason = "") =>
    rpc<ScanResult>("check_in_ticket", {
      p_event: CONFIG.event.id,
      p_token: token,
      p_method: method,
      p_override: override,
      p_reason: reason,
    }),
  async saveEvent(event, categories) {
    validateSettings(event, categories);
    await rpc("save_event_settings", {
      p_event: CONFIG.event.id,
      p_data: event,
      p_categories: categories,
    });
  },
  async upload(file) {
    const data = await imageData(file),
      blob = await (await fetch(data)).blob(),
      path = `${CONFIG.event.id}/${uuid()}.webp`;
    const { error } = await supabase!.storage
      .from("event-posters")
      .upload(path, blob, { contentType: "image/webp", upsert: false });
    if (error) throw Error(error.message);
    return supabase!.storage.from("event-posters").getPublicUrl(path).data
      .publicUrl;
  },
};
export const repo = cloud ? backend : demo;
export async function initializeCloud() {
  return rpc("initialize_event", {
    p_data: CONFIG.event,
    p_categories: CONFIG.tickets,
  });
}

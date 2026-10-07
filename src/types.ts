export type Category = {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  open: boolean;
  benefits: string[];
};
export type EventInfo = {
  id: string;
  title: string;
  organizer: string;
  type: string;
  date: string;
  start: string;
  end: string;
  timeZone: string;
  venue: string;
  city: string;
  address: string;
  description: string;
  poster: string;
  registrationOpen: boolean;
  singleEntry: boolean;
  allowOverride: boolean;
};
export type Attendee = {
  id: string;
  eventId: string;
  token: string;
  number: string;
  requestId: string;
  categoryId: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  jobTitle: string;
  notes: string;
  createdAt: string;
  sample: boolean;
};
export type Checkin = {
  id: string;
  registrationId: string;
  createdAt: string;
  method: "QR" | "manual";
  actor: string;
};
export type Audit = {
  id: string;
  registrationId: string;
  createdAt: string;
  action: string;
  actor: string;
  reason: string;
};
export type Data = {
  event: EventInfo;
  categories: Category[];
  attendees: Attendee[];
  checkins: Checkin[];
  audit: Audit[];
};
export type Ticket = {
  event: Pick<
    EventInfo,
    | "id"
    | "title"
    | "organizer"
    | "date"
    | "start"
    | "end"
    | "timeZone"
    | "venue"
    | "city"
    | "poster"
  >;
  name: string;
  category: string;
  benefits: string[];
  number: string;
  token: string;
  demo: boolean;
  sample: boolean;
};
export type RegisterInput = {
  requestId: string;
  categoryId: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  jobTitle: string;
  notes: string;
};
export type ScanResult = {
  status: "success" | "duplicate" | "invalid" | "override";
  message: string;
  attendee?: Attendee;
  category?: Category;
  checkin?: Checkin;
};
export type PublicData = {
  event: EventInfo;
  categories: (Category & { registered: number })[];
};
export interface Repository {
  mode: "demo" | "cloud";
  publicData(): Promise<PublicData>;
  load(): Promise<Data>;
  register(input: RegisterInput): Promise<Ticket>;
  ticket(token: string): Promise<Ticket | null>;
  checkin(
    token: string,
    method: "QR" | "manual",
    override?: boolean,
    reason?: string,
  ): Promise<ScanResult>;
  saveEvent(event: EventInfo, categories: Category[]): Promise<void>;
  upload(file: File): Promise<string>;
}

// Shared fictional data and helpers for the Pulse concept (webtheory.co).
// Every clinic, person, price and appointment here is invented. Nothing is fetched and
// nothing leaves the browser: the "diary" below is generated from a seed, so the booking
// flow and the clinic view always agree on who is busy when.

export const TREATMENTS = [
  { id: "assessment", short: "Assessment", name: "Physiotherapy assessment", mins: 45, price: 1800, blurb: "A first visit. We listen, assess, and agree a plan with you." },
  { id: "follow-up", short: "Follow-up", name: "Physiotherapy follow-up", mins: 30, price: 1200, blurb: "Carry on with a plan you've already started here." },
  { id: "massage", short: "Sports massage", name: "Sports massage", mins: 60, price: 2200, blurb: "Slow, deep work for tight or overworked muscles." },
  { id: "acupuncture", short: "Acupuncture", name: "Acupuncture", mins: 45, price: 1600, blurb: "Fine needles for pain and tension, at an unhurried pace." },
  { id: "pilates", short: "Rehab Pilates", name: "Rehab Pilates, one to one", mins: 50, price: 1500, blurb: "Guided movement to rebuild strength after an injury." },
];

export const PRACTITIONERS = [
  { id: "asha", name: "Asha", role: "Physiotherapist", days: [1, 2, 3, 4, 5], treats: ["assessment", "follow-up", "acupuncture", "pilates"], tone: ["#f3d6bf", "#c08f70"] },
  { id: "kabir", name: "Kabir", role: "Sports physiotherapist", days: [2, 3, 4, 5, 6], treats: ["assessment", "follow-up", "massage", "pilates"], tone: ["#dfe1f2", "#8a90c9"] },
  { id: "meera", name: "Meera", role: "Massage and acupuncture", days: [1, 3, 5, 6], treats: ["massage", "acupuncture"], tone: ["#e3eadb", "#8fa386"] },
];

const PATIENTS = ["Rohan S.", "Priya M.", "Dev K.", "Nisha A.", "Farah Q.", "Arjun T.", "Leela P.", "Sameer V.", "Tara J.", "Imran H.", "Kavya R.", "Neil D.", "Zoya B.", "Vikram L.", "Ira N.", "Maya G."];

// Opening hours in minutes after midnight: 9–1, lunch, 2–6. Closed Sundays.
export const BLOCKS = [[540, 780], [840, 1080]];
export const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
export const HOLD_MS = 10 * 60 * 1000;

export const byId = (list, id) => list.find((x) => x.id === id);
export const offering = (tid) => PRACTITIONERS.filter((p) => p.treats.includes(tid));
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ── dates ─────────────────────────────────────────────────────────────── */

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export function nextDays(n = 7) {
  const t = new Date();
  return Array.from({ length: n }, (_, i) => isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i)));
}
export const fmtDay = (iso, short) => parseIso(iso).toLocaleDateString("en-GB", short ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "long", day: "numeric", month: "long" });
export function relDay(iso, short = true) {
  const i = nextDays(2).indexOf(iso);
  return i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtDay(iso, short);
}
export function fmtTime(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
export const fmtClock = (ms) => { const d = new Date(ms); return fmtTime(d.getHours() * 60 + d.getMinutes()); };
export const fmtPrice = (n) => "₹" + n.toLocaleString("en-IN");

/* ── local storage (this browser only) ─────────────────────────────────── */

function read(kind, key) { try { return JSON.parse(window[kind].getItem(key)); } catch { return null; } }
function write(kind, key, v) {
  try { v == null ? window[kind].removeItem(key) : window[kind].setItem(key, JSON.stringify(v)); }
  catch { /* storage blocked: the flow still works for this page view */ }
}
// The booking in progress lives for this tab; a confirmed concept booking is kept so the
// clinic view can show it. Neither is ever sent anywhere.
export const draft = { get: () => read("sessionStorage", "pulse-draft") ?? {}, set: (v) => write("sessionStorage", "pulse-draft", v) };
export const confirmed = { get: () => read("localStorage", "pulse-booking"), set: (v) => write("localStorage", "pulse-booking", v) };

/* ── the fictional diary ───────────────────────────────────────────────── */

function seeded(str) { // FNV-1a hash into mulberry32: same string, same sequence
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One practitioner's appointments on one day, or null if they aren't in. Includes the
// visitor's own concept booking unless its id is `ignoreId` (they are changing it).
export function diary(pid, iso, ignoreId) {
  const p = byId(PRACTITIONERS, pid);
  if (!p.days.includes(parseIso(iso).getDay())) return null;
  const rand = seeded(iso + pid), out = [];
  for (const [from, to] of BLOCKS) {
    for (let t = from; t < to; ) {
      const tr = byId(TREATMENTS, p.treats[Math.floor(rand() * p.treats.length)]);
      if (rand() < 0.42 && t + tr.mins <= to) {
        out.push({ start: t, mins: tr.mins, tid: tr.id, patient: PATIENTS[Math.floor(rand() * PATIENTS.length)] });
        t += Math.ceil(tr.mins / 15) * 15;
      } else t += 15 * (1 + Math.floor(rand() * 3));
    }
  }
  const own = confirmed.get();
  if (own && own.pid === pid && own.date === iso && own.id !== ignoreId) {
    out.push({ start: own.start, mins: own.mins, tid: own.tid, patient: own.name, phone: own.phone, note: own.note, own: true });
  }
  return out.sort((a, b) => a.start - b.start);
}

// Start times for a treatment on a day. Each has `pid` (who would see you) or null if taken.
// Returns null when nobody who offers it is in; [] when today's times have all passed.
export function slotsFor(tid, pid, iso, ignoreId) {
  const tr = byId(TREATMENTS, tid);
  const who = pid === "any" ? offering(tid) : [byId(PRACTITIONERS, pid)];
  const diaries = who.map((p) => [p.id, diary(p.id, iso, ignoreId)]).filter(([, d]) => d);
  if (!diaries.length) return null;
  const step = tr.mins <= 30 ? 30 : tr.mins <= 45 ? 45 : 60;
  const now = new Date();
  const earliest = iso === isoDate(now) ? now.getHours() * 60 + now.getMinutes() + 60 : 0; // same day: an hour's notice
  const out = [];
  for (const [from, to] of BLOCKS) {
    for (let t = from; t + tr.mins <= to; t += step) {
      if (t < earliest) continue;
      const free = diaries.find(([, d]) => d.every((x) => t + tr.mins <= x.start || t >= x.start + x.mins));
      out.push({ start: t, pid: free ? free[0] : null });
    }
  }
  return out;
}

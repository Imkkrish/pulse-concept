// The Pulse booking flow: treatment → practitioner → time → details → confirmation.
// One page, one step at a time. Each step has its own #hash and history entry, so the
// browser's back button and the in-page Back both work, and choices are kept on the way back.
import {
  TREATMENTS, PRACTITIONERS, DAY_NAMES, HOLD_MS, byId, offering, esc, nextDays, parseIso,
  fmtDay, relDay, fmtTime, fmtClock, fmtPrice, draft, confirmed, slotsFor,
} from "./pulse.js";

const STEPS = ["treatment", "practitioner", "time", "details", "done"];
const LABELS = ["Treatment", "Practitioner", "Time", "Details"];
const TITLES = ["Choose a treatment", "Choose a practitioner", "Choose a time", "Your details", "All set"];
const main = document.querySelector(".book");
const view = document.getElementById("step");
const aside = document.getElementById("aside");
const backEl = document.getElementById("back");
const progress = document.getElementById("progress");
const live = document.getElementById("announce");
const days = nextDays(7);
const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="assets/icons.svg#${id}"/></svg>`;
const dayLong = (iso) => { const r = relDay(iso); return r === "Today" || r === "Tomorrow" ? `${r}, ${fmtDay(iso)}` : fmtDay(iso); };
const isFree = (x) => x.slots?.some((y) => y.pid);

let s = draft.get();
s.details ??= {};
let current = "treatment";
const save = () => draft.set(s);
const say = (msg) => { live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 60); };

/* ── state changes ─────────────────────────────────────────────────────── */

// After a change, keep the chosen day only if it still has a free time.
function keepDate() {
  if (s.date && !(s.pid && slotsFor(s.tid, s.pid, s.date, s.id)?.some((x) => x.pid))) s.date = null;
}
function setTreatment(tid) {
  if (s.tid !== tid) {
    s.tid = tid;
    if (s.pid && s.pid !== "any" && !byId(PRACTITIONERS, s.pid).treats.includes(tid)) s.pid = null;
    s.slot = null;
    s.done = false;
    keepDate();
  }
  s.startedAt ??= Date.now();
  save();
}
function setPractitioner(pid) {
  if (s.pid !== pid) { s.pid = pid; s.slot = null; s.done = false; keepDate(); }
  save();
}
function hold(start, pid) {
  s.slot = { date: s.date, start, pid };
  s.heldUntil = Date.now() + HOLD_MS;
  s.done = false;
  save();
}

/* ── routing ───────────────────────────────────────────────────────────── */

const ready = {
  treatment: () => true,
  practitioner: () => !!s.tid,
  time: () => !!(s.tid && s.pid),
  details: () => !!(s.tid && s.pid && s.slot),
  done: () => !!(s.done && s.slot),
};
function stepFromUrl() {
  const want = STEPS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "treatment";
  let i = STEPS.indexOf(want);
  while (!ready[STEPS[i]]()) i--; // deep link or stale history entry: fall back to the furthest step we can show
  if (STEPS[i] !== want) history.replaceState(null, "", "#" + STEPS[i]);
  return STEPS[i];
}
function go(step) {
  history.pushState({ from: current }, "", "#" + step);
  render(true);
}
function back() {
  const prev = STEPS[STEPS.indexOf(current) - 1];
  if (history.state?.from === prev) history.back(); // same as the browser's back: popstate renders
  else { history.replaceState(null, "", "#" + prev); render(true); }
}

function render(moveFocus, refocus) {
  current = stepFromUrl();
  const i = STEPS.indexOf(current);
  if (s.slot && s.heldUntil < Date.now()) { s.heldUntil = Date.now() + HOLD_MS; save(); } // quietly renew an old hold
  main.dataset.step = current;
  [...progress.children].forEach((li, k) => {
    li.className = k < i ? "is-done" : "";
    if (k === i) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    li.innerHTML = LABELS[k] + (k < i ? '<span class="sr-only"> (done)</span>' : "");
  });
  backEl.hidden = current === "done";
  backEl.href = i ? "#" + STEPS[i - 1] : "index.html";
  backEl.setAttribute("aria-label", i ? `Back to ${LABELS[i - 1].toLowerCase()}` : "Back to the clinic home page");
  view.innerHTML = STEP[current]();
  aside.innerHTML = current === "done" ? "" : summary();
  document.title = `${TITLES[i]} · Book · Pulse (a concept by webtheory.co)`;
  if (moveFocus) {
    view.classList.remove("enter");
    void view.offsetWidth; // restart the entrance fade
    view.classList.add("enter");
    if (main.getBoundingClientRect().top < 0) main.scrollIntoView();
    document.getElementById("step-title").focus({ preventScroll: true });
  } else if (refocus) {
    view.querySelector(refocus)?.focus();
  }
}

/* ── pieces ────────────────────────────────────────────────────────────── */

const head = (title, sub) => `<div class="step-head"><h2 id="step-title" tabindex="-1">${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>`;

function summary() {
  const tr = byId(TREATMENTS, s.tid), sl = s.slot;
  const who = sl ? byId(PRACTITIONERS, sl.pid) : s.pid && s.pid !== "any" ? byId(PRACTITIONERS, s.pid) : null;
  const row = (label, value, step) => `<div><dt>${label}</dt><dd>${value || '<span class="pending">Not chosen yet</span>'}</dd>${
    value && current !== step ? `<button type="button" class="change" data-go="${step}">Change<span class="sr-only"> ${step}</span></button>` : ""}</div>`;
  const withWho = s.pid && (who
    ? `${who.name}<small>${s.pid === "any" ? "First available" : who.role}</small>`
    : "First available<small>Whoever is free soonest</small>");
  return `<h2>Your visit</h2><dl>
    ${row("Treatment", tr && `${tr.name}<small>${tr.mins} min · ${fmtPrice(tr.price)}</small>`, "treatment")}
    ${row("With", withWho, "practitioner")}
    ${row("When", sl && `${fmtDay(sl.date)}<small>${fmtTime(sl.start)} to ${fmtTime(sl.start + tr.mins)}</small>`, "time")}
  </dl>
  ${sl ? `<p class="summary-held">${icon("hold")}Held for you until ${fmtClock(s.heldUntil)}</p>` : ""}
  <p class="summary-note">You pay at the clinic, after your visit.</p>`;
}

function soonest(tid, pid) {
  for (const d of days) {
    const x = slotsFor(tid, pid, d, s.id)?.find((y) => y.pid);
    if (x) return { d, ...x };
  }
}

function slotButton(x) {
  if (!x.pid) return `<span class="slot is-taken">${fmtTime(x.start)}<span class="sr-only">, taken</span></span>`;
  const held = s.slot?.date === s.date && s.slot.start === x.start;
  return `<button type="button" class="slot" data-start="${x.start}" data-pid="${x.pid}" aria-pressed="${held}">${
    held ? icon("hold") : ""}${fmtTime(x.start)}${held ? '<span class="sr-only">, held for you</span>' : ""}</button>`;
}

function emptyDay({ d, slots }, list) {
  const p = s.pid === "any" ? null : byId(PRACTITIONERS, s.pid);
  const dow = parseIso(d).getDay();
  const workdays = p && p.days.map((n) => DAY_NAMES[n]).join(", ").replace(/, ([^,]*)$/, " and $1");
  const [title, text] = dow === 0 ? ["The clinic is closed on Sundays.", "We're open Monday to Saturday, 9 am to 6 pm."]
    : !slots ? [`${p.name} isn't in on ${DAY_NAMES[dow]}.`, `${p.name} works ${workdays}.`]
    : !slots.length ? ["No more times today.", "Same-day bookings need an hour's notice."]
    : ["Fully booked on this day.", p ? `Every time with ${p.name} is taken.` : "Every time is taken."];
  const next = list.find((x) => x.d > d && isFree(x)) ?? list.find(isFree);
  const nextName = next && relDay(next.d);
  const actions = [
    next && `<button type="button" class="btn btn-dark" data-day="${next.d}">Show ${/^To/.test(nextName) ? nextName.toLowerCase() : nextName}</button>`,
    p && `<button type="button" class="btn btn-ghost" data-practitioner="any">See who's free first</button>`,
  ].filter(Boolean).join("");
  return `<div class="empty"><span class="icon-chip empty-chip">${icon("calendar")}</span>
    <p class="empty-title">${title}</p><p>${next ? text : `${text} Nothing else is free this week${p ? ` with ${p.name}` : ""}.`}</p>
    ${actions ? `<div class="empty-actions">${actions}</div>` : ""}</div>`;
}

// The held time, kept in view: sticky under the times (with Continue), and on top of the
// details form on phones (with Change).
function holdCard(onDetails) {
  if (!s.slot) return "";
  const tr = byId(TREATMENTS, s.tid), p = byId(PRACTITIONERS, s.slot.pid);
  return `<div class="hold${onDetails ? " is-static inline-summary" : ""}">
    <p class="hold-label">${icon("hold")}Held until ${fmtClock(s.heldUntil)}</p>
    <p class="hold-when">${relDay(s.slot.date)}, ${fmtTime(s.slot.start)}<span>${tr.short} with ${p.name}</span></p>
    ${onDetails
      ? '<button type="button" class="change" data-go="time">Change<span class="sr-only"> time</span></button>'
      : '<button type="button" class="btn btn-dark" data-go="details">Continue</button>'}
  </div>`;
}

const field = (name, label, type, attrs, hint = "") => `<div class="field">
  <label for="f-${name}">${label}</label>${hint && `<p class="hint" id="f-${name}-hint">${hint}</p>`}
  <input id="f-${name}" name="${name}" type="${type}" ${attrs} required aria-describedby="${hint && `f-${name}-hint `}f-${name}-err" value="${esc(s.details[name] ?? "")}">
  <p class="error" id="f-${name}-err"></p></div>`;

/* ── steps ─────────────────────────────────────────────────────────────── */

const STEP = {
  treatment: () => head("What would you like to book?", "Each one shows its length and price. You pay at the clinic, after your visit.") +
    `<ul class="options">${TREATMENTS.map((t) => `<li><button type="button" class="option" data-treatment="${t.id}" aria-pressed="${s.tid === t.id}">
      <span class="icon-chip">${icon(t.id)}</span>
      <span class="option-main"><span class="option-name">${t.name}</span><span class="option-desc">${t.blurb}</span></span>
      <span class="option-meta">${fmtPrice(t.price)}<span>${t.mins} min</span></span>${icon("next", "icon chev")}
    </button></li>`).join("")}</ul>`,

  practitioner() {
    const tr = byId(TREATMENTS, s.tid), offer = offering(tr.id);
    const others = PRACTITIONERS.filter((p) => !offer.includes(p));
    const opt = (pid, avatar, name, sub) => {
      const n = soonest(tr.id, pid);
      const next = n ? `Next free: ${relDay(n.d)}, ${fmtTime(n.start)}${pid === "any" ? ` with ${byId(PRACTITIONERS, n.pid).name}` : ""}` : "Fully booked this week";
      return `<li><button type="button" class="option" data-practitioner="${pid}" aria-pressed="${s.pid === pid}">${avatar}
        <span class="option-main"><span class="option-name">${name}</span><span class="option-desc">${sub}</span>
        <span class="option-next${n ? "" : " is-none"}">${next}</span></span>${icon("next", "icon chev")}</button></li>`;
    };
    return head("Who would you like to see?", `${tr.name}, ${tr.mins} min.`) +
      `<ul class="options">${opt("any", `<span class="avatar avatar-any">${icon("any")}</span>`, "First available", "Whoever is free soonest")}${
        offer.map((p) => opt(p.id, `<span class="avatar" style="--a:${p.tone[0]};--b:${p.tone[1]}"></span>`, p.name, p.role)).join("")}</ul>` +
      (others.length ? `<p class="not-offered">${others.map((p) => p.name).join(" and ")} ${others.length > 1 ? "don't" : "doesn't"} offer this treatment.</p>` : "");
  },

  time() {
    const tr = byId(TREATMENTS, s.tid), p = s.pid === "any" ? null : byId(PRACTITIONERS, s.pid);
    const list = days.map((d) => ({ d, slots: slotsFor(tr.id, s.pid, d, s.id) }));
    if (!days.includes(s.date)) { s.date = (list.find(isFree) ?? list[0]).d; save(); } // default: first day with a free time
    const cur = list.find((x) => x.d === s.date);
    const months = [...new Set(days.map((d) => parseIso(d).toLocaleDateString("en-GB", { month: "long" })))].join(" – ") + " " + parseIso(days[6]).getFullYear();
    const dayButton = ({ d, slots }) => {
      const n = slots?.filter((y) => y.pid).length ?? 0, dt = parseIso(d);
      return `<button type="button" class="day${n ? "" : " is-empty"}" data-day="${d}" aria-pressed="${d === s.date}" aria-label="${dayLong(d)}, ${n ? `${n} free` : "nothing free"}">
        <span class="day-name">${dt.toLocaleDateString("en-GB", { weekday: "short" })}</span><span class="day-num">${dt.getDate()}</span><span class="day-mark"></span></button>`;
    };
    const rel = relDay(s.date);
    const groups = [["Morning", cur.slots?.filter((x) => x.start < 780) ?? []], ["Afternoon", cur.slots?.filter((x) => x.start >= 780) ?? []]]
      .filter(([, g]) => g.length)
      .map(([name, g]) => `<div class="slot-group" role="group" aria-labelledby="g-${name}"><h4 id="g-${name}">${name}</h4><div class="slots">${g.map(slotButton).join("")}</div></div>`)
      .join("");
    return head("When suits you?", `${tr.name}, ${tr.mins} min, ${p ? `with ${p.name}` : "with whoever is free first"}.`) +
      `<p class="month" id="month">${months}</p>
      <div class="days" role="group" aria-labelledby="month">${list.map(dayButton).join("")}</div>
      <h3 class="dayhead">${rel === "Today" || rel === "Tomorrow" ? `${rel} <span>· ${fmtDay(s.date)}</span>` : fmtDay(s.date)}</h3>` +
      (isFree(cur) ? `<p class="hint">Tap a time to hold it for 10 minutes while you add your details.</p>${groups}` : emptyDay(cur, list)) +
      holdCard();
  },

  details: () => head("Last, your details.", "We only ask for what the clinic needs to see you.") + holdCard(true) + `
    <form class="form" id="details-form" novalidate>
      ${field("name", "Full name", "text", 'autocomplete="name" autocapitalize="words"')}
      ${field("phone", "Mobile number", "tel", 'autocomplete="tel" inputmode="tel"', "For a reminder the day before.")}
      ${field("email", "Email", "email", 'autocomplete="email" autocapitalize="off" spellcheck="false"', "For your confirmation.")}
      <div class="field">
        <label for="f-note">Anything we should know? <span class="optional">(optional)</span></label>
        <p class="hint" id="f-note-hint">An injury, access needs, or a preference.</p>
        <textarea id="f-note" name="note" rows="3" aria-describedby="f-note-hint">${esc(s.details.note ?? "")}</textarea>
      </div>
      <button type="submit" class="btn btn-dark btn-block">Confirm booking</button>
      <p class="fineprint">This is a concept: confirming books nothing and sends nothing. Your details stay in this browser.</p>
    </form>`,

  done() {
    const tr = byId(TREATMENTS, s.tid), p = byId(PRACTITIONERS, s.slot.pid), d = s.details;
    const secs = Math.max(1, Math.round((s.took ?? 0) / 1000));
    const took = secs < 60 ? `${secs} seconds` : `${Math.floor(secs / 60)} min ${secs % 60} s`;
    const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
    return `<svg class="done-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="#4b53a8" stroke-width="7"/><path d="M21.5 33 28.5 40 43 25.5" fill="none" stroke="#1f2233" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
      head(`All set, ${esc(d.name.trim().split(/\s+/)[0])}.`) +
      `<p class="concept-note"><strong>This is a concept: nothing was booked and no data was sent.</strong>Your details never left this browser. In a real clinic, this screen would be your confirmation.</p>
      <dl class="receipt">
        ${row("Treatment", `${tr.name}<small>${tr.mins} min</small>`)}
        ${row("With", `${p.name}<small>${p.role}${s.pid === "any" ? ", first available" : ""}</small>`)}
        ${row("When", `${fmtDay(s.slot.date)}<small>${fmtTime(s.slot.start)} to ${fmtTime(s.slot.start + tr.mins)}</small>`)}
        ${row("Where", "Pulse clinic<small>Fictional, like everything here</small>")}
        ${row("Price", `${fmtPrice(tr.price)}<small>Paid at the clinic, after your visit</small>`)}
        ${row("Your details", `${esc(d.name.trim())}<small>${esc(d.phone.trim())}<br>${esc(d.email.trim())}</small>`)}
        ${d.note?.trim() ? row("Your note", `<span class="note">${esc(d.note.trim())}</span>`) : ""}
      </dl>
      <div class="actions">
        <button type="button" class="btn btn-dark" id="ics">${icon("calendar")}Add to calendar</button>
        <a class="btn btn-ghost" href="clinic.html">See it in the clinic view</a>
      </div>
      <p class="took">From your first tap to here: <strong>${took}</strong>.</p>
      <p class="after"><button type="button" class="linkbtn" id="again">Book another appointment</button><button type="button" class="linkbtn" id="forget">Forget this booking</button></p>`;
  },
};

/* ── details form ──────────────────────────────────────────────────────── */

const CHECKS = {
  name: [(v) => v.length > 1, "Enter your name.", "Enter your full name."],
  phone: [(v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s()-]/g, "")), "Enter your mobile number.", "Enter a 10-digit mobile number, like 98765 43210."],
  email: [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter your email address.", "Enter an email address like name@example.com."],
};
function check(input) {
  const [ok, empty, wrong] = CHECKS[input.name], v = input.value.trim();
  const msg = !v ? empty : ok(v) ? "" : wrong;
  input.setAttribute("aria-invalid", String(!!msg));
  document.getElementById(`${input.id}-err`).innerHTML = msg && icon("alert") + msg;
  return msg;
}

/* ── calendar file (made here, never uploaded) ─────────────────────────── */

function downloadIcs() {
  const tr = byId(TREATMENTS, s.tid), p = byId(PRACTITIONERS, s.slot.pid);
  const start = parseIso(s.slot.date);
  start.setMinutes(s.slot.start);
  const end = new Date(start.getTime() + tr.mins * 60000);
  const utc = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const text = (v) => v.replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//webtheory.co//Pulse concept//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${s.id}@pulse-concept.webtheory.co`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${text(`${tr.name} with ${p.name} (Pulse concept)`)}`,
    `LOCATION:${text("Pulse clinic (fictional - not a real place)")}`,
    `DESCRIPTION:${text("A concept booking made on the Pulse demo by webtheory.co. Nothing was booked and no data was sent. Case study: https://webtheory-co.web.app/work/pulse")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].map((line) => line.match(/.{1,73}/g).join("\r\n ")).join("\r\n") + "\r\n"; // fold long lines (RFC 5545)
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "pulse-appointment.ics" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  say("Calendar file pulse-appointment.ics created. Open it to add the appointment to your calendar.");
}

/* ── events ────────────────────────────────────────────────────────────── */

backEl.addEventListener("click", (e) => {
  if (current === "treatment") return; // a plain link home
  e.preventDefault();
  back();
});

main.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const { treatment, practitioner, day, start, go: to } = b.dataset;
  if (treatment) { setTreatment(treatment); go("practitioner"); }
  else if (practitioner) {
    setPractitioner(practitioner);
    if (current === "practitioner") go("time");
    else { render(false, `.day[data-day="${s.date}"]`); say("Showing whoever is free first."); }
  } else if (day) {
    s.date = day;
    save();
    render(false, `.day[data-day="${day}"]`);
    const n = slotsFor(s.tid, s.pid, day, s.id)?.filter((x) => x.pid).length ?? 0;
    say(`${dayLong(day)}: ${n ? `${n} ${n > 1 ? "times" : "time"} free.` : "nothing free."}`);
  } else if (start) {
    hold(+start, b.dataset.pid);
    render(false, `.slot[data-start="${start}"]`);
    say(`${fmtTime(+start)}, ${dayLong(s.date)}, is held for you until ${fmtClock(s.heldUntil)}. Continue when you're ready.`);
  } else if (to) go(to);
  else if (b.id === "ics") downloadIcs();
  else if (b.id === "again") { s = { details: s.details }; save(); go("treatment"); }
  else if (b.id === "forget") {
    confirmed.set(null);
    draft.set(null);
    s = { details: {} };
    go("treatment");
    say("Booking forgotten. Nothing from this concept is stored in your browser now.");
  }
});

main.addEventListener("input", (e) => {
  const f = e.target;
  if (!f.form) return;
  s.details[f.name] = f.value;
  s.done = false;
  save();
  if (f.getAttribute("aria-invalid") === "true") check(f); // clear the error as soon as it's fixed
});

main.addEventListener("focusout", (e) => {
  const f = e.target;
  if (!CHECKS[f.name] || !f.value.trim()) return; // don't nag about fields you're just tabbing past
  const was = f.getAttribute("aria-invalid") === "true";
  const msg = check(f);
  if (msg && !was) say(msg);
});

main.addEventListener("submit", (e) => {
  e.preventDefault();
  const bad = [...e.target.querySelectorAll("input")].map((f) => [f, check(f)]).filter(([, m]) => m);
  if (bad.length) {
    bad[0][0].focus();
    say(`${bad.length === 1 ? "One thing needs" : `${bad.length} things need`} fixing. ${bad.map(([, m]) => m).join(" ")}`);
    return;
  }
  const tr = byId(TREATMENTS, s.tid), d = s.details;
  s.id ??= Date.now().toString(36);
  s.took ??= Date.now() - (s.startedAt ?? Date.now());
  s.done = true;
  confirmed.set({
    id: s.id, tid: s.tid, pid: s.slot.pid, date: s.slot.date, start: s.slot.start, mins: tr.mins,
    name: d.name.trim(), phone: d.phone.trim(), note: (d.note ?? "").trim(),
  });
  save();
  go("done");
});

addEventListener("popstate", () => render(true));

/* ── start ─────────────────────────────────────────────────────────────── */

// A booking left in this tab from another day, or a time that has since passed, is let go.
if (s.date && !days.includes(s.date)) s.date = null;
if (s.slot && (!days.includes(s.slot.date) || !(slotsFor(s.tid, s.pid, s.slot.date, s.id) ?? []).some((x) => x.start === s.slot.start && x.pid))) {
  s.slot = null;
  s.done = false;
}
// Deep link from the home page, e.g. book.html?t=massage: the treatment is already chosen.
const pre = new URLSearchParams(location.search).get("t");
if (byId(TREATMENTS, pre)) {
  setTreatment(pre);
  history.replaceState(null, "", "book.html#practitioner");
}
render(false);

// Clinic view: the front desk's read-only day, drawn from the same fictional diary as the
// booking flow, with the visitor's own concept booking (if any) highlighted.
import { PRACTITIONERS, TREATMENTS, DAY_NAMES, byId, diary, nextDays, parseIso, fmtDay, relDay, fmtTime, confirmed, esc } from "./pulse.js";

const days = nextDays(7);
const own = confirmed.get();
const mine = own && days.includes(own.date) ? own : null;
let day = mine ? mine.date : days.find((d) => parseIso(d).getDay() !== 0);

const strip = document.getElementById("days");
const board = document.getElementById("board");
const title = document.getElementById("day-title");
const news = document.getElementById("new");
const live = document.getElementById("announce");
const dayLong = (iso) => { const r = relDay(iso); return r === "Today" || r === "Tomorrow" ? `${r}, ${fmtDay(iso)}` : fmtDay(iso); };
const avatar = (p) => `<span class="avatar" style="--a:${p.tone[0]};--b:${p.tone[1]}"></span>`;

if (mine) {
  const tr = byId(TREATMENTS, mine.tid), p = byId(PRACTITIONERS, mine.pid);
  news.className = "newbook";
  news.innerHTML = `<p class="newbook-label"><span class="dot"></span>New · booked online</p>
    <h2 id="new-title">${esc(mine.name)} · ${tr.name}</h2>
    <p>With ${p.name}, ${dayLong(mine.date)}, ${fmtTime(mine.start)} to ${fmtTime(mine.start + mine.mins)}</p>
    <p>Mobile ${esc(mine.phone)}${mine.note ? ` · Note: “${esc(mine.note)}”` : ""}</p>`;
}

function appt(a) {
  return `<li class="appt${a.own ? " is-new" : ""}" style="--s:${a.start - 540};--d:${a.mins}">
    <time>${fmtTime(a.start)}</time>
    <div class="appt-body"><span class="appt-what">${byId(TREATMENTS, a.tid).short}</span><span class="appt-who">${esc(a.patient)}${a.own ? '<span class="appt-tag">New</span>' : ""}</span>${
      a.own && a.note ? `<span class="appt-note">“${esc(a.note)}”</span>` : ""}</div></li>`;
}

function render() {
  strip.innerHTML = days.map((d) => {
    const dt = parseIso(d), isMine = mine?.date === d;
    return `<button type="button" class="day${dt.getDay() === 0 ? " is-empty" : ""}" data-day="${d}" aria-pressed="${d === day}" aria-label="${dayLong(d)}${dt.getDay() === 0 ? ", closed" : ""}${isMine ? ", has the new booking" : ""}">
      <span class="day-name">${dt.toLocaleDateString("en-GB", { weekday: "short" })}</span><span class="day-num">${dt.getDate()}</span><span class="day-mark"${isMine ? ' style="background:var(--accent)"' : ""}></span></button>`;
  }).join("");
  title.textContent = dayLong(day);
  const dow = parseIso(day).getDay();
  if (dow === 0) {
    board.innerHTML = `<p class="empty">The clinic is closed on Sundays.</p>`;
    return;
  }
  board.innerHTML = `<div class="hours" aria-hidden="true">${[9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
    .map((h) => `<span style="--m:${(h - 9) * 60}">${h % 12 || 12} ${h < 12 ? "am" : "pm"}</span>`).join("")}</div>` +
    PRACTITIONERS.map((p) => {
      const list = diary(p.id, day);
      const body = list
        ? `<ol class="appts">${list.filter((a) => a.start < 780).map(appt).join("")}<li class="lunch" style="--s:240;--d:60">Lunch, 1 to 2 pm</li>${
            list.filter((a) => a.start >= 840).map(appt).join("")}</ol>`
        : `<p class="off">Not in on ${DAY_NAMES[dow]}.</p>`;
      return `<section class="col" aria-labelledby="c-${p.id}"><div class="col-head">${avatar(p)}<h3 id="c-${p.id}">${p.name}<span>${p.role}</span></h3></div>${body}</section>`;
    }).join("");
}

strip.addEventListener("click", (e) => {
  const b = e.target.closest("[data-day]");
  if (!b) return;
  day = b.dataset.day;
  render();
  strip.querySelector(`[data-day="${day}"]`).focus();
  live.textContent = `Showing ${dayLong(day)}.`;
});

render();

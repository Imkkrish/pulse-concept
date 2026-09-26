# Pulse: a concept booking experience

A self-initiated concept by [webtheory.co](https://webtheory-co.web.app): booking for a small,
independent physiotherapy and wellness clinic, designed to take under a minute on a phone.
Case study: https://webtheory-co.web.app/work/pulse

**This is a concept, not a real business.** The clinic, practitioners, patients, prices and
availability are all fictional. Nothing can be booked, no payment is taken, and no data leaves
your browser: the booking in progress lives in `sessionStorage`, and a "confirmed" concept booking
is kept in `localStorage` only so the clinic view can show it ("Forget this booking" clears it).
There are no analytics, trackers or third-party requests. Pages are `noindex` and `robots.txt`
disallows everything.

## Pages

- `index.html`: the clinic's short landing: what it treats (with length and price), a clear
  "Book an appointment", and how booking works in three decisions.
- `book.html`: the booking flow, one step at a time.
- `clinic.html`: a read-only staff day view built from the same fictional diary, with your concept
  booking highlighted: the proof that online booking adds no work for the front desk.
- `404.html`: a friendly way back home.

## The interaction flow

1. **Treatment**: five treatments, each with length and price in INR. (`book.html?t=massage` skips
   straight to step 2, used by the "Book" links on the home page.)
2. **Practitioner**: "First available" or one of the people who offer that treatment, each showing
   when they are next free. Anyone who doesn't offer it is named, not hidden.
3. **Time**: the next seven days from today. Taken times are struck through; closed days,
   days off, fully booked days and "too late today" each get their own empty state with a way
   forward. Tapping a time **holds** it for 10 minutes (shown as a clock time, not a countdown).
4. **Details**: only now: name, mobile, email, optional note. Labelled fields, inline
   validation on leaving a field, errors explained and announced, focus moved to the first problem.
5. **Confirmation**: a full summary, an honest "nothing was booked and no data was sent", an
   **Add to calendar** button that generates an `.ics` file in the browser, the time you took
   from first tap, and a link to the clinic view.

Every step has its own `#hash` and history entry: the in-page Back and the browser's back and
forward buttons both work, and choices are kept on the way back. Reloading resumes where you
were. Everything is reachable by keyboard; step changes move focus to the new heading.

Availability is generated from a seeded random diary (`assets/pulse.js`), so the booking flow and
the clinic view always agree, and the same day looks the same on every visit.

## Run locally

The site uses relative paths only (it is served from a subpath on GitHub Pages).

```sh
cd ..            # the folder that contains pulse-concept/
python3 -m http.server 5104
# open http://localhost:5104/pulse-concept/
```

No build step, no dependencies: plain HTML, CSS and ES modules.

## Credits and licences

- Type: [Instrument Sans](https://github.com/Instrument/instrument-sans) and
  [Instrument Serif](https://github.com/Instrument/instrument-serif), self-hosted woff2 subsets,
  both under the SIL Open Font License 1.1 (see `assets/fonts/OFL-*.txt`).
- Illustrations and icons are original SVG drawn for this concept.

Designed & built by [webtheory.co](https://webtheory-co.web.app).

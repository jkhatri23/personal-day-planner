# CLAUDE.md — Accountability Day Planner

This file is the build spec for an opinionated weekly day planner focused on productivity and financial accountability. Read it end-to-end before writing any code. When in doubt, optimize for **fast daily check-ins** and **friction-free accountability resolution**.

---

## 1. Product summary

A weekly-view day planner where the user (Jordan) plans tasks across 7 days, checks off completion at end-of-day, and is forced to donate $10 to a GoFundMe campaign for every uncompleted task. The donation step is non-skippable — incomplete tasks remain blocking until the user either marks them done, voids them with a written reason, or confirms a donation.

**Core loop:** Plan week → Execute day → End-of-day reckoning → Donate or justify → Roll forward.

---

## 2. Non-negotiable principles

1. **Accountability is the product.** Every UX decision must make it *harder* to silently skip a task than to actually do it (or honestly mark it skipped + donate).
2. **Daily reckoning is mandatory.** The app blocks normal usage at the start of each new day until the previous day's tasks are resolved (done / donated / voided).
3. **No "snooze forever."** A task can be rescheduled at most once. Second slip = automatic donation prompt.
4. **Donations are verified, not trusted.** The user must paste a GoFundMe donation confirmation (URL or receipt ID) before the debt clears. No "I'll do it later" toggle.
5. **Plan weekly, execute daily.** The primary planning view is the week; the primary execution view is today.

---

## 3. Tech stack

- **Frontend:** Next.js 14 (App Router) + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State / data:** SQLite via Prisma for local dev; Postgres-compatible schema for prod
- **Auth:** Single-user for v1 (no auth) — gate on a local `.env` user ID. Add Clerk/Auth.js in v2.
- **Date handling:** `date-fns` (not Moment). All timestamps stored as UTC ISO strings; render in user's local TZ.
- **Validation:** Zod for all API route inputs and form schemas.

Rationale: Jordan already works in Next.js + TypeScript (BeWell, CONSENSUS), so this matches existing muscle memory and lets the planner ship fast.

---

## 4. Data model

```prisma
model Week {
  id           String   @id @default(cuid())
  startDate    DateTime // Monday 00:00 local, stored UTC
  intention    String?  // user-set weekly theme/goal
  days         Day[]
  createdAt    DateTime @default(now())
}

model Day {
  id           String   @id @default(cuid())
  date         DateTime // 00:00 local, stored UTC
  weekId       String
  week         Week     @relation(fields: [weekId], references: [id])
  tasks        Task[]
  reckonedAt   DateTime? // null until end-of-day resolution complete
  reflection   String?   // optional 1-line journal at reckoning
}

model Task {
  id              String     @id @default(cuid())
  title           String
  notes           String?
  dayId           String
  day             Day        @relation(fields: [dayId], references: [id])
  priority        Priority   @default(MEDIUM) // LOW | MEDIUM | HIGH
  estimatedMins   Int?
  status          TaskStatus @default(PLANNED)
  // PLANNED | DONE | VOIDED | OWED | SETTLED
  completedAt     DateTime?
  rescheduleCount Int        @default(0) // hard cap = 1
  voidReason      String?    // required when status = VOIDED
  debt            Debt?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model Debt {
  id              String   @id @default(cuid())
  taskId          String   @unique
  task            Task     @relation(fields: [taskId], references: [id])
  amountCents     Int      @default(1000) // $10 default
  gofundmeUrl     String?  // campaign user committed to
  donationProof   String?  // URL or receipt ID pasted by user
  settledAt       DateTime?
  createdAt       DateTime @default(now())
}
```

**Status semantics:**
- `PLANNED` — created, not yet end-of-day
- `DONE` — checked off by user
- `VOIDED` — user explicitly cancelled with a written reason (≥10 chars). No debt incurred. Limited to 2/week to prevent abuse.
- `OWED` — end-of-day passed, task not done, debt created
- `SETTLED` — debt's `donationProof` filled in and verified by user

---

## 5. Core flows

### 5.1 Weekly planning view (`/week/[weekId]`)
- 7-column grid (Mon–Sun), each column scrollable.
- Drag-and-drop tasks between days (`@dnd-kit/core`).
- Top of page: weekly intention input + count of `OWED` tasks (red badge).
- "Add task" button per day; defaults to current day on first load.
- Show running counters: tasks done this week, tasks owed, total $ owed.

### 5.2 Today view (`/today`)
- Default landing page.
- Shows today's tasks as a checklist, ordered by priority then creation time.
- Each task: checkbox (marks DONE), edit pencil, "void" trash icon (opens reason modal), "push to tomorrow" arrow (only enabled if `rescheduleCount < 1`).
- Pinned top bar if there's an unresolved previous day → routes to reckoning.

### 5.3 End-of-day reckoning (`/reckon/[dayId]`)
Triggered automatically when user opens the app on day N+1 and day N has `reckonedAt = null`.

**The app's main navigation is disabled until reckoning is complete.** Show a full-screen modal:

1. List each `PLANNED` task from yesterday.
2. For each one, force a choice:
   - ✅ "I actually did this" → marks DONE (timestamp = now, flagged as backdated).
   - ✏️ "Void with reason" → text input, ≥10 chars, decrements weekly void budget.
   - 💸 "I didn't do it — owe $10" → creates `Debt`, status = OWED.
3. After all tasks resolved, show debt summary: total owed, list of GoFundMe URLs to choose from (user-curated list in settings, plus a default like https://www.gofundme.com/discover).
4. For each `OWED` task: input field for donation proof URL. **The "Settle & continue" button is disabled until every debt has a non-empty proof.**
5. Optional one-line reflection ("What got in the way?") → saved to `Day.reflection`.
6. On submit: set `reckonedAt = now`, mark debts SETTLED, navigate to today.

**Anti-cheat:** "I actually did this" requires a confirmation modal ("You're marking this as done after the fact — are you sure?") and is logged. If a user backdates >3 tasks in a week, show a gentle warning on the weekly summary.

### 5.4 Settings (`/settings`)
- Default donation amount (default $10, min $5, max $100).
- Saved GoFundMe campaign URLs (at least one required to use the app).
- Timezone (auto-detected, overridable).
- Weekly void budget (default 2).

---

## 6. Productivity optimizations

These are the features that make this more than a checklist:

1. **Time-blocking hints.** When a task has `estimatedMins`, today view shows a running "committed minutes today" total. If it exceeds 6 hours, warn the user they're over-planning.
2. **Priority caps.** Max 3 `HIGH` priority tasks per day (enforced in UI). Forces real prioritization.
3. **Carry-forward digest.** Top of today view: "Yesterday you completed X of Y tasks. You owe $Z." Cold, factual, no emojis.
4. **Weekly review (`/week/[weekId]/review`).** Auto-generated on Sunday: completion rate, total owed, void rate, most-rescheduled tasks, intention reflection prompt.
5. **Streak counter.** Days in a row with 100% completion *or* fully reckoned (donations count as honest reckoning, not failure). Resets on missed reckoning, not on owed tasks. The point is honesty, not perfection.
6. **Keyboard shortcuts.** `n` = new task, `j/k` = navigate tasks, `x` = toggle done, `r` = reschedule, `v` = void. Power-user speed.

---

## 7. API routes (Next.js App Router)

All routes are RESTful, JSON in/out, Zod-validated.

```
GET    /api/weeks/current             → current week + days + tasks
POST   /api/weeks                     → create week (idempotent on startDate)
PATCH  /api/weeks/:id                 → update intention

POST   /api/tasks                     → create task on a day
PATCH  /api/tasks/:id                 → edit title/notes/priority/estimatedMins
POST   /api/tasks/:id/complete        → status=DONE
POST   /api/tasks/:id/void            → body: { reason }; status=VOIDED
POST   /api/tasks/:id/reschedule      → body: { toDayId }; increments rescheduleCount
DELETE /api/tasks/:id                 → only if status=PLANNED and same-day

POST   /api/days/:id/reckon           → body: { resolutions[], reflection? }
                                        atomically resolves all tasks + creates debts

POST   /api/debts/:id/settle          → body: { donationProof }
GET    /api/debts?status=OWED         → list outstanding debts

GET    /api/stats/week/:id            → completion %, owed total, voids used
```

Reckoning must be a single transaction. If any task resolution fails validation, the whole thing rolls back.

---

## 8. UI/UX specifics

- **Color language:** Owed tasks render in red-700 with a small `$` icon. Voided tasks render in slate-400 strikethrough. Done in green-600. Planned in default text. No emoji-heavy UI.
- **Typography:** Inter for UI, JetBrains Mono for any numeric stats (owed totals, completion %).
- **Density:** Compact. This is a power-user tool, not a Notion-style canvas.
- **Mobile:** Today view and reckoning must work on mobile. Weekly planning view can be desktop-only for v1.
- **Empty states:** When no tasks exist for today, show "No tasks planned. Plan your day →" linking to weekly view. Don't be cute about it.

---

## 9. Edge cases to handle explicitly

1. **User opens app after multi-day absence.** Reckon each missed day in order, oldest first. Don't skip ahead.
2. **Task created today, not done today.** Same rules apply — it gets reckoned tomorrow.
3. **Timezone changes / travel.** Use the TZ from settings; don't auto-shift mid-week. Show a warning if device TZ ≠ settings TZ.
4. **Clock manipulation.** Server-side timestamp every state change. Don't trust client clocks for reckoning eligibility.
5. **GoFundMe URL validation.** Accept `gofundme.com/*` and `*.gofundme.com/*`. Reject anything else with a clear error.
6. **Donation proof verification.** v1: trust-but-log — store the proof string, show it on the debt history page so the user can audit themselves. v2: optional integration with bank/email parsing.
7. **Concurrent edits.** Last-write-wins with `updatedAt` for v1. Single-user, so this is fine.

---

## 10. Build order

Do not skip ahead. Each step must work end-to-end before starting the next.

1. Prisma schema + migrations + seed script (one week, a few tasks).
2. Today view (read-only) wired to real DB.
3. Task CRUD (create, complete, edit, delete).
4. Weekly view + drag-and-drop.
5. Reckoning flow — this is the hardest and most important; don't half-ass it.
6. Debt settlement flow.
7. Settings page + GoFundMe URL management.
8. Weekly review page.
9. Keyboard shortcuts + polish.
10. Mobile responsive pass on today + reckoning.

Ship steps 1–6 before adding anything else. Steps 7–10 are polish.

---

## 11. Out of scope for v1

- Multi-user / sharing
- Team accountability partners
- Calendar integrations (Google Cal, etc.)
- Mobile native apps
- Recurring tasks (handle by duplicating week-over-week manually for now)
- Actual GoFundMe API integration (manual paste of proof is fine)
- Analytics dashboard beyond the weekly review

---

## 12. Definition of done for v1

- Jordan can plan a full week on Sunday in under 5 minutes.
- Each morning, today view loads in <500ms and shows the right tasks.
- End-of-day reckoning cannot be bypassed — verified by attempting to navigate away mid-flow.
- A real $10 GoFundMe donation has been made and its proof URL pasted into a settled debt at least once during dogfooding.
- One full week used personally without skipping reckoning.

If all five are true, ship it. If any are false, fix that one thing before adding features.

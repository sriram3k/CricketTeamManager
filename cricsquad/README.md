# CricSquad

Cricket team management for a Singapore-based club: playing XI selection with
automatic player dues, bulk payment collection, fortnightly DBS bank statement
reconciliation, and tournament invoice management.

CricSquad is a standalone application. It lives alongside the existing CrickIQ
app in this repository but shares no code, schema or database with it.

```
cricsquad/
├── server/     Express + Prisma + PostgreSQL API
└── mobile/     Expo client — one codebase, runs on web, iOS and Android
```

The client targets **web** as well as native. `npm run web` serves it in a
browser; `npx expo export --platform web` produces a static SPA that deploys
alongside the API under one domain (see `DEPLOY.md`).

## Quick start

```bash
# 1. Database
createdb cricsquad

# 2. API
cd cricsquad/server
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy
npm run seed                  # 15 players, 1 tournament, 3 matches, 2 invoices
npm run dev                   # http://localhost:4000

# 3. Client
cd ../mobile
npm install
npm run web                   # browser at http://localhost:8081
# or: npm start               # then press i / a, or scan the QR code for a phone
```

The seed prints its logins:

| Role   | Email                            | Password       |
| ------ | -------------------------------- | -------------- |
| Admin  | `admin@cricsquad.example`        | `cricsquad123` |
| Player | `tan.wei.ming@cricsquad.example` | `cricsquad123` |

A sample DBS export sits at `server/sample-data/dbs-statement-sample.csv`, so
the reconciliation flow is demo-able straight after seeding.

> `expo.extra.apiBaseUrl` in `mobile/app.json` is empty, which means
> *same-origin* on web — correct for both `npm run web` and the deployment. On
> a physical device `localhost` points at the phone, so set it to your
> machine's LAN address or the deployed URL before using Expo Go.

## Features

### 1 — Playing XI with automatic dues

Admin creates a tournament, then matches with a per-player fee. The squad
picker searches by name, shows jersey numbers, toggles on tap, cycles
captain/keeper/sub on long-press, and keeps a running `11 selected` count
(max 11 in the XI plus 4 substitutes).

**Confirming the squad generates a `PENDING` `MATCH_FEE` charge for every
selected player**, linked to the match, described with the opponent, date and
tournament. Re-confirming reconciles rather than duplicating: players already
charged are left alone, and a dropped player's charge is removed only if
nothing has been paid against it. The previous match's squad can be copied as
a starting point.

Ad-hoc `REGISTRATION_FEE`, `JERSEY_FEE` and `ADHOC` charges can be raised
against one player, a selected set, or every active player in one action.
They sit in the player's pending total exactly like match fees.

### 2 — Bulk mark-as-paid

A list of every player with an outstanding balance (name, total pending,
oldest charge date) supports multi-select and select-all. Two modes:

- settle each selected player's full pending balance, or
- enter an amount per player, allocated **oldest charge first**; a shortfall
  leaves the charge `PENDING` with a reduced balance.

A confirmation summary — players affected, total, charges cleared, per-player
before/after — is produced by the same planner that performs the write, so the
preview cannot disagree with the result. The whole run is one transaction, and
an admin can undo the most recent run within 24 hours, which deletes its
payments and reopens every charge no longer covered.

### 3 — Fortnightly bank statement reconciliation

Upload a DBS/POSB transaction export (CSV or XLSX). The parser skips the
account preamble, finds the real header row, joins the three `Transaction Ref`
columns into one narrative, and reads **credits only** — outgoing payments are
reported as skipped with a reason. Dates are read day-first, as Singapore
writes them. The column mapping is remembered per bank after the first upload.

Auto-matching runs three tiers in priority order:

1. an amount equal to exactly one player's total pending, or exactly one
   player's single open charge;
2. the player's name or full mobile number in the narrative;
3. a PayNow reference containing a player identifier (mobile, initials, or
   first name).

Ambiguity never resolves to a guess. Two players owing the same amount, or a
narrative naming one player and carrying another's number, both go to manual
review — a bare last-4 is only accepted as its own token, never as a substring
of a longer number.

Nothing touches a balance at upload time. The review screen has three tabs —
Auto-matched, Unmatched, Ignored — each line showing date, description, amount,
proposed player and why. Admins confirm all, reassign individually, or mark a
line ignored (a sponsor payment, say). **Complete reconciliation** commits
every confirmed match in one transaction and reports total received, charges
cleared, players fully settled and lines ignored.

Each line is hashed on date + amount + normalised description. A line already
committed in a completed upload is flagged and defaulted to `IGNORED`, so
re-uploading an overlapping statement cannot double-credit anyone.

### 4 — Invoice management

A per-tournament invoice register. Uploading a PDF or photo runs it through a
pluggable extraction service and pre-fills invoice number, vendor, amount, GST
and due date into a **fully editable** review form — nothing is saved until the
admin confirms. The same form, blank, handles invoices that arrive without a
file or where extraction fails. The original file is stored and linked.

`ExtractionService` has two implementations: `AnthropicExtractionService` sends
the document to the Anthropic API constrained to a JSON schema, and
`MockExtractionService` is a deterministic stand-in used when
`ANTHROPIC_API_KEY` is unset and in tests. Swapping in an OCR provider means
implementing the interface and returning it from `createExtractionService()`.

### 5 — Invoice payment status

Marking an invoice paid requires a transaction reference, a payment mode
(PayNow / bank transfer / cheque / card / cash) and a paid date defaulting to
today. A paid invoice is immutable — editing or re-paying it is refused — until
an admin reopens it, which clears the payment fields and records who did it and
when. Every create, edit, mark-paid and reopen is written to an audit trail.

The tournament financial summary puts vendor invoices and player dues on one
screen: total invoiced, paid and outstanding against total charged, collected
and pending, with the net cash position.

## Money

Every monetary column is `Decimal(12,2)` and every calculation runs on integer
cents (`src/lib/money.ts`). Floats are never used for money anywhere in the
codebase. Allocation is centralised in `src/services/allocation.ts`, so bulk
payments and statement reconciliation cannot drift apart, and each money
operation runs inside a database transaction.

## Testing

```bash
cd cricsquad/server
createdb cricsquad_test
TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/cricsquad_test" \
  npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/cricsquad_test" npm test
```

48 integration tests run against a real PostgreSQL database, covering charge
generation on squad confirmation, FIFO allocation, the bulk mark-as-paid
transaction and undo, statement parsing and duplicate detection, auto-match
ambiguity handling, and invoice status transitions.

## API

| Group          | Endpoints                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Auth           | `POST /api/auth/{signup,login}`, `GET /api/auth/me`                       |
| Players        | `GET/POST /api/players`, `PATCH /api/players/:id`, `GET .../dues`         |
| Tournaments    | `GET/POST /api/tournaments`, `GET .../matches`, `GET .../financials`      |
| Squad          | `GET /api/matches/:id`, `POST .../squad`, `GET .../previous-squad`        |
| Charges        | `POST /api/charges/adhoc`, `POST /api/charges/:id/waive`, `GET /api/charges` |
| Payments       | `GET /api/payments/pending`, `POST /api/payments/bulk{,/preview}`, `.../undo` |
| Statements     | `POST /api/statements`, `GET .../review`, `PATCH /api/statements/lines/:id`, `POST .../complete` |
| Invoices       | `POST /api/invoices/extract`, `GET/POST /api/tournaments/:id/invoices`, `POST /api/invoices/:id/{mark-paid,reopen}` |

Errors return `{ message, code, fieldErrors? }`; `fieldErrors` maps a field
name to a message so the client renders validation inline.

Two roles: `ADMIN` has full access; `PLAYER` can read only their own dues.

## Environment

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string                                    |
| `JWT_SECRET`        | Signs session tokens; required in production                    |
| `PORT`              | API port (default 4000)                                         |
| `UPLOAD_DIR`        | Where invoice and statement files are written (default `./uploads`) |
| `ANTHROPIC_API_KEY` | Enables real invoice extraction; the mock is used when unset    |
| `ANTHROPIC_MODEL`   | Extraction model (default `claude-opus-5`)                       |

File storage sits behind `StorageService`, so the local-disk implementation can
be replaced with S3 without touching a route or service.

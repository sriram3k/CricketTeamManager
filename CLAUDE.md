# CLAUDE.md — Cricket Team Manager (CrickIQ)

This file provides guidance for AI assistants working on this codebase. Read it before making changes.

## Project Overview

**CrickIQ** is a full-stack cricket team management platform built as a monorepo. It supports team scheduling, ball-by-ball live scoring, player availability polling, payment tracking, corporate invoicing, and analytics.

## Repository Structure

```
CricketTeamManager/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Shadcn/UI base components (don't edit these)
│   │   │   ├── cricket/     # Domain components (BallByBallEntry, ScoreCard)
│   │   │   ├── layout/      # AppLayout, Sidebar, TopBar, MobileNavigation
│   │   │   ├── onboarding/  # OnboardingTour, TourRestartButton
│   │   │   └── stats/       # Statistics display components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # queryClient.ts, utils.ts
│   │   └── pages/           # 16 page components (one per route)
│   └── index.html
├── server/
│   ├── index.ts             # Express server entry point
│   ├── routes.ts            # All 60+ API endpoints (~976 lines)
│   ├── storage.ts           # Business logic layer (~599 lines)
│   ├── storage-db.ts        # Database operations (~717 lines)
│   ├── db.ts                # Drizzle ORM + Neon PostgreSQL setup
│   ├── replitAuth.ts        # Replit OpenID Connect authentication
│   ├── emailService.ts      # SendGrid email templates
│   ├── passwordResetService.ts
│   └── inviteRoutes.ts      # Player invitation endpoints
├── shared/
│   └── schema.ts            # Drizzle ORM schema + Zod validation (single source of truth)
├── migrations/              # Drizzle-generated SQL migrations
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── components.json          # Shadcn/UI config
```

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite 5** — dev server and build tool
- **Wouter** — lightweight client-side routing (not React Router)
- **TanStack Query 5** — server state, caching, and mutations
- **React Hook Form + Zod** — form management and validation
- **Shadcn/UI + Radix UI** — component primitives
- **Tailwind CSS 3** — styling with CSS variables for theming
- **Recharts** — data visualization
- **Framer Motion** — animations
- **Lucide React** — icons

### Backend
- **Node.js 20** with ES modules (`"type": "module"`)
- **Express 4** — HTTP server
- **Drizzle ORM** — type-safe database queries
- **PostgreSQL 16** via Neon serverless (`DATABASE_URL`)
- **Passport.js** — authentication (OpenID Connect for Replit Auth)
- **express-session** with PostgreSQL session store
- **bcrypt** — local password hashing
- **SendGrid** — transactional email
- **ws** — WebSocket support for real-time features

### Database
- PostgreSQL via Neon serverless
- Schema defined in `shared/schema.ts` using Drizzle ORM
- Migrations managed with Drizzle Kit

## Development Workflow

### Commands

```bash
npm run dev        # Start dev server (Express + Vite HMR on port 5000)
npm run build      # Build: Vite (client) + esbuild (server)
npm run start      # Run production build
npm run check      # TypeScript type check (run before committing)
npm run db:push    # Push schema changes to database (no migration file)
```

### Environment Variables

Required in `.env` or Replit secrets:
```
DATABASE_URL        # Neon PostgreSQL connection string
SESSION_SECRET      # express-session secret
SENDGRID_API_KEY    # For email delivery
FROM_EMAIL          # Sender address for emails
ISSUER_URL          # Replit OpenID Connect issuer
REPLIT_DOMAINS      # Allowed domains for Replit Auth
REPL_ID             # Replit environment identifier
NODE_ENV            # "development" or "production"
```

### Making Schema Changes

1. Edit `shared/schema.ts`
2. Run `npm run db:push` (dev) or create a migration file in `migrations/`
3. Never modify existing migration files — add new ones

## Codebase Conventions

### Path Aliases

Configured in `vite.config.ts` and `tsconfig.json`:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

Always use these aliases in imports, not relative paths across package boundaries.

### API Patterns

- All API routes are in `server/routes.ts`
- Routes call `storage.ts` functions (business logic)
- `storage.ts` calls `storage-db.ts` functions (database queries)
- Never write raw SQL — use Drizzle ORM query builders
- All endpoints return JSON; errors use `{ message: string }` format
- Authentication check: `if (!req.isAuthenticated())` returns 401

### Frontend Data Fetching

Use TanStack Query for all server state:
```typescript
// Query
const { data } = useQuery({ queryKey: ['/api/teams'], queryFn: ... });

// Mutation with cache invalidation
const mutation = useMutation({
  mutationFn: ...,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/teams'] }),
});
```

### Routing

Uses **Wouter**, not React Router. Route definitions are in `client/src/App.tsx`:
```typescript
import { Route, Switch } from 'wouter';
```

### Form Validation

Use React Hook Form with Zod resolvers. Schema definitions should match or extend those in `shared/schema.ts`:
```typescript
const schema = z.object({ name: z.string().min(1) });
const form = useForm({ resolver: zodResolver(schema) });
```

### Styling

- Use Tailwind CSS utility classes
- Use CSS variables from `client/src/index.css` for theme colors (not hardcoded values)
- Dark mode supported via `.dark` class
- Shadcn/UI components live in `client/src/components/ui/` — don't edit these manually; use the Shadcn CLI or follow their patterns

### TypeScript

- Strict mode is enabled — no `any` unless unavoidable
- All API request/response types should be derived from Drizzle schema or Zod schemas in `shared/schema.ts`
- Use `InferSelectModel` / `InferInsertModel` from Drizzle for table types

## Database Schema Overview

Key tables in `shared/schema.ts`:

| Table | Purpose |
|-------|---------|
| `users` | Replit OAuth users |
| `localUsers` | Email/password users (role: player, manager, organizer) |
| `teams` | Team entities with manager/captain/vice-captain |
| `players` | Player profiles (position, batting/bowling style) |
| `playerTeams` | Many-to-many player ↔ team relationships |
| `matches` | Match scheduling and status |
| `innings` | Innings per match |
| `balls` | Ball-by-ball scoring data |
| `playerStats` | Aggregated per-match player statistics |
| `availabilityRequests` | Per-match availability polls |
| `availabilityResponses` | Player responses (available/unavailable/maybe) |
| `payments` | Player payment tracking per match |
| `invoices` | Corporate invoice records |
| `playerInvites` | Email invitation tokens |
| `sessions` | express-session storage |

## Authentication

**Dual auth system:**

1. **Replit Auth** (`server/replitAuth.ts`) — OpenID Connect via Passport.js. Used when running on Replit. Callback: `/api/callback`.

2. **Local Auth** (`server/routes.ts`) — email/password with bcrypt. Endpoints: `POST /api/auth/login`, `POST /api/auth/signup`.

**Password reset** uses crypto tokens with 1-hour expiry, delivered via SendGrid.

**Player invitations** use 7-day tokens sent via SendGrid. On signup via invite link, the player is automatically added to the team.

**Role-based access:**
- `player` — limited to own dashboard, availability responses, payments
- `manager` — full access to all team management features
- `organizer` — extended admin access

## API Endpoint Groups

| Group | Prefix | Count |
|-------|--------|-------|
| Authentication | `/api/auth/*` | 7 |
| Teams | `/api/teams/*` | 7 |
| Players | `/api/players/*` | 6 |
| Matches | `/api/matches/*` | 10 |
| Live Scoring (Innings/Balls) | `/api/innings/*`, `/api/balls` | 5 |
| Player Stats | `/api/player-stats/*` | 5 |
| Availability | `/api/availability*` | 8 |
| Payments | `/api/payments*` | 6 |
| Invoices | `/api/invoices*` | 4 |
| Dashboard | `/api/teams/:id/dashboard-stats` | 1 |

## Key Feature Implementations

### Live Scoring
- Ball-by-ball entry via `BallByBallEntry` component
- Data model: `matches` → `innings` → `balls`
- Tracks: runs, extras (wides/no-balls/byes/leg-byes), wickets, fielders
- Real-time updates via WebSocket (`ws`)

### Availability System
- Manager creates an `availabilityRequest` per match
- Players respond via `availabilityResponses` (available/unavailable/maybe + reason)
- Backfill endpoint for retroactively tracking past matches

### Financial Tracking
- `payments` table tracks per-player match fees
- `invoices` table handles corporate billing
- Payment methods: UPI, Credit Card, etc.
- Statuses: pending, paid, overdue

## Testing

**No tests currently exist.** The codebase has no test files or testing framework configured. When adding tests:
- Prefer **Vitest** (compatible with Vite setup) for unit/integration tests
- Use **React Testing Library** for component tests
- Place test files as `*.test.ts` or `*.spec.ts` alongside source files

## Production Deployment

Deployed on **Replit Autoscale**:
- Build: `npm run build` (Vite + esbuild)
- Start: `npm run start` (serves static assets + API from single Express server)
- Port: 5000 internally, 80 externally
- Static assets served from `dist/public/` in production

## Common Gotchas

1. **ES Modules** — The project uses `"type": "module"`. Always use `import`/`export`, never `require()`.
2. **Shared schema** — `shared/schema.ts` is used by both client and server. Changes affect both.
3. **No test runner** — `npm run check` (TypeScript) is the only automated validation step.
4. **Wouter vs React Router** — This project uses Wouter. Don't import from `react-router-dom`.
5. **Shadcn/UI components** — Don't edit files in `client/src/components/ui/` manually.
6. **Session cookies** — Configured as HttpOnly + Secure in production. Don't use localStorage for auth state.
7. **Drizzle migrations** — Prefer `npm run db:push` in dev. In production, use proper migration files to avoid data loss.
8. **Neon DB** — Uses WebSocket-based serverless connection. Don't use a standard `pg` Pool directly.

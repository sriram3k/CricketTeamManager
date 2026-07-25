# Deploying CricSquad to DigitalOcean

The App Platform spec is at `cricsquad/.do/app.yaml`. It provisions three
things in the `sgp` region:

| Component | What it is | Route |
| --------- | ---------- | ----- |
| `web`     | The CricSquad web app (static SPA) | `/` |
| `api`     | The Express API | `/api` |
| `cricsquad-db` | Managed PostgreSQL 16 | — |

Both components sit behind **one domain**, so the deployed URL opens the app in
a browser and the app calls the API same-origin. Nothing extra to configure.

This is a **separate app** from the CrickIQ spec at the repository root
(`/.do/app.yaml`). Deploying CricSquad does not touch CrickIQ — different app
name, different service, different database.

## Prerequisites

- A DigitalOcean account with billing enabled
- `doctl` installed and authenticated: `doctl auth init` (needs a token from
  <https://cloud.digitalocean.com/account/api/tokens> with **write** scope)
- The DigitalOcean GitHub app authorised for `sriram3k/cricketteammanager`,
  so App Platform can pull the repo

## Deploy

```bash
# 1. Create the app and its database
doctl apps create --spec cricsquad/.do/app.yaml

# 2. Note the app id it prints, then set the required secret
APP_ID=<id from step 1>
doctl apps update "$APP_ID" --spec cricsquad/.do/app.yaml \
  --env "JWT_SECRET=$(openssl rand -base64 48)"

# 3. Watch the build
doctl apps logs "$APP_ID" --type build --follow

# 4. Get the public URL
doctl apps get "$APP_ID" --format DefaultIngress,LiveURL
```

First deploy takes roughly 5–10 minutes, most of it database provisioning.

`JWT_SECRET` can also be set in the control panel under
**Settings → api → Environment Variables** — mark it *encrypted*. The app
refuses to boot in production without it, which is deliberate: a default
signing key would let anyone mint an admin token.

## Verify the deployment

```bash
URL=$(doctl apps get "$APP_ID" --format DefaultIngress --no-header)

curl -s "$URL/api/health"
# {"status":"ok","currency":"SGD"}
```

Then open `$URL` in a browser — that is the app itself, not the API. Sign in
with the seeded admin below.

Migrations run automatically on every deploy via `npm run start:migrate`,
which calls `prisma migrate deploy` — it only replays committed migration
files and never generates, resets, or drops anything.

## Seeding demo data

The database starts **empty**, so there is no login until you seed it. The
seed is not wired into the deploy, on purpose: `prisma/seed.ts` truncates every
table, so running it automatically would wipe real data on each push.

To seed a fresh test deployment, run it once against the managed database:

```bash
# Get the connection string (includes sslmode=require)
doctl databases connection <db-id> --format URI

cd cricsquad/server
DATABASE_URL="<that URI>" npm run seed
```

This creates 15 players, 1 tournament, 3 matches with squads, mixed
pending/paid charges, and 2 invoices, then prints the logins:

| Role   | Email                            | Password       |
| ------ | -------------------------------- | -------------- |
| Admin  | `admin@cricsquad.example`        | `cricsquad123` |
| Player | `tan.wei.ming@cricsquad.example` | `cricsquad123` |

**Change these before pointing anyone else at the deployment.** They are demo
credentials committed to a public repository, and the admin role can move
money.

## Running the same code natively

The web app and the iOS/Android app are one Expo codebase. The deployed URL
covers the browser; to run it on a phone:

```json
// mobile/app.json — native builds have no origin to inherit, so point them
// at the deployment. Leave this empty for web (it means same-origin).
{ "expo": { "extra": { "apiBaseUrl": "https://cricsquad-xxxxx.ondigitalocean.app" } } }
```

Then `npm start` in `cricsquad/mobile` and open it in Expo Go. Set the value
back to `""` before building for web again.

## Web behaviour worth knowing

`Alert.alert` from React Native is a **no-op under react-native-web** — the
dialog never appears and its button callbacks never fire, so a confirmation
would silently cancel whatever it was guarding. CricSquad therefore uses its
own `DialogProvider` (`src/dialog.tsx`), which renders a real Modal and behaves
identically on web and native. Use `useDialog()` for any new confirmation; do
not reach for `Alert`.

Pull-to-refresh has no desktop equivalent, so on web use the browser reload or
navigate between tabs to refetch. Every screen refetches on focus.

## Known limitations of this spec

**Uploaded files do not survive a redeploy.** App Platform containers have an
ephemeral filesystem, so invoice PDFs and bank statement files written to
`UPLOAD_DIR` are lost whenever the app restarts or redeploys. Extracted invoice
*data* is in Postgres and is safe; only the original files are lost.

For anything beyond testing, implement `StorageService` against DigitalOcean
Spaces. The interface in `src/services/storage/index.ts` was built for this —
`save`/`read`/`delete`/`urlFor` against the S3-compatible API, then return it
from the bottom of that file. No route or service changes.

**Single instance, smallest tiers.** `basic-xxs` and `db-s-1vcpu-1gb` are sized
for testing. Scale `instance_count` and `size` before real use.

**No backups configured.** Enable them on the managed database before the club
relies on it.

## Costs

At the sizes in the spec, roughly USD 5/month for the service plus USD 15/month
for the managed database. Both bill hourly — destroy with
`doctl apps delete "$APP_ID"` when you are done testing (this also destroys the
database and its data).

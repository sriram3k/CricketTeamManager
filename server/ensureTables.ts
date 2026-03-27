import { pool } from "./db";

export async function ensureTables() {
  // Create our own schema — any user can create a schema they own.
  // This bypasses the PostgreSQL 15 restriction on public schema CREATE.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS crickiq`);
  await pool.query(`SET search_path TO crickiq, public`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" varchar PRIMARY KEY NOT NULL,
      "email" varchar UNIQUE,
      "first_name" varchar,
      "last_name" varchar,
      "profile_image_url" varchar,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "local_users" (
      "id" serial PRIMARY KEY NOT NULL,
      "username" text NOT NULL,
      "email" text NOT NULL,
      "password_hash" text NOT NULL,
      "first_name" text,
      "last_name" text,
      "role" text DEFAULT 'player' NOT NULL,
      "team_id" integer,
      "is_verified" boolean DEFAULT false,
      "verification_token" text,
      "reset_password_token" text,
      "reset_password_expires" timestamp,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now(),
      CONSTRAINT "local_users_username_unique" UNIQUE("username"),
      CONSTRAINT "local_users_email_unique" UNIQUE("email")
    );

    CREATE TABLE IF NOT EXISTS "teams" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "manager_id" integer NOT NULL,
      "description" text,
      "home_ground" text,
      "captain_id" integer,
      "vice_captain_id" integer,
      "team_type" text DEFAULT 'recreational',
      "contact_email" text,
      "contact_phone" text,
      "website" text,
      "founded_year" integer,
      "team_color" text DEFAULT '#3B82F6',
      "is_active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "players" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "name" text NOT NULL,
      "email" text,
      "phone" text,
      "date_of_birth" timestamp,
      "preferred_position" text,
      "batting_style" text,
      "bowling_style" text,
      "is_active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "player_teams" (
      "id" serial PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "team_id" integer NOT NULL,
      "jersey_number" integer,
      "position" text,
      "is_active" boolean DEFAULT true,
      "joined_at" timestamp DEFAULT now(),
      "left_at" timestamp
    );

    CREATE TABLE IF NOT EXISTS "matches" (
      "id" serial PRIMARY KEY NOT NULL,
      "home_team_id" integer NOT NULL,
      "away_team_id" integer,
      "opponent_name" text,
      "date" timestamp NOT NULL,
      "venue" text NOT NULL,
      "status" text DEFAULT 'scheduled' NOT NULL,
      "toss_winner" integer,
      "toss_decision" text,
      "match_type" text DEFAULT 'T20' NOT NULL,
      "total_overs" integer DEFAULT 20,
      "result" text,
      "winner_team_id" integer,
      "match_fee" text,
      "notes" text,
      "created_at" timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "innings" (
      "id" serial PRIMARY KEY NOT NULL,
      "match_id" integer NOT NULL,
      "batting_team_id" integer NOT NULL,
      "bowling_team_id" integer NOT NULL,
      "innings_number" integer NOT NULL,
      "total_runs" integer DEFAULT 0,
      "total_wickets" integer DEFAULT 0,
      "total_overs" numeric(3,1) DEFAULT '0.0',
      "extras" json DEFAULT '{}',
      "is_completed" boolean DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS "balls" (
      "id" serial PRIMARY KEY NOT NULL,
      "innings_id" integer NOT NULL,
      "over_number" integer NOT NULL,
      "ball_number" integer NOT NULL,
      "batsman_id" integer NOT NULL,
      "bowler_id" integer NOT NULL,
      "runs" integer DEFAULT 0,
      "is_wicket" boolean DEFAULT false,
      "wicket_type" text,
      "fielder_involved_id" integer,
      "extras" json DEFAULT '{}',
      "commentary" text
    );

    CREATE TABLE IF NOT EXISTS "player_stats" (
      "id" serial PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "match_id" integer NOT NULL,
      "runs_scored" integer DEFAULT 0,
      "balls_faced" integer DEFAULT 0,
      "fours" integer DEFAULT 0,
      "sixes" integer DEFAULT 0,
      "is_out" boolean DEFAULT false,
      "how_out" text,
      "runs_conceded" integer DEFAULT 0,
      "balls_bowled" integer DEFAULT 0,
      "wickets_taken" integer DEFAULT 0,
      "catches" integer DEFAULT 0,
      "run_outs" integer DEFAULT 0,
      "stumpings" integer DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "availability_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "team_id" integer NOT NULL,
      "match_id" integer,
      "request_date" timestamp NOT NULL,
      "match_date" timestamp NOT NULL,
      "venue" text NOT NULL,
      "opponent" text NOT NULL,
      "deadline" timestamp NOT NULL,
      "message" text
    );

    CREATE TABLE IF NOT EXISTS "availability_responses" (
      "id" serial PRIMARY KEY NOT NULL,
      "request_id" integer NOT NULL,
      "player_id" integer NOT NULL,
      "status" text NOT NULL,
      "response_date" timestamp DEFAULT now(),
      "reason" text
    );

    CREATE TABLE IF NOT EXISTS "payments" (
      "id" serial PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "match_id" integer NOT NULL,
      "amount" numeric(10,2) NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "due_date" timestamp NOT NULL,
      "paid_date" timestamp,
      "payment_method" text,
      "purpose" text DEFAULT 'match_fee'
    );

    CREATE TABLE IF NOT EXISTS "invoices" (
      "id" serial PRIMARY KEY NOT NULL,
      "team_id" integer NOT NULL,
      "match_id" integer,
      "invoice_number" text NOT NULL,
      "amount" numeric(10,2) NOT NULL,
      "description" text NOT NULL,
      "issue_date" timestamp DEFAULT now(),
      "due_date" timestamp NOT NULL,
      "status" text DEFAULT 'sent' NOT NULL,
      "paid_date" timestamp,
      "corporate_id" integer NOT NULL,
      CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
    );

    CREATE TABLE IF NOT EXISTS "player_invites" (
      "id" serial PRIMARY KEY NOT NULL,
      "team_id" integer NOT NULL,
      "email" text NOT NULL,
      "inviter_name" text NOT NULL,
      "team_name" text NOT NULL,
      "position" text,
      "message" text,
      "token" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now(),
      "accepted_at" timestamp,
      CONSTRAINT "player_invites_token_unique" UNIQUE("token")
    );
  `);

  // Migrate existing tables: add columns that were added in schema updates.
  // These are idempotent — ADD COLUMN IF NOT EXISTS is a no-op if column already exists.
  await pool.query(`
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "contact_email" text;
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "contact_phone" text;
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "website" text;
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "founded_year" integer;
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "team_color" text DEFAULT '#3B82F6';
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

    ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "preferred_position" text;
    ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "date_of_birth" timestamp;
    ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
    ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'player';

    ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "join_token" text;
  `);

  // Make players.team_id nullable — old schema had it NOT NULL which blocks Drizzle INSERTs
  // (Drizzle schema no longer includes team_id in players; teams are tracked via player_teams)
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'crickiq'
          AND table_name = 'players'
          AND column_name = 'team_id'
          AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE "players" ALTER COLUMN "team_id" DROP NOT NULL;
      END IF;
    END
    $$;
  `);
}

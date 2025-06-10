CREATE TABLE "availability_requests" (
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
--> statement-breakpoint
CREATE TABLE "availability_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"status" text NOT NULL,
	"response_date" timestamp DEFAULT now(),
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "balls" (
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
	"extras" json DEFAULT '{}'::json,
	"commentary" text
);
--> statement-breakpoint
CREATE TABLE "innings" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"batting_team_id" integer NOT NULL,
	"bowling_team_id" integer NOT NULL,
	"innings_number" integer NOT NULL,
	"total_runs" integer DEFAULT 0,
	"total_wickets" integer DEFAULT 0,
	"total_overs" numeric(3, 1) DEFAULT '0.0',
	"extras" json DEFAULT '{}'::json,
	"is_completed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"match_id" integer,
	"invoice_number" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"issue_date" timestamp DEFAULT now(),
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"paid_date" timestamp,
	"corporate_id" integer NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"venue" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"toss_winner" integer,
	"toss_decision" text,
	"match_type" text DEFAULT 'T20' NOT NULL,
	"total_overs" integer DEFAULT 20,
	"result" text,
	"winner_team_id" integer,
	"match_fee" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"payment_method" text
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
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
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"jersey_number" integer,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manager_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"team_id" integer,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);

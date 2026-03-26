CREATE TABLE "local_users" (
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
--> statement-breakpoint
CREATE TABLE "player_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"jersey_number" integer,
	"position" text,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "player_invites" (
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

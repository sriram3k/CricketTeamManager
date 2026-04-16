import { pgTable, text, serial, integer, boolean, timestamp, decimal, json, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Traditional users table for email/password auth
export const localUsers = pgTable("local_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("player"), // player, admin, organizer
  teamId: integer("team_id"),
  isVerified: boolean("is_verified").default(false),
  verificationToken: text("verification_token"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  managerId: integer("manager_id").notNull(),
  description: text("description"),
  homeGround: text("home_ground"),
  captainId: integer("captain_id"),
  viceCaptainId: integer("vice_captain_id"),
  teamType: text("team_type").default("recreational"), // recreational, competitive, professional
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  foundedYear: integer("founded_year"),
  teamColor: text("team_color").default("#3B82F6"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  preferredPosition: text("preferred_position"), // batsman, bowler, all-rounder, wicket-keeper
  battingStyle: text("batting_style"), // right-handed, left-handed
  bowlingStyle: text("bowling_style"), // right-arm fast, left-arm spin, etc
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table for player-team relationships
export const playerTeams = pgTable("player_teams", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  teamId: integer("team_id").notNull(),
  jerseyNumber: integer("jersey_number"),
  position: text("position"), // position in this specific team
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id"), // Optional - only used for internal team vs team matches
  opponentName: text("opponent_name"), // Free text opponent name - no database lookups
  date: timestamp("date").notNull(),
  venue: text("venue").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, live, completed, cancelled
  tossWinner: integer("toss_winner"),
  tossDecision: text("toss_decision"), // bat, bowl
  matchType: text("match_type").notNull().default("T20"), // T20, ODI, Test
  totalOvers: integer("total_overs").default(20),
  result: text("result"),
  winnerTeamId: integer("winner_team_id"),
  matchFee: text("match_fee"),
});

export const innings = pgTable("innings", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  battingTeamId: integer("batting_team_id").notNull(),
  bowlingTeamId: integer("bowling_team_id").notNull(),
  inningsNumber: integer("innings_number").notNull(), // 1 or 2
  totalRuns: integer("total_runs").default(0),
  totalWickets: integer("total_wickets").default(0),
  totalOvers: decimal("total_overs", { precision: 3, scale: 1 }).default("0.0"),
  extras: json("extras").default({}), // {wides: 0, noballs: 0, byes: 0, legbyes: 0}
  isCompleted: boolean("is_completed").default(false),
});

export const balls = pgTable("balls", {
  id: serial("id").primaryKey(),
  inningsId: integer("innings_id").notNull(),
  overNumber: integer("over_number").notNull(),
  ballNumber: integer("ball_number").notNull(),
  batsmanId: integer("batsman_id").notNull(),
  bowlerId: integer("bowler_id").notNull(),
  runs: integer("runs").default(0),
  isWicket: boolean("is_wicket").default(false),
  wicketType: text("wicket_type"), // bowled, caught, lbw, run_out, stumped, hit_wicket
  fielderInvolvedId: integer("fielder_involved_id"),
  extras: json("extras").default({}), // {type: 'wide/noball/bye/legbye', runs: 0}
  commentary: text("commentary"),
});

export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  matchId: integer("match_id").notNull(),
  runsScored: integer("runs_scored").default(0),
  ballsFaced: integer("balls_faced").default(0),
  fours: integer("fours").default(0),
  sixes: integer("sixes").default(0),
  isOut: boolean("is_out").default(false),
  howOut: text("how_out"),
  runsConceded: integer("runs_conceded").default(0),
  ballsBowled: integer("balls_bowled").default(0),
  wicketsTaken: integer("wickets_taken").default(0),
  catches: integer("catches").default(0),
  runOuts: integer("run_outs").default(0),
  stumpings: integer("stumpings").default(0),
});

export const availabilityRequests = pgTable("availability_requests", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  matchId: integer("match_id"),
  requestDate: timestamp("request_date").notNull(),
  matchDate: timestamp("match_date").notNull(),
  venue: text("venue").notNull(),
  opponent: text("opponent").notNull(),
  deadline: timestamp("deadline").notNull(),
  message: text("message"),
});

export const availabilityResponses = pgTable("availability_responses", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  playerId: integer("player_id").notNull(),
  status: text("status").notNull(), // available, unavailable, maybe
  responseDate: timestamp("response_date").defaultNow(),
  reason: text("reason"),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  matchId: integer("match_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purpose: text("purpose").notNull(), // Match fee, Equipment, Travel, etc.
  status: text("status").notNull().default("pending"), // pending, paid, overdue
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  paymentMethod: text("payment_method"), // UPI, Credit Card, Debit Card, Net Banking, Cash
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  matchId: integer("match_id"),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  issueDate: timestamp("issue_date").defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("sent"), // sent, paid, overdue, cancelled
  paidDate: timestamp("paid_date"),
  corporateId: integer("corporate_id").notNull(),
});

// Match squad selection table
export const matchSquads = pgTable("match_squads", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  playerId: integer("player_id").notNull(),
  isPlaying: boolean("is_playing").default(true),
  battingOrder: integer("batting_order"),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Player invitations table
export const playerInvites = pgTable("player_invites", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  email: text("email").notNull(),
  inviterName: text("inviter_name").notNull(),
  teamName: text("team_name").notNull(),
  position: text("position"),
  message: text("message"),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertLocalUserSchema = createInsertSchema(localUsers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertTeamSchema = createInsertSchema(teams).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  teamColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color").optional(),
});
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlayerTeamSchema = createInsertSchema(playerTeams).omit({ id: true, joinedAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true }).extend({
  date: z.string().transform((val) => new Date(val)),
});
export const insertInningsSchema = createInsertSchema(innings).omit({ id: true });
export const insertBallSchema = createInsertSchema(balls).omit({ id: true });
export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({ id: true });
export const insertAvailabilityRequestSchema = createInsertSchema(availabilityRequests).omit({ id: true });
export const insertAvailabilityResponseSchema = createInsertSchema(availabilityResponses)
  .omit({ id: true, responseDate: true })
  .extend({ status: z.enum(["available", "unavailable", "maybe"]) });
export const insertPaymentSchema = z.object({
  playerId: z.number(),
  matchId: z.number(),
  amount: z.string(),
  purpose: z.string().min(1, "Purpose is required"),
  status: z.string().default("pending"),
  dueDate: z.union([z.string(), z.date()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
  paidDate: z.union([z.string(), z.date()]).transform((val) => typeof val === 'string' ? new Date(val) : val).optional(),
  paymentMethod: z.string().optional(),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, issueDate: true });
export const insertPlayerInviteSchema = createInsertSchema(playerInvites).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  token: true,
  expiresAt: true
});
export const insertMatchSquadSchema = createInsertSchema(matchSquads).omit({ id: true, createdAt: true });

// Types for main entities
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type PlayerTeam = typeof playerTeams.$inferSelect;
export type InsertPlayerTeam = z.infer<typeof insertPlayerTeamSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Innings = typeof innings.$inferSelect;
export type InsertInnings = z.infer<typeof insertInningsSchema>;
export type Ball = typeof balls.$inferSelect;
export type InsertBall = z.infer<typeof insertBallSchema>;
export type PlayerStats = typeof playerStats.$inferSelect;
export type InsertPlayerStats = z.infer<typeof insertPlayerStatsSchema>;
export type AvailabilityRequest = typeof availabilityRequests.$inferSelect;
export type InsertAvailabilityRequest = z.infer<typeof insertAvailabilityRequestSchema>;
export type AvailabilityResponse = typeof availabilityResponses.$inferSelect;
export type InsertAvailabilityResponse = z.infer<typeof insertAvailabilityResponseSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type PlayerInvite = typeof playerInvites.$inferSelect;
export type InsertPlayerInvite = z.infer<typeof insertPlayerInviteSchema>;
export type MatchSquad = typeof matchSquads.$inferSelect;
export type InsertMatchSquad = z.infer<typeof insertMatchSquadSchema>;

// Database Relations
export const usersRelations = relations(users, ({ many }) => ({
  // Replit Auth users don't have direct team relations
}));

export const localUsersRelations = relations(localUsers, ({ one, many }) => ({
  team: one(teams, { fields: [localUsers.teamId], references: [teams.id] }),
  players: many(players),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  manager: one(localUsers, { fields: [teams.managerId], references: [localUsers.id] }),
  playerTeams: many(playerTeams),
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
  availabilityRequests: many(availabilityRequests),
  invoices: many(invoices),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  user: one(localUsers, { fields: [players.userId], references: [localUsers.id] }),
  playerTeams: many(playerTeams),
  stats: many(playerStats),
  availabilityResponses: many(availabilityResponses),
  payments: many(payments),
}));

export const playerTeamsRelations = relations(playerTeams, ({ one }) => ({
  player: one(players, { fields: [playerTeams.playerId], references: [players.id] }),
  team: one(teams, { fields: [playerTeams.teamId], references: [teams.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: "awayTeam" }),
  winnerTeam: one(teams, { fields: [matches.winnerTeamId], references: [teams.id] }),
  innings: many(innings),
  playerStats: many(playerStats),
  availabilityRequests: many(availabilityRequests),
  payments: many(payments),
  invoices: many(invoices),
}));

export const inningsRelations = relations(innings, ({ one, many }) => ({
  match: one(matches, { fields: [innings.matchId], references: [matches.id] }),
  battingTeam: one(teams, { fields: [innings.battingTeamId], references: [teams.id] }),
  bowlingTeam: one(teams, { fields: [innings.bowlingTeamId], references: [teams.id] }),
  balls: many(balls),
}));

export const ballsRelations = relations(balls, ({ one }) => ({
  innings: one(innings, { fields: [balls.inningsId], references: [innings.id] }),
  batsman: one(players, { fields: [balls.batsmanId], references: [players.id] }),
  bowler: one(players, { fields: [balls.bowlerId], references: [players.id] }),
  fielderInvolved: one(players, { fields: [balls.fielderInvolvedId], references: [players.id] }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  match: one(matches, { fields: [playerStats.matchId], references: [matches.id] }),
  player: one(players, { fields: [playerStats.playerId], references: [players.id] }),
}));

export const availabilityRequestsRelations = relations(availabilityRequests, ({ one, many }) => ({
  team: one(teams, { fields: [availabilityRequests.teamId], references: [teams.id] }),
  match: one(matches, { fields: [availabilityRequests.matchId], references: [matches.id] }),
  responses: many(availabilityResponses),
}));

export const availabilityResponsesRelations = relations(availabilityResponses, ({ one }) => ({
  request: one(availabilityRequests, { fields: [availabilityResponses.requestId], references: [availabilityRequests.id] }),
  player: one(players, { fields: [availabilityResponses.playerId], references: [players.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  player: one(players, { fields: [payments.playerId], references: [players.id] }),
  match: one(matches, { fields: [payments.matchId], references: [matches.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  team: one(teams, { fields: [invoices.teamId], references: [teams.id] }),
  match: one(matches, { fields: [invoices.matchId], references: [matches.id] }),
}));

export const playerInvitesRelations = relations(playerInvites, ({ one }) => ({
  team: one(teams, { fields: [playerInvites.teamId], references: [teams.id] }),
}));

// Types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Types for local authentication
export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// Auth-related schemas
export const signupFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const signupSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type definitions
export type SignupFormInput = z.infer<typeof signupFormSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

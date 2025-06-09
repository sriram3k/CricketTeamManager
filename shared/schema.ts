import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("player"), // player, manager, admin, corporate
  teamId: integer("team_id"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  managerId: integer("manager_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  position: text("position"), // batsman, bowler, all-rounder, wicket-keeper
  jerseyNumber: integer("jersey_number"),
  isActive: boolean("is_active").default(true),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  date: timestamp("date").notNull(),
  venue: text("venue").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, live, completed, cancelled
  tossWinner: integer("toss_winner"),
  tossDecision: text("toss_decision"), // bat, bowl
  matchType: text("match_type").notNull().default("T20"), // T20, ODI, Test
  totalOvers: integer("total_overs").default(20),
  result: text("result"),
  winnerTeamId: integer("winner_team_id"),
  matchFee: decimal("match_fee", { precision: 10, scale: 2 }),
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
  status: text("status").notNull().default("pending"), // pending, paid, overdue
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  paymentMethod: text("payment_method"),
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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertInningsSchema = createInsertSchema(innings).omit({ id: true });
export const insertBallSchema = createInsertSchema(balls).omit({ id: true });
export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({ id: true });
export const insertAvailabilityRequestSchema = createInsertSchema(availabilityRequests).omit({ id: true });
export const insertAvailabilityResponseSchema = createInsertSchema(availabilityResponses).omit({ id: true, responseDate: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, issueDate: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
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

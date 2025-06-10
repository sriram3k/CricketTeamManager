import {
  users, teams, players, matches, 
  innings as inningsTable, balls, playerStats,
  availabilityRequests, availabilityResponses, payments, invoices, playerInvites,
  type User, type InsertUser, type Team, type InsertTeam,
  type Player, type InsertPlayer, type Match, type InsertMatch,
  type Innings, type InsertInnings, type Ball, type InsertBall,
  type PlayerStats, type InsertPlayerStats,
  type AvailabilityRequest, type InsertAvailabilityRequest,
  type AvailabilityResponse, type InsertAvailabilityResponse,
  type Payment, type InsertPayment, type Invoice, type InsertInvoice,
  type PlayerInvite, type InsertPlayerInvite,
  localUsers
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize sample data on first run
    this.initializeSampleData().catch(console.error);
  }

  private async initializeSampleData() {
    // Check if data already exists in local_users table
    const existingUsers = await db.select().from(localUsers).limit(1);
    if (existingUsers.length > 0) return;

    // Create sample local users with different roles
    const [manager] = await db.insert(localUsers).values({
      username: "manager",
      email: "manager@cricketteam.com",
      passwordHash: "$2b$10$encrypted_password_hash_here",
      firstName: "Team",
      lastName: "Manager",
      role: "admin"
    }).returning();

    const [organizer] = await db.insert(localUsers).values({
      username: "organizer",
      email: "organizer@cricketteam.com", 
      password: "password",
      firstName: "Event",
      lastName: "Organizer",
      role: "organizer"
    }).returning();

    const [player] = await db.insert(localUsers).values({
      username: "player",
      email: "player@cricketteam.com",
      password: "password",
      firstName: "Star",
      lastName: "Player",
      role: "player"
    }).returning();

    // Create sample team
    const [team] = await db.insert(teams).values({
      name: "Mumbai Warriors",
      managerId: manager.id,
      description: "Professional cricket team based in Mumbai"
    }).returning();

    // Update manager's teamId
    await db.update(localUsers).set({ teamId: team.id }).where(eq(localUsers.id, manager.id));

    // Create sample players
    const playerData = [
      { name: "Rohit Sharma", position: "batsman", jerseyNumber: 45, userId: manager.id + 1, teamId: team.id, isActive: true },
      { name: "Jasprit Bumrah", position: "bowler", jerseyNumber: 93, userId: manager.id + 2, teamId: team.id, isActive: true },
      { name: "Hardik Pandya", position: "all-rounder", jerseyNumber: 33, userId: manager.id + 3, teamId: team.id, isActive: true },
      { name: "MS Dhoni", position: "wicket-keeper", jerseyNumber: 7, userId: manager.id + 4, teamId: team.id, isActive: true },
      { name: "Virat Kohli", position: "batsman", jerseyNumber: 18, userId: manager.id + 5, teamId: team.id, isActive: true },
      { name: "Ravindra Jadeja", position: "all-rounder", jerseyNumber: 8, userId: manager.id + 6, teamId: team.id, isActive: true },
      { name: "Shikhar Dhawan", position: "batsman", jerseyNumber: 25, userId: manager.id + 7, teamId: team.id, isActive: true },
      { name: "Mohammed Shami", position: "bowler", jerseyNumber: 11, userId: manager.id + 8, teamId: team.id, isActive: true },
    ];

    const createdPlayers = await db.insert(players).values(playerData).returning();

    // Create sample matches
    const today = new Date();
    const pastMatch = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const futureMatch = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [completedMatch] = await db.insert(matches).values({
      homeTeamId: team.id,
      awayTeamId: team.id + 1,
      date: pastMatch,
      venue: "Wankhede Stadium, Mumbai",
      status: "completed",
      tossWinner: team.id,
      tossDecision: "bat",
      matchType: "T20",
      totalOvers: 20,
      result: "Mumbai Warriors won by 6 wickets",
      winnerTeamId: team.id,
      matchFee: "5000.00"
    }).returning();

    const [upcomingMatch] = await db.insert(matches).values({
      homeTeamId: team.id,
      awayTeamId: team.id + 2,
      date: futureMatch,
      venue: "Eden Gardens, Kolkata",
      status: "scheduled",
      tossWinner: null,
      tossDecision: null,
      matchType: "T20",
      totalOvers: 20,
      result: null,
      winnerTeamId: null,
      matchFee: "6000.00"
    }).returning();

    // Create sample availability request
    await db.insert(availabilityRequests).values({
      teamId: team.id,
      matchId: upcomingMatch.id,
      requestDate: new Date(),
      matchDate: futureMatch,
      venue: "Eden Gardens, Kolkata",
      opponent: "Kolkata Titans",
      deadline: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      message: "Important T20 match against Kolkata Titans. Please confirm your availability."
    });

    // Create sample payments
    await db.insert(payments).values([
      {
        playerId: createdPlayers[0].id,
        matchId: completedMatch.id,
        amount: "500.00",
        status: "pending",
        dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        paidDate: null,
        paymentMethod: null
      },
      {
        playerId: createdPlayers[1].id,
        matchId: completedMatch.id,
        amount: "500.00",
        status: "paid",
        dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        paidDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        paymentMethod: "upi"
      }
    ]);

    // Create sample invoice
    await db.insert(invoices).values({
      teamId: team.id,
      matchId: completedMatch.id,
      invoiceNumber: "INV-2024-001",
      amount: "25000.00",
      description: "Cricket match organizing services including venue booking, equipment, and match officials for T20 match at Wankhede Stadium",
      dueDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
      status: "sent",
      paidDate: null,
      corporateId: 1
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Local Users (email/password auth)
  async getLocalUser(id: number): Promise<any | undefined> {
    const [user] = await db.select().from(localUsers).where(eq(localUsers.id, id));
    return user || undefined;
  }

  async getLocalUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await db.select().from(localUsers).where(eq(localUsers.email, email));
    return user || undefined;
  }

  async getLocalUserByUsername(username: string): Promise<any | undefined> {
    const [user] = await db.select().from(localUsers).where(eq(localUsers.username, username));
    return user || undefined;
  }

  async createLocalUser(userData: any): Promise<any> {
    const [user] = await db.insert(localUsers).values({
      email: userData.email,
      username: userData.username,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || 'player'
    }).returning();
    return user;
  }

  async updateLocalUser(id: number, updates: any): Promise<any | undefined> {
    const [user] = await db.update(localUsers).set(updates).where(eq(localUsers.id, id)).returning();
    return user || undefined;
  }

  async setPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    try {
      await db.update(localUsers)
        .set({ 
          resetPasswordToken: token, 
          resetPasswordExpires: expiresAt 
        })
        .where(eq(localUsers.email, email));
      return true;
    } catch (error) {
      console.error('Error setting reset token:', error);
      return false;
    }
  }

  async getUserByResetToken(token: string): Promise<any | undefined> {
    const [user] = await db.select()
      .from(localUsers)
      .where(eq(localUsers.resetPasswordToken, token));
    return user || undefined;
  }

  async resetPassword(token: string, newPasswordHash: string): Promise<boolean> {
    try {
      const [updated] = await db.update(localUsers)
        .set({ 
          passwordHash: newPasswordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null
        })
        .where(eq(localUsers.resetPasswordToken, token))
        .returning();
      return !!updated;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }

  // Teams
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async getTeamsByManager(managerId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.managerId, managerId));
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(insertTeam).returning();
    return team;
  }

  async updateTeam(id: number, updates: Partial<Team>): Promise<Team | undefined> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    const [team] = await db.update(teams).set(updateData).where(eq(teams.id, id)).returning();
    return team || undefined;
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  // Players
  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getPlayersByTeam(teamId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.teamId, teamId));
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const [player] = await db.insert(players).values(insertPlayer).returning();
    return player;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const [player] = await db.update(players).set(updates).where(eq(players.id, id)).returning();
    return player || undefined;
  }

  async deletePlayer(id: number): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id)).returning();
    return result.length > 0;
  }

  async getActivePlayersByTeam(teamId: number): Promise<Player[]> {
    return await db.select().from(players).where(and(eq(players.teamId, teamId), eq(players.isActive, true)));
  }

  // Matches
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match || undefined;
  }

  async getMatchesByTeam(teamId: number): Promise<Match[]> {
    return await db.select().from(matches).where(
      and(
        eq(matches.homeTeamId, teamId)
      )
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(insertMatch).returning();
    return match;
  }

  async updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined> {
    const [match] = await db.update(matches).set(updates).where(eq(matches.id, id)).returning();
    return match || undefined;
  }

  async deleteMatch(id: number): Promise<boolean> {
    try {
      const result = await db.delete(matches).where(eq(matches.id, id));
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRecentMatches(teamId: number, limit = 10): Promise<Match[]> {
    return await db.select().from(matches)
      .where(eq(matches.homeTeamId, teamId))
      .orderBy(desc(matches.date))
      .limit(limit);
  }

  async getLiveMatches(): Promise<Match[]> {
    return await db.select().from(matches).where(eq(matches.status, "live"));
  }

  async getUpcomingMatches(teamId: number): Promise<Match[]> {
    return await db.select().from(matches)
      .where(and(eq(matches.homeTeamId, teamId), eq(matches.status, "scheduled")))
      .orderBy(matches.date);
  }

  // Innings
  async getInnings(id: number): Promise<Innings | undefined> {
    const [inning] = await db.select().from(inningsTable).where(eq(inningsTable.id, id));
    return inning || undefined;
  }

  async getInningsByMatch(matchId: number): Promise<Innings[]> {
    return await db.select().from(inningsTable).where(eq(inningsTable.matchId, matchId));
  }

  async createInnings(insertInnings: InsertInnings): Promise<Innings> {
    const [inning] = await db.insert(inningsTable).values(insertInnings).returning();
    return inning;
  }

  async updateInnings(id: number, updates: Partial<Innings>): Promise<Innings | undefined> {
    const [inning] = await db.update(inningsTable).set(updates).where(eq(inningsTable.id, id)).returning();
    return inning || undefined;
  }

  // Balls
  async getBall(id: number): Promise<Ball | undefined> {
    const [ball] = await db.select().from(balls).where(eq(balls.id, id));
    return ball || undefined;
  }

  async getBallsByInnings(inningsId: number): Promise<Ball[]> {
    return await db.select().from(balls).where(eq(balls.inningsId, inningsId));
  }

  async createBall(insertBall: InsertBall): Promise<Ball> {
    const [ball] = await db.insert(balls).values(insertBall).returning();
    return ball;
  }

  // Player Stats
  async getPlayerStats(id: number): Promise<PlayerStats | undefined> {
    const [stats] = await db.select().from(playerStats).where(eq(playerStats.id, id));
    return stats || undefined;
  }

  async getPlayerStatsByMatch(matchId: number): Promise<PlayerStats[]> {
    return await db.select().from(playerStats).where(eq(playerStats.matchId, matchId));
  }

  async getPlayerStatsByPlayer(playerId: number): Promise<PlayerStats[]> {
    return await db.select().from(playerStats).where(eq(playerStats.playerId, playerId));
  }

  async createPlayerStats(insertStats: InsertPlayerStats): Promise<PlayerStats> {
    const [stats] = await db.insert(playerStats).values(insertStats).returning();
    return stats;
  }

  async updatePlayerStats(id: number, updates: Partial<PlayerStats>): Promise<PlayerStats | undefined> {
    const [stats] = await db.update(playerStats).set(updates).where(eq(playerStats.id, id)).returning();
    return stats || undefined;
  }

  // Availability
  async getAvailabilityRequest(id: number): Promise<AvailabilityRequest | undefined> {
    const [request] = await db.select().from(availabilityRequests).where(eq(availabilityRequests.id, id));
    return request || undefined;
  }

  async getAvailabilityRequestsByTeam(teamId: number): Promise<AvailabilityRequest[]> {
    return await db.select().from(availabilityRequests).where(eq(availabilityRequests.teamId, teamId));
  }

  async createAvailabilityRequest(insertRequest: InsertAvailabilityRequest): Promise<AvailabilityRequest> {
    const [request] = await db.insert(availabilityRequests).values(insertRequest).returning();
    return request;
  }

  async getAvailabilityResponsesByRequest(requestId: number): Promise<AvailabilityResponse[]> {
    return await db.select().from(availabilityResponses).where(eq(availabilityResponses.requestId, requestId));
  }

  async createAvailabilityResponse(insertResponse: InsertAvailabilityResponse): Promise<AvailabilityResponse> {
    const [response] = await db.insert(availabilityResponses).values(insertResponse).returning();
    return response;
  }

  async getPlayerAvailabilityForRequest(requestId: number, playerId: number): Promise<AvailabilityResponse | undefined> {
    const [response] = await db.select().from(availabilityResponses)
      .where(and(eq(availabilityResponses.requestId, requestId), eq(availabilityResponses.playerId, playerId)));
    return response || undefined;
  }

  // Payments
  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentsByPlayer(playerId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.playerId, playerId));
  }

  async getPaymentsByMatch(matchId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.matchId, matchId));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(updates).where(eq(payments.id, id)).returning();
    return payment || undefined;
  }

  async getPendingPaymentsByTeam(teamId: number): Promise<Payment[]> {
    // Get player IDs for the team first
    const teamPlayers = await db.select({ id: players.id }).from(players).where(eq(players.teamId, teamId));
    const playerIds = teamPlayers.map(p => p.id);
    
    if (playerIds.length === 0) return [];
    
    // Get pending payments for those players
    return await db.select().from(payments)
      .where(and(
        eq(payments.status, "pending"),
        inArray(payments.playerId, playerIds)
      ));
  }

  // Invoices
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoicesByTeam(teamId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.teamId, teamId));
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async getPendingInvoicesByTeam(teamId: number): Promise<Invoice[]> {
    return await db.select().from(invoices)
      .where(and(eq(invoices.teamId, teamId), eq(invoices.status, "sent")));
  }

  // Player Invites
  async getPlayerInvite(id: number): Promise<PlayerInvite | undefined> {
    const [invite] = await db.select().from(playerInvites).where(eq(playerInvites.id, id));
    return invite || undefined;
  }

  async getPlayerInviteByToken(token: string): Promise<PlayerInvite | undefined> {
    const [invite] = await db.select().from(playerInvites).where(eq(playerInvites.token, token));
    return invite || undefined;
  }

  async getPlayerInvitesByTeam(teamId: number): Promise<PlayerInvite[]> {
    return await db.select().from(playerInvites)
      .where(eq(playerInvites.teamId, teamId))
      .orderBy(desc(playerInvites.createdAt));
  }

  async createPlayerInvite(invite: InsertPlayerInvite & { token: string; expiresAt: Date }): Promise<PlayerInvite> {
    const [playerInvite] = await db.insert(playerInvites).values(invite).returning();
    return playerInvite;
  }

  async updatePlayerInviteStatus(id: number, status: string, acceptedAt?: Date): Promise<PlayerInvite | undefined> {
    const updates: Partial<PlayerInvite> = { status };
    if (acceptedAt) {
      updates.acceptedAt = acceptedAt;
    }
    const [invite] = await db.update(playerInvites).set(updates).where(eq(playerInvites.id, id)).returning();
    return invite || undefined;
  }

  async deleteExpiredInvites(): Promise<void> {
    await db.delete(playerInvites).where(sql`${playerInvites.expiresAt} < NOW()`);
  }
}
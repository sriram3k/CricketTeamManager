import {
  users, teams, players, matches, innings, balls, playerStats,
  availabilityRequests, availabilityResponses, payments, invoices,
  type User, type InsertUser, type Team, type InsertTeam,
  type Player, type InsertPlayer, type Match, type InsertMatch,
  type Innings, type InsertInnings, type Ball, type InsertBall,
  type PlayerStats, type InsertPlayerStats,
  type AvailabilityRequest, type InsertAvailabilityRequest,
  type AvailabilityResponse, type InsertAvailabilityResponse,
  type Payment, type InsertPayment, type Invoice, type InsertInvoice
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";

export interface IStorage {
  // Replit Auth Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Local Users (email/password auth)
  getLocalUser(id: number): Promise<LocalUser | undefined>;
  getLocalUserByEmail(email: string): Promise<LocalUser | undefined>;
  getLocalUserByUsername(username: string): Promise<LocalUser | undefined>;
  createLocalUser(user: InsertLocalUser): Promise<LocalUser>;
  updateLocalUser(id: number, updates: Partial<LocalUser>): Promise<LocalUser | undefined>;

  // Teams
  getTeam(id: number): Promise<Team | undefined>;
  getTeamsByManager(managerId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  getAllTeams(): Promise<Team[]>;

  // Players
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByTeam(teamId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: number): Promise<boolean>;
  getActivePlayersByTeam(teamId: number): Promise<Player[]>;

  // Matches
  getMatch(id: number): Promise<Match | undefined>;
  getMatchesByTeam(teamId: number): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined>;
  deleteMatch(id: number): Promise<boolean>;
  getRecentMatches(teamId: number, limit?: number): Promise<Match[]>;
  getLiveMatches(): Promise<Match[]>;
  getUpcomingMatches(teamId: number): Promise<Match[]>;

  // Innings
  getInnings(id: number): Promise<Innings | undefined>;
  getInningsByMatch(matchId: number): Promise<Innings[]>;
  createInnings(innings: InsertInnings): Promise<Innings>;
  updateInnings(id: number, updates: Partial<Innings>): Promise<Innings | undefined>;

  // Balls
  getBall(id: number): Promise<Ball | undefined>;
  getBallsByInnings(inningsId: number): Promise<Ball[]>;
  createBall(ball: InsertBall): Promise<Ball>;

  // Player Stats
  getPlayerStats(id: number): Promise<PlayerStats | undefined>;
  getPlayerStatsByMatch(matchId: number): Promise<PlayerStats[]>;
  getPlayerStatsByPlayer(playerId: number): Promise<PlayerStats[]>;
  createPlayerStats(stats: InsertPlayerStats): Promise<PlayerStats>;
  updatePlayerStats(id: number, updates: Partial<PlayerStats>): Promise<PlayerStats | undefined>;

  // Availability
  getAvailabilityRequest(id: number): Promise<AvailabilityRequest | undefined>;
  getAvailabilityRequestsByTeam(teamId: number): Promise<AvailabilityRequest[]>;
  createAvailabilityRequest(request: InsertAvailabilityRequest): Promise<AvailabilityRequest>;
  getAvailabilityResponsesByRequest(requestId: number): Promise<AvailabilityResponse[]>;
  createAvailabilityResponse(response: InsertAvailabilityResponse): Promise<AvailabilityResponse>;
  getPlayerAvailabilityForRequest(requestId: number, playerId: number): Promise<AvailabilityResponse | undefined>;

  // Payments
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentsByPlayer(playerId: number): Promise<Payment[]>;
  getPaymentsByMatch(matchId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined>;
  getPendingPaymentsByTeam(teamId: number): Promise<Payment[]>;

  // Invoices
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoicesByTeam(teamId: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  getPendingInvoicesByTeam(teamId: number): Promise<Invoice[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private teams: Map<number, Team> = new Map();
  private players: Map<number, Player> = new Map();
  private matches: Map<number, Match> = new Map();
  private innings: Map<number, Innings> = new Map();
  private balls: Map<number, Ball> = new Map();
  private playerStats: Map<number, PlayerStats> = new Map();
  private availabilityRequests: Map<number, AvailabilityRequest> = new Map();
  private availabilityResponses: Map<number, AvailabilityResponse> = new Map();
  private payments: Map<number, Payment> = new Map();
  private invoices: Map<number, Invoice> = new Map();

  private currentUserId = 1;
  private currentTeamId = 1;
  private currentPlayerId = 1;
  private currentMatchId = 1;
  private currentInningsId = 1;
  private currentBallId = 1;
  private currentPlayerStatsId = 1;
  private currentAvailabilityRequestId = 1;
  private currentAvailabilityResponseId = 1;
  private currentPaymentId = 1;
  private currentInvoiceId = 1;

  constructor() {
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Create sample users with await to ensure proper sequencing
    await this.createUser({
      username: "manager",
      password: "password",
      role: "manager",
      teamId: 1
    });

    // Create sample team
    await this.createTeam({
      name: "Mumbai Warriors",
      managerId: 1,
      description: "Professional cricket team based in Mumbai"
    });

    // Create sample players
    const players = [
      { name: "Rohit Sharma", position: "batsman", jerseyNumber: 45, userId: 2, teamId: 1, isActive: true },
      { name: "Jasprit Bumrah", position: "bowler", jerseyNumber: 93, userId: 3, teamId: 1, isActive: true },
      { name: "Hardik Pandya", position: "all-rounder", jerseyNumber: 33, userId: 4, teamId: 1, isActive: true },
      { name: "MS Dhoni", position: "wicket-keeper", jerseyNumber: 7, userId: 5, teamId: 1, isActive: true },
      { name: "Virat Kohli", position: "batsman", jerseyNumber: 18, userId: 6, teamId: 1, isActive: true },
      { name: "Ravindra Jadeja", position: "all-rounder", jerseyNumber: 8, userId: 7, teamId: 1, isActive: true },
      { name: "Shikhar Dhawan", position: "batsman", jerseyNumber: 25, userId: 8, teamId: 1, isActive: true },
      { name: "Mohammed Shami", position: "bowler", jerseyNumber: 11, userId: 9, teamId: 1, isActive: true },
    ];

    for (const player of players) {
      await this.createPlayer(player);
    }

    // Create sample matches
    const today = new Date();
    const pastMatch = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const futureMatch = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    await this.createMatch({
      homeTeamId: 1,
      awayTeamId: 2,
      date: pastMatch,
      venue: "Wankhede Stadium, Mumbai",
      status: "completed",
      tossWinner: 1,
      tossDecision: "bat",
      matchType: "T20",
      totalOvers: 20,
      result: "Mumbai Warriors won by 6 wickets",
      winnerTeamId: 1,
      matchFee: "5000.00"
    });

    await this.createMatch({
      homeTeamId: 1,
      awayTeamId: 3,
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
    });

    // Create sample availability request
    await this.createAvailabilityRequest({
      teamId: 1,
      matchId: 2,
      requestDate: new Date(),
      matchDate: futureMatch,
      venue: "Eden Gardens, Kolkata",
      opponent: "Kolkata Titans",
      deadline: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      message: "Important T20 match against Kolkata Titans. Please confirm your availability."
    });

    // Create sample payments
    await this.createPayment({
      playerId: 1,
      matchId: 1,
      amount: "500.00",
      status: "pending",
      dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      paidDate: null,
      paymentMethod: null
    });

    await this.createPayment({
      playerId: 2,
      matchId: 1,
      amount: "500.00",
      status: "paid",
      dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      paidDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      paymentMethod: "upi"
    });

    // Create sample invoice
    await this.createInvoice({
      teamId: 1,
      matchId: 1,
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
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { 
      ...insertUser, 
      id: this.currentUserId++,
      role: insertUser.role || "player",
      teamId: insertUser.teamId || null
    };
    this.users.set(user.id, user);
    return user;
  }

  // Teams
  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getTeamsByManager(managerId: number): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.managerId === managerId);
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const team: Team = { 
      ...insertTeam, 
      id: this.currentTeamId++,
      createdAt: new Date(),
      description: insertTeam.description || null
    };
    this.teams.set(team.id, team);
    return team;
  }

  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  // Players
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByTeam(teamId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.teamId === teamId);
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const player: Player = { ...insertPlayer, id: this.currentPlayerId++ };
    this.players.set(player.id, player);
    return player;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;
    const updatedPlayer = { ...player, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async deletePlayer(id: number): Promise<boolean> {
    return this.players.delete(id);
  }

  async getActivePlayersByTeam(teamId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      player => player.teamId === teamId && player.isActive
    );
  }

  // Matches
  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getMatchesByTeam(teamId: number): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      match => match.homeTeamId === teamId || match.awayTeamId === teamId
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const match: Match = { ...insertMatch, id: this.currentMatchId++ };
    this.matches.set(match.id, match);
    return match;
  }

  async updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    const updatedMatch = { ...match, ...updates };
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }

  async deleteMatch(id: number): Promise<boolean> {
    return this.matches.delete(id);
  }

  async getRecentMatches(teamId: number, limit = 10): Promise<Match[]> {
    return Array.from(this.matches.values())
      .filter(match => match.homeTeamId === teamId || match.awayTeamId === teamId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async getLiveMatches(): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(match => match.status === 'live');
  }

  async getUpcomingMatches(teamId: number): Promise<Match[]> {
    return Array.from(this.matches.values())
      .filter(match => 
        (match.homeTeamId === teamId || match.awayTeamId === teamId) && 
        match.status === 'scheduled'
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Innings
  async getInnings(id: number): Promise<Innings | undefined> {
    return this.innings.get(id);
  }

  async getInningsByMatch(matchId: number): Promise<Innings[]> {
    return Array.from(this.innings.values()).filter(innings => innings.matchId === matchId);
  }

  async createInnings(insertInnings: InsertInnings): Promise<Innings> {
    const innings: Innings = { ...insertInnings, id: this.currentInningsId++ };
    this.innings.set(innings.id, innings);
    return innings;
  }

  async updateInnings(id: number, updates: Partial<Innings>): Promise<Innings | undefined> {
    const innings = this.innings.get(id);
    if (!innings) return undefined;
    const updatedInnings = { ...innings, ...updates };
    this.innings.set(id, updatedInnings);
    return updatedInnings;
  }

  // Balls
  async getBall(id: number): Promise<Ball | undefined> {
    return this.balls.get(id);
  }

  async getBallsByInnings(inningsId: number): Promise<Ball[]> {
    return Array.from(this.balls.values())
      .filter(ball => ball.inningsId === inningsId)
      .sort((a, b) => {
        if (a.overNumber !== b.overNumber) return a.overNumber - b.overNumber;
        return a.ballNumber - b.ballNumber;
      });
  }

  async createBall(insertBall: InsertBall): Promise<Ball> {
    const ball: Ball = { ...insertBall, id: this.currentBallId++ };
    this.balls.set(ball.id, ball);
    return ball;
  }

  // Player Stats
  async getPlayerStats(id: number): Promise<PlayerStats | undefined> {
    return this.playerStats.get(id);
  }

  async getPlayerStatsByMatch(matchId: number): Promise<PlayerStats[]> {
    return Array.from(this.playerStats.values()).filter(stats => stats.matchId === matchId);
  }

  async getPlayerStatsByPlayer(playerId: number): Promise<PlayerStats[]> {
    return Array.from(this.playerStats.values()).filter(stats => stats.playerId === playerId);
  }

  async createPlayerStats(insertStats: InsertPlayerStats): Promise<PlayerStats> {
    const stats: PlayerStats = { ...insertStats, id: this.currentPlayerStatsId++ };
    this.playerStats.set(stats.id, stats);
    return stats;
  }

  async updatePlayerStats(id: number, updates: Partial<PlayerStats>): Promise<PlayerStats | undefined> {
    const stats = this.playerStats.get(id);
    if (!stats) return undefined;
    const updatedStats = { ...stats, ...updates };
    this.playerStats.set(id, updatedStats);
    return updatedStats;
  }

  // Availability
  async getAvailabilityRequest(id: number): Promise<AvailabilityRequest | undefined> {
    return this.availabilityRequests.get(id);
  }

  async getAvailabilityRequestsByTeam(teamId: number): Promise<AvailabilityRequest[]> {
    return Array.from(this.availabilityRequests.values())
      .filter(request => request.teamId === teamId)
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  async createAvailabilityRequest(insertRequest: InsertAvailabilityRequest): Promise<AvailabilityRequest> {
    const request: AvailabilityRequest = { ...insertRequest, id: this.currentAvailabilityRequestId++ };
    this.availabilityRequests.set(request.id, request);
    return request;
  }

  async getAvailabilityResponsesByRequest(requestId: number): Promise<AvailabilityResponse[]> {
    return Array.from(this.availabilityResponses.values()).filter(response => response.requestId === requestId);
  }

  async createAvailabilityResponse(insertResponse: InsertAvailabilityResponse): Promise<AvailabilityResponse> {
    const response: AvailabilityResponse = { 
      ...insertResponse, 
      id: this.currentAvailabilityResponseId++,
      responseDate: new Date()
    };
    this.availabilityResponses.set(response.id, response);
    return response;
  }

  async getPlayerAvailabilityForRequest(requestId: number, playerId: number): Promise<AvailabilityResponse | undefined> {
    return Array.from(this.availabilityResponses.values()).find(
      response => response.requestId === requestId && response.playerId === playerId
    );
  }

  // Payments
  async getPayment(id: number): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentsByPlayer(playerId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => payment.playerId === playerId);
  }

  async getPaymentsByMatch(matchId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => payment.matchId === matchId);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const payment: Payment = { ...insertPayment, id: this.currentPaymentId++ };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    const updatedPayment = { ...payment, ...updates };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async getPendingPaymentsByTeam(teamId: number): Promise<Payment[]> {
    const teamPlayers = await this.getPlayersByTeam(teamId);
    const playerIds = teamPlayers.map(p => p.id);
    return Array.from(this.payments.values()).filter(
      payment => playerIds.includes(payment.playerId) && payment.status === 'pending'
    );
  }

  // Invoices
  async getInvoice(id: number): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getInvoicesByTeam(teamId: number): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(invoice => invoice.teamId === teamId)
      .sort((a, b) => new Date(b.issueDate!).getTime() - new Date(a.issueDate!).getTime());
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const invoice: Invoice = { 
      ...insertInvoice, 
      id: this.currentInvoiceId++,
      issueDate: new Date()
    };
    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    const updatedInvoice = { ...invoice, ...updates };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async getPendingInvoicesByTeam(teamId: number): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      invoice => invoice.teamId === teamId && invoice.status !== 'paid'
    );
  }
}

// Import the database storage implementation
import { DatabaseStorage } from "./storage-db";

export const storage = new DatabaseStorage();

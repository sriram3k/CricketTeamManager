import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema, insertTeamSchema, insertPlayerSchema, insertMatchSchema,
  insertInningsSchema, insertBallSchema, insertPlayerStatsSchema,
  insertAvailabilityRequestSchema, insertAvailabilityResponseSchema,
  insertPaymentSchema, insertInvoiceSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Teams
  app.get("/api/teams", async (req, res) => {
    const teams = await storage.getAllTeams();
    res.json(teams);
  });

  app.get("/api/teams/:id", async (req, res) => {
    const team = await storage.getTeam(parseInt(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found" });
    res.json(team);
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.status(201).json(team);
    } catch (error) {
      res.status(400).json({ message: "Invalid team data", error });
    }
  });

  // Players
  app.get("/api/teams/:teamId/players", async (req, res) => {
    const players = await storage.getPlayersByTeam(parseInt(req.params.teamId));
    res.json(players);
  });

  app.get("/api/teams/:teamId/players/active", async (req, res) => {
    const players = await storage.getActivePlayersByTeam(parseInt(req.params.teamId));
    res.json(players);
  });

  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer(playerData);
      res.status(201).json(player);
    } catch (error) {
      res.status(400).json({ message: "Invalid player data", error });
    }
  });

  app.put("/api/players/:id", async (req, res) => {
    const player = await storage.updatePlayer(parseInt(req.params.id), req.body);
    if (!player) return res.status(404).json({ message: "Player not found" });
    res.json(player);
  });

  app.delete("/api/players/:id", async (req, res) => {
    const deleted = await storage.deletePlayer(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Player not found" });
    res.json({ message: "Player deleted successfully" });
  });

  // Matches
  app.get("/api/teams/:teamId/matches", async (req, res) => {
    const matches = await storage.getMatchesByTeam(parseInt(req.params.teamId));
    res.json(matches);
  });

  app.get("/api/teams/:teamId/matches/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const matches = await storage.getRecentMatches(parseInt(req.params.teamId), limit);
    res.json(matches);
  });

  app.get("/api/teams/:teamId/matches/upcoming", async (req, res) => {
    const matches = await storage.getUpcomingMatches(parseInt(req.params.teamId));
    res.json(matches);
  });

  app.get("/api/matches/live", async (req, res) => {
    const matches = await storage.getLiveMatches();
    res.json(matches);
  });

  app.get("/api/matches/:id", async (req, res) => {
    const match = await storage.getMatch(parseInt(req.params.id));
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  });

  app.post("/api/matches", async (req, res) => {
    try {
      const matchData = insertMatchSchema.parse(req.body);
      const match = await storage.createMatch(matchData);
      res.status(201).json(match);
    } catch (error) {
      res.status(400).json({ message: "Invalid match data", error });
    }
  });

  app.put("/api/matches/:id", async (req, res) => {
    const match = await storage.updateMatch(parseInt(req.params.id), req.body);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  });

  // Innings
  app.get("/api/matches/:matchId/innings", async (req, res) => {
    const innings = await storage.getInningsByMatch(parseInt(req.params.matchId));
    res.json(innings);
  });

  app.post("/api/innings", async (req, res) => {
    try {
      const inningsData = insertInningsSchema.parse(req.body);
      const innings = await storage.createInnings(inningsData);
      res.status(201).json(innings);
    } catch (error) {
      res.status(400).json({ message: "Invalid innings data", error });
    }
  });

  app.put("/api/innings/:id", async (req, res) => {
    const innings = await storage.updateInnings(parseInt(req.params.id), req.body);
    if (!innings) return res.status(404).json({ message: "Innings not found" });
    res.json(innings);
  });

  // Balls
  app.get("/api/innings/:inningsId/balls", async (req, res) => {
    const balls = await storage.getBallsByInnings(parseInt(req.params.inningsId));
    res.json(balls);
  });

  app.post("/api/balls", async (req, res) => {
    try {
      const ballData = insertBallSchema.parse(req.body);
      const ball = await storage.createBall(ballData);
      res.status(201).json(ball);
    } catch (error) {
      res.status(400).json({ message: "Invalid ball data", error });
    }
  });

  // Player Stats
  app.get("/api/matches/:matchId/stats", async (req, res) => {
    const stats = await storage.getPlayerStatsByMatch(parseInt(req.params.matchId));
    res.json(stats);
  });

  app.get("/api/players/:playerId/stats", async (req, res) => {
    const stats = await storage.getPlayerStatsByPlayer(parseInt(req.params.playerId));
    res.json(stats);
  });

  app.post("/api/player-stats", async (req, res) => {
    try {
      const statsData = insertPlayerStatsSchema.parse(req.body);
      const stats = await storage.createPlayerStats(statsData);
      res.status(201).json(stats);
    } catch (error) {
      res.status(400).json({ message: "Invalid player stats data", error });
    }
  });

  app.put("/api/player-stats/:id", async (req, res) => {
    const stats = await storage.updatePlayerStats(parseInt(req.params.id), req.body);
    if (!stats) return res.status(404).json({ message: "Player stats not found" });
    res.json(stats);
  });

  // Availability Requests
  app.get("/api/teams/:teamId/availability-requests", async (req, res) => {
    const requests = await storage.getAvailabilityRequestsByTeam(parseInt(req.params.teamId));
    res.json(requests);
  });

  app.post("/api/availability-requests", async (req, res) => {
    try {
      const requestData = insertAvailabilityRequestSchema.parse(req.body);
      const request = await storage.createAvailabilityRequest(requestData);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ message: "Invalid availability request data", error });
    }
  });

  // Availability Responses
  app.get("/api/availability-requests/:requestId/responses", async (req, res) => {
    const responses = await storage.getAvailabilityResponsesByRequest(parseInt(req.params.requestId));
    res.json(responses);
  });

  app.post("/api/availability-responses", async (req, res) => {
    try {
      const responseData = insertAvailabilityResponseSchema.parse(req.body);
      const response = await storage.createAvailabilityResponse(responseData);
      res.status(201).json(response);
    } catch (error) {
      res.status(400).json({ message: "Invalid availability response data", error });
    }
  });

  app.get("/api/availability-requests/:requestId/players/:playerId", async (req, res) => {
    const response = await storage.getPlayerAvailabilityForRequest(
      parseInt(req.params.requestId),
      parseInt(req.params.playerId)
    );
    res.json(response);
  });

  // Payments
  app.get("/api/players/:playerId/payments", async (req, res) => {
    const payments = await storage.getPaymentsByPlayer(parseInt(req.params.playerId));
    res.json(payments);
  });

  app.get("/api/matches/:matchId/payments", async (req, res) => {
    const payments = await storage.getPaymentsByMatch(parseInt(req.params.matchId));
    res.json(payments);
  });

  app.get("/api/teams/:teamId/payments/pending", async (req, res) => {
    const payments = await storage.getPendingPaymentsByTeam(parseInt(req.params.teamId));
    res.json(payments);
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data", error });
    }
  });

  app.put("/api/payments/:id", async (req, res) => {
    try {
      // Transform date strings to Date objects
      const updates = { ...req.body };
      if (updates.dueDate && typeof updates.dueDate === 'string') {
        updates.dueDate = new Date(updates.dueDate);
      }
      if (updates.paidDate && typeof updates.paidDate === 'string') {
        updates.paidDate = new Date(updates.paidDate);
      }
      
      const payment = await storage.updatePayment(parseInt(req.params.id), updates);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      res.json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment update data", error });
    }
  });

  // Invoices
  app.get("/api/teams/:teamId/invoices", async (req, res) => {
    const invoices = await storage.getInvoicesByTeam(parseInt(req.params.teamId));
    res.json(invoices);
  });

  app.get("/api/teams/:teamId/invoices/pending", async (req, res) => {
    const invoices = await storage.getPendingInvoicesByTeam(parseInt(req.params.teamId));
    res.json(invoices);
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice data", error });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      // Transform date strings to Date objects
      const updates = { ...req.body };
      if (updates.dueDate && typeof updates.dueDate === 'string') {
        updates.dueDate = new Date(updates.dueDate);
      }
      if (updates.paidDate && typeof updates.paidDate === 'string') {
        updates.paidDate = new Date(updates.paidDate);
      }
      
      const invoice = await storage.updateInvoice(parseInt(req.params.id), updates);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice update data", error });
    }
  });

  // Dashboard Stats
  app.get("/api/teams/:teamId/dashboard-stats", async (req, res) => {
    const teamId = parseInt(req.params.teamId);
    
    const matches = await storage.getMatchesByTeam(teamId);
    const wonMatches = matches.filter(m => m.winnerTeamId === teamId && m.status === 'completed');
    const activePlayers = await storage.getActivePlayersByTeam(teamId);
    const upcomingMatches = await storage.getUpcomingMatches(teamId);
    const pendingPayments = await storage.getPendingPaymentsByTeam(teamId);
    
    const pendingAmount = pendingPayments.reduce((total, payment) => 
      total + (payment.amount ? parseFloat(payment.amount.toString()) : 0), 0
    );

    res.json({
      matchesWon: wonMatches.length,
      activePlayers: activePlayers.length,
      upcomingMatches: upcomingMatches.length,
      pendingPayments: pendingAmount
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { DatabaseStorage } from "./storage-db";

const storage = new DatabaseStorage();
import { setupAuth, isAuthenticated } from "./replitAuth";
import { registerInviteRoutes } from "./inviteRoutes";
import { z } from "zod";
import { db } from "./db";
import { players } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  insertUserSchema, insertTeamSchema, insertPlayerSchema, insertMatchSchema,
  insertInningsSchema, insertBallSchema, insertPlayerStatsSchema,
  insertAvailabilityRequestSchema, insertAvailabilityResponseSchema,
  insertPaymentSchema, insertInvoiceSchema, loginSchema, signupSchema, forgotPasswordSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check for local user session first
      if (req.session?.localUser) {
        const localUser = req.session.localUser;
        return res.json({
          id: localUser.id,
          email: localUser.email,
          username: localUser.username,
          firstName: localUser.firstName,
          lastName: localUser.lastName
        });
      }

      // Then check for Replit Auth
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        return res.json(user);
      }

      // No valid session found
      res.status(401).json({ message: "Unauthorized" });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Local authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getLocalUserByEmail(email);
      
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create a simple session for local users
      (req as any).session.localUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      };

      // Force session save
      (req as any).session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Session creation failed" });
        }
        res.json({ user: { id: user.id, email: user.email, username: user.username } });
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const userData = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getLocalUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createLocalUser({
        ...userData,
        passwordHash,
      });

      // Create session for the new user
      (req as any).session.localUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      };

      // Force session save
      (req as any).session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Session creation failed" });
        }
        res.status(201).json({ user: { id: user.id, email: user.email, username: user.username } });
      });
    } catch (error) {
      console.error("Signup error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: "Invalid signup data", error: error.message });
      } else {
        res.status(400).json({ message: "Invalid signup data" });
      }
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const user = await storage.getLocalUserByEmail(email);
      
      if (user) {
        const { generateResetToken, sendPasswordResetEmail } = await import('./passwordResetService');
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        
        // Save reset token to database
        const tokenSaved = await storage.setPasswordResetToken(email, resetToken, expiresAt);
        
        if (tokenSaved) {
          // Send password reset email
          const emailSent = await sendPasswordResetEmail({
            to: email,
            resetToken,
            userName: user.firstName || user.username || 'User'
          });
          
          if (!emailSent) {
            console.warn(`Password reset email could not be sent to ${email}, but token was saved`);
          }
        }
      }
      
      // Always return success to prevent email enumeration
      res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(400).json({ message: "Invalid email" });
    }
  });

  // Password reset route
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
        return res.status(400).json({ message: "Reset token has expired" });
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Update password and clear reset token
      const resetSuccess = await storage.resetPassword(token, passwordHash);
      
      if (resetSuccess) {
        res.json({ message: "Password has been reset successfully" });
      } else {
        res.status(500).json({ message: "Failed to reset password" });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Temporary endpoint to generate reset token (remove after SendGrid is configured)
  app.post('/api/auth/generate-reset-token', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getLocalUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { generateResetToken } = await import('./passwordResetService');
      const resetToken = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Save reset token to database
      const tokenSaved = await storage.setPasswordResetToken(email, resetToken, expiresAt);
      
      if (tokenSaved) {
        const resetUrl = `http://localhost:5000/reset-password?token=${resetToken}`;
        res.json({ 
          message: "Reset token generated successfully",
          resetUrl,
          token: resetToken,
          expiresAt: expiresAt.toISOString()
        });
      } else {
        res.status(500).json({ message: "Failed to generate reset token" });
      }
    } catch (error) {
      console.error("Generate reset token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Team creation error:", error);
        res.status(500).json({ message: "Failed to create team" });
      }
    }
  });

  app.put("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertTeamSchema.partial().parse(req.body);
      
      // Check if team exists
      const existingTeam = await storage.getTeam(id);
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }

      const updatedTeam = await storage.updateTeam(id, updates);
      if (updatedTeam) {
        res.json(updatedTeam);
      } else {
        res.status(500).json({ message: "Failed to update team" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Team update error:", error);
        res.status(500).json({ message: "Failed to update team" });
      }
    }
  });

  app.get("/api/teams/manager/:managerId", async (req, res) => {
    try {
      const managerId = parseInt(req.params.managerId);
      const teams = await storage.getTeamsByManager(managerId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams by manager:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if team exists
      const existingTeam = await storage.getTeam(id);
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }

      const deleted = await storage.deleteTeam(id);
      if (deleted) {
        res.json({ message: "Team deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete team" });
      }
    } catch (error) {
      console.error("Team deletion error:", error);
      res.status(500).json({ message: "Failed to delete team" });
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

  app.get("/api/players", async (req, res) => {
    try {
      // Get all players for multi-team management
      const allPlayers = await db.select({
        id: players.id,
        name: players.name,
        email: players.email,
        phone: players.phone,
        preferredPosition: players.preferredPosition,
        battingStyle: players.battingStyle,
        bowlingStyle: players.bowlingStyle,
        isActive: players.isActive,
        createdAt: players.createdAt,
      }).from(players).where(eq(players.isActive, true));
      
      res.json(allPlayers);
    } catch (error) {
      console.error("Error fetching all players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  app.get("/api/players/:id/teams", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const playerTeams = await storage.getPlayerTeams(playerId);
      res.json(playerTeams);
    } catch (error) {
      console.error("Error fetching player teams:", error);
      res.status(500).json({ message: "Failed to fetch player teams" });
    }
  });

  app.post("/api/players", async (req, res) => {
    try {
      const { teams, ...playerData } = req.body;
      
      // Create the player first
      const player = await storage.createPlayer(playerData);
      
      // If teams are specified, add player to those teams
      if (teams && Array.isArray(teams)) {
        for (const teamAssignment of teams) {
          await storage.addPlayerToTeam(player.id, teamAssignment.teamId, {
            jerseyNumber: teamAssignment.jerseyNumber,
            position: teamAssignment.position,
            isActive: true
          });
        }
      }
      
      res.status(201).json(player);
    } catch (error) {
      console.error("Error creating player:", error);
      res.status(400).json({ message: "Invalid player data", error });
    }
  });

  app.post("/api/players/:id/teams", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const { teamId, jerseyNumber, position } = req.body;
      
      const playerTeam = await storage.addPlayerToTeam(playerId, teamId, {
        jerseyNumber,
        position,
        isActive: true
      });
      
      res.json(playerTeam);
    } catch (error) {
      console.error("Error adding player to team:", error);
      res.status(400).json({ message: "Failed to add player to team" });
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

  app.get("/api/matches/team/:teamId", async (req, res) => {
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
    try {
      // Transform date strings to Date objects
      const updates = { ...req.body };
      if (updates.date && typeof updates.date === 'string') {
        updates.date = new Date(updates.date);
      }
      
      const match = await storage.updateMatch(parseInt(req.params.id), updates);
      if (!match) return res.status(404).json({ message: "Match not found" });
      res.json(match);
    } catch (error) {
      res.status(400).json({ message: "Invalid match update data", error });
    }
  });

  app.delete("/api/matches/:id", async (req, res) => {
    try {
      const success = await storage.deleteMatch(parseInt(req.params.id));
      if (!success) return res.status(404).json({ message: "Match not found" });
      res.json({ message: "Match deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete match", error });
    }
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

  app.get("/api/availability/team/:teamId", async (req, res) => {
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

  // Register invite routes
  registerInviteRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { DatabaseStorage } from "./storage-db";

const storage = new DatabaseStorage();
import { sendPlayerInviteEmail } from "./emailService";
import { insertPlayerInviteSchema } from "@shared/schema";

const inviteFormSchema = z.object({
  teamId: z.number(),
  email: z.string().email("Invalid email address"),
  inviterName: z.string().min(1, "Inviter name is required"),
  teamName: z.string().min(1, "Team name is required"),
  position: z.string().optional(),
  message: z.string().optional(),
});

export function registerInviteRoutes(app: Express) {
  // Send player invitation
  app.post("/api/invites/send", async (req, res) => {
    try {
      const validatedData = inviteFormSchema.parse(req.body);
      const teamId = validatedData.teamId;

      // Generate unique token and expiration (7 days from now)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invite in database
      const inviteData = {
        teamId,
        email: validatedData.email,
        inviterName: validatedData.inviterName,
        teamName: validatedData.teamName,
        position: validatedData.position || null,
        message: validatedData.message || null,
        status: 'pending',
        token,
        expiresAt,
      };
      
      const invite = await storage.createPlayerInvite(inviteData);

      // Generate invite URL
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.hostname}` 
        : `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;
      const inviteUrl = `${baseUrl}/invite/${token}`;

      // Send email invitation
      const emailSent = await sendPlayerInviteEmail({
        to: validatedData.email,
        inviterName: validatedData.inviterName,
        teamName: validatedData.teamName,
        position: validatedData.position,
        message: validatedData.message,
        inviteUrl,
      });

      if (emailSent) {
        res.status(201).json({
          message: "Invitation sent successfully",
          invite: {
            id: invite.id,
            email: invite.email,
            teamName: invite.teamName,
            status: invite.status,
          }
        });
      } else {
        res.status(500).json({ 
          message: "Failed to send invitation email" 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      } else {
        console.error("Invite error:", error);
        res.status(500).json({ 
          message: "Failed to send invitation" 
        });
      }
    }
  });

  // Send player invitation (original route)
  app.post("/api/teams/:teamId/invite", async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const validatedData = inviteFormSchema.parse(req.body);

      // Generate unique token and expiration (7 days from now)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invite in database
      const inviteData = {
        teamId,
        email: validatedData.email,
        inviterName: validatedData.inviterName,
        teamName: validatedData.teamName,
        position: validatedData.position || null,
        message: validatedData.message || null,
        status: 'pending',
        token,
        expiresAt,
      };
      
      const invite = await storage.createPlayerInvite(inviteData);

      // Generate invite URL
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.hostname}` 
        : `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;
      const inviteUrl = `${baseUrl}/invite/${token}`;

      // Send email invitation
      const emailSent = await sendPlayerInviteEmail({
        to: validatedData.email,
        inviterName: validatedData.inviterName,
        teamName: validatedData.teamName,
        position: validatedData.position || undefined,
        message: validatedData.message || undefined,
        inviteUrl,
      });

      if (!emailSent) {
        console.warn('Email could not be sent, but invite was created in database');
      }

      res.json({
        message: "Invitation sent successfully",
        invite: {
          id: invite.id,
          email: invite.email,
          status: invite.status,
          createdAt: invite.createdAt,
        },
        emailSent,
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get team invitations
  app.get("/api/teams/:teamId/invites", async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const invites = await storage.getPlayerInvitesByTeam(teamId);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (public route)
  app.get("/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invite = await storage.getPlayerInviteByToken(token);

      if (!invite) {
        return res.status(404).send(`
          <html>
            <head><title>Invitation Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🏏 CrickIQ</h1>
              <h2>Invitation Not Found</h2>
              <p>This invitation link is invalid or has already been used.</p>
              <a href="/" style="color: #667eea;">Go to CrickIQ</a>
            </body>
          </html>
        `);
      }

      if (invite.status !== 'pending') {
        return res.status(400).send(`
          <html>
            <head><title>Invitation Already Used</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🏏 CrickIQ</h1>
              <h2>Invitation Already ${invite.status === 'accepted' ? 'Accepted' : 'Expired'}</h2>
              <p>This invitation has already been ${invite.status}.</p>
              <a href="/" style="color: #667eea;">Go to CrickIQ</a>
            </body>
          </html>
        `);
      }

      if (new Date() > invite.expiresAt) {
        await storage.updatePlayerInviteStatus(invite.id, 'expired');
        return res.status(400).send(`
          <html>
            <head><title>Invitation Expired</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🏏 CrickIQ</h1>
              <h2>Invitation Expired</h2>
              <p>This invitation has expired. Please contact ${invite.inviterName} for a new invitation.</p>
              <a href="/" style="color: #667eea;">Go to CrickIQ</a>
            </body>
          </html>
        `);
      }

      // Redirect to signup/login with invite data in query params
      const signupUrl = `/?invite=${token}&email=${encodeURIComponent(invite.email)}&team=${encodeURIComponent(invite.teamName)}`;
      res.redirect(signupUrl);
    } catch (error) {
      console.error("Error processing invitation:", error);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🏏 CrickIQ</h1>
            <h2>Error Processing Invitation</h2>
            <p>There was an error processing your invitation. Please try again later.</p>
            <a href="/" style="color: #667eea;">Go to CrickIQ</a>
          </body>
        </html>
      `);
    }
  });

  // Complete invitation (after user signs up/logs in)
  app.post("/api/invite/:token/complete", async (req, res) => {
    try {
      const { token } = req.params;
      const invite = await storage.getPlayerInviteByToken(token);

      if (!invite || invite.status !== 'pending' || new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      // Mark invitation as accepted
      await storage.updatePlayerInviteStatus(invite.id, 'accepted', new Date());

      res.json({
        message: "Invitation accepted successfully",
        teamId: invite.teamId,
        teamName: invite.teamName,
      });
    } catch (error) {
      console.error("Error completing invitation:", error);
      res.status(500).json({ message: "Failed to complete invitation" });
    }
  });

  // Clean up expired invitations (can be called periodically)
  app.post("/api/invites/cleanup", async (req, res) => {
    try {
      await storage.deleteExpiredInvites();
      res.json({ message: "Expired invitations cleaned up" });
    } catch (error) {
      console.error("Error cleaning up invitations:", error);
      res.status(500).json({ message: "Failed to clean up invitations" });
    }
  });
}
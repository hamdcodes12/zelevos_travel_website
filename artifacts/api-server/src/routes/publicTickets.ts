import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  PublicTicketsService,
  checkRateLimit,
} from "../lib/publicTicketsService.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// =============================================================================
// PUBLIC ENDPOINT — Create Support Request
// =============================================================================

router.post("/public-tickets", async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    // 1. Rate Limiting Check
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({
        error: "Too many requests. Please wait a few minutes before submitting another support request.",
      });
      return;
    }

    // 2. Anti-spam Honeypot Check
    const { honeypot } = req.body;
    if (honeypot && String(honeypot).trim().length > 0) {
      logger.warn({ ip: clientIp }, "Spam detected via public ticket honeypot");
      // Silently succeed to trick bots without creating ticket
      res.status(200).json({
        success: true,
        ticketId: "THK-TKT-000000",
        message: "Your request has been submitted successfully.",
      });
      return;
    }

    // 3. Extract and Validate Public Fields
    const {
      fullName,
      email,
      companyName,
      phone,
      requestType,
      subject,
      message,
      attachment,
    } = req.body;

    const { ticket, ticketNumber } = await PublicTicketsService.createTicket({
      fullName,
      email,
      companyName,
      phone,
      requestType,
      subject,
      message,
      attachment,
      clientIp,
    });

    res.status(201).json({
      success: true,
      ticketId: ticketNumber,
      message: "Your request has been submitted successfully.",
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error creating public ticket");
    res.status(400).json({
      error: error?.message || "Failed to submit support request. Please verify your details.",
    });
  }
});

// =============================================================================
// ADMIN ENDPOINTS — Require Full Admin Authentication
// =============================================================================

/**
 * GET /admin/public-tickets/stats — Live KPI cards
 */
router.get("/admin/public-tickets/stats", requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = PublicTicketsService.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error fetching public ticket stats");
    res.status(500).json({ error: "Failed to retrieve ticket statistics" });
  }
});

/**
 * GET /admin/public-tickets — Search, filter & paginate
 */
router.get("/admin/public-tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      status,
      requestType,
      priority,
      search,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query as Record<string, string | undefined>;

    const result = PublicTicketsService.listTickets({
      status,
      requestType,
      priority,
      search,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error listing public tickets");
    res.status(500).json({ error: "Failed to list public tickets" });
  }
});

/**
 * GET /admin/public-tickets/:id — Ticket details, messages, notes & audit logs
 */
router.get("/admin/public-tickets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const detail = PublicTicketsService.getTicketDetail(String(req.params.id));
    if (!detail) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({
      success: true,
      ...detail,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error getting public ticket detail");
    res.status(500).json({ error: "Failed to retrieve ticket details" });
  }
});

/**
 * POST /admin/public-tickets/:id/replies — Admin reply
 */
router.post("/admin/public-tickets/:id/replies", requireAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Reply message is required" });
      return;
    }

    const result = PublicTicketsService.addAdminReply(String(req.params.id), admin, message);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error adding admin reply");
    res.status(400).json({ error: error?.message || "Failed to submit reply" });
  }
});

/**
 * POST /admin/public-tickets/:id/notes — Internal note (Admin only)
 */
router.post("/admin/public-tickets/:id/notes", requireAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { note } = req.body;

    if (!note || typeof note !== "string" || !note.trim()) {
      res.status(400).json({ error: "Internal note is required" });
      return;
    }

    const result = PublicTicketsService.addInternalNote(String(req.params.id), admin, note);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error adding internal note");
    res.status(400).json({ error: error?.message || "Failed to save internal note" });
  }
});

/**
 * PATCH /admin/public-tickets/:id — Update status, priority, or assignment
 */
router.patch("/admin/public-tickets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { status, priority, assignedAdminId, assignedAdminName } = req.body;

    const ticket = PublicTicketsService.updateTicket(String(req.params.id), admin, {
      status,
      priority,
      assignedAdminId,
      assignedAdminName,
    });

    res.json({
      success: true,
      ticket,
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Error updating public ticket");
    res.status(400).json({ error: error?.message || "Failed to update ticket" });
  }
});

export default router;

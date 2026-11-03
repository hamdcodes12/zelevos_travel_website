import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/**
 * PHASE 8 FINAL GOVERNANCE HARDENING:
 * The runtime OpenAI chatbot has been permanently decommissioned.
 * Thinkatic operates strictly as a human-governed B2B BPO platform.
 * Any request to this endpoint returns a deterministic HTTP 410 Gone.
 */
router.all(["/chat", "/api/chat"], (req: Request, res: Response) => {
  logger.info({ ip: req.ip, path: req.path }, "Decommissioned AI chatbot endpoint accessed");
  res.status(410).json({
    success: false,
    error: "The AI chatbot endpoint has been permanently decommissioned. Thinkatic is a strictly human-operated BPO platform.",
    status: "DECOMMISSIONED",
    governance: "HUMAN_OPERATIONS",
    support_contact: {
      phone: "+1 (800) 844-6528",
      email: "support@thinkatic.com",
      portal: "/contact"
    }
  });
});

export default router;


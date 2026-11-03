import { Router, type IRouter } from "express";
import { contactsRepository } from "@workspace/db";

const router: IRouter = Router();

router.post("/contacts", async (req, res) => {
  try {
    const { name, email, company, budget, message, source } = req.body as {
      name: string;
      email: string;
      company?: string;
      budget?: string;
      message: string;
      source?: string;
    };

    if (!name || !email || !message) {
      res.status(400).json({ error: "name, email, and message are required" });
      return;
    }

    const submission = await contactsRepository.create({
      name,
      email,
      company,
      budget,
      message,
      source: source ?? "contact_form",
    });

    res.status(201).json(submission);
  } catch (error: any) {
    console.error("Contacts submission error:", error);
    res.status(500).json({ error: "Failed to submit contact request", details: error?.message });
  }
});

export default router;

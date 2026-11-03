import { Router, type IRouter, type Request, type Response } from "express";
import {
  clientUpdatesRepository,
  plansRepository,
  userProfileRepository,
  supabase,
  type ClientUpdateClient,
} from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireUserAuth, requireFeature } from "./user.js";

const router: IRouter = Router();

type AdminRequest = Request & { admin?: { id: number; username: string } };
const BPO_PLANS: Record<string, { name: string; price: number; seats: string; term: string }> = {
  "bpo-starter": { name: "STARTER BPO", price: 2000, seats: "5–10 seats", term: "11-month partnership" },
  "bpo-growth": { name: "GROWTH BPO", price: 4000, seats: "10–50 seats", term: "11-month partnership" },
  "bpo-enterprise": { name: "ENTERPRISE BPO", price: 5000, seats: "50–500 seats", term: "11-month enterprise partnership" },
};

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function resolvePlan(serviceId: string | null) {
  if (!serviceId) return null;
  const bpo = BPO_PLANS[serviceId];
  if (bpo) return { name: bpo.name, price: bpo.price, seats: bpo.seats, term: bpo.term };
  const plan = await plansRepository.getByServiceId(serviceId);
  return plan ? { name: plan.name, price: plan.price, seats: null, term: "one-time" } : null;
}

router.get("/user/updates", requireUserAuth, requireFeature("client_updates"), async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const updates = await clientUpdatesRepository.getPublishedForUser(req.user!.id);
    res.json(updates);
  } catch (error: any) {
    console.error("User updates error:", error);
    res.status(500).json({ error: "Failed to load project updates" });
  }
});

router.get("/admin/client-updates/clients", requireAuth, async (_req: AdminRequest, res: Response) => {
  try {
    const profiles = await userProfileRepository.getAll();
    const clientProfiles = profiles.filter((p) => {
      const acctType = String(p.accountType || "").toUpperCase();
      return acctType !== "BPO" && p.role !== "bpo_partner" && p.role !== "agent" && p.role !== "admin";
    });

    const clients: any[] = [];
    for (const profile of clientProfiles) {
      const [plan, updates, projectsRes] = await Promise.all([
        resolvePlan(profile.selectedPlan),
        clientUpdatesRepository.getForUser(profile.id),
        supabase.from("projects").select("id, name, status").eq("client_id", profile.id),
      ]);
      const published = updates.find((update) => update.status === "published");
      clients.push({
        userId: profile.id,
        clientId: profile.id,
        clientName: profile.fullName || profile.email.split("@")[0],
        email: profile.email,
        assignedPlan: plan?.name ?? (profile.selectedPlan || "None"),
        planPrice: plan?.price ?? null,
        planSeats: plan?.seats ?? null,
        planStatus: profile.selectedPlan ? "Assigned" : "Unassigned",
        lastUpdateSent: published?.publishedAt ?? null,
        updateCount: updates.length,
        projectsCount: (projectsRes.data || []).length,
      });
    }
    res.json(clients);
  } catch (error: any) {
    console.error("Admin client updates clients error:", error);
    res.status(500).json({ error: "Failed to load client update recipients" });
  }
});

router.get("/admin/client-updates/users/:userId", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const profile = await userProfileRepository.getById(String(req.params.userId));
    if (!profile) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json(await clientUpdatesRepository.getForUser(profile.id));
  } catch (error: any) {
    console.error("Admin client updates history error:", error);
    res.status(500).json({ error: "Failed to load client update history" });
  }
});

router.post("/admin/client-updates", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { userId, title, message, category = "Progress Update", status = "published" } = req.body as {
      userId?: string; title?: string; message?: string; category?: string; status?: string;
    };
    if (!userId || !title?.trim() || !message?.trim()) {
      res.status(400).json({ error: "userId, title, and message are required" });
      return;
    }
    if (status !== "draft" && status !== "published") {
      res.status(400).json({ error: "status must be draft or published" });
      return;
    }
    const profile = await userProfileRepository.getById(userId);
    if (!profile) {
      res.status(404).json({ error: "Client account not found" });
      return;
    }
    const update = await clientUpdatesRepository.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      category: category?.trim() || "Progress Update",
      status,
      createdBy: String(req.admin?.id ?? "admin"),
    });

    // Notify client in real-time if published
    if (status === "published") {
      await supabase.from("notifications").insert({
        recipient_user_id: userId,
        type: "client_update",
        title: title.trim(),
        body: message.trim(),
        entity_type: "client_update",
        entity_id: String(update.id),
      });
    }

    res.status(201).json(update);
  } catch (error: any) {
    console.error("Admin create client update error:", error);
    res.status(500).json({ error: "Failed to create client update" });
  }
});

router.patch("/admin/client-updates/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) { res.status(400).json({ error: "Invalid update ID" }); return; }
    const existing = await clientUpdatesRepository.getById(id);
    if (!existing) { res.status(404).json({ error: "Update not found" }); return; }
    const { title, message, category, status } = req.body as { title?: string; message?: string; category?: string; status?: string };
    if (status !== undefined && status !== "draft" && status !== "published") {
      res.status(400).json({ error: "status must be draft or published" }); return;
    }
    const updated = await clientUpdatesRepository.update(id, {
      title: title?.trim(), message: message?.trim(), category: category?.trim() || null,
      status: status as "draft" | "published" | undefined,
    });
    res.json(updated);
  } catch (error: any) {
    console.error("Admin update client update error:", error);
    res.status(500).json({ error: "Failed to update client update" });
  }
});

router.delete("/admin/client-updates/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) { res.status(400).json({ error: "Invalid update ID" }); return; }
    const deleted = await clientUpdatesRepository.delete(id);
    if (!deleted) { res.status(404).json({ error: "Update not found" }); return; }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Admin delete client update error:", error);
    res.status(500).json({ error: "Failed to delete client update" });
  }
});

export default router;

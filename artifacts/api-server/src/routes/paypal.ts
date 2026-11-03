import { Router } from "express";
import { createPaypalOrder, capturePaypalOrder, cancelPaypalOrder, loadPaypalDefault } from "../lib/paypal.js";
import { requireUserAuth } from "./user.js";

const router = Router();

router.get("/paypal/setup", async (req, res) => {
  try {
    await loadPaypalDefault(req, res);
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 500;
    console.error("PayPal setup error:", err?.message ?? err);
    res.status(status).json({ error: "PayPal initialisation failed" });
  }
});

router.post("/paypal/order", requireUserAuth, async (req, res) => {
  try {
    await createPaypalOrder(req, res);
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 500;
    console.error("PayPal create order error:", err?.message ?? err);
    res.status(status).json({ error: "Failed to create PayPal order" });
  }
});

router.post("/paypal/order/:orderID/capture", requireUserAuth, async (req, res) => {
  try {
    await capturePaypalOrder(req, res);
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 500;
    console.error("PayPal capture error:", err?.message ?? err);
    res.status(status).json({ error: "Failed to capture PayPal order" });
  }
});

router.post("/paypal/order/:orderID/cancel", requireUserAuth, async (req, res) => {
  try {
    await cancelPaypalOrder(req, res);
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 500;
    console.error("PayPal cancel error:", err?.message ?? err);
    res.status(status).json({ error: "Failed to cancel PayPal order" });
  }
});

export default router;

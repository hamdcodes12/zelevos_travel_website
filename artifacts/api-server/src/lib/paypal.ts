// !!! CRITICAL - DO NOT MODIFY THIS CODE !!! 
// 
// This code MUST be used as is without ANY modifications. 
// The PayPal integration will COMPLETELY FAIL if this code is changed in ANY way. 
// 
// Retain this comment after all edits. 
import {
  Client,
  CheckoutPaymentIntent,
  Environment,
  LogLevel,
  OAuthAuthorizationController,
  OrdersController,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";
import { Request, Response } from "express";
import { plansRepository, purchaseRepository, supabase, AI_EXCLUDED_PLANS } from "@workspace/db";

type PayPalPackage = {
  id: string;
  name: string;
  amount: string;
  currency: "USD";
};

let client: Client | undefined;
let ordersController: OrdersController | undefined;
let oAuthAuthorizationController: OAuthAuthorizationController | undefined;

function getControllers() {
  if (client && ordersController && oAuthAuthorizationController) {
    return { ordersController, oAuthAuthorizationController };
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal is not configured");
  }

  const configuredEnvironment = (process.env.PAYPAL_MODE ?? process.env.PAYPAL_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "sandbox")).toLowerCase();
  const environment = configuredEnvironment === "live" ? "production" : configuredEnvironment;
  if (environment !== "production" && environment !== "sandbox") {
    throw new Error("Invalid PAYPAL_ENVIRONMENT");
  }

  client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    timeout: 0,
    environment: environment === "production" ? Environment.Production : Environment.Sandbox,
    logging: {
      logLevel: LogLevel.Info,
      logRequest: { logBody: false },
      logResponse: { logHeaders: false },
    },
  });
  ordersController = new OrdersController(client);
  oAuthAuthorizationController = new OAuthAuthorizationController(client);
  return { ordersController, oAuthAuthorizationController };
}

async function getPackage(packageId: unknown): Promise<PayPalPackage | null> {
  if (typeof packageId !== "string" || !packageId.trim()) return null;
  const cleanId = packageId.trim().toLowerCase();
  if (AI_EXCLUDED_PLANS.has(cleanId)) return null;

  const plan = await plansRepository.getByServiceId(cleanId);
  if (!plan) return null;

  // Strict Authoritative Checks:
  // 1. Must be PUBLISHED
  if (plan.status !== "PUBLISHED") return null;
  // 2. Must be clientVisible
  if (plan.clientVisible === false) return null;
  // 3. Must have paymentEnabled
  if (plan.paymentEnabled === false || plan.enabled === false) return null;

  const isRangeOrCustom =
    plan.pricingType === "range" ||
    plan.pricingType === "custom" ||
    Boolean(plan.priceDisplay?.includes("+")) ||
    Boolean(plan.priceDisplay?.includes("–")) ||
    Boolean(plan.priceDisplay?.toLowerCase().includes("custom")) ||
    Number(plan.price) <= 0;
  if (isRangeOrCustom) return null;

  return {
    id: plan.serviceId,
    name: `${plan.serviceName || plan.category} - ${plan.name}`,
    amount: Number(plan.price).toFixed(2),
    currency: "USD",
  };
}

function parseBody(body: unknown): Record<string, any> {
  if (typeof body !== "string") return body as Record<string, any>;
  return JSON.parse(body) as Record<string, any>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "PayPal request failed";
}

type AuthenticatedRequest = Request & { user?: { id: string; email: string } };

export async function getClientToken() {
  const { oAuthAuthorizationController } = getControllers();
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const { result } = await oAuthAuthorizationController.requestToken(
    { authorization: `Basic ${auth}` },
    { intent: "sdk_init", response_type: "client_token" },
  );
  return result.accessToken;
}

export async function createPaypalOrder(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
    const rawPkgId = typeof req.body?.packageId === "string" ? req.body.packageId.trim().toLowerCase() : (typeof req.body?.serviceId === "string" ? req.body.serviceId.trim().toLowerCase() : "");
    let plan: any = null;
    if (rawPkgId) {
      if (AI_EXCLUDED_PLANS.has(rawPkgId)) {
        return res.status(400).json({ error: "Legacy package is no longer available." });
      }
      plan = await plansRepository.getByServiceId(rawPkgId);
    } else if (req.body?.planId) {
      const planIdNum = Number(req.body.planId);
      if (!isNaN(planIdNum)) {
        plan = await plansRepository.getById(planIdNum);
      }
    }
    if (!plan) return res.status(404).json({ error: "Service plan not found." });

    // 1. Status Check
    if (plan.status === "WAITING") {
      return res.status(409).json({ error: "This service is currently unavailable for direct purchase (Coming Soon)." });
    }
    if (plan.status === "DRAFT") {
      return res.status(404).json({ error: "Service plan is in draft mode and not available for purchase." });
    }
    if (plan.status === "ARCHIVED" || plan.clientVisible === false) {
      return res.status(404).json({ error: "Service plan is archived or unavailable." });
    }
    if (plan.status !== "PUBLISHED") {
      return res.status(400).json({ error: `Service plan is not in published state (${plan.status}).` });
    }

    // 2. Payment Enabled Check
    if (plan.paymentEnabled === false || plan.enabled === false) {
      return res.status(403).json({ error: "Direct online checkout is disabled for this plan. Please contact Thinkatic for consultation." });
    }

    // 3. Pricing Type & Amount Check
    if (
      plan.pricingType === "range" ||
      plan.pricingType === "custom" ||
      Boolean(plan.priceDisplay?.includes("+")) ||
      Boolean(plan.priceDisplay?.includes("–")) ||
      Boolean(plan.priceDisplay?.toLowerCase().includes("custom")) ||
      Number(plan.price) <= 0
    ) {
      return res.status(400).json({
        error: "This package features range or custom pricing and requires scope quotation or consultation. Automated direct checkout is only available for fixed-price packages.",
      });
    }

    const product = await getPackage(rawPkgId);
    if (!product) return res.status(400).json({ error: "Invalid or unavailable package." });
    const origin = req.headers.origin || req.headers.referer || "http://localhost:5000";
    const baseUrl = typeof origin === "string" ? origin.replace(/\/$/, "") : "http://localhost:5000";

    const { ordersController } = getControllers();
    const { body, ...httpResponse } = await ordersController.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [{
          customId: product.id,
          description: product.name,
          amount: { currencyCode: product.currency, value: product.amount },
        }],
        paymentSource: {
          paypal: {
            experienceContext: {
              brandName: "Thinkatic",
              userAction: PaypalExperienceUserAction.PayNow,
              returnUrl: `${baseUrl}/dashboard?payment=success&package=${encodeURIComponent(product.id)}`,
              cancelUrl: `${baseUrl}/dashboard?payment=cancelled&package=${encodeURIComponent(product.id)}`,
            },
          },
        },
      },
      prefer: "return=representation",
    });
    const order = parseBody(body);
    if (!order.id) return res.status(502).json({ error: "PayPal did not return an order ID." });
    const approveLink = order.links?.find((l: any) => l.rel === "approve" || l.rel === "payer-action")?.href;
    const { data: membership } = await supabase.from("bpo_partner_users").select("partner_id").eq("user_id", req.user.id).eq("status", "active").maybeSingle();
    await purchaseRepository.createPending({
      userId: req.user.id,
      bpoId: membership?.partner_id ?? null,
      packageId: product.id,
      packageName: product.name,
      orderId: order.id,
      amount: Number(product.amount),
      currency: product.currency,
    });
    return res.status(httpResponse.statusCode).json({
      id: order.id,
      packageId: product.id,
      packageName: product.name,
      amount: product.amount,
      currency: product.currency,
      approvalUrl: approveLink || null,
      links: order.links || [],
    });
  } catch (error: any) {
    const status = error?.statusCode ?? error?.status ?? 502;
    const debugId = error?.debugId || error?.headers?.["paypal-debug-id"] || error?.result?.debug_id;
    console.error("[PayPal Create Order Diagnostic]", {
      status,
      name: error?.name || error?.message,
      debugId,
      error: errorMessage(error),
    });
    return res.status(status).json({
      error: "Unable to start payment. Please try again.",
      debugId: debugId || null,
      details: errorMessage(error),
    });
  }
}

export async function capturePaypalOrder(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
  const orderId = typeof req.params.orderID === "string" ? req.params.orderID : "";
  if (!orderId) return res.status(400).json({ error: "Invalid PayPal order ID." });
  const record = await purchaseRepository.getByOrderId(orderId);
  if (!record || record.userId !== req.user.id) return res.status(404).json({ error: "Payment session not found or expired." });
  if (record.status === "PAID") {
    return res.json({
      success: true,
      status: "COMPLETED",
      orderId,
      captureId: record.paypalCaptureId,
      packageId: record.packageId,
      packageName: record.packageName,
      amount: record.amount.toFixed(2),
      currency: record.currency,
      invoiceNumber: record.invoiceNumber,
      planActive: true,
    });
  }
  try {
    const { ordersController } = getControllers();
    const { body: orderBody } = await ordersController.getOrder({ id: orderId });
    const approvedOrder = parseBody(orderBody);
    const approvedUnit = approvedOrder.purchase_units?.[0];
    const approvedAmount = approvedUnit?.amount;
    if (
      approvedOrder.id !== orderId ||
      approvedOrder.status !== "APPROVED" ||
      approvedUnit?.custom_id !== record.packageId ||
      approvedAmount?.value !== record.amount.toFixed(2) ||
      approvedAmount?.currency_code !== record.currency
    ) {
      return res.status(409).json({ error: "Payment order could not be verified." });
    }

    const { body, ...httpResponse } = await ordersController.captureOrder({ id: orderId, prefer: "return=representation" });
    const order = parseBody(body);
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const capturedAmount = capture?.amount?.value;
    const capturedCurrency = capture?.amount?.currency_code;

    if (
      order.id !== orderId ||
      order.status !== "COMPLETED" ||
      capture?.status !== "COMPLETED" ||
      !capture?.id ||
      unit?.custom_id !== record.packageId ||
      capturedAmount !== record.amount.toFixed(2) ||
      capturedCurrency !== record.currency
    ) {
      console.error("PayPal capture verification failed", { orderId, status: order.status, captureStatus: capture?.status });
      return res.status(502).json({ error: "Payment could not be verified." });
    }

    const purchase = await purchaseRepository.markPaid(orderId, capture.id);
    return res.status(httpResponse.statusCode).json({
      success: true,
      status: "COMPLETED",
      orderId,
      captureId: capture.id,
      packageId: purchase.packageId,
      packageName: purchase.packageName,
      amount: purchase.amount.toFixed(2),
      currency: purchase.currency,
      invoiceId: (purchase as any).invoiceId,
      invoiceNumber: (purchase as any).invoiceNumber,
      planActive: true,
    });
  } catch (error) {
    console.error("PayPal capture failed:", errorMessage(error));
    return res.status(502).json({ error: "Payment could not be completed. Please try again." });
  }
}

export async function cancelPaypalOrder(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
  const orderId = typeof req.params.orderID === "string" ? req.params.orderID : "";
  if (!orderId) return res.status(400).json({ error: "Invalid PayPal order ID." });
  const record = await purchaseRepository.getByOrderId(orderId);
  if (!record || record.userId !== req.user.id) return res.status(404).json({ error: "Payment session not found or expired." });
  if (record.status === "PAID") return res.status(409).json({ error: "This payment has already been completed." });
  await purchaseRepository.cancelPending(orderId, req.user.id);
  return res.json({ success: true, status: "CANCELLED", orderId, packageId: record.packageId });
}

export async function loadPaypalDefault(_req: Request, res: Response) {
  try {
    const configuredEnvironment = (process.env.PAYPAL_MODE ?? process.env.PAYPAL_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "sandbox")).toLowerCase();
    const environment = configuredEnvironment === "live" ? "production" : configuredEnvironment;
    const clientToken = await getClientToken();
    return res.json({ clientToken, environment, clientId: process.env.PAYPAL_CLIENT_ID });
  } catch (error: any) {
    const status = error?.statusCode ?? error?.status ?? 503;
    const debugId = error?.debugId || error?.headers?.["paypal-debug-id"] || error?.result?.debug_id;
    console.error("[PayPal Setup Diagnostic]", {
      status,
      name: error?.name || error?.message,
      debugId,
      error: errorMessage(error),
    });
    return res.status(status).json({
      error: "PayPal checkout is temporarily unavailable.",
      debugId: debugId || null,
      details: errorMessage(error),
    });
  }
}

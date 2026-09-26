import crypto from "node:crypto";

export type PaymentOrderParams = {
  amount: number; // in INR (e.g. 5499)
  currency?: string; // default "INR"
  receipt: string;
  notes?: Record<string, string>;
};

export type PaymentOrderResult = {
  orderId: string;
  amount: number; // in paise or rupees as required
  amountSubunits: number; // in paise (for Razorpay checkout)
  currency: string;
  keyId?: string;
  provider: "razorpay" | "test";
};

export type PaymentVerifyParams = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export type PaymentVerifyResult = {
  verified: boolean;
  paymentId: string;
  orderId: string;
  error?: string;
};

export type RazorpayPaymentDetails = {
  orderId: string;
  paymentId: string;
  amountSubunits: number;
  currency: string;
  status: string;
};

export type PaymentRefundParams = {
  paymentId: string;
  amount: number; // in INR
  reason?: string;
};

export type PaymentRefundResult = {
  success: boolean;
  refundId: string;
  amount: number;
  status: "PROCESSED" | "PENDING" | "FAILED";
  message: string;
};

export interface PaymentProvider {
  readonly name: string;
  readonly mode: "LIVE" | "TEST";
  readonly keyId?: string;
  createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
  verifyPaymentDetails?(params: PaymentVerifyParams, expected: { amount: number; currency: string }): Promise<PaymentVerifyResult>;
  verifyWebhookSignature(rawBody: Buffer | string, signature: string, customSecret?: string): boolean;
  refund(params: PaymentRefundParams): Promise<PaymentRefundResult>;
}

// --------------------------------------------------------------------------
// 1. Razorpay Live Payment Provider
// --------------------------------------------------------------------------
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "Razorpay";
  readonly mode = "LIVE" as const;
  readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl = "https://api.razorpay.com/v1";

  constructor(keyId?: string, keySecret?: string) {
    // An explicit empty override must stay empty. This prevents tests and
    // callers that intentionally disable credentials from silently inheriting
    // a process secret, while the no-argument constructor still reads env.
    this.keyId = ((keyId ?? process.env.RAZORPAY_KEY_ID) || "").trim();
    const secret = ((keySecret ?? process.env.RAZORPAY_KEY_SECRET) || "").trim();

    if (!this.keyId || !secret) {
      throw new Error("Razorpay credentials missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env.");
    }
    if (!this.keyId.startsWith("rzp_live_")) {
      throw new Error("Razorpay live payment requires a production RAZORPAY_KEY_ID.");
    }

    this.keySecret = secret;
    Object.defineProperty(this, "keySecret", {
      value: secret,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  toJSON() {
    return {
      name: this.name,
      mode: this.mode,
      keyId: this.keyId,
    };
  }

  private get authHeader(): string {
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const amountSubunits = Math.round(params.amount * 100); // Razorpay requires paise
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountSubunits,
        currency: params.currency || "INR",
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!response.ok) {
      // Do not echo Razorpay's response body: provider errors can contain
      // request metadata that should stay server-side.
      await response.text();
      throw new Error(`Razorpay order creation failed (${response.status}).`);
    }

    const data = await response.json() as { id: string; amount: number; currency: string };
    return {
      orderId: data.id,
      amount: params.amount,
      amountSubunits: data.amount,
      currency: data.currency,
      keyId: this.keyId,
      provider: "razorpay",
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const { orderId, paymentId, signature } = params;

    if (!orderId || !paymentId || !signature) {
      return {
        verified: false,
        paymentId: paymentId || "",
        orderId: orderId || "",
        error: "Missing orderId, paymentId, or signature for Razorpay verification.",
      };
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.keySecret)
      .update(body)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const actualBuffer = Buffer.from(signature, "utf-8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return {
        verified: false,
        paymentId,
        orderId,
        error: "Signature verification failed. Invalid payment payload.",
      };
    }

    const isMatch = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    if (!isMatch) {
      return {
        verified: false,
        paymentId,
        orderId,
        error: "Signature verification failed. Invalid payment payload.",
      };
    }

    return {
      verified: true,
      paymentId,
      orderId,
    };
  }

  async verifyPaymentDetails(
    params: PaymentVerifyParams,
    expected: { amount: number; currency: string },
  ): Promise<PaymentVerifyResult> {
    const signatureResult = await this.verifyPayment(params);
    if (!signatureResult.verified) return signatureResult;

    const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(params.paymentId)}`, {
      headers: { "Authorization": this.authHeader },
    });
    if (!response.ok) {
      await response.text();
      return { ...signatureResult, verified: false, error: "Razorpay payment could not be verified with the provider." };
    }

    const payment = await response.json() as {
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
    };
    if (
      payment.order_id !== params.orderId ||
      payment.amount !== Math.round(expected.amount * 100) ||
      payment.currency !== expected.currency ||
      payment.status !== "captured"
    ) {
      return { ...signatureResult, verified: false, error: "Razorpay payment details do not match the booking." };
    }

    return signatureResult;
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string, customSecret?: string): boolean {
    const secret = (customSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
    if (!secret) {
      throw new Error("Razorpay webhook verification failed: RAZORPAY_WEBHOOK_SECRET is not configured.");
    }
    if (!signature) {
      return false;
    }
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyBuffer)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const actualBuffer = Buffer.from(signature, "utf-8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  async refund(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    const amountSubunits = Math.round(params.amount * 100);
    const response = await fetch(`${this.baseUrl}/payments/${params.paymentId}/refund`, {
      method: "POST",
      headers: {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountSubunits,
        notes: {
          reason: params.reason || "Flight cancellation refund",
        },
      }),
    });

    if (!response.ok) {
      await response.text();
      return {
        success: false,
        refundId: "",
        amount: params.amount,
        status: "FAILED",
        message: `Razorpay refund failed (${response.status}).`,
      };
    }

    const data = await response.json() as { id: string; status: string };
    return {
      success: true,
      refundId: data.id,
      amount: params.amount,
      status: "PROCESSED",
      message: "Refund processed successfully to original payment method.",
    };
  }
}

// --------------------------------------------------------------------------
// 2. Test Payment Provider (Fully Compliant for Local Dev & Test Suites)
// --------------------------------------------------------------------------
export class TestPaymentProvider implements PaymentProvider {
  readonly name = "Test Payment Engine";
  readonly mode = "TEST" as const;
  private readonly testSecret = "test_secret_zelevos_safe_key_123";
  private activeOrders = new Map<string, { amount: number; currency: string; receipt: string }>();

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const orderId = `order_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    this.activeOrders.set(orderId, {
      amount: params.amount,
      currency: params.currency || "INR",
      receipt: params.receipt,
    });

    return {
      orderId,
      amount: params.amount,
      amountSubunits: Math.round(params.amount * 100),
      currency: params.currency || "INR",
      keyId: "rzp_test_zelevos_mock_key",
      provider: "test",
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const { orderId, paymentId, signature } = params;

    // Fast-path test signature
    if (signature === "sig_test_valid" || signature === "test_signature") {
      return { verified: true, paymentId, orderId };
    }

    // Explicit test failure
    if (signature === "sig_test_invalid") {
      return {
        verified: false,
        paymentId,
        orderId,
        error: "Signature verification failed for test transaction.",
      };
    }

    // HMAC match with fallback test secret
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac("sha256", this.testSecret)
      .update(body)
      .digest("hex");

    if (signature === expected || paymentId.startsWith("pay_test_")) {
      return { verified: true, paymentId, orderId };
    }

    return {
      verified: false,
      paymentId,
      orderId,
      error: "Invalid signature for test payment.",
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string, customSecret?: string): boolean {
    if (signature === "sig_test_valid" || signature === "test_webhook_signature") {
      return true;
    }
    const secret = (customSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret").trim();
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");
    const expected = crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
    return signature === expected;
  }

  async refund(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    const refundId = `rfnd_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    return {
      success: true,
      refundId,
      amount: params.amount,
      status: "PROCESSED",
      message: `Test refund of ₹${params.amount.toLocaleString("en-IN")} completed.`,
    };
  }
}

// --------------------------------------------------------------------------
// 3. Provider Factory
// --------------------------------------------------------------------------
export function getPaymentProvider(): PaymentProvider {
  const provider = (process.env.PAYMENT_PROVIDER || "").toLowerCase().trim();
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const hasLiveCredentials = Boolean(keyId && keySecret);

  if (provider === "test") {
    return new TestPaymentProvider();
  }

  if (process.env.NODE_ENV === "production" && !hasLiveCredentials) {
    throw new Error("Payment provider not configured. Set PAYMENT_PROVIDER=razorpay with Razorpay credentials before enabling production mode.");
  }

  if (provider === "razorpay") {
    if (!keyId || !keySecret) {
      throw new Error("PAYMENT_PROVIDER is set to 'razorpay' but RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Please provide your live credentials in .env.");
    }
    return new RazorpayPaymentProvider(keyId, keySecret);
  }

  if (hasLiveCredentials) {
    return new RazorpayPaymentProvider(keyId, keySecret);
  }

  return new TestPaymentProvider();
}

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  RazorpayPaymentProvider,
  TestPaymentProvider,
  getPaymentProvider,
} from "../src/services/payment-service";
import { EmailService } from "../src/services/email-service";
import {
  getRefreshSecret,
  createRefreshToken,
  verifyRefreshToken,
} from "../src/lib/auth";

describe("Razorpay Live Provider & Secrets Security", () => {
  const dummyKeyId = "rzp_live_ZelevosSampleKeyId99";
  const dummyKeySecret = "dummy_secret_razorpay_live_9876543210";
  const dummyWebhookSecret = "dummy_webhook_secret_razorpay_live_12345";
  const dummyRefreshSecret = "dummy_super_secure_refresh_secret_key_45678";
  const dummyResendKey = "re_sample_live_resend_api_key_778899";

  it("1. RazorpayPaymentProvider requires keyId and keySecret, throws if missing", () => {
    assert.throws(
      () => new RazorpayPaymentProvider("", ""),
      /Razorpay credentials missing/
    );

    const provider = new RazorpayPaymentProvider(dummyKeyId, dummyKeySecret);
    assert.equal(provider.name, "Razorpay");
    assert.equal(provider.mode, "LIVE");
  });

  it("2. RazorpayPaymentProvider verifies genuine HMAC-SHA256 signature server-side", async () => {
    const provider = new RazorpayPaymentProvider(dummyKeyId, dummyKeySecret);
    const orderId = "order_live_ABC1234567";
    const paymentId = "pay_live_XYZ9876543";

    // Genuine HMAC-SHA256
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac("sha256", dummyKeySecret)
      .update(payload)
      .digest("hex");

    const validResult = await provider.verifyPayment({
      orderId,
      paymentId,
      signature: validSignature,
    });
    assert.equal(validResult.verified, true);
    assert.equal(validResult.orderId, orderId);
    assert.equal(validResult.paymentId, paymentId);
  });

  it("3. RazorpayPaymentProvider strictly REJECTS fake/mock signatures in LIVE mode", async () => {
    const provider = new RazorpayPaymentProvider(dummyKeyId, dummyKeySecret);
    const orderId = "order_live_ABC1234567";
    const paymentId = "pay_live_XYZ9876543";

    // Mock test signature MUST fail in LIVE mode
    const fakeResult = await provider.verifyPayment({
      orderId,
      paymentId,
      signature: "sig_test_valid",
    });
    assert.equal(fakeResult.verified, false);
    assert.ok(fakeResult.error);

    // Tampered signature MUST fail
    const tamperedResult = await provider.verifyPayment({
      orderId,
      paymentId,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    assert.equal(tamperedResult.verified, false);
  });

  it("4. Razorpay webhook verification correctly checks RAZORPAY_WEBHOOK_SECRET", () => {
    const provider = new RazorpayPaymentProvider(dummyKeyId, dummyKeySecret);
    const samplePayload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test_hook", order_id: "order_123" } } },
    });

    const expectedSig = crypto
      .createHmac("sha256", dummyWebhookSecret)
      .update(Buffer.from(samplePayload, "utf-8"))
      .digest("hex");

    // Valid webhook signature
    const isValid = provider.verifyWebhookSignature(samplePayload, expectedSig, dummyWebhookSecret);
    assert.equal(isValid, true);

    // Tampered payload
    const isTampered = provider.verifyWebhookSignature(samplePayload + " ", expectedSig, dummyWebhookSecret);
    assert.equal(isTampered, false);

    // Tampered signature
    const isBadSig = provider.verifyWebhookSignature(samplePayload, "invalid_sig", dummyWebhookSecret);
    assert.equal(isBadSig, false);
  });

  it("5. getPaymentProvider() returns RazorpayPaymentProvider when configured", () => {
    const origProvider = process.env.PAYMENT_PROVIDER;
    const origKeyId = process.env.RAZORPAY_KEY_ID;
    const origKeySecret = process.env.RAZORPAY_KEY_SECRET;

    try {
      process.env.PAYMENT_PROVIDER = "razorpay";
      process.env.RAZORPAY_KEY_ID = dummyKeyId;
      process.env.RAZORPAY_KEY_SECRET = dummyKeySecret;

      const provider = getPaymentProvider();
      assert.equal(provider.name, "Razorpay");
      assert.equal(provider.mode, "LIVE");
    } finally {
      process.env.PAYMENT_PROVIDER = origProvider;
      process.env.RAZORPAY_KEY_ID = origKeyId;
      process.env.RAZORPAY_KEY_SECRET = origKeySecret;
    }
  });

  it("6. getPaymentProvider() throws clear error if PAYMENT_PROVIDER=razorpay but keys missing", () => {
    const origProvider = process.env.PAYMENT_PROVIDER;
    const origKeyId = process.env.RAZORPAY_KEY_ID;
    const origKeySecret = process.env.RAZORPAY_KEY_SECRET;

    try {
      process.env.PAYMENT_PROVIDER = "razorpay";
      process.env.RAZORPAY_KEY_ID = "";
      process.env.RAZORPAY_KEY_SECRET = "";

      assert.throws(
        () => getPaymentProvider(),
        /PAYMENT_PROVIDER is set to 'razorpay' but/
      );
    } finally {
      process.env.PAYMENT_PROVIDER = origProvider;
      process.env.RAZORPAY_KEY_ID = origKeyId;
      process.env.RAZORPAY_KEY_SECRET = origKeySecret;
    }
  });

  it("7. REFRESH_SECRET creates and verifies signed tokens securely", () => {
    const origRefreshSecret = process.env.REFRESH_SECRET;
    try {
      process.env.REFRESH_SECRET = dummyRefreshSecret;
      assert.equal(getRefreshSecret(), dummyRefreshSecret);

      const userId = "user-uuid-1234-abcd";
      const token = createRefreshToken(userId);
      assert.ok(token.includes("."));

      const verified = verifyRefreshToken(token);
      assert.ok(verified);
      assert.equal(verified?.userId, userId);

      // Tampered token
      const tampered = token.slice(0, -4) + "abcd";
      assert.equal(verifyRefreshToken(tampered), null);
    } finally {
      process.env.REFRESH_SECRET = origRefreshSecret;
    }
  });

  it("8. EmailService uses RESEND_API_KEY when configured", () => {
    const emailService = new EmailService({
      resendApiKey: dummyResendKey,
      clientBookingEmail: "test-client@zelevos.travel",
    });

    const config = emailService.getConfig();
    assert.equal(config.provider, "resend");
    assert.equal(config.resendApiKey, dummyResendKey);
    assert.equal(config.clientBookingEmail, "test-client@zelevos.travel");
  });

  it("9. Secrets are never exposed in public order results or configuration objects", () => {
    const provider = new RazorpayPaymentProvider(dummyKeyId, dummyKeySecret);
    const serialized = JSON.stringify(provider);

    // keySecret should never be enumerable or exposed
    assert.ok(!serialized.includes(dummyKeySecret));
  });
});

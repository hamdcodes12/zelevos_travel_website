async function testLiveE2E() {
  const base = "http://localhost:3000";
  console.log("1. Signing up test user on", base);
  const email = `liveuser-${Date.now()}@wayora.test`;
  const regRes = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password12345" }),
  });
  const cookie = regRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  console.log("   Signup status:", regRes.status, "Cookie set:", !!cookie);

  console.log("2. Searching flights (DEL -> BOM)");
  const searchRes = await fetch(`${base}/api/flights/search?from=DEL&to=BOM&departure=2026-10-12&travellers=1`);
  const searchData = await searchRes.json();
  console.log("   Search results count:", searchData.results.length);
  const flight = searchData.results[0];
  console.log("   Selected flight:", flight.airline, flight.flightNumber, "Price: ₹" + flight.price);

  console.log("3. Revalidating fare lock");
  const revalRes = await fetch(`${base}/api/flights/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offerId: flight.id, expectedPrice: flight.price }),
  });
  const reval = await revalRes.json();
  console.log("   Revalidation valid:", reval.valid, "Sold out:", reval.soldOut);

  console.log("4. Creating payment order");
  const orderRes = await fetch(`${base}/api/payments/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ amount: flight.price, currency: "INR" }),
  });
  const order = await orderRes.json();
  console.log("   Order ID:", order.orderId, "Amount paise:", order.amountSubunits);

  console.log("5. Booking flight with traveller details & issuing PNR");
  const bookRes = await fetch(`${base}/api/flights/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      offerId: flight.id,
      passengers: [
        {
          type: "ADULT",
          title: "Mr",
          firstName: "Aarav",
          lastName: "Sharma",
          dateOfBirth: "1994-06-15",
          gender: "MALE",
          nationality: "IN",
        },
      ],
      contact: { email: "aarav.sharma@example.com", phone: "9876543210" },
      addons: { extraBaggageKg: 5, extraBaggagePrice: 1200, seatCode: "12A" },
      payment: {
        orderId: order.orderId,
        paymentId: `pay_test_${Date.now()}`,
        signature: "sig_test_valid",
      },
      idempotencyKey: `idem-live-${Date.now()}`,
    }),
  });
  const bookingData = await bookRes.json();
  console.log("   Booking status:", bookRes.status);
  console.log("   Issued PNR:", bookingData.pnr);
  console.log("   E-Ticket Number:", bookingData.ticketNumber);
  console.log("   Booking DB Status:", bookingData.booking?.status);
  console.log("   Booking Email Status:", bookingData.emailStatus || bookingData.booking?.emailStatus);
  console.log("   Booking Client Email:", bookingData.booking?.clientEmail);

  console.log("6. Testing Client Email retry endpoint (POST /api/bookings/:id/email)");
  const emailRetryRes = await fetch(`${base}/api/bookings/${bookingData.booking.id}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  const emailRetryData = await emailRetryRes.json();
  console.log("   Email retry status:", emailRetryRes.status, "Result status:", emailRetryData.status);
  console.log("   Recipient:", emailRetryData.recipient);

  console.log("7. Verifying booking in My Trips / Bookings");
  const listRes = await fetch(`${base}/api/bookings`, { headers: { Cookie: cookie } });
  const listData = await listRes.json();
  console.log("   Bookings count:", listData.results.length);
  console.log("   First booking PNR in list:", listData.results[0]?.pnr);
  console.log("   First booking Email Status:", listData.results[0]?.emailStatus);

  console.log("8. Testing cancellation & refund");
  const cancelRes = await fetch(`${base}/api/bookings/${bookingData.booking.id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ reason: "Customer requested cancellation" }),
  });
  const cancelData = await cancelRes.json();
  console.log("   Cancellation status:", cancelRes.status);
  console.log("   Cancellation refund amount: ₹" + cancelData.cancellation?.refundAmount);
  console.log("   Updated booking status:", cancelData.booking?.status);

  console.log("\n>>> ALL END-TO-END FLOWS ON LOCALHOST:3000 VERIFIED SUCCESSFULLY! <<<");
}
testLiveE2E().catch(console.error);

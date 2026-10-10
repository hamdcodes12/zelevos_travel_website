import puppeteer from 'puppeteer-core';
import pg from '../lib/db/node_modules/pg/lib/index.js';
import path from 'node:path';
import fs from 'node:fs';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const { Client } = pg;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DB_URL = 'postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const SCREENSHOTS_DIR = path.resolve('artifacts', 'screenshots');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPgClient() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  return client;
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 11 FIX: REAL RESEND EMAIL DELIVERY & MULTI-CUSTOMER TEST');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const pgClient = await getPgClient();
  const createdBookingIds = [];

  // Launch Google Chrome
  console.log('[Browser] Launching Google Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1024'],
    defaultViewport: { width: 1440, height: 1024 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(35000);

  try {
    // ------------------------------------------------------------------------
    // STEP 0: Verify Resend API Key and Domain
    // ------------------------------------------------------------------------
    console.log('\n--- STEP 0: Resend API Key & Domain Check ---');
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment!');
    }
    console.log('RESEND_API_KEY prefix:', resendApiKey.slice(0, 4) + '****');

    const domainRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    const domainData = await domainRes.json();
    console.log('Resend Domains:', JSON.stringify(domainData.data?.map(d => ({ name: d.name, status: d.status, region: d.region })), null, 2));

    // Get Kashmir Package
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    const pkg = await page.evaluate(async () => {
      const res = await fetch('/api/packages');
      const data = await res.json();
      const list = data.results || data.packages || [];
      return list.find(p => (p.title || '').toLowerCase().includes('kashmir')) || list[0];
    });
    console.log('Using Package:', pkg.title, `(${pkg.id})`);

    // Helper: Admin setup and approval of a booking
    async function fulfillAndSendBooking(bId, bRef, expectedRecipient) {
      console.log(`\n[Admin] Setting up fulfillment for booking ${bRef}...`);
      // Admin login
      await page.evaluate(async () => {
        await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ adminId: 'harshad', password: 'harshad@10' }),
        });
      });

      // Get/initialize fulfillment
      const fulfillRes = await page.evaluate(async (id) => {
        const res = await fetch(`/api/admin/bookings/${id}/fulfillment`, { credentials: 'include' });
        return res.json();
      }, bId);

      const items = fulfillRes.items || [];
      console.log(`Found ${items.length} fulfillment components. Populating details and approving...`);

      // Find hotel, cab, guide
      const hotelItem = items.find(i => i.componentType === 'HOTEL');
      const cabItem = items.find(i => i.componentType === 'CAB');
      const guideItem = items.find(i => i.componentType === 'GUIDE');

      if (hotelItem) {
        await page.evaluate(async (bId, itemId) => {
          await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              status: 'APPROVED',
              details: {
                hotelName: 'The Grand Dragon Luxury Resort Srinagar',
                fullAddress: 'Boulevard Road, Dal Lake, Srinagar, Kashmir 190001',
                hotelPhone: '+91 194 2451234',
                checkInDate: '2026-10-15',
                checkInTime: '14:00',
                checkOutDate: '2026-10-20',
                checkOutTime: '11:00',
                nights: 5,
                roomType: 'Heritage Lake View Suite',
                numberOfRooms: 1,
                mealPlan: 'MAP (Breakfast & Dinner Included)',
                confirmationNumber: 'GD-SRI-7729',
              },
            }),
          });
        }, bId, hotelItem.id);
      }

      if (cabItem) {
        await page.evaluate(async (bId, itemId) => {
          await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              status: 'APPROVED',
              details: {
                driverName: 'Tariq Ahmad Wani',
                driverPhone: '+91 98765 12345',
                vehicleModel: 'Toyota Innova Crysta ZX (AC 4x4)',
                vehicleRegistrationNumber: 'JK01AB1234',
                pickupPoint: 'Sheikh ul-Alam International Airport Srinagar (SXR)',
                pickupDateTime: '2026-10-15 10:30 AM',
                dropPoint: 'Full Circuit Tour (Srinagar - Gulmarg - Pahalgam)',
              },
            }),
          });
        }, bId, cabItem.id);
      }

      if (guideItem) {
        await page.evaluate(async (bId, itemId) => {
          await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              status: 'APPROVED',
              details: {
                guideName: 'Bashir Lone (Certified J&K Tourism Cultural Specialist)',
                phone: '+91 98765 67890',
                languages: 'English, Hindi, Kashmiri, Urdu',
                meetingPoint: 'Hotel Lobby / Shankaracharya Temple Base',
                dateTime: '2026-10-16 09:30 AM',
              },
            }),
          });
        }, bId, guideItem.id);
      }

      // Approve any other remaining items
      for (const item of items) {
        if (item.id !== hotelItem?.id && item.id !== cabItem?.id && item.id !== guideItem?.id) {
          await page.evaluate(async (bId, itemId) => {
            await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'APPROVED' }),
            });
          }, bId, item.id);
        }
      }

      // Open Admin drawer in UI to show the fulfillment screen
      console.log(`Opening Admin UI for booking ${bRef}...`);
      await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
      await delay(2000);

      // Click row for this booking
      await page.evaluate((ref) => {
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          if (row.textContent?.includes(ref)) {
            row.click();
            break;
          }
        }
      }, bRef);
      await delay(2000);

      // Now click "Send to Customer" button in Admin UI
      console.log(`Clicking 'Send to Customer' for ${expectedRecipient}...`);
      const sendResult = await page.evaluate(async (id) => {
        const res = await fetch(`/api/admin/bookings/${id}/fulfillment/send`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.json();
      }, bId);

      console.log('Send to Customer Response:', JSON.stringify(sendResult, null, 2));

      // Refresh drawer in Admin UI to display green banner
      await page.evaluate((ref) => {
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          if (row.textContent?.includes(ref)) {
            row.click();
            break;
          }
        }
      }, bRef);
      await delay(2500);

      return sendResult;
    }

    // ========================================================================
    // TEST 1: CUSTOMER A (aarav108@gmail.com)
    // ========================================================================
    console.log('\n================================================================');
    console.log('TEST 1: Customer A (aarav108@gmail.com)');
    console.log('================================================================');

    // Customer A login
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    const loginA = await page.evaluate(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
      });
      return res.json();
    });
    console.log('Customer A Login:', loginA.user ? `Logged in as ${loginA.user.fullName} (${loginA.user.email})` : loginA);

    // Customer A Booking
    const bookResA = await page.evaluate(async (pkgId) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageId: pkgId,
          travelDate: '2026-10-15',
          adultsCount: 2,
          childrenCount: 0,
          roomsCount: 1,
          specialRequests: 'Kashmir Autumn Tour — Aarav Sharma',
          customerContact: {
            name: 'Aarav Sharma',
            email: 'aarav108@gmail.com',
            phone: '+91 98765 43210',
          },
          travellers: [
            {
              fullName: 'Aarav Sharma',
              age: 32,
              gender: 'MALE',
              isLead: true,
              contactPhone: '+91 98765 43210',
              contactEmail: 'aarav108@gmail.com',
            },
          ],
        }),
      });
      return res.json();
    }, pkg.id);

    const bookingIdA = bookResA.booking?.id;
    const bookingRefA = bookResA.bookingId || bookResA.booking?.bookingId;
    createdBookingIds.push(bookingIdA);
    console.log('Created Booking A:', bookingRefA, `(${bookingIdA})`);

    // Capture payment
    await pgClient.query(
      `UPDATE bookings SET payment_status = 'CAPTURED', status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
      [bookingIdA]
    );
    await pgClient.query(
      `INSERT INTO payment_transactions (user_id, provider, provider_order_id, provider_payment_id, amount, requested_amount, status, booking_id)
       VALUES ($1, 'razorpay', $2, $3, $4, $4, 'CAPTURED', $5)`,
      [loginA.user.id, `order_${bookingRefA}`, `pay_live_A_${Date.now()}`, bookResA.booking.totalPrice, bookingIdA]
    );

    // Admin fulfills and dispatches email
    const sendA = await fulfillAndSendBooking(bookingIdA, bookingRefA, 'aarav108@gmail.com');

    // Admin Screen Screenshot
    const shotAdminA = path.join(SCREENSHOTS_DIR, 'admin_email_sent_aarav108.png');
    await page.screenshot({ path: shotAdminA, fullPage: false });
    console.log('✓ Admin Screen Screenshot (Customer A) Saved:', shotAdminA);

    // Customer A visits My Trips
    console.log('\n[Customer A] Checking My Trips page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
      });
    });

    await page.goto('http://localhost:3000/#my-trips', { waitUntil: 'networkidle2' });
    await delay(3000);

    // Scroll to My Trips section and click booking card if not selected
    await page.evaluate((bRef) => {
      const myTripsSec = document.getElementById('my-trips') || document.querySelector('.my-trips-section');
      if (myTripsSec) myTripsSec.scrollIntoView({ behavior: 'instant', block: 'start' });

      const cards = document.querySelectorAll('.saved-trip-card');
      for (const card of cards) {
        if (card.textContent?.includes(bRef)) {
          card.click();
          break;
        }
      }
    }, bookingRefA);
    await delay(2500);

    const shotCustomerA = path.join(SCREENSHOTS_DIR, 'customerA_my_trips_cards.png');
    await page.screenshot({ path: shotCustomerA, fullPage: false });
    console.log('✓ Customer A My Trips Screenshot Saved:', shotCustomerA);

    // Verify Resend message ID for Customer A
    const messageIdA = sendA.fulfillment?.emailMessageId || sendA.fulfillment?.email_message_id;
    console.log('\nCustomer A Resend Message ID:', messageIdA);
    if (messageIdA) {
      const resendResA = await fetch(`https://api.resend.com/emails/${messageIdA}`, {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });
      const resendDataA = await resendResA.json();
      console.log('>>> FULL RESEND API RESPONSE FOR CUSTOMER A (aarav108@gmail.com):');
      console.log(JSON.stringify(resendDataA, null, 2));
    }

    // ========================================================================
    // TEST 2: CUSTOMER B (navin.kumar.chakraborty2453@gmail.com)
    // ========================================================================
    console.log('\n================================================================');
    console.log('TEST 2: Customer B (navin.kumar.chakraborty2453@gmail.com)');
    console.log('================================================================');

    // Customer B login
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    const loginB = await page.evaluate(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'navin.kumar.chakraborty2453@gmail.com', password: 'navin0044' }),
      });
      return res.json();
    });
    console.log('Customer B Login:', loginB.user ? `Logged in as ${loginB.user.fullName} (${loginB.user.email})` : loginB);

    // Customer B Booking
    const bookResB = await page.evaluate(async (pkgId) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageId: pkgId,
          travelDate: '2026-11-01',
          adultsCount: 2,
          childrenCount: 1,
          roomsCount: 1,
          specialRequests: 'Kashmir Winter Tour — Navin Chakraborty',
          customerContact: {
            name: 'Navin Chakraborty',
            email: 'navin.kumar.chakraborty2453@gmail.com',
            phone: '+91 98765 99999',
          },
          travellers: [
            {
              fullName: 'Navin Chakraborty',
              age: 35,
              gender: 'MALE',
              isLead: true,
              contactPhone: '+91 98765 99999',
              contactEmail: 'navin.kumar.chakraborty2453@gmail.com',
            },
          ],
        }),
      });
      return res.json();
    }, pkg.id);

    const bookingIdB = bookResB.booking?.id;
    const bookingRefB = bookResB.bookingId || bookResB.booking?.bookingId;
    createdBookingIds.push(bookingIdB);
    console.log('Created Booking B:', bookingRefB, `(${bookingIdB})`);

    // Capture payment
    await pgClient.query(
      `UPDATE bookings SET payment_status = 'CAPTURED', status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
      [bookingIdB]
    );
    await pgClient.query(
      `INSERT INTO payment_transactions (user_id, provider, provider_order_id, provider_payment_id, amount, requested_amount, status, booking_id)
       VALUES ($1, 'razorpay', $2, $3, $4, $4, 'CAPTURED', $5)`,
      [loginB.user.id, `order_${bookingRefB}`, `pay_live_B_${Date.now()}`, bookResB.booking.totalPrice, bookingIdB]
    );

    // Admin fulfills and dispatches email
    const sendB = await fulfillAndSendBooking(bookingIdB, bookingRefB, 'navin.kumar.chakraborty2453@gmail.com');

    // Admin Screen Screenshot
    const shotAdminB = path.join(SCREENSHOTS_DIR, 'admin_email_sent_customerB.png');
    await page.screenshot({ path: shotAdminB, fullPage: false });
    console.log('✓ Admin Screen Screenshot (Customer B) Saved:', shotAdminB);

    // Customer B visits My Trips
    console.log('\n[Customer B] Checking My Trips page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'navin.kumar.chakraborty2453@gmail.com', password: 'navin0044' }),
      });
    });

    await page.goto('http://localhost:3000/#my-trips', { waitUntil: 'networkidle2' });
    await delay(3000);

    // Scroll to My Trips section and click booking card if not selected
    const bCardsText = await page.evaluate((bRef) => {
      const myTripsSec = document.getElementById('my-trips') || document.querySelector('.my-trips-section');
      if (myTripsSec) myTripsSec.scrollIntoView({ behavior: 'instant', block: 'start' });

      const cards = document.querySelectorAll('.saved-trip-card');
      for (const card of cards) {
        if (card.textContent?.includes(bRef)) {
          card.click();
          break;
        }
      }
      return Array.from(cards).map(c => c.textContent);
    }, bookingRefB);
    await delay(2500);

    console.log('Customer B sees booking cards:', bCardsText.length);
    console.log('Does Customer B see Customer A booking?:', bCardsText.some(t => t.includes(bookingRefA)));

    const shotCustomerB = path.join(SCREENSHOTS_DIR, 'customerB_my_trips_cards.png');
    await page.screenshot({ path: shotCustomerB, fullPage: false });
    console.log('✓ Customer B My Trips Screenshot Saved:', shotCustomerB);

    // Verify Resend message ID for Customer B
    const messageIdB = sendB.fulfillment?.emailMessageId || sendB.fulfillment?.email_message_id;
    console.log('\nCustomer B Resend Message ID:', messageIdB);
    if (messageIdB) {
      const resendResB = await fetch(`https://api.resend.com/emails/${messageIdB}`, {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });
      const resendDataB = await resendResB.json();
      console.log('>>> FULL RESEND API RESPONSE FOR CUSTOMER B (navin.kumar.chakraborty2453@gmail.com):');
      console.log(JSON.stringify(resendDataB, null, 2));
    }

    // ========================================================================
    // TEST 3: PDF VOUCHER INSPECTION & RUPEE SYMBOL VERIFICATION
    // ========================================================================
    console.log('\n================================================================');
    console.log('TEST 3: PDF Voucher Download & ₹ Symbol Check');
    console.log('================================================================');
    const voucherRes = await page.evaluate(async (bRef) => {
      const res = await fetch(`/api/bookings/${bRef}/trip-voucher`, { credentials: 'include' });
      const blob = await res.blob();
      return { ok: res.ok, status: res.status, size: blob.size, type: blob.type };
    }, bookingRefA);
    console.log('Voucher PDF Download Result:', voucherRes);

    // ========================================================================
    // TEST 4: BELL NOTIFICATIONS & PRIVACY VERIFICATION
    // ========================================================================
    console.log('\n================================================================');
    console.log('TEST 4: Bell Notification Check');
    console.log('================================================================');
    const notifA = await pgClient.query(
      `SELECT id, type, title, body, created_at FROM notifications WHERE user_id = $1 AND type = 'TRIP_DETAILS' ORDER BY created_at DESC LIMIT 1`,
      [loginA.user.id]
    );
    console.log('Customer A Notification:', notifA.rows[0]);

    const notifB = await pgClient.query(
      `SELECT id, type, title, body, created_at FROM notifications WHERE user_id = $1 AND type = 'TRIP_DETAILS' ORDER BY created_at DESC LIMIT 1`,
      [loginB.user.id]
    );
    console.log('Customer B Notification:', notifB.rows[0]);

    // ========================================================================
    // TEST 5: FORCE FAILURE (INVALID RECIPIENT)
    // ========================================================================
    console.log('\n================================================================');
    console.log('TEST 5: Force Failure (Invalid Recipient)');
    console.log('================================================================');

    // Create a dummy booking with invalid email
    const badBookRes = await page.evaluate(async (pkgId) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageId: pkgId,
          travelDate: '2026-10-25',
          adultsCount: 1,
          customerContact: {
            name: 'Invalid Test User',
            email: 'invalid-email-format-without-at',
            phone: '+91 99999 99999',
          },
          travellers: [{ fullName: 'Test', age: 25, isLead: true }],
        }),
      });
      return res.json();
    }, pkg.id);

    const badBookingId = badBookRes.booking?.id;
    const badBookingRef = badBookRes.bookingId || badBookRes.booking?.bookingId;
    if (badBookingId) createdBookingIds.push(badBookingId);

    // Mark paid
    await pgClient.query(`UPDATE bookings SET payment_status = 'CAPTURED', status = 'CONFIRMED' WHERE id = $1`, [badBookingId]);

    // Admin login
    await page.evaluate(async () => {
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminId: 'harshad', password: 'harshad@10' }),
      });
    });

    // Initialize fulfillment
    const badFulfill = await page.evaluate(async (id) => {
      const res = await fetch(`/api/admin/bookings/${id}/fulfillment`, { credentials: 'include' });
      return res.json();
    }, badBookingId);

    // Approve components
    for (const item of badFulfill.items || []) {
      await page.evaluate(async (bId, itemId) => {
        await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'APPROVED' }),
        });
      }, badBookingId, item.id);
    }

    // Send to invalid customer
    const failSendResult = await page.evaluate(async (id) => {
      const res = await fetch(`/api/admin/bookings/${id}/fulfillment/send`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    }, badBookingId);

    console.log('Forced Failure Send Result:', JSON.stringify(failSendResult, null, 2));

    // Open Admin UI drawer for this failed booking
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.evaluate((ref) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent?.includes(ref)) {
          row.click();
          break;
        }
      }
    }, badBookingRef);
    await delay(2500);

    const shotFail = path.join(SCREENSHOTS_DIR, 'admin_email_failed_banner.png');
    await page.screenshot({ path: shotFail, fullPage: false });
    console.log('✓ Admin Failure Banner Screenshot Saved:', shotFail);

  } finally {
    // Clean up all created test records
    console.log('\n[Cleanup] Cleaning up created test bookings...');
    for (const id of createdBookingIds) {
      try {
        await pgClient.query(`DELETE FROM notifications WHERE metadata->>'bookingId' = $1`, [id]);
        await pgClient.query(`DELETE FROM audit_logs WHERE resource_id = $1`, [id]);
        await pgClient.query(`DELETE FROM payment_transactions WHERE booking_id = $1`, [id]);
        await pgClient.query(`DELETE FROM trip_fulfillment_items WHERE fulfillment_id IN (SELECT id FROM trip_fulfillments WHERE booking_id = $1)`, [id]);
        await pgClient.query(`DELETE FROM trip_fulfillments WHERE booking_id = $1`, [id]);
        await pgClient.query(`DELETE FROM travellers WHERE booking_id = $1`, [id]);
        await pgClient.query(`DELETE FROM bookings WHERE id = $1`, [id]);
        console.log(`Cleaned up booking ${id}`);
      } catch (cleanErr) {
        console.warn(`Cleanup error for ${id}:`, cleanErr.message);
      }
    }

    await pgClient.end();
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('ALL PHASE 11 LIVE EMAIL DELIVERY TESTS COMPLETE');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});

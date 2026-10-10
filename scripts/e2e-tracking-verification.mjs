import fs from 'node:fs';
import pg from '../lib/db/node_modules/pg/lib/index.js';

const BASE_URL = 'http://127.0.0.1:8080';

class TestClient {
  constructor() {
    this.cookieMap = new Map();
  }

  get cookies() {
    return Array.from(this.cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.cookies ? { Cookie: this.cookies } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);

    for (const sc of setCookies) {
      const firstPart = sc.split(';')[0].trim();
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        const key = firstPart.slice(0, eqIdx).trim();
        const val = firstPart.slice(eqIdx + 1).trim();
        this.cookieMap.set(key, val);
      }
    }

    let body = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    return { status: res.status, headers: res.headers, body };
  }
}

async function runE2EVerification() {
  console.log('====================================================');
  console.log('  ZELEVOS LIVE TRIP SAFETY — END-TO-END VERIFICATION');
  console.log('====================================================\n');

  // Ensure clean active session state in database
  const envText = fs.readFileSync('.env', 'utf-8');
  const dbMatch = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  if (dbMatch) {
    const pgClient = new pg.Client({ connectionString: dbMatch[1] });
    await pgClient.connect();
    await pgClient.query(`
      UPDATE trip_tracking_sessions
      SET status = 'ACTIVE',
          customer_tracking_enabled = false,
          driver_tracking_enabled = false,
          emergency_alert_active = false,
          emergency_alert_notes = NULL,
          last_customer_latitude = NULL,
          last_customer_longitude = NULL,
          last_driver_latitude = NULL,
          last_driver_longitude = NULL,
          calculated_distance_km = NULL,
          ended_at = NULL
      WHERE booking_id IN (SELECT id FROM bookings WHERE booking_id = 'ZL261002009');
    `);
    await pgClient.end();
  }

  const results = [];

  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} : ${testName} ${details ? `(${details})` : ''}`);
  }

  // 1. ANONYMOUS ACCESS BLOCKS
  console.log('--- 1. ANONYMOUS ACCESS BOUNDARIES ---');
  const anon = new TestClient();
  const anonMyTrip = await anon.request('/api/tracking/my-trip/ZL261002009');
  record('Anonymous rejected from Customer Tracking endpoint', anonMyTrip.status === 401, `Status: ${anonMyTrip.status}`);

  const anonAdmin = await anon.request('/api/admin/live-trips');
  record('Anonymous rejected from Admin Live Trips endpoint', anonAdmin.status === 401, `Status: ${anonAdmin.status}`);

  // 2. CUSTOMER A LOGIN & ACCESS
  console.log('\n--- 2. CUSTOMER A (Aarav Sharma) LOGIN & TRIP FETCH ---');
  const custA = new TestClient();
  const loginResA = await custA.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
  });
  record('Customer A logged in successfully', loginResA.status === 200, `User: ${loginResA.body?.user?.fullName}`);

  const myTripA = await custA.request('/api/tracking/my-trip/ZL261002009');
  record('Customer A fetches active tracking session', myTripA.status === 200 && myTripA.body?.status === 'success', `Session: ${myTripA.body?.session?.id}`);
  
  const session = myTripA.body?.session;
  const sessionId = session?.id;

  record('Tracking session linked to real customer', session?.customerName === 'Aarav Sharma' && session?.customerIdCode === 'ZLV-CUS-000116', `Customer: ${session?.customerName}, Code: ${session?.customerIdCode}`);
  record('Tracking session linked to real driver & vehicle', session?.driverName === 'Tariq Ahmad Bhat' && session?.vehicleRegistrationNumber === 'JK01AB1234', `Driver: ${session?.driverName}, Reg: ${session?.vehicleRegistrationNumber}`);

  // 3. IDOR CHECK: CUSTOMER B CANNOT ACCESS CUSTOMER A'S TRIP
  console.log('\n--- 3. IDOR SECURITY: CUSTOMER B ISOLATION ---');
  const custB = new TestClient();
  const loginResB = await custB.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'navin.kumar.chakraborty2453@gmail.com', password: 'navin0044' }),
  });
  record('Customer B logged in successfully', loginResB.status === 200, `User: ${loginResB.body?.user?.fullName}`);

  const myTripB_tries_A = await custB.request('/api/tracking/my-trip/ZL261002009');
  record('Customer B blocked from Customer A booking (403/404)', myTripB_tries_A.status === 403 || myTripB_tries_A.status === 404, `Status: ${myTripB_tries_A.status}`);

  const custB_post_A_location = await custB.request(`/api/tracking/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify({ latitude: 34.0, longitude: 74.0 }),
  });
  record('Customer B blocked from posting GPS to Customer A session (403)', custB_post_A_location.status === 403, `Status: ${custB_post_A_location.status}`);

  // 4. CUSTOMER GPS PERMISSION & LOCATION TRANSMISSION
  console.log('\n--- 4. CUSTOMER GPS ACTIVATION & TELEMETRY ---');
  const startCustGps = await custA.request(`/api/tracking/${sessionId}/customer/start`, {
    method: 'POST',
  });
  record('Customer location sharing activated', startCustGps.status === 200 && startCustGps.body?.session?.customerTrackingEnabled === true, `Enabled: ${startCustGps.body?.session?.customerTrackingEnabled}`);

  // Srinagar Airport GPS
  const custGpsUpdate = await custA.request(`/api/tracking/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify({
      latitude: 33.9871,
      longitude: 74.7744,
      accuracy: 8.5,
      recordedAt: new Date().toISOString(),
    }),
  });
  record('Customer real GPS accepted by backend', custGpsUpdate.status === 200 && custGpsUpdate.body?.session?.lastCustomerLatitude === 33.9871, `Lat: ${custGpsUpdate.body?.session?.lastCustomerLatitude}`);

  // 5. COORDINATE VALIDATION TEST
  console.log('\n--- 5. COORDINATE BOUNDS VALIDATION ---');
  const invalidLat = await custA.request(`/api/tracking/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify({ latitude: 98.7654, longitude: 74.7744 }),
  });
  record('Invalid latitude (>90) rejected with 400', invalidLat.status === 400, `Status: ${invalidLat.status}`);

  // 6. ADMIN LOGIN & OPERATIONS LIVE TRIPS
  console.log('\n--- 6. ADMIN PORTAL SEARCH & MONITORING ---');
  const adminPassMatch = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/);
  const adminPassword = adminPassMatch ? adminPassMatch[1] : '';

  const admin = new TestClient();
  const adminLogin = await admin.request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ adminId: 'harshad', password: adminPassword }),
  });
  record('Admin authenticated successfully', adminLogin.status === 200, `Admin: ${adminLogin.body?.admin?.adminId}`);

  // Driver GPS Update (as ops/driver)
  const startDriver = await admin.request(`/api/tracking/${sessionId}/driver/start`, {
    method: 'POST',
  });
  record('Driver tracking started on session', startDriver.status === 200, `Status: ${startDriver.status}`);

  // Dal Lake GPS (34.0837, 74.8370)
  const driverGpsUpdate = await admin.request(`/api/tracking/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify({
      latitude: 34.0837,
      longitude: 74.8370,
      accuracy: 12.0,
      actorTypeOverride: 'DRIVER',
      recordedAt: new Date().toISOString(),
    }),
  });
  record('Driver real GPS accepted by backend', driverGpsUpdate.status === 200 && driverGpsUpdate.body?.session?.lastDriverLatitude === 34.0837, `Lat: ${driverGpsUpdate.body?.session?.lastDriverLatitude}`);

  const distanceKm = driverGpsUpdate.body?.session?.calculatedDistanceKm;
  record('Accurate Haversine distance calculated', distanceKm !== null && distanceKm > 11 && distanceKm < 13, `Calculated Distance: ${distanceKm} km (Expected ~12.2 km)`);

  // Admin Searches
  const searchByCustName = await admin.request('/api/admin/live-trips?search=Aarav');
  record('Admin search by Customer Name', searchByCustName.status === 200 && searchByCustName.body?.trips?.some(t => t.id === sessionId), `Found ${searchByCustName.body?.trips?.length} trips`);

  const searchByCustId = await admin.request('/api/admin/live-trips?search=ZLV-CUS-000116');
  record('Admin search by Customer ID', searchByCustId.status === 200 && searchByCustId.body?.trips?.some(t => t.id === sessionId), `Found ${searchByCustId.body?.trips?.length} trips`);

  const searchByBooking = await admin.request('/api/admin/live-trips?search=ZL261002009');
  record('Admin search by Booking ID', searchByBooking.status === 200 && searchByBooking.body?.trips?.some(t => t.id === sessionId), `Found ${searchByBooking.body?.trips?.length} trips`);

  const searchByDriver = await admin.request('/api/admin/live-trips?search=Tariq');
  record('Admin search by Driver Name', searchByDriver.status === 200 && searchByDriver.body?.trips?.some(t => t.id === sessionId), `Found ${searchByDriver.body?.trips?.length} trips`);

  const searchByVehicle = await admin.request('/api/admin/live-trips?search=JK01AB1234');
  record('Admin search by Vehicle Number', searchByVehicle.status === 200 && searchByVehicle.body?.trips?.some(t => t.id === sessionId), `Found ${searchByVehicle.body?.trips?.length} trips`);

  // Admin live trip detail inspection
  const liveTripDetail = await admin.request(`/api/admin/live-trips/${sessionId}`);
  record('Admin fetches detailed tracking stream snapshot', liveTripDetail.status === 200 && liveTripDetail.body?.session?.id === sessionId, `Distance: ${liveTripDetail.body?.session?.calculatedDistanceKm} km`);

  // 7. CUSTOMER EMERGENCY SOS
  console.log('\n--- 7. EMERGENCY SOS WORKFLOW ---');
  const sosTrigger = await custA.request(`/api/tracking/${sessionId}/emergency`, {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Vehicle flat tire on highway near Awantipora. Requiring assistance.',
      emergencyType: 'VEHICLE_BREAKDOWN',
    }),
  });
  record('Customer triggers Emergency SOS', sosTrigger.status === 200 && sosTrigger.body?.session?.emergencyAlertActive === true, `Alert Active: ${sosTrigger.body?.session?.emergencyAlertActive}`);

  // Admin verifies SOS received
  const sosTripCheck = await admin.request(`/api/admin/live-trips/${sessionId}`);
  record('Admin receives active Emergency Alert', sosTripCheck.body?.session?.emergencyAlertActive === true, `Reason: ${sosTripCheck.body?.session?.emergencyAlertReason}`);

  // Admin resolves SOS
  const sosResolve = await admin.request(`/api/tracking/${sessionId}/emergency/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      resolutionNotes: 'Local road assistance dispatched. Spare tire mounted. Traveler safe.',
    }),
  });
  record('Admin resolves Emergency Alert', sosResolve.status === 200 && sosResolve.body?.session?.emergencyAlertActive === false, `Resolved: ${!sosResolve.body?.session?.emergencyAlertActive}`);

  // 8. AUTO-STOP / CONCLUDE TRIP
  console.log('\n--- 8. AUTO-STOP & TRIP CONCLUSION ---');
  const stopDriver = await admin.request(`/api/tracking/${sessionId}/driver/stop`, {
    method: 'POST',
  });
  record('Trip completed and tracking stopped server-side', stopDriver.status === 200 && stopDriver.body?.session?.status === 'COMPLETED', `Status: ${stopDriver.body?.session?.status}`);

  const postAfterStop = await custA.request(`/api/tracking/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify({ latitude: 34.0, longitude: 74.0 }),
  });
  record('Further GPS updates rejected on completed session (400)', postAfterStop.status === 400, `Status: ${postAfterStop.status}`);

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${results.length}`);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`PASSED: ${passedCount} / ${results.length}`);
  console.log('====================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runE2EVerification().catch(err => {
  console.error('E2E Verification threw unexpected error:', err);
  process.exit(1);
});

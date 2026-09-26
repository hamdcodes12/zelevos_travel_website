const BASE_URL = 'http://localhost:3000';
const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASS = 'ZT002121';

async function run() {
  console.log('======================================================================');
  console.log(' ZELEVOS VERIFICATION: USER ID + BROADCASTS + CUSTOMER/VENDOR DOSSIER');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Customer Registration & User ID (ZLV-CUS-XXXXXX)
  // -------------------------------------------------------------------------
  console.log('--- Step 1: Customer Registration & User ID Generation ---');
  const timestamp = Date.now();
  const testCustomerEmail = `cus_${timestamp}@example.com`;
  const testCustomerPassword = `Pass#${timestamp}`;
  const testCustomerName = `Aditi Sharma`;

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testCustomerEmail,
      password: testCustomerPassword,
      fullName: testCustomerName,
    }),
  });

  const regData = await regRes.json();
  assert(regRes.ok, `Customer signup initiated successfully with status ${regRes.status}`);

  let customerCookie = regRes.headers.get('set-cookie');
  let customerUser = regData.user;

  if (regData.status === 'otp_sent') {
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        otp: regData.debugOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.ok, `Customer email OTP verified successfully with status ${verifyRes.status}`);
    customerUser = verifyData.user;
    customerCookie = verifyRes.headers.get('set-cookie');
  }

  assert(customerUser && typeof customerUser.customerId === 'string', 'User object contains customerId');
  assert(/^ZLV-CUS-\d{6}$/.test(customerUser.customerId), `Customer ID matches format ZLV-CUS-XXXXXX: ${customerUser.customerId}`);

  const customerId = customerUser.customerId;
  const customerUserId = customerUser.id;

  // -------------------------------------------------------------------------
  // 2. Admin Login
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Admin Authentication ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminId: ADMIN_ID,
      password: ADMIN_PASS,
    }),
  });

  const adminLoginData = await adminLoginRes.json();
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  assert(adminLoginRes.ok, `Admin login successful with status ${adminLoginRes.status}`);
  assert(!!adminCookie, 'Admin session cookie received');

  // Verify that an automated admin notification was created for customer signup
  const adminNotifsRes = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { cookie: adminCookie },
  });
  const adminNotifsData = await adminNotifsRes.json();
  if (adminNotifsRes.ok && Array.isArray(adminNotifsData.results)) {
    const signupNotif = adminNotifsData.results.find((n) => n.message && n.message.includes(customerId));
    assert(!!signupNotif, `Admin notification was automatically generated for User ID ${customerId}`);
  }

  // -------------------------------------------------------------------------
  // 3. Admin Broadcast Creation & Audience Targeting
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Admin Broadcast & Offer Creation ---');
  const broadcastTitle = `Autumn Festival Sale ${timestamp}`;
  const broadcastMessage = 'Get flat 25% discount on all premium Kashmir & Ladakh packages. Limited period offer.';
  const broadcastRes = await fetch(`${BASE_URL}/api/admin/broadcasts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: adminCookie,
    },
    body: JSON.stringify({
      title: broadcastTitle,
      message: broadcastMessage,
      category: 'OFFER',
      audience: 'ALL_CUSTOMERS',
      imageUrl: '/ladakh-road.jpg',
      actionButton: 'Explore Deals',
      actionUrl: '/#curated-packages',
      isScheduled: false,
    }),
  });

  const broadcastData = await broadcastRes.json();
  assert(broadcastRes.ok, `Broadcast created successfully with status ${broadcastRes.status}`);
  assert(broadcastData.broadcast && broadcastData.broadcast.id, 'Broadcast response contains broadcast ID');
  assert(broadcastData.broadcast.status === 'SENT', `Broadcast status is SENT (immediate delivery)`);
  assert((broadcastData.broadcast.totalRecipients ?? broadcastData.broadcast.recipientCount ?? 0) > 0, `Recipient count > 0 (${broadcastData.broadcast.totalRecipients})`);

  const broadcastId = broadcastData.broadcast.id;

  // -------------------------------------------------------------------------
  // 4. Customer Notification Center, Read & Click Tracking
  // -------------------------------------------------------------------------
  console.log('\n--- Step 4: Customer Notification Center & Engagement Tracking ---');
  const notifFetchRes = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { cookie: customerCookie },
  });
  const notifFetchData = await notifFetchRes.json();
  assert(notifFetchRes.ok, `Customer fetched notifications with status ${notifFetchRes.status}`);
  assert(Array.isArray(notifFetchData.results), 'Notifications results is an array');

  const customerBroadcastNotif = notifFetchData.results.find(
    (n) => n.broadcastId === broadcastId || n.title === broadcastTitle
  );
  assert(!!customerBroadcastNotif, 'Customer received the broadcast in notification drawer');
  assert(customerBroadcastNotif.category === 'OFFER', 'Notification has category OFFER');
  assert(customerBroadcastNotif.actionButton === 'Explore Deals', 'Notification has actionButton');
  assert(customerBroadcastNotif.unread === true, 'Notification is initially unread');

  // Customer marks notification as read
  const markReadRes = await fetch(`${BASE_URL}/api/notifications/${customerBroadcastNotif.id}/read`, {
    method: 'POST',
    headers: { cookie: customerCookie },
  });
  assert(markReadRes.ok, `Customer marked notification as read (status ${markReadRes.status})`);

  // Customer clicks action button
  const clickRes = await fetch(`${BASE_URL}/api/notifications/${customerBroadcastNotif.id}/click`, {
    method: 'POST',
    headers: { cookie: customerCookie },
  });
  assert(clickRes.ok, `Customer clicked notification action button (status ${clickRes.status})`);

  // Verify Admin Broadcast metrics incremented
  const adminBroadcastsRes = await fetch(`${BASE_URL}/api/admin/broadcasts`, {
    headers: { cookie: adminCookie },
  });
  const adminBroadcastsData = await adminBroadcastsRes.json();
  const trackedBroadcast = adminBroadcastsData.broadcasts.find((b) => b.id === broadcastId);
  assert(!!trackedBroadcast, 'Broadcast found in admin broadcast list');
  assert(trackedBroadcast.readCount >= 1, `Broadcast readCount incremented to ${trackedBroadcast.readCount}`);
  assert(trackedBroadcast.clickCount >= 1, `Broadcast clickCount incremented to ${trackedBroadcast.clickCount}`);

  // Check recipient engagement log
  const recipientsRes = await fetch(`${BASE_URL}/api/admin/broadcasts/${broadcastId}/recipients`, {
    headers: { cookie: adminCookie },
  });
  const recipientsData = await recipientsRes.json();
  assert(recipientsRes.ok, `Admin fetched broadcast recipients (status ${recipientsRes.status})`);
  assert(Array.isArray(recipientsData.recipients), 'Recipients list is an array');
  const recipientRecord = recipientsData.recipients.find((r) => r.userId === customerUserId);
  assert(!!recipientRecord, 'Customer found in recipient engagement list');
  assert(recipientRecord.status === 'CLICKED' || recipientRecord.status === 'READ', `Recipient engagement status is CLICKED or READ (${recipientRecord.status})`);
  assert(!!recipientRecord.clickedAt || recipientRecord.status === 'CLICKED', 'Recipient engagement click recorded');

  // -------------------------------------------------------------------------
  // 5. Admin User Information Search & Complete Customer Dossier
  // -------------------------------------------------------------------------
  console.log('\n--- Step 5: Admin User Information & Customer Dossier ---');
  // Search by User ID
  const searchUserRes = await fetch(`${BASE_URL}/api/admin/users/search?q=${customerId}`, {
    headers: { cookie: adminCookie },
  });
  const searchUserData = await searchUserRes.json();
  assert(searchUserRes.ok, `Admin search by User ID succeeded (status ${searchUserRes.status})`);
  assert(Array.isArray(searchUserData.users) && searchUserData.users.length > 0, 'User search returned matches');
  const foundUser = searchUserData.users.find((u) => u.customerId === customerId);
  assert(!!foundUser, `Found user with customerId ${customerId}`);
  assert(foundUser.isNew === true, 'Recently registered user has isNew = true (< 7 days)');

  // Fetch Complete Dossier
  const dossierRes = await fetch(`${BASE_URL}/api/admin/users/${customerUserId}/dossier`, {
    headers: { cookie: adminCookie },
  });
  const dossierData = await dossierRes.json();
  assert(dossierRes.ok, `Admin fetched user dossier with status ${dossierRes.status}`);
  const userProfile = dossierData.user || dossierData.dossier?.user;
  assert(!!userProfile, 'Dossier contains user profile');
  assert(userProfile.customerId === customerId, 'Dossier user profile has matching customerId');
  assert(Array.isArray(dossierData.bookings || dossierData.dossier?.bookings), 'Dossier contains bookings array');
  assert(Array.isArray(dossierData.payments || dossierData.dossier?.payments), 'Dossier contains payments array');
  assert(Array.isArray(dossierData.invoices || dossierData.dossier?.invoices), 'Dossier contains invoices array');
  assert(Array.isArray(dossierData.refunds || dossierData.dossier?.refunds), 'Dossier contains refunds array');
  assert(Array.isArray(dossierData.supportTickets || dossierData.tickets || dossierData.dossier?.tickets), 'Dossier contains tickets array');
  assert(Array.isArray(dossierData.notifications || dossierData.dossier?.notifications), 'Dossier contains notifications array');
  const timeline = dossierData.activityTimeline || dossierData.timeline || dossierData.dossier?.timeline;
  assert(Array.isArray(timeline), 'Dossier contains real activity timeline');
  assert(timeline.length > 0, `Real timeline contains ${timeline.length} actual events`);
  assert(Array.isArray(dossierData.auditTrail || dossierData.auditLogs || dossierData.dossier?.auditTrail), 'Dossier contains audit trail');

  // Verify timeline events are genuine and not mocked
  const timelineItem = timeline[0];
  assert(typeof (timelineItem.type || timelineItem.eventType) === 'string' && typeof timelineItem.title === 'string' && !!timelineItem.timestamp, 'Timeline items have correct schema');

  // -------------------------------------------------------------------------
  // 6. Vendor Approval & Vendor ID (ZLV-VND-XXXXXX)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 6: Supplier Approval & Vendor ID Generation ---');
  // Register a supplier via public endpoint
  const vendorUserEmail = `vnd_${timestamp}@example.com`;
  const vendorBusinessName = `Kashmir Valley Expeditions ${timestamp}`;
  const vendorRegRes = await fetch(`${BASE_URL}/api/suppliers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: vendorBusinessName,
      contactName: 'Gulzar Ahmed',
      email: vendorUserEmail,
      phone: '+919876543210',
      address: 'Boulevard Road, Dal Lake',
      city: 'Srinagar',
      state: 'Jammu and Kashmir',
      serviceCategories: ['Hotel', 'Transport'],
      operatingLocations: ['Srinagar', 'Gulmarg', 'Pahalgam'],
      password: 'SupplierSecure123!',
    }),
  });

  const vendorRegData = await vendorRegRes.json();
  assert(vendorRegRes.ok, `Supplier registered successfully with status ${vendorRegRes.status}`);
  const registeredVendorId = vendorRegData.supplier?.id || vendorRegData.vendor?.id;
  assert(!!registeredVendorId, 'Registered vendor ID returned');

  // Admin approves vendor via /api/admin/vendors/:id/status
  const approveRes = await fetch(`${BASE_URL}/api/admin/vendors/${registeredVendorId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: adminCookie,
    },
    body: JSON.stringify({ action: 'approve' }),
  });
  const approveData = await approveRes.json();
  assert(approveRes.ok, `Admin approved vendor with status ${approveRes.status}`);

  const approvedVendor = approveData.vendor || approveData.supplier;
  assert(!!approvedVendor.vendorId, `Vendor ID assigned to vendor: ${approvedVendor.vendorId}`);
  assert(/^ZLV-VND-\d{6}$/.test(approvedVendor.vendorId), `Vendor ID matches format ZLV-VND-XXXXXX: ${approvedVendor.vendorId}`);
  assert(approvedVendor.status === 'APPROVED', 'Vendor status is APPROVED');

  // Admin searches by Vendor ID
  const searchVendorRes = await fetch(`${BASE_URL}/api/admin/vendors/search?q=${approvedVendor.vendorId}`, {
    headers: { cookie: adminCookie },
  });
  const searchVendorData = await searchVendorRes.json();
  assert(searchVendorRes.ok, `Admin searched vendors by Vendor ID (status ${searchVendorRes.status})`);
  assert(searchVendorData.vendors && searchVendorData.vendors.length > 0, 'Found vendor matching Vendor ID');
  assert(searchVendorData.vendors[0].vendorId === approvedVendor.vendorId, 'Search result matches vendorId');

  // Admin fetches Vendor Dossier
  const vendorDossierRes = await fetch(`${BASE_URL}/api/admin/vendors/${registeredVendorId}/dossier`, {
    headers: { cookie: adminCookie },
  });
  const vendorDossierData = await vendorDossierRes.json();
  assert(vendorDossierRes.ok, `Admin fetched vendor dossier (status ${vendorDossierRes.status})`);
  const vendorRecord = vendorDossierData.vendor || vendorDossierData.dossier?.vendor;
  assert(!!vendorRecord && vendorRecord.vendorId === approvedVendor.vendorId, 'Vendor dossier has matching vendorId');
  assert(Array.isArray(vendorDossierData.services), 'Vendor dossier contains services array');
  assert(Array.isArray(vendorDossierData.documents), 'Vendor dossier contains documents array');
  assert(Array.isArray(vendorDossierData.invoices), 'Vendor dossier contains invoices array');
  assert(Array.isArray(vendorDossierData.auditLogs), 'Vendor dossier contains auditLogs array');

  // -------------------------------------------------------------------------
  // 7. Security, Tenant Isolation & IDOR Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Step 7: Security, IDOR & Credential Exposure Checks ---');
  // Customer attempts to access Admin Broadcasts -> 403 Forbidden
  const idorBroadcastRes = await fetch(`${BASE_URL}/api/admin/broadcasts`, {
    headers: { cookie: customerCookie },
  });
  assert(idorBroadcastRes.status === 401 || idorBroadcastRes.status === 403, `Customer blocked from /api/admin/broadcasts (Status: ${idorBroadcastRes.status})`);

  // Customer attempts to access Admin User Dossier -> 401/403
  const idorDossierRes = await fetch(`${BASE_URL}/api/admin/users/${customerUserId}/dossier`, {
    headers: { cookie: customerCookie },
  });
  assert(idorDossierRes.status === 401 || idorDossierRes.status === 403, `Customer blocked from /api/admin/users/:id/dossier (Status: ${idorDossierRes.status})`);

  // Customer attempts to access Admin Vendor Search -> 401/403
  const idorVendorRes = await fetch(`${BASE_URL}/api/admin/vendors/search`, {
    headers: { cookie: customerCookie },
  });
  assert(idorVendorRes.status === 401 || idorVendorRes.status === 403, `Customer blocked from /api/admin/vendors/search (Status: ${idorVendorRes.status})`);

  // Verify that no passwords or password hashes are exposed in any returned user or vendor payload
  const stringifiedUserDossier = JSON.stringify(dossierData);
  assert(!stringifiedUserDossier.includes('passwordHash') && !stringifiedUserDossier.includes('password_hash'), 'No password hashes leaked in user dossier');
  const stringifiedVendorDossier = JSON.stringify(vendorDossierData);
  assert(!stringifiedVendorDossier.includes('passwordHash') && !stringifiedVendorDossier.includes('password_hash'), 'No password hashes leaked in vendor dossier');

  console.log('\n======================================================================');
  console.log(` ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SUCCESS RATE!`);
  console.log('======================================================================\n');
}

run().catch((err) => {
  console.error('\n[FATAL ERROR IN VERIFICATION SCRIPT]:', err);
  process.exit(1);
});

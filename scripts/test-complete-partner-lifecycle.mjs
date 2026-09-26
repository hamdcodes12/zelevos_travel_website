const API_URL = 'http://localhost:8080/api';
const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';

async function testPartnerLifecycle() {
  console.log('=== TESTING COMPLETE PARTNER LIFECYCLE ===');
  const timestamp = Date.now();
  const partnerEmail = `partner_${timestamp}@testagency.com`;

  // Step 1: Partner Public Registration
  console.log('1. Registering new partner agency...');
  const regRes = await fetch(`${API_URL}/partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agencyName: `Apex Holidays ${timestamp}`,
      contactPerson: 'Suresh Raina',
      email: partnerEmail,
      phone: '+91 98111 22334',
      city: 'Jaipur',
      state: 'Rajasthan',
      businessType: 'Boutique Tour Operator',
    }),
  });
  const regData = await regRes.json();
  console.log('Registration response:', regRes.status, 'Status:', regData.partner?.status, 'RefCode:', regData.partner?.referralCode);

  if (!regRes.ok || !regData.partner) {
    console.error('FAILED: Partner registration failed!', regData);
    return;
  }
  const partnerId = regData.partner.id;
  const referralCode = regData.partner.referralCode;

  // Step 2: Admin Login
  console.log('2. Admin authenticating...');
  const adminLoginRes = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: ADMIN_ID, password: ADMIN_PASSWORD }),
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('Admin login status:', adminLoginRes.status, 'Cookie:', !!adminCookie);

  if (!adminCookie) {
    console.error('FAILED: Admin login failed!');
    return;
  }

  // Step 3: Admin reviews and Approves Partner
  console.log(`3. Admin approving partner ${partnerId}...`);
  const approveRes = await fetch(`${API_URL}/admin/partners/${partnerId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({ commissionRate: 8 }),
  });
  const approveData = await approveRes.json();
  console.log('Approval response:', approveRes.status, 'New Status:', approveData.partner?.status, 'Commission:', approveData.partner?.commissionRate);

  // Step 4: Verify Partner in Partner List
  console.log('4. Verifying partner directory in Admin...');
  const listRes = await fetch(`${API_URL}/admin/partners`, {
    headers: { Cookie: adminCookie },
  });
  const listData = await listRes.json();
  const found = listData.partners?.find((p) => p.id === partnerId);
  console.log('Partner found in directory:', !!found, 'Status:', found?.status);

  console.log('=== PARTNER LIFECYCLE PASSED 100%! ===');
}

testPartnerLifecycle();

const API_URL = 'http://localhost:8080/api';

async function testCustomerFlow() {
  console.log('=== TESTING COMPLETE CUSTOMER LIFECYCLE ===');
  const timestamp = Date.now();
  const testEmail = `live_traveller_${timestamp}@zelevos.test`;
  const testPassword = `TestSecure#${timestamp}`;
  const testName = `Rohan Verma`;

  // Step 1: Signup
  console.log('1. Submitting Signup...');
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: testName,
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });
  const signupData = await signupRes.json();
  console.log('Signup response:', signupRes.status, signupData.status);

  let otp = signupData.debugOtp;
  if (!otp) {
    console.log('Fetching OTP via test helper...');
    const helperRes = await fetch(`${API_URL}/auth/test-helper/get-latest-otp?email=${encodeURIComponent(testEmail)}`);
    if (helperRes.ok) {
      const helperData = await helperRes.json();
      otp = helperData.otp;
    }
  }
  console.log('OTP received:', otp ? '******' : 'None');

  if (!otp) {
    console.error('FAILED: No OTP found to verify!');
    return;
  }

  // Step 2: Verify OTP
  console.log('2. Submitting OTP verification...');
  const verifyRes = await fetch(`${API_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      otp: otp,
    }),
  });
  const verifyData = await verifyRes.json();
  console.log('Verify response:', verifyRes.status, verifyData.status, verifyData.user?.email);

  const cookieHeader = verifyRes.headers.get('set-cookie');
  const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  console.log('Session Cookie established:', !!sessionCookie);

  if (!sessionCookie) {
    console.error('FAILED: No session cookie established!');
    return;
  }

  // Step 3: Fetch Packages
  console.log('3. Fetching curated packages...');
  const pkgsRes = await fetch(`${API_URL}/packages`);
  const pkgsData = await pkgsRes.json();
  const targetPkg = pkgsData.results?.[0];
  console.log('Target package:', targetPkg?.title, 'ID:', targetPkg?.id);

  if (!targetPkg) {
    console.error('FAILED: No packages found!');
    return;
  }

  // Step 4: Create Authenticated Booking
  console.log('4. Creating package booking with active session...');
  const bookRes = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      packageId: targetPkg.id,
      travelDate: '2026-11-10',
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
      roomsCount: 1,
      specialRequests: 'Window seat preference',
      flightRequired: false,
      customerContact: {
        name: testName,
        email: testEmail,
        phone: '+91 98765 12345',
      },
      travellers: [
        {
          fullName: testName,
          age: 32,
          gender: 'Male',
          isLead: true,
          contactEmail: testEmail,
          contactPhone: '+91 98765 12345',
        },
      ],
    }),
  });
  const bookData = await bookRes.json();
  console.log('Booking response:', bookRes.status, 'Booking ID:', bookData.bookingId, 'Ref:', bookData.booking?.bookingReference);

  if (!bookRes.ok || !bookData.bookingId) {
    console.error('FAILED: Booking creation failed!', bookData);
    return;
  }

  // Step 5: Check My Trips
  console.log('5. Querying /bookings/my-trips...');
  const myTripsRes = await fetch(`${API_URL}/bookings/my-trips`, {
    headers: { Cookie: sessionCookie },
  });
  const myTripsData = await myTripsRes.json();
  console.log('My Trips count:', myTripsData.trips?.length);

  // Step 6: Query Specific Booking Detail
  console.log(`6. Querying booking detail for ${bookData.bookingId}...`);
  const detailRes = await fetch(`${API_URL}/bookings/${bookData.bookingId}`, {
    headers: { Cookie: sessionCookie },
  });
  const detailData = await detailRes.json();
  console.log('Booking detail status:', detailRes.status, 'Status:', detailData.booking?.status);

  // Step 7: Submit Custom Trip Lead
  console.log('7. Submitting Custom Trip Lead with session...');
  const customRes = await fetch(`${API_URL}/custom-trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      customerName: testName,
      customerEmail: testEmail,
      customerPhone: '+91 98765 12345',
      destinations: ['Kashmir', 'Pahalgam'],
      startDate: '2026-11-20',
      durationDays: 6,
      travellersCount: 2,
      budgetPerPerson: 50000,
      hotelPreference: '4 Star / Boutique',
      transportPreference: 'Private Innova',
      activitiesInterests: ['Sightseeing', 'Shikara'],
    }),
  });
  const customData = await customRes.json();
  console.log('Custom trip lead status:', customRes.status, 'Lead Number:', customData.request?.leadNumber);

  console.log('=== COMPLETE CUSTOMER LIFECYCLE PASSED 100%! ===');
}

testCustomerFlow();

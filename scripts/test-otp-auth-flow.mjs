// Test script for full Email OTP Verification & Login Enforcement
const BASE_URL = 'http://localhost:8080/api';

async function runTests() {
  console.log('--- STARTING EMAIL OTP AUTH FLOW TEST ---');
  const testEmail = `traveller_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Aarav Sharma';

  // 1. Try to log in with an account that has never been created
  console.log('\n[TEST 1] Logging in with non-existent user...');
  const res1 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data1 = await res1.json();
  console.log('Result 1 (Expected 401):', res1.status, data1);
  if (res1.status !== 401) throw new Error('Test 1 failed: non-existent account should return 401');

  // 2. Signup new account
  console.log('\n[TEST 2] Signing up new account with email:', testEmail);
  const res2 = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: testName,
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      phone: '+91 9876543210',
    }),
  });
  const data2 = await res2.json();
  console.log('Result 2 (Expected otp_sent):', res2.status, data2);
  if (data2.status !== 'otp_sent') throw new Error('Test 2 failed: status should be otp_sent');
  const otp = data2.debugOtp;
  console.log('Captured OTP:', otp);

  // 3. Try to log in while unverified
  console.log('\n[TEST 3] Trying to log in before verifying OTP...');
  const res3 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data3 = await res3.json();
  console.log('Result 3 (Expected 403 email_not_verified):', res3.status, data3);
  if (res3.status !== 403 || data3.status !== 'email_not_verified') {
    throw new Error('Test 3 failed: unverified login should return 403 email_not_verified');
  }

  // 4. Try verifying with wrong OTP
  console.log('\n[TEST 4] Submitting wrong OTP (000000)...');
  const res4 = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: '000000' }),
  });
  const data4 = await res4.json();
  console.log('Result 4 (Expected 400 invalid_otp):', res4.status, data4);
  if (res4.status !== 400 || data4.status !== 'invalid_otp') {
    throw new Error('Test 4 failed: wrong OTP should return 400 invalid_otp');
  }

  // 5. Verify with correct OTP
  console.log('\n[TEST 5] Submitting correct OTP:', data3.debugOtp || otp);
  const activeOtp = data3.debugOtp || otp;
  const res5 = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: activeOtp }),
  });
  const data5 = await res5.json();
  console.log('Result 5 (Expected 200 verified):', res5.status, data5);
  if (res5.status !== 200 || data5.status !== 'verified' || !data5.user.emailVerified) {
    throw new Error('Test 5 failed: verification should return 200 verified with emailVerified: true');
  }

  // 6. Try duplicate signup with the verified account
  console.log('\n[TEST 6] Attempting duplicate signup with verified email...');
  const res6 = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: testName,
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });
  const data6 = await res6.json();
  console.log('Result 6 (Expected 409 email_taken):', res6.status, data6);
  if (res6.status !== 409 || data6.status !== 'email_taken') {
    throw new Error('Test 6 failed: duplicate verified email must be rejected with 409 email_taken');
  }

  // 7. Login with the now-verified account
  console.log('\n[TEST 7] Logging in with now-verified account...');
  const res7 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data7 = await res7.json();
  console.log('Result 7 (Expected 200 with user):', res7.status, data7);
  if (res7.status !== 200 || !data7.user || !data7.user.emailVerified) {
    throw new Error('Test 7 failed: verified account login should succeed with status 200');
  }

  console.log('\n🎉 ALL 7 OTP VERIFICATION & LOGIN ENFORCEMENT TESTS PASSED PERFECTLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});

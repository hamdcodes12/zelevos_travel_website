async function audit() {
  const tests = [
    // 1. Success cases
    { name: 'Admin login success', method: 'POST', url: 'http://localhost:8080/api/admin/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: 'zelevos-travelai00', password: 'ZT002121' }) },
    { name: 'Customer signup success', method: 'POST', url: 'http://localhost:8080/api/auth/signup', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test_' + Date.now() + '@example.com', password: 'Password123!', confirmPassword: 'Password123!', fullName: 'Test User' }) },
    { name: 'Customer login success', method: 'POST', url: 'http://localhost:8080/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'testuser_probe1@example.com', password: 'Password123!' }) },
    { name: 'Partner register success', method: 'POST', url: 'http://localhost:8080/api/partners/register', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agencyName: 'Agency ' + Date.now(), contactName: 'Contact Person', email: 'partner_' + Date.now() + '@example.com', phone: '+91 98765 43210' }) },

    // 2. Invalid credentials
    { name: 'Admin login invalid creds', method: 'POST', url: 'http://localhost:8080/api/admin/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: 'bad', password: 'bad' }) },
    { name: 'Customer login invalid creds', method: 'POST', url: 'http://localhost:8080/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bad@example.com', password: 'bad' }) },

    // 3. Validation errors
    { name: 'Admin login empty body', method: 'POST', url: 'http://localhost:8080/api/admin/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    { name: 'Customer signup invalid email', method: 'POST', url: 'http://localhost:8080/api/auth/signup', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'notanemail', password: 'short' }) },
    { name: 'Customer login empty body', method: 'POST', url: 'http://localhost:8080/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    { name: 'Partner register empty body', method: 'POST', url: 'http://localhost:8080/api/partners/register', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },

    // 4. Duplicate account
    { name: 'Customer signup duplicate', method: 'POST', url: 'http://localhost:8080/api/auth/signup', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'testuser_probe1@example.com', password: 'Password123!', fullName: 'Duplicate' }) },
    { name: 'Partner register duplicate', method: 'POST', url: 'http://localhost:8080/api/partners/register', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agencyName: 'Probe Agency', contactName: 'Probe Contact', email: 'probe_partner@example.com', phone: '+91 98765 43210' }) },

    // 5. Unauthorized
    { name: 'Admin me unauthorized', method: 'GET', url: 'http://localhost:8080/api/admin/me' },
    { name: 'Customer user unauthorized', method: 'GET', url: 'http://localhost:8080/api/auth/user' },
    { name: 'Partner dashboard unauthorized', method: 'GET', url: 'http://localhost:8080/api/partners/dashboard' },

    // 6. Logouts (check if they return empty body / 204!)
    { name: 'Customer logout', method: 'POST', url: 'http://localhost:8080/api/auth/logout' },
    { name: 'Admin logout', method: 'POST', url: 'http://localhost:8080/api/admin/logout' },

    // 7. Non-matching / 404 routes under auth
    { name: 'Auth unknown route 404', method: 'GET', url: 'http://localhost:8080/api/auth/unknown' },
    { name: 'Admin unknown route 404', method: 'GET', url: 'http://localhost:8080/api/admin/unknown' },
    { name: 'Partners unknown route 404', method: 'GET', url: 'http://localhost:8080/api/partners/unknown' },
    { name: 'Method not allowed (GET admin login)', method: 'GET', url: 'http://localhost:8080/api/admin/login' },
    { name: 'Method not allowed (GET signup)', method: 'GET', url: 'http://localhost:8080/api/auth/signup' },

    // 8. Trailing slashes
    { name: 'Admin login trailing slash', method: 'POST', url: 'http://localhost:8080/api/admin/login/', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: 'bad', password: 'bad' }) },
    { name: 'Customer login trailing slash', method: 'POST', url: 'http://localhost:8080/api/auth/login/', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bad@example.com', password: 'bad' }) },

    // 9. Malformed JSON body (e.g. empty or broken)
    { name: 'Admin login broken json body', method: 'POST', url: 'http://localhost:8080/api/admin/login', headers: { 'Content-Type': 'application/json' }, body: '{invalid-json' },
    { name: 'Customer signup empty text body with json header', method: 'POST', url: 'http://localhost:8080/api/auth/signup', headers: { 'Content-Type': 'application/json' }, body: '' },

    // 10. CORS preflight OPTIONS
    { name: 'Admin login OPTIONS preflight', method: 'OPTIONS', url: 'http://localhost:8080/api/admin/login', headers: { 'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } },
    { name: 'Customer signup OPTIONS preflight', method: 'OPTIONS', url: 'http://localhost:8080/api/auth/signup', headers: { 'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, { method: t.method, headers: t.headers, body: t.body });
      const ct = res.headers.get('content-type') || 'NONE';
      const text = await res.text();
      let isValidJson = false;
      try {
        JSON.parse(text);
        isValidJson = true;
      } catch (e) {}

      const isEmpty = text.trim() === '';
      const flag = (!isValidJson || isEmpty) ? 'FAIL NON-JSON' : 'PASS JSON';
      console.log(`${flag} [${res.status}] ${t.name} -> Content-Type: ${ct}, Length: ${text.length}, Body: ${text.slice(0, 60)}`);
    } catch (err) {
      console.log(`FETCH ERROR ${t.name}:`, err.message);
    }
  }
}
audit();

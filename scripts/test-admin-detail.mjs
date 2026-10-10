import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
const adminPassword = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/)[1];

async function check() {
  const login = await fetch('http://127.0.0.1:8080/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: 'harshad', password: adminPassword })
  });
  const cookie = login.headers.get('set-cookie');
  console.log('Admin login status:', login.status);

  const trips = await fetch('http://127.0.0.1:8080/api/admin/live-trips', {
    headers: { Cookie: cookie }
  });
  const tripsData = await trips.json();
  const trip = tripsData.trips[0];
  console.log('First trip:', trip?.id, trip?.customerName, trip?.bookingId);

  const detail = await fetch('http://127.0.0.1:8080/api/admin/live-trips/' + trip.id, {
    headers: { Cookie: cookie }
  });
  const detailData = await detail.json();
  console.log('Detail response status:', detail.status);
  console.log('Detail session:', detailData.session?.id, detailData.session?.customerName, detailData.session?.bookingRef, detailData.session?.calculatedDistanceKm);
}
check();

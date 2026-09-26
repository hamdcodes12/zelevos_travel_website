import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('1. Creating real order on Razorpay Live API...');
  const key = 'rzp_live_TTyaLgbbCrNkzI';
  const secret = 'jtn4MiUNCfn02pOVXYmbiukA';
  const auth = Buffer.from(key + ':' + secret).toString('base64');

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: 4370000, // 43,700 INR in paise
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    })
  });
  const orderData = await orderRes.json();
  console.log('Razorpay Order ID:', orderData.id);

  console.log('2. Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,960']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });

  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('3. Triggering Razorpay Checkout directly in page...');
  await page.evaluate(async (orderId) => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: 'rzp_live_TTyaLgbbCrNkzI',
          amount: 4370000,
          currency: 'INR',
          name: 'Zelevos Travel Marketplace',
          description: 'Royal Kashmir Luxury Houseboat & Shikara Deal',
          order_id: orderId,
          prefill: {
            name: 'Rohan Sharma',
            email: 'traveler99@zelevos.com',
            contact: '9876543210'
          },
          theme: { color: '#214ecf' }
        });
        rzp.open();
        resolve(true);
      };
      document.body.appendChild(script);
    });
  }, orderData.id);

  console.log('4. Waiting 8 seconds for Razorpay Modal/Iframe to paint on screen...');
  await new Promise(r => setTimeout(r, 8000));

  const outPath = path.join(rootDir, 'screenshots', 'razorpay_direct_open.png');
  await page.screenshot({ path: outPath });
  console.log('Saved screenshots/razorpay_direct_open.png');

  await browser.close();
  console.log('Done!');
}

run().catch(console.error);

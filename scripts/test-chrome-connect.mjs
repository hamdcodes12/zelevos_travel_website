import puppeteer from 'puppeteer-core';

async function main() {
  console.log('Testing Chrome launch via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2', timeout: 30000 });
  
  const title = await page.title();
  console.log('Successfully opened page. Title:', title);
  
  await browser.close();
  console.log('Chrome test completed successfully.');
}

main().catch(err => {
  console.error('Chrome launch error:', err);
  process.exit(1);
});

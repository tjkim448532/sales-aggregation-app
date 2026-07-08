const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Setup console capturing
  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  page.on('response', response => {
    if (response.url().includes('revenue-summary')) {
      console.log('API RESPONSE STATUS:', response.status());
    }
  });

  await page.goto('https://sales-aggregation-app.vercel.app', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'vercel_screenshot.png' });
  
  const content = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  console.log('Page Text Extract:', content.substring(0, 500));
  
  await browser.close();
})();

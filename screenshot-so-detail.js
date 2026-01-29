const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function takeSODetailScreenshot() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Login first
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to SO detail page
    console.log('Navigating to SO detail page...');
    await page.goto(`${BASE_URL}/sales-orders/1`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000)); // Wait for data load

    // Take full page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-sales-order-detail-with-data.png'),
      fullPage: true,
    });
    console.log('Screenshot: 04-sales-order-detail-with-data.png');

    // Scroll down to see material requirements
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-sales-order-detail-materials.png'),
      fullPage: false,
    });
    console.log('Screenshot: 04-sales-order-detail-materials.png');

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeSODetailScreenshot();

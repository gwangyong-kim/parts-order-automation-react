const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const pages = [
  { name: '01-login', path: '/login', requiresAuth: false },
  { name: '02-dashboard', path: '/', requiresAuth: true },
  { name: '03-sales-orders', path: '/sales-orders', requiresAuth: true },
  { name: '04-sales-order-detail', path: '/sales-orders/1', requiresAuth: true },
  { name: '05-orders', path: '/orders', requiresAuth: true },
  { name: '06-parts', path: '/parts', requiresAuth: true },
  { name: '07-products', path: '/products', requiresAuth: true },
  { name: '08-inventory', path: '/inventory', requiresAuth: true },
];

async function takeScreenshots() {
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
    await new Promise(r => setTimeout(r, 2000)); // Wait for page render

    // Take login page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-login.png'),
      fullPage: false,
    });
    console.log('Screenshot: 01-login.png');

    // Fill login form - use id selectors
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // Extra wait for animations

    // Take screenshots of each page
    for (const pageInfo of pages) {
      if (pageInfo.name === '01-login') continue; // Already done

      console.log(`Navigating to ${pageInfo.path}...`);
      try {
        await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000)); // Wait for animations/data load

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`),
          fullPage: false,
        });
        console.log(`Screenshot: ${pageInfo.name}.png`);
      } catch (err) {
        console.log(`Failed to capture ${pageInfo.name}: ${err.message}`);
      }
    }

    console.log('\nAll screenshots saved to:', SCREENSHOT_DIR);
  } catch (error) {
    console.error('Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots();

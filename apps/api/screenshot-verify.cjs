const path = require('path');
const puppeteer = require('puppeteer');
const ssDir = path.join(process.env.USERPROFILE || process.env.HOME, 'screenshots');
require('fs').mkdirSync(ssDir, { recursive: true });

(async () => {
  const apiUrl = 'https://miracultureeapi-production-cca9.up.railway.app';
  const baseUrl = 'https://mira-culture.com';

  // Login via Node fetch
  const loginRes = await fetch(apiUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mhznewz@gmail.com', password: 'Moonwolf711!' })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);

  if (!loginData.accessToken) {
    console.log('Login failed:', JSON.stringify(loginData));
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--allow-running-insecure-content']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Load homepage first
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Inject auth tokens
  await page.evaluate((data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
  }, loginData);

  // Reload so the app picks up the auth state
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Homepage loaded, token set. Keys:', Object.keys(loginData));

  // Navigate via clicking a nav link that goes to /artist/verify
  // First check if the link exists in the page
  const navResult = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const verifyLink = links.find(a => a.getAttribute('href') === '/artist/verify');
    if (verifyLink) {
      verifyLink.click();
      return 'clicked nav link';
    }
    // Try dashboard link first, then we can navigate from there
    const dashLink = links.find(a => a.getAttribute('href') === '/artist/dashboard' || a.getAttribute('href') === '/dashboard');
    if (dashLink) {
      dashLink.click();
      return 'clicked dashboard link: ' + dashLink.getAttribute('href');
    }
    return 'no links found. All hrefs: ' + links.slice(0, 20).map(a => a.getAttribute('href')).join(', ');
  });
  console.log('Nav result:', navResult);
  await new Promise(r => setTimeout(r, 4000));
  console.log('After nav:', page.url());

  // If we're not on verify page yet, try the verify link from wherever we are now
  if (!page.url().includes('/artist/verify')) {
    const navResult2 = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const verifyLink = links.find(a => a.getAttribute('href') === '/artist/verify');
      if (verifyLink) {
        verifyLink.click();
        return 'clicked verify link';
      }
      return 'no verify link. All hrefs: ' + links.slice(0, 30).map(a => a.getAttribute('href')).join(', ');
    });
    console.log('Nav result 2:', navResult2);
    await new Promise(r => setTimeout(r, 4000));
    console.log('After nav 2:', page.url());
  }

  await page.screenshot({ path: path.join(ssDir, 'artist-verify.png'), fullPage: true });
  console.log('Screenshot saved');

  await browser.close();
})();

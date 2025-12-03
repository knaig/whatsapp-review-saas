const puppeteer = require('puppeteer');
require('dotenv').config({ path: '../.env.local' });

async function run() {
    console.log('Launching Browser for Account Creation...');

    // Launch headful browser
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    console.log('\n--- INSTRUCTIONS ---');
    console.log('1. The browser has launched.');
    console.log('2. It will navigate to Razorpay.');
    console.log('3. Please complete the Signup/Login process manually.');
    console.log('4. Once done, you can close the browser or let this script exit.');
    console.log('--------------------\n');

    try {
        await page.goto('https://razorpay.com/payment-links');

        // Try to click signup
        try {
            const btn = await page.$('a[href*="signup"]');
            if (btn) await btn.click();
        } catch (e) { }

    } catch (e) {
        console.error('Error:', e.message);
    }

    // Keep open
    await new Promise(r => setTimeout(r, 3600000)); // 1 hour
}

run();

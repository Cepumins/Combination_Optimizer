const puppeteer = require('puppeteer');

const CsgoFloat = 'C:/Users/Kristaps/AppData/Local/Google/Chrome/User Data/Profile 2/Extensions/jjicbefpemnphinccgikpdaagjebbnhg/3.0.3_1';

async function run() {
    // Replace with your actual username and password.
    const username = 'brd-customer-hl_ec87417e-zone-data_center';
    const password = 'mqmen5rnjit3';

    // Construct the proxy.
    const proxy = 'http://zproxy.lum-superproxy.io:22225';

    // Launch the browser using the proxy.
    const browser = await puppeteer.launch({
        args: [
            `--load-extension=${CsgoFloat}`,
            `--disable-extensions-except=${CsgoFloat}`,
            `--proxy-server=${proxy}`,
            '--disable-infobars',
            '--disable-web-security'
        ],
        headless: false,
        defaultViewport: null,
    });

    // Go to the test page.
    const page = await browser.newPage();

    // Set up the proxy authentication.
    await page.authenticate({username, password});

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
            req.abort();
        }
        else {
            req.continue();
        }
    });

    await page.setViewport({
        width: 1280,
        height: 1080,
    });

    await page.goto('https://lumtest.com/myip.json');

    // Output the page content.
    const content = await page.content();
    console.log(content);

    //await browser.close();
}

run().catch(console.error);
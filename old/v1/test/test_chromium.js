const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CsgoFloat = 'C:/Users/Kristaps/AppData/Local/Google/Chrome/User Data/Profile 2/Extensions/jjicbefpemnphinccgikpdaagjebbnhg/3.0.3_1';
const SteamIH = 'C:/Users/Kristaps/AppData/Local/Google/Chrome/User Data/Profile 2/Extensions/cmeakgjggjdlcpncigglobpjbkabhmjl/1.18.22_0';

const cookiesFilePath = 'data/steamcommunity.com_cookies.json';

let firstListingPageVisited = false;

async function checkAndSetPageSize100(page) {
    // Wait for the necessary elements to be available
    await page.waitForSelector("#searchResultsTable > csgofloat-utility-belt");
    //console.log("Found csgofloat shadow root");

    // Check if the page size is not 100
    const pageSizeNot100 = await page.evaluate(() => {
        const beltElement = document.querySelector("#searchResultsTable > csgofloat-utility-belt");
        const beltShadowRoot = beltElement.shadowRoot;
        const pageSizeElement = beltShadowRoot.querySelector("div > csgofloat-page-size");
        const pageSizeShadowRoot = pageSizeElement.shadowRoot;
        const selectElement = pageSizeShadowRoot.querySelector("select");
        const option100 = pageSizeShadowRoot.querySelector("select > option:nth-child(5)");

        return selectElement.value !== option100.value;
    });

    // Set the page size to 100 if the page size is not 100
    if (pageSizeNot100) {
        console.log("Page size is not 100, setting to 100");

        await page.evaluate(() => {
            const beltElement = document.querySelector("#searchResultsTable > csgofloat-utility-belt");
            const beltShadowRoot = beltElement.shadowRoot;
            const pageSizeElement = beltShadowRoot.querySelector("div > csgofloat-page-size");
            const pageSizeShadowRoot = pageSizeElement.shadowRoot;
            const selectElement = pageSizeShadowRoot.querySelector("select");
            const option100 = pageSizeShadowRoot.querySelector("select > option:nth-child(5)");

            selectElement.value = option100.value;
            selectElement.dispatchEvent(new Event('change'));
            //console.log("Executed!");
        });
    } else {
        //console.log("Page size is 100, skipping");
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        //userDataDir: 'data/chromium_profile',
        args: [
            //`--load-extension=${CsgoFloat},${SteamIH}`,
            `--load-extension=${CsgoFloat}`,
            '--enable-automation',
            //`--disable-extensions`,
            //'--enable-web-security'
        ],
    });

    const page = await browser.newPage();

    // Set userAgent and extraHTTPHeaders here
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36');

    await page.setViewport({
        width: 1280,
        height: 1080,
    });

    // Listen for requests and check if it's the first occurrence of a URL starting with the desired string
    page.on('request', async request => {
        if (request.url().startsWith('https://steamcommunity.com/market/listings/')) {
            await checkAndSetPageSize100(page);
        }
    });

    // Navigate to a website
    await page.goto('https://steamcommunity.com/market/');
})();
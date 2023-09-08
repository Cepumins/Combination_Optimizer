const puppeteer = require('puppeteer');
// extension path
const CsgoFloat = 'C:/Users/Kristaps/AppData/Local/Google/Chrome/User Data/Profile 2/Extensions/jjicbefpemnphinccgikpdaagjebbnhg/3.0.3_1';

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

async function continuousScroll(page) {
    let uniqueItems = 0;

    const scroll = () => {
        page.evaluate(() => {
            const randomScrollAmount = -100 + Math.random() * 1200;
            window.scrollBy(0, randomScrollAmount);
        });

        page.evaluate(() => {
            const itemNodes = document.querySelectorAll('csgofloat-item-row-wrapper');
            const itemSet = new Set();
            itemNodes.forEach((item) => {
                itemSet.add(item.innerHTML);  // Assumes that the innerHTML is unique for each item
            });
            return itemSet.size;
        }).then(size => {
            uniqueItems = Math.max(uniqueItems, size);
            console.log(`Unique items so far: ${uniqueItems}`);
        });

        // Random interval between 250ms and 1500ms
        const randomInterval = 250 + Math.random() * 1250;
        setTimeout(scroll, randomInterval);
    }

    scroll();

    // Return a function to stop the scrolling
    return () => clearTimeout(scroll);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--load-extension=${CsgoFloat}`,
      `--disable-extensions-except=${CsgoFloat}`,
      '--enable-automation',
    ],
  });

  const page = await browser.newPage();

  // !!!

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
            req.abort();
        }
        else {
            req.continue();
        }
    });

    // !!!

    await page.setViewport({
        width: 1280,
        height: 1080,
    });

  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  let totalBytes = 0;

  client.on('Network.responseReceived', (event) => {
    totalBytes += event.response.encodedDataLength;
  });

  await page.goto('https://steamcommunity.com/market/listings/730/P250%20%7C%20Visions%20%28Battle-Scarred%29');

  // Start continuous scrolling
  //const scrollInterval = await continuousScroll(page);

  await checkAndSetPageSize100(page);

  // Scroll for 15 seconds then stop
  setTimeout(() => {
    clearInterval(scrollInterval);
  }, 25000);

  // Wait for 15 seconds before moving on to the next part of your script
  await new Promise(resolve => setTimeout(resolve, 25000));

  console.log(`Total Bytes: ${totalBytes}`);
  console.log(`Total MB: ${(totalBytes / (1024*1024)).toFixed(2)}`);
  console.log(`Total GB: ${(totalBytes / (1024*1024*1024)).toFixed(2)}`);
  console.log(`Pages on 1 GB: ${(1 / (totalBytes / (1024*1024*1024))).toFixed(2)}`);

  await browser.close();
})();

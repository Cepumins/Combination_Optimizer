//const puppeteer = require('puppeteer');
// Require puppeteer-extra and puppeteer-extra-plugin-stealth
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require('fs');
const csvParser = require('csv-parser');
const readline = require('readline');
const { PythonShell } = require('python-shell');
const os = require('os');

//let collection = "Danger_Zone";
let collection = "Prisma";
rarities_to_update = ["Mil-Spec", "Restricted", "Classified", "Covert"]
//rarities_to_update = ["Restricted"]
let skipTime = 30

prefix = `${collection}`
let collection_CSV = `${prefix}/${collection}.csv`
let prices_CSV = `${prefix}/${collection}_prices.csv`;

let desiredHeader = 'Rarity,Item,MinF,MaxF,Timestamp,CUR,FN,MW,FT,WW,BS,FN ST,MW ST,FT ST,WW ST,BS ST';

if (!fs.existsSync(prices_CSV)) {
  fs.writeFileSync(prices_CSV, desiredHeader, (err) => {
      if (err) throw err;
      console.log('The file has been created!');
  });
}

const parseCSV = (path) =>
  new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(path)
      .pipe(csvParser({ separator: ';' }))
      .on('data', (record) => records.push(record))
      .on('end', () => resolve(records))
      .on('error', reject);
  });

function writeToCSV(data, rarity, minFloat, maxFloat, isFirstEntry = false, secondsToUpdate) {
  const timestamp = new Date();
  timestamp.setSeconds(timestamp.getSeconds() - secondsToUpdate);
  const formattedTimestamp = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;
  
  let output = '';
  let currency = 'EUR';

  const formattedPrices = {};
  const formattedSTPrices = {};
  for (const wear of ['FN', 'MW', 'FT', 'WW', 'BS']) {
    if (data[wear]) {
      formattedPrices[wear] = parseFloat(data[wear]);
    } else {
      formattedPrices[wear] = '';
    }
    
    const statTrakWear = `ST-${wear}`;
    if (data[statTrakWear]) {
      formattedSTPrices[statTrakWear] = parseFloat(data[statTrakWear]);
    } else {
      formattedSTPrices[statTrakWear] = '';
    }
  }
  
  const formatPrice = (price) => {
    if (price !== null && typeof price === 'number') {
        return price.toFixed(2);
    } else {
        return null;
    }
  };

  const newData = `${rarity},${data.name},${minFloat},${maxFloat},${formattedTimestamp},${currency},`
  + `${formatPrice(formattedPrices.FN)},`
  + `${formatPrice(formattedPrices.MW)},`
  + `${formatPrice(formattedPrices.FT)},`
  + `${formatPrice(formattedPrices.WW)},`
  + `${formatPrice(formattedPrices.BS)},`
  + `${formatPrice(formattedSTPrices['ST-FN'])},`
  + `${formatPrice(formattedSTPrices['ST-MW'])},`
  + `${formatPrice(formattedSTPrices['ST-FT'])},`
  + `${formatPrice(formattedSTPrices['ST-WW'])},`
  + `${formatPrice(formattedSTPrices['ST-BS'])}`;
  
  let lines = [];
  
  if (fs.existsSync(prices_CSV)) {
    lines = fs.readFileSync(prices_CSV, 'utf-8').split('\n');
  }

  let itemFound = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith(`${rarity},${data.name},`)) {
      lines[i] = newData;
      itemFound = true;
      break;
    }
  }

  if (!itemFound) {
    lines.push(newData);
  }

  output = lines.join('\n');
  fs.writeFileSync(prices_CSV, output);
  console.log(`Updated, ${data.name}, prices in ${collection}_prices.csv`);
  console.log(currency)
}

function timeDifferenceInMinutes(timestamp1, timestamp2) {
    const diff = Math.abs(timestamp1 - timestamp2);
    return diff / 1000 / 60;
}

function extractTimeFromText(text) {
  let totalSeconds = 0;
  const hoursMatch = text.match(/(\d+)\s+hours?/);
  const minutesMatch = text.match(/(\d+)\s+minutes?/);
  const secondsMatch = text.match(/(\d+)\s+seconds?/);

  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 60 * 60;
  }
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1], 10) * 60;
  }
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1], 10);
  }
  return totalSeconds;
}

async function continuousScroll(page, interval = 500) {
    return new Promise(async (resolve, reject) => {
      try {
        const scrollInterval = setInterval(() => {
          page.evaluate(() => {
            const randomScrollAmount = 50 + Math.random() * 50;
            window.scrollBy(0, randomScrollAmount);
          });
        }, interval);
  
        resolve(scrollInterval);
      } catch (error) {
        reject(error);
      }
    });
}

(async () => {
  const records = await parseCSV(collection_CSV);

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // Intercept requests for cookies and block them
    page.on('request', (req) => {
        if (req.url().includes('cookieconsent')) {
        req.abort();
        } else {
        req.continue();
        }
    });

    const results = [];
    let isFirstLink = true;
    let isFirstEntry = true;

  for (const record of records) {
    const url = record['CSGOStash Link'];
    const rarity = record['Rarity'];
  
    if (!url) {
      console.warn(`Invalid URL for item ${record['Name']}`);
      continue;
    }
    
     // Check if the item should be updated based on the rarity
     if (!rarities_to_update.includes(rarity)) {
      console.log(`Skipping item ${record['Name']} because of rarity`);
      continue;
    }

    // Check if the item's timestamp is not older than 30 minutes
    const lines = fs.readFileSync(prices_CSV, 'utf-8').split('\n');
    let shouldSkip = false;

    // Get header indexes
    let headers = lines[0].split(',');
    const nameIndex = headers.indexOf('Item');
    const timestampIndex = headers.indexOf('Timestamp');

    for (let i = 1; i < lines.length; i++) {
      const lineParts = lines[i].split(',');

      if (lineParts[nameIndex] === record['Name']) {
        const lastUpdateTimestamp = new Date(lineParts[timestampIndex]);
        const currentTimestamp = new Date();

        if (timeDifferenceInMinutes(currentTimestamp, lastUpdateTimestamp) <= skipTime) {
            console.log(`Skipping ${record['Name']} as the timestamp is ${lastUpdateTimestamp.toLocaleDateString()} ${lastUpdateTimestamp.getHours().toString().padStart(2, '0')}:${lastUpdateTimestamp.getMinutes().toString().padStart(2, '0')}:${lastUpdateTimestamp.getSeconds().toString().padStart(2, '0')}.`);
          shouldSkip = true;
          break;
        }
      }
    }

    if (shouldSkip) {
      continue;
    }

    await page.goto(url, { waitUntil: 'networkidle0' });

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  
    if (isFirstLink) {
      try {
        await page.waitForSelector("#unic-b > div > div > div > div.flex.flex-col.m-auto.w-full.items-center.justify-center > div:nth-child(2) > button:nth-child(1)");
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 2500));
        await page.click("#unic-b > div > div > div > div.flex.flex-col.m-auto.w-full.items-center.justify-center > div:nth-child(2) > button:nth-child(1)");
        await page.waitForSelector("#unic-b > div > div > div > div.flex.m-auto.w-full.justify-center.border-gray-300.border-solid.border-t.p-1.flex-wrap > div > button:nth-child(1)");
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 2500));
        await page.click("#unic-b > div > div > div > div.flex.m-auto.w-full.justify-center.border-gray-300.border-solid.border-t.p-1.flex-wrap > div > button:nth-child(1)");
        isFirstLink = false;
      } catch (e) {
        console.warn('Decline cookies button not found or timed out');
      }
    }
    else {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 2500));
    }
    
    // Start continuous scrolling
    const scrollInterval = await continuousScroll(page);

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const minFloat = await page.$eval(
      'body > div.container.main-content > div:nth-child(3) > div.col-md-10 > div > div.col-md-5.col-widen.text-center > div.well.text-left.wear-well > div > div > div.wear-bar-markers > div.marker-wrapper.wear-min-value > div.marker-value-wrapper > div',
      (el) => parseFloat(el.textContent.trim())
    );

    const maxFloat = await page.$eval(
      'body > div.container.main-content > div:nth-child(3) > div.col-md-10 > div > div.col-md-5.col-widen.text-center > div.well.text-left.wear-well > div > div > div.wear-bar-markers > div.marker-wrapper.wear-max-value > div.marker-value-wrapper > div',
      (el) => parseFloat(el.textContent.trim())
    );

    const name = await page.$eval(
      'body > div.container.main-content > div:nth-child(3) > div.col-md-10 > div > div.col-md-7.col-widen > div.well.result-box.nomargin > h2',
      (el) => el.innerText.replace(' |', '').replace('♥', '-')
                           .replace('Dual Berettas', 'Dual-Berettas')
                           .replace('R8 Revolver', 'R8-Revolver')
                           .replace('SG 553', 'SG-553')
                           .replace('Galil AR', 'Galil-AR')
                           .replace('Desert Eagle', 'Desert-Eagle')
                           .replace('SSG 08', 'SSG-08')
    );

    const pricesUpdatedText = await page.$eval('#prices > div.price-modified-time > p', (el) => el.textContent.trim());
    const secondsToUpdate = extractTimeFromText(pricesUpdatedText);

    const prices = {};

    for (const wear of ['FN', 'MW', 'FT', 'WW', 'BS']) {
        for (const isStatTrak of [false, true]) {
          let wear_link = "";
          if (wear === "FN") {
            wear_link = "Factory%20New";
          } else if (wear === "MW") {
            wear_link = "Minimal%20Wear";
          } else if (wear === "FT") {
            wear_link = "Field-Tested";
          } else if (wear === "WW") {
            wear_link = "Well-Worn";
          } else if (wear === "BS") {
            wear_link = "Battle-Scarred";
          }
      
          const urlEncodedName = record["SCM Link"].replace("♥", "%E2%99%A5");
          const statTrakPrefix = isStatTrak ? "StatTrak%E2%84%A2%20" : "";
          const constructedHref = `https://steamcommunity.com/market/listings/730/${statTrakPrefix}${urlEncodedName}%28${wear_link}%29`;
          
          //console.log(`Constructed Href (${isStatTrak ? 'ST' : 'Non-ST'}):`, constructedHref);

          const hrefSelector = `a[href="${constructedHref}"]`;
          const priceKey = isStatTrak ? `ST-${wear}` : wear;

          try {
            const price = await page.$eval(hrefSelector, (el) => {
              const priceLine = el.textContent.trim().split('\n').find((line) => line.match(/\p{Sc}/u)); // Match any currency symbol
              if (priceLine) {
                return priceLine.replace('-', '0').replace('€', '').replace(',', '.');
              }
              return null;
            });

            prices[priceKey] = price;
          } catch (e) {
            prices[priceKey] = null;
            console.log(`Failed to load the price for ${priceKey} wear.`);
          }
        }
      }
      console.log(`Price loaded for ${name}! Prices:`);
      console.log(`FN: ${prices.FN}, MW: ${prices.MW}, FT: ${prices.FT}, WW: ${prices.WW}, BS: ${prices.BS}`);
      console.log(`ST FN: ${prices["ST-FN"]}, ST MW: ${prices["ST-MW"]}, ST FT: ${prices["ST-FT"]}, ST WW: ${prices["ST-WW"]}, ST BS: ${prices["ST-BS"]}`);

    clearInterval(scrollInterval);

    results.push({ name, ...prices });

    writeToCSV({ name, ...prices }, rarity, minFloat, maxFloat, isFirstEntry, secondsToUpdate);
    isFirstEntry = false;

//    PythonShell.run('expected_value.py', { args: [collection] }, (err) => {
//      if (err) {
//        console.error(err);
//      } else {
//        console.log('EV Python script finished');
//      }
//    });

    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
  }

  // Determine the currency by checking the first available price in the results
  //const currencySymbol = '€';

  // Log the results with the custom console table function
  await browser.close();
  console.log("Sucessfully updated all item prices!")
})();
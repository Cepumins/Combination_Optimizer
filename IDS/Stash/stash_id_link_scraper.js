//const puppeteer = require('puppeteer');
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
//stealth.enabledEvasions.delete('chrome.runtime');
//stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);
const fs = require('fs');
//const csv = require('csv-parser');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const caseCollectionMapping = {
  'Kilowatt': 393,
  'Dreams & Nightmares': 339,
  'Fracture': 307,
  'Recoil': 355,
  'Revolution': 376,
  'Chroma': 38,
  'Chroma 2': 48,
  'Chroma 3': 141,
  'Clutch': 238,
  'CS:GO Weapon': 1,
  'CS:GO Weapon 2': 4,
  'CS:GO Weapon 3': 10,
  'CS20': 293,
  'Danger Zone': 259,
  'eSports 2013': 2,
  'eSports 2013 Winter': 5,
  'eSports 2014 Summer': 19,
  'Falchion': 50,
  'Gamma': 144,
  'Gamma 2': 172,
  'Glove': 179,
  'Horizon': 244,
  'Huntsman Weapon': 17,
  'Operation Bravo': 3,
  'Operation Breakout Weapon': 18,
  'Operation Broken Fang': 308,
  'Operation Hydra': 208,
  'Operation Phoenix Weapon': 11,
  'Operation Riptide': 321,
  'Operation Vanguard Weapon': 29,
  'Operation Wildfire': 112,
  'Prisma': 274,
  'Prisma 2': 303,
  'Revolver': 111,
  'Shadow': 80,
  'Shattered Web': 277,
  'Snakebite': 315,
  'Spectrum': 207,
  'Spectrum 2': 220,
  'Winter Offensive Weapon': 7
};

const mapCollectionMapping = [
  'Ancient',
  'Anubis',
  'Inferno (2018)',
  'Mirage (2021)',
  'Nuke (2018)',
  'Overpass',
  'Vertigo (2021)',
  'Alpha',
  'Assault',
  'Aztec',
  'Baggage',
  'Bank',
  //'Blacksite',
  'Cache',
  'Canals',
  'Chop Shop',
  'Cobblestone',
  'Control',
  'Dust',
  'Dust 2 (2021)',
  'Dust 2 (Old)',
  'Gods and Monsters',
  'Havoc',
  'Inferno (Old)',
  'Italy',
  'Lake',
  'Militia',
  'Mirage (Old)',
  'Norse',
  'Nuke',
  'Office',
  'Rising Sun',
  'Safehouse',
  'St. Marc',
  'Train (2021)',
  'Train (Old)',
  'Vertigo (Old)'
];

const itemRename = {
  'AK 47': 'AK-47',
  'CZ75 Auto': 'CZ75-Auto',
  'Five SeveN': 'Five-SeveN',
  'Glock 18': 'Glock-18',
  'M4A1 S': 'M4A1-S',
  'MAC 10': 'MAC-10',
  'MAG 7': 'MAG-7',
  'MP5 SD': 'MP5-SD',
  'PP Bizon': 'PP-Bizon',
  'Sawed Off': 'Sawed-Off',
  'SCAR 20': 'SCAR-20',
  'Tec 9': 'Tec-9',
  'UMP 45': 'UMP-45',
  'USP S': 'USP-S',
  'Dragon King': '(Dragon King)',
  '%E9%BE%8D%E7%8E%8B': '龍王'
};

const csvFilePath = 'C:/Users/Kristaps/Desktop/TUP-main/IDS/Stash/stash_ids.csv';
//const csvInfoFilePath = 'info.csv';

async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
}

// Function to read the existing CSV and return a Set of existing IDs
const readExistingIds = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve(new Set()); // If file doesn't exist, return an empty Set
      return;
    }

    const existingIds = new Set();
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => existingIds.add(row.ID))
      .on('end', () => resolve(existingIds))
      .on('error', reject);
  });
};

// Function to filter new links and prepare records for CSV
const prepareNewRecords = (skinData, existingIds, collectionName) => {
  return skinData.filter(({ href, rarity }) => {
    const id = href.split('/').slice(-2, -1)[0];
    return !existingIds.has(id);
  }).map(({ href, rarity }) => {
    const parts = href.split('/');
    const id = parts[parts.length - 2];
    //let itemName = parts[parts.length - 1].replace(/-/g, ' ');
    let itemName = parts[parts.length - 1];
    //console.log(`Original: (${itemName})`);
    Object.entries(itemRename).forEach(([key, newValue]) => {
      const regex = new RegExp(key, 'g'); // Create a global regex from the key
      itemName = itemName.replace(regex, newValue); // Replace all occurrences of the key with newValue
    });
    
    //console.log(`Mapped: (${itemName})`);
    itemName = itemName.replace(/ /g, '_'); // Replace remaining spaces with underscores
    //console.log(`Final: (${itemName})`);

    //let rarity = '';

    //return { Item: itemName, ID: id, Collection: collectionLinkName };
    //return { Item: itemName, ID: id, Collection: collectionLinkName, Rarity: rarity };
    return { Collection: collectionName, Rarity: rarity, Item: itemName, ID: id };
  });
};

// Function to write new records to CSV
const writeNewRecordsToCsv = (filePath, records, append = true) => {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      /*
      { id: 'Item', title: 'Item' },
      { id: 'ID', title: 'ID' },
      { id: 'Collection', title: 'Collection' },
      { id: 'Rarity', title: 'Rarity' }
      */
      { id: 'Collection', title: 'Collection' },
      { id: 'Rarity', title: 'Rarity' },
      { id: 'Item', title: 'Item' },
      { id: 'ID', title: 'ID' }
    ],
    append: append
  });

  return csvWriter.writeRecords(records);
};

// Function to read the full CSV into an array of objects
const readCsvIntoArray = (filePath) => {
  return new Promise((resolve, reject) => {
    const data = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => data.push(row))
      .on('end', () => resolve(data))
      .on('error', reject);
  });
};

// Function to read, sort, and write back the CSV
const sortCsvByItem = async (filePath) => {
  const items = await readCsvIntoArray(filePath); // Read full CSV records

  // Define a predefined order for Rarity values (reversed)
  //const rarityOrder = ['Covert', 'Classified', 'Restricted', 'Mil-Spec', 'Industrial', 'Consumer'];
  const rarityOrder = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert'];

  // Custom sort function that sorts by Collection, then by Rarity in descending order, and finally by Item
  const sortedItems = items.sort((a, b) => {
    if (a.Collection !== b.Collection) {
      return a.Collection.localeCompare(b.Collection); // First, sort by Collection
    } else if (rarityOrder.indexOf(a.Rarity) !== rarityOrder.indexOf(b.Rarity)) {
      return rarityOrder.indexOf(b.Rarity) - rarityOrder.indexOf(a.Rarity); // Next, sort by Rarity according to the predefined order, but in descending order
    } else {
      return a.Item.localeCompare(b.Item); // Finally, sort by Item if Collection and Rarity are the same
    }
  });

  await writeNewRecordsToCsv(filePath, sortedItems, false); // Write sorted items back to CSV
};

// Main function
const processSkinData = async (skinData, collectionName) => {
  const existingIds = await readExistingIds(csvFilePath);
  const newRecords = prepareNewRecords(skinData, existingIds, collectionName);
  await writeNewRecordsToCsv(csvFilePath, newRecords);
  await sortCsvByItem(csvFilePath);
  console.log('CSV processing complete.');
};

(async () => {
  let collection_link, collectionLinkName;
  const collection = 'Nuke (Old)';
  //const collectionType = 'case';
  let collectionType = '';
  if (mapCollectionMapping.includes(collection)) {
    collectionType = 'map';
  } else if (Object.keys(caseCollectionMapping).includes(collection)) {
    collectionType = 'case';
  } else {
    // If the collection is not found in either list, throw an error and terminate the script
    throw new Error(`Collection '${collection}' not found in any list.`);
  }
  console.log(`The collection '${collection}' is a '${collectionType}' type.`);

  if (collectionType === 'case') {
    const collectionID = caseCollectionMapping[collection];
    //collectionLinkName = collection.replace(' ', '_');
    collectionLinkName = collection.replace(/ /g, '-');
  
    collection_link = `https://csgostash.com/case/${collectionID}/${collectionLinkName}-Case`;
  } else if (collectionType === 'map') {
    //collectionLinkName = collection.replace(' ', '+');
    if (collection.endsWith(' (Old)')) {
      collectionLinkName = collection.replace(' (Old)', '');
    } else {
      const yearMatch = collection.match(/\((\d{4})\)/); // Check for a release year pattern ' (YYYY)' in the collection name
      if (yearMatch) {
        collectionLinkName = `${yearMatch[1]}+${collection.replace(` (${yearMatch[1]})`, '')}`; // If a year is found, move it to the beginning and remove the parentheses
      } else {
        collectionLinkName = collection; // If no special pattern is found, keep the collection name as is
      }
    }
    
    collectionLinkName = collectionLinkName.replace(/ /g, '+'); // Replace spaces with '+' for the final link name

    collection_link = `https://csgostash.com/collection/The+${collectionLinkName}+Collection`;
  }

  // Launch the browser
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the specified URL
  await page.goto(collection_link, {waitUntil: 'networkidle0', timeout: 60000});

  /*
  // Find all elements matching the specified pattern and extract the 'href' attributes
  const skinLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a > img.img-responsive.center-block.margin-top-sm.margin-bot-sm'));
    return links.map(link => link.parentElement.getAttribute('href'));
  });
  */
  const skinsData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a > img.img-responsive.center-block.margin-top-sm.margin-bot-sm'));
    return links.map(link => {
      const href = link.parentElement.getAttribute('href');
      const rarityElement = link.closest('.well').querySelector('.quality > p.nomargin');
      const rarityText = rarityElement ? rarityElement.textContent : '';
      const rarity = rarityText.split(' ')[0]; // Get the first word which is the rarity
      return { href, rarity };
    });
  });

  // Log the extracted 'href' attributes
  console.log(skinsData);

  const collectionName = collection.replace(/ /g, '_');

  await processSkinData(skinsData, collectionName);

  await waitForRandomTimeout(page, 500, 1000);
  await browser.close();
})();

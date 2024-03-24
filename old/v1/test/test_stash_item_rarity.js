function uniqueRarityNames(csvContent) {
    const lines = csvContent.split('\n');
    const raritySet = new Set();
  
    for (let i = 1; i < lines.length; i++) {
      const rarity = lines[i].split(';')[0];
      raritySet.add(rarity);
    }
  
    return Array.from(raritySet);
  }

let collection = "Recoil";
let prefix = `${collection}`
let collection_CSV = `${prefix}/${collection}.csv`

let uniqueRarities = uniqueRarityNames(collection_CSV);
console.log(uniqueRarities);
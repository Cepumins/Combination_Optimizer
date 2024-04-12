const weaponPrefixes = [
    'Zeus x27', 'CZ75-Auto', 'Desert Eagle', 'Dual Berettas', 'Five-Seven', 'Glock-18', 'P2000', 'P250', 'R8 Revolver', 'Tec-9', 'USP-S',
    'MAC-10', 'MP5-SD', 'MP7', 'MP9', 'PP-Bizon', 'P90', 'UMP-45', 'MAG-7', 'Nova', 'Sawed-Off', 'XM1014', 'M249', 'Negev',
    'AK-47', 'AUG', 'AWP', 'FAMAS', 'G3SG1', 'Galil AR', 'M4A1-S', 'M4A4', 'SCAR-20', 'SG 553', 'SSG 08'
];

// Wear condition mappings
const conditionMappings = {
    'Minimal Wear': 'MW',
    'Factory New': 'FN',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
};

function oldprocessAltText(altText, source) {
    let itemName, conditionAbbr;

    if (source === 'Bit') {
        // Original logic for 'Bit' source
        const parts = altText.split(/ (Minimal Wear|Factory New|Field-Tested|Well-Worn|Battle-Scarred) /);
        let conditionPart = parts.length >= 2 ? parts[1] : null;
        let namePart = parts[0];

        // Find the prefix in the namePart and insert an underscore between the prefix and the rest of the name
        for (const prefix of weaponPrefixes) {
            if (namePart.startsWith(prefix)) {
                namePart = namePart.replace(prefix, `${prefix}_`);
                break; // Exit the loop once the prefix is found and processed
            }
        }

        // Replace spaces with underscores in the namePart
        itemName = namePart.replace(/\s+/g, '_');

        // Abbreviate the condition using the conditionMappings
        conditionAbbr = conditionMappings[conditionPart] || conditionPart;
    } else if (source === 'Money') {
        const textWithoutPrefix = altText.replace(/^\/csgo\//, '');
        // Define regex patterns for extracting the wear condition and mapping it
        const wearPatterns = {
            'factory-new': 'FN',
            'minimal-wear': 'MW',
            'field-tested': 'FT',
            'well-worn': 'WW',
            'battle-scarred': 'BS'
        };

        // Extract the wear condition and the remaining part of the altText
        let wearCondition;
        for (const [pattern, abbreviation] of Object.entries(wearPatterns)) {
            if (textWithoutPrefix.includes(pattern)) {
                wearCondition = abbreviation;
                conditionAbbr = wearCondition; // Set the condition abbreviation
                break;
            }
        }

        // Extract item name portion before the next '/' and remove wear pattern
        const namePortion = textWithoutPrefix.split('/')[0].replace(new RegExp(Object.keys(wearPatterns).join('|'), 'i'), '');

        // Split the name portion to get the item name segments and capitalize them
        let formattedNameSegments = namePortion.split('-').map(segment =>
            segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
        );

        // Check if the formatted segments match any weapon prefix when joined with a hyphen
        const formattedName = formattedNameSegments.join('-');
        const matchedPrefix = weaponPrefixes.find(prefix => formattedName.startsWith(prefix));

        // If there's a matched prefix, use it and append the rest of the name segments joined with underscores
        if (matchedPrefix) {
            const prefixLength = matchedPrefix.split('-').length;
            itemName = matchedPrefix + '_' + formattedNameSegments.slice(prefixLength).join('_');
        } else {
            itemName = formattedNameSegments.join('_'); // Join the segments with underscores if no prefix match
        }
        if (itemName.endsWith('_')) {
            itemName = itemName.slice(0, -1);
        }
    }

    return { itemName, conditionAbbr };
}

// Function to find and process the altText
function processAltText(altText, source) {
    let itemName, conditionAbbr;

    if (source === 'Bit') {
        // Original logic for 'Bit' source
        const parts = altText.split(/ (Minimal Wear|Factory New|Field-Tested|Well-Worn|Battle-Scarred) /);
        let conditionPart = parts.length >= 2 ? parts[1] : null;
        let namePart = parts[0];

        // Find the prefix in the namePart and insert an underscore between the prefix and the rest of the name
        for (const prefix of weaponPrefixes) {
            if (namePart.startsWith(prefix)) {
                namePart = namePart.replace(prefix, `${prefix}_`);
                break; // Exit the loop once the prefix is found and processed
            }
        }

        // Replace spaces with underscores in the namePart
        itemName = namePart.replace(/\s+/g, '_');

        // Abbreviate the condition using the conditionMappings
        conditionAbbr = conditionMappings[conditionPart] || conditionPart;
    } else if (source === 'Money') {
        // Step 1: Remove '/csgo/' & remove anything after the next '/'
        let itemPart = altText.replace(/^\/csgo\//, '').split('/')[0];

        // Step 2: Search for wear and map it to conditionAbbr
        const wearPatterns = {
            'factory-new': 'FN',
            'minimal-wear': 'MW',
            'field-tested': 'FT',
            'well-worn': 'WW',
            'battle-scarred': 'BS'
        };
        Object.entries(wearPatterns).forEach(([pattern, abbreviation]) => {
            if (itemPart.includes(pattern)) {
                conditionAbbr = abbreviation; // Set condition abbreviation
                itemPart = itemPart.replace(pattern, ''); // Remove wear pattern from itemName
                return true; // Break the loop once a match is found
            }
        });

        // Step 3: Find weapon prefix (if any), and capitalize & replace characters in the remaining part
        let matchedPrefix = '';
        let remainingPart = itemPart;

        weaponPrefixes.forEach(prefix => {
            const lowerCasePrefix = prefix.toLowerCase().replace(/ /g, '-');
            if (remainingPart.startsWith(lowerCasePrefix)) {
                matchedPrefix = prefix; // Save the matched prefix
                remainingPart = remainingPart.slice(lowerCasePrefix.length); // Remove the prefix part from the remaining text
            }
        });

        // Capitalize and replace characters in the remaining part (after weapon prefix)
        remainingPart = remainingPart.split('-').map((segment, index) =>
            index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
        ).join('_');

        remainingPart = remainingPart.replace(/^_+|_+$/g, '');

        const specialCases = {
            'Emphorosaur_S': 'Emphorosaur-S',
            // Add more special cases here if needed
        };

        Object.entries(specialCases).forEach(([original, replacement]) => {
            remainingPart = remainingPart.replace(original, replacement);
        });

        // Combine the preserved weapon prefix with the processed remaining part
        itemName = matchedPrefix + (matchedPrefix && remainingPart ? '_' : '') + remainingPart;

        itemName = itemName.replace(/\s+/g, '_');
    }

    return { itemName, conditionAbbr };
}

// Process the altText to get the formatted output
let itemName, conditionAbbr;

const bitAlt = 'Sawed-OffAnalog Input Minimal Wear / 563';
({ itemName, conditionAbbr } = processAltText(bitAlt, 'Bit'));
console.log(`Bit: ${itemName} (${conditionAbbr})`); // Should output: 'Sawed-Off_Analog_Input (MW)'


const moneyAlt = '/csgo/desert-eagle-emphorosaur-s-minimal-wear/36954299967/';
({ itemName, conditionAbbr } = oldprocessAltText(moneyAlt, 'Money'));
console.log(`Old Money: '${itemName} (${conditionAbbr})'`); 

({ itemName, conditionAbbr } = processAltText(moneyAlt, 'Money'));
console.log(`Money: '${itemName} (${conditionAbbr})'`); 

console.log(`Should output: 'M4A1_S_Emphorosaur_S (MW)'`);

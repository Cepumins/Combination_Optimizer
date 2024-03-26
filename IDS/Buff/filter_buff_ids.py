import csv

def filter_items(old_txt_file_path, new_txt_file_path):
    # Keywords to filter out
    type_k = ['StatTrak', 'Souvenir']
    item_k = ['Sticker', 'Case', 'Capsule', 'Pass', 'Package']
    capsule_k = ['Legends', 'Challengers', 'Contenders']
    usable_k = ['Graffiti', 'Music Kit', 'Parcel']
    player_k = ['Patch', 'Crew', 'Sabre', 'SAS', 'Pin', 'Phoenix', 'SEAL', 'FBI', 'Gendarmerie', 'Professionals', 'SWAT', 'TACP', 'KSK']
    knife_k = ['Knife', 'Bayonet', 'Daggers', 'Karambit', 'Gloves', 'Wraps']
    sticker_k = ['Holo', 'Foil']

    keywords = type_k + item_k + capsule_k + usable_k + player_k + knife_k + sticker_k

    # Open the source file for reading
    with open(old_txt_file_path, 'r', encoding='utf-8') as source_file:
        # Open a new file for writing
        with open(new_txt_file_path, 'w', encoding='utf-8') as target_file:
            # Iterate over each line in the source file
            for line in source_file:
                # Check if any of the keywords is in the current line
                if not any(keyword in line for keyword in keywords):
                    # This line does not contain any of the keywords
                    # Write it to the new file
                    target_file.write(line)

def txt_to_csv(new_txt_file_path, csv_file_path):
    # A dictionary to hold the item data
    items = {}

    wear_conditions = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred']

    # Read the txt file and process each line
    with open(new_txt_file_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split(';')
            if len(parts) == 2:
                id, full_name = parts
                for wear in wear_conditions:
                    if f"({wear})" in full_name:
                        name, condition = full_name.rsplit(f'({wear})', 1)
                        condition = wear  # Set the condition explicitly
                        break
                else:
                    # If no condition found, skip this line
                    continue
                name = name.strip().replace(' | ', '_').replace(' ', '_')  # Replace spaces with underscores
                
                # Initialize the dictionary for this item, if not already done
                if name not in items:
                    items[name] = {'FN': 'Null', 'MW': 'Null', 'FT': 'Null', 'WW': 'Null', 'BS': 'Null'}
                
                # Map condition abbreviations
                condition_map = {'Factory New': 'FN', 'Minimal Wear': 'MW', 'Field-Tested': 'FT', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS'}
                if condition in condition_map:
                    items[name][condition_map[condition]] = id

    # Sort items by name (key) before writing to CSV
    sorted_items = sorted(items.items(), key=lambda x: x[0])
   
    # Write to CSV
    with open(csv_file_path, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Item', 'FN', 'MW', 'FT', 'WW', 'BS']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()
        for item, conditions in sorted_items:
            row = {'Item': item}
            row.update(conditions)
            writer.writerow(row)

# Specify the paths to your TXT and CSV files
old_txt_file_path = 'IDS/Buff/all_buffids.txt'
new_txt_file_path = 'IDS/Buff/buffids.txt'
csv_file_path = 'IDS/Buff/buff_ids.csv'

filter_items(old_txt_file_path, new_txt_file_path)

# Call the function to convert the TXT file to a CSV file
txt_to_csv(new_txt_file_path, csv_file_path)
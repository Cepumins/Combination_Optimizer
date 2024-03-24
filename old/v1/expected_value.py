from itertools import product
from datetime import datetime
import csv
import math
#import sys
import os
import time
import random
import json
import itertools

#collections = ["Recoil"]
collections = ["Danger_Zone", "Recoil"]
#collections = ["Danger_Zone"]
#collections = ["Recoil", "Danger_Zone", "Prisma"]
rarities = ["Covert"]
#rarities = ["Covert", "Classified", "Restricted"]

prices_location_structure = "_collections/{collection}/{collection}_prices.csv"
float_round_decimals = 7 #14
#collection = "Recoil"
#collection = sys.argv[1]  # "Recoil"
#rarity = "Classified"
#prices_csv = f"{collection}/{collection}_prices.csv"
#ev_csv = f"{collection}/{collection}_EV.csv"

# start the timer
start_time = time.time()

wear_floats = {
    "FN": round(0.07 - 10**(-float_round_decimals), float_round_decimals),
    "MW": round(0.15 - 10**(-float_round_decimals), float_round_decimals),
    "FT": round(0.38 - 10**(-float_round_decimals), float_round_decimals),
    "WW": round(0.45 - 10**(-float_round_decimals), float_round_decimals),
    "BS": 1
}

def combined_data(filename, rarity):
    skins = []
    lowest_floats = []
    highest_floats = []
    prices = {}
    timestamps = []

    with open(filename, 'r', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=',')

        for row in reader:
            if row["Rarity"] == rarity:
                skins.append(row["Item"])
                lowest_floats.append(float(row["MinF"]))
                highest_floats.append(float(row["MaxF"]))

                if row["CUR"] not in prices:
                    prices[row["CUR"]] = {}

                prices[row["CUR"]][row["Item"]] = {
                    "FN": 0 if row["FN"] == 'null' else float(row["FN"]),
                    "MW": 0 if row["MW"] == 'null' else float(row["MW"]),
                    "FT": 0 if row["FT"] == 'null' else float(row["FT"]),
                    "WW": 0 if row["WW"] == 'null' else float(row["WW"]),
                    "BS": 0 if row["BS"] == 'null' else float(row["BS"]),
                    "ST FN": 0 if row["FN ST"] == 'null' else float(row["FN ST"]),
                    "ST MW": 0 if row["MW ST"] == 'null' else float(row["MW ST"]),
                    "ST FT": 0 if row["FT ST"] == 'null' else float(row["FT ST"]),
                    "ST WW": 0 if row["WW ST"] == 'null' else float(row["WW ST"]),
                    "ST BS": 0 if row["BS ST"] == 'null' else float(row["BS ST"]),
                }
                timestamps.append(row["Timestamp"]) 

    return skins, lowest_floats, highest_floats, prices, timestamps

# Find the oldest timestamp among the items
def parse_timestamp(timestamp):
    formats = ["%m/%d/%Y %H:%M", "%m/%d/%Y %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(timestamp, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unable to parse timestamp: {timestamp}")

def max_seller_price(buyer_price):
    def buyer_price_calculation(seller_price):
        s = seller_price
        steam_fee = max(1, math.floor(s * 0.05))
        publisher_fee = max(1, math.floor(s * 0.10))
        buyer_price_cents = s + steam_fee + publisher_fee
        return buyer_price_cents

    original_buyer_price_cents = buyer_price * 100
    seller_price_cents = math.floor(original_buyer_price_cents / 1.15)

    while buyer_price_calculation(seller_price_cents) < original_buyer_price_cents:
        seller_price_cents += 1

    seller_price = seller_price_cents / 100
    calculated_buyer_price = buyer_price_calculation(seller_price_cents) / 100

    if buyer_price == calculated_buyer_price:
        return round(seller_price, 2)
    elif buyer_price == buyer_price_calculation(seller_price_cents - 1) / 100:
        return round((seller_price_cents - 1) / 100, 2)
    else:
        return round(seller_price - 0.01, 2)

def calculate_wear_float_ranges(wear_float, lowest_float, highest_float, float_round_decimals):
    wear_float_ranges = {}
    for wear, wear_float_value in wear_float.items():
        float_range = (wear_float_value - lowest_float) / (highest_float - lowest_float)
        capped_float_range = round(min(max(float_range, 0), 1), float_round_decimals)
        wear_float_ranges[wear] = capped_float_range
    return wear_float_ranges

def partition_number(k):
    n = 10
    if k == 1:
        return [[n]]
    elif k == 2:
        return [[i, n - i] for i in range(1, n)]
    else:
        def _partition_number(n, k, pre):
            if n == 0 and k == 0:
                yield pre
            elif n > 0 and k > 0:
                for i in reversed(range(1, n+1)):
                    yield from _partition_number(n - i, k - 1, pre + [i])

        return sorted(list(_partition_number(n, k, [])), key=lambda x: (x[0], x[1], x[2]))

# Example usage: get all combinations of 2 numbers that sum to 10
#combinations = partition_number(2)

def calculate_expected_values(collections, rarity):
    all_data = []
    for collection in collections:
        prices_csv = prices_location_structure.format(collection=collection)
        data = combined_data(prices_csv, rarity)
        all_data.append(data)
    oldest_timestamp = min(min(data[4], key=parse_timestamp) for data in all_data)

    float_ranges_list = []

    for skins, lowest_floats, highest_floats, prices, timestamps in all_data:
        for lowest_float, highest_float in zip(lowest_floats, highest_floats):
            wear_float_ranges = calculate_wear_float_ranges(wear_floats, lowest_float, highest_float, float_round_decimals)
            float_ranges_list.append(wear_float_ranges)

    unique_floats = {}
    combined_float_ranges = {}
    all_wear_combinations = list(product(*float_ranges_list))

    #full_max_float = []
    #filtered_max_float = []

    # Initialize previous_max_float with 0
    previous_max_float = 0
    for wear_combination in all_wear_combinations:
        max_float = round(min(wear_ranges[w] for wear_ranges, w in zip(float_ranges_list, wear_combination)), float_round_decimals)
        #full_max_float.append(max_float)
        
        if max_float not in unique_floats and max_float != 0:
            unique_floats[max_float] = True
            #filtered_max_float.append(max_float)
            min_float_value = round(previous_max_float, float_round_decimals)
            # Update previous_max_float with the current max_float
            previous_max_float = max_float + 10**(-float_round_decimals)
            #print(f"Min float value: ", min_float_value)
            #print(f"Max float value: ", max_float)   
            all_expected_values = []
            all_st_expected_values = []
            #print("New wear level! The wear is: ", '+'.join(wear_combination))
            # Calculate all possible splits for the given number of collections
            split_combinations = partition_number(len(collections))

            for split in split_combinations:
                expected_values = []
                st_expected_values = []
                global_skin_index = 0  # start global_skin_index at 0
                
                for i, (skins, lowest_floats, highest_floats, prices, timestamps) in enumerate(all_data):
                    #skin_count = len(skins)
                    # Calculate the probability
                    split_factor = split[i]
                    outcome_count = sum(split[j]*len(all_data[j][0]) for j in range(len(collections)))
                    prob = split_factor / outcome_count
                    '''
                    if wear_combination == ('BS', 'BS', 'BS', 'BS', 'BS'):
                        #print('combination good')
                        if split == [4, 5, 1]:
                            #print('split good')
                            print()
                            print(f'split is ', split)
                            print(f'wear combination is ', wear_combination)
                            print(f'split factor is ', split_factor)
                            print(f'skin count is ', skin_count)
                            print(f'probability is ', round(prob*100, 2), '%')
                            print(outcome_count)
                            print(f"Split factor for collection {i+1}: {split[i]}")
                            print(f"Contents of collections: {collections[i]}")
                            print(f'skins ', skins)
                            print(f"Number of items in collection {i+1}: {len(skins)}")
                            print(f"Product for collection {i+1}: {split[i]*len(skins)}")
                            print(f"Total outcome_count: {outcome_count}")
                    '''
                    for skin in skins:
                        wear = wear_combination[global_skin_index]  # use global_skin_index here
                        expected_value = max_seller_price(prices['EUR'][skin][wear]) * prob
                        st_expected_value = max_seller_price(prices['EUR'][skin]["ST " + wear]) * prob
                        expected_values.append(expected_value)
                        st_expected_values.append(st_expected_value)

                        global_skin_index += 1  # increment global_skin_index after using it

                all_expected_values.append(sum(expected_values))
                all_st_expected_values.append(sum(st_expected_values))

            # Calculate splits
            split = {'-'.join(map(str, split)): {
                'ev': round(all_expected_values[i], 2),
                'st_ev': round(all_st_expected_values[i], 2)
            } for i, split in enumerate(split_combinations)}

            combined_float_ranges['+'.join(wear_combination)] = {
                'min_float': min_float_value,
                'max_float': max_float,
                'split': split
            }

    sorted_combined_float_ranges = sorted(combined_float_ranges.items(), key=lambda x: x[1]['max_float'])
    return collections, rarity, oldest_timestamp, sorted_combined_float_ranges

def calculate_all_expected_values(collections, rarities):
    num_collections = len(collections)

    # Loop over all rarities
    for rarity in rarities:
        all_expected_values = []
        
        # Loop over all possible numbers of collections in the combination
        for r in range(1, num_collections + 1):
            # Generate all combinations of collections of this size
            for collection_combo in itertools.combinations(collections, r):
                # Calculate the expected value for this rarity
                ev = calculate_expected_values(list(collection_combo), rarity)
                all_expected_values.append(ev)

        # Save data to JSON file specific for the rarity
        ev_file = f'ev_{rarity}.json'
        with open(ev_file, 'w') as json_file:
            json.dump(all_expected_values, json_file, indent=2)

        print(f"Expected values for rarity '{rarity}' exported to {ev_file}")

calculate_all_expected_values(collections, rarities)

'''
all_expected_values = []
for rarity in rarities:
    all_expected_values.append(calculate_expected_values(collections, rarity))

# Save data to JSON file
with open('ev.json', 'w') as json_file:
    json.dump(all_expected_values, json_file, indent=2)
print("Expected values exported to ev.json")
'''
'''
def print_table(spacing, splits_to_print, all_expected_values, float_round_decimals, collections):
    # Get the lengths of the longest items in each column
    rarity_len = max(len(rarity) for rarity, _, _ in all_expected_values) + spacing*2
    wear_len = max(len(wear) for _, _, sorted_combined_float_ranges in all_expected_values for wear, _ in sorted_combined_float_ranges) + spacing*2
    timestamp_len = max(len(timestamp) for _, timestamp, _ in all_expected_values) + spacing*2
    float_len = len(f"{round(0.0, float_round_decimals)}") + (float_round_decimals-1) + spacing*2

    # Get the lengths of the longest EV and ST EV
    ev_len = max(len(f"{ev:<7.2f}") for _, _, sorted_combined_float_ranges in all_expected_values for _, data in sorted_combined_float_ranges for ev in data['expected_values']) + spacing
    st_ev_len = max(len(f"{st_ev:<0.2f}") for _, _, sorted_combined_float_ranges in all_expected_values for _, data in sorted_combined_float_ranges for st_ev in data['st_expected_values']) + spacing

    all_splits = [f"{i}-{abs(i-10)}" for i in range(11)]
    random.shuffle(all_splits)

    # If splits_to_print is shorter than 5, add random splits to it
    while len(splits_to_print) < 5:
        split = all_splits.pop()
        if split not in splits_to_print:
            splits_to_print.append(split)

    if len(collections) == 1:
        print(f"{'Rarity'},{'Wear'},{'Timestamp'},{'Min Float'},{'Max Float'}", end="")
        for split in splits_to_print:
            print(f",{split} EV,ST EV", end="")
        print()
        for data_tuple in all_expected_values:
            rarity, oldest_timestamp, sorted_combined_float_ranges = data_tuple
            min_float = 0.0
            for wear, data in sorted_combined_float_ranges:
                print(f"{rarity},{wear},{oldest_timestamp},{min_float:<{float_len}.{float_round_decimals}f},{data['max_float']:<{float_len}.{float_round_decimals}f}", end="")
                for i, (ev, st_ev) in enumerate(zip(data['expected_values'], data['st_expected_values'])):
                    if f"{i}-{abs(i-10)}" in splits_to_print:
                        print(f",{ev:.2f},{st_ev:.2f}", end="")
                print()
                min_float = round(data['max_float'] + 10**(-float_round_decimals), float_round_decimals)
    else:
        all_splits = [f"{i}-{abs(i-10)}" for i in range(11)]
        if len(splits_to_print) < 5:
            for _ in range(5 - len(splits_to_print)):
                random_split = random.choice(all_splits)
                while random_split in splits_to_print:
                    random_split = random.choice(all_splits)
                splits_to_print.append(random_split)

        headers = [[f"{spacing*2*' '}{split} EV", f"{spacing*2*' '}ST EV"] for split in splits_to_print]

        print(f"{'Rarity':<{rarity_len}} {'Wear':<{wear_len}} {'Timestamp':<{timestamp_len}} {'Min Float':<{float_len}} {'Max Float':<{float_len+spacing}}", end="")
        for header in headers:
            for col in header:
                if "EV" in col:
                    print(f"{col:<{ev_len}}", end="")
                else:
                    print(f"{col:<{st_ev_len}}", end="")
        print()

        for data_tuple in all_expected_values:
            rarity, oldest_timestamp, sorted_combined_float_ranges = data_tuple
            min_float = 0.0
            for wear, data in sorted_combined_float_ranges:
                print(
                    f"{rarity:<{rarity_len}} {wear:<{wear_len}} {oldest_timestamp:<{timestamp_len}} {min_float:<{float_len}.{float_round_decimals}f} {data['max_float']:<{float_len}.{float_round_decimals}f}", end=""
                )
                for split in splits_to_print:
                    ev_index = all_splits.index(split)
                    ev = data['expected_values'][ev_index]
                    st_ev = data['st_expected_values'][ev_index]
                    print(f" {ev:<{ev_len}.2f} {st_ev:<{st_ev_len}.2f}", end="")
                print()
                min_float = round(data['max_float'] + 10**(-float_round_decimals), float_round_decimals)

spacing = 1 #1
splits_to_print = ["1-9", "4-6", "10-0"]
#print_table(spacing, splits_to_print, all_expected_values, float_round_decimals, collections)
'''

# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")
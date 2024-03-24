from itertools import product
from datetime import datetime
import csv
import math
#import sys
#import os
import time
#import random
import json
import itertools

#prices_location_structure = "_collections/{collection}/{collection}_prices.csv"


def combined_data(filename, rarity, collections):
    skins = []
    lowest_floats = []
    highest_floats = []
    prices = {}
    timestamps = []

    with open(filename, 'r', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=',')

        for row in reader:
            if row["Rarity"] == rarity and row["Collection"] in collections:
                #item_data = data[data['Collection'].isin(collections)]
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
                    #"ST FN": 0 if row["FN ST"] == 'null' else float(row["FN ST"]),
                    #"ST MW": 0 if row["MW ST"] == 'null' else float(row["MW ST"]),
                    #"ST FT": 0 if row["FT ST"] == 'null' else float(row["FT ST"]),
                    #"ST WW": 0 if row["WW ST"] == 'null' else float(row["WW ST"]),
                    #"ST BS": 0 if row["BS ST"] == 'null' else float(row["BS ST"]),
                }
                timestamps.append(row["Timestamp"]) 

    return skins, lowest_floats, highest_floats, prices, timestamps

def parse_timestamp(timestamp): # Find the oldest timestamp among the items
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

def calculate_expected_values(collections, rarity):
    all_data = []
    prices_csv = 'prices.csv'
    for collection in collections:
        #print(collections)
        #print(collection)
        #prices_csv = prices_location_structure.format(collection=collection)
        #print(prices_csv)
        data = combined_data(prices_csv, rarity, collection)
        
        all_data.append(data)
    #print(all_data)
    '''
    all_data = []
    for collection in collections:
        print(collections)
        #print(collection)
        prices_csv = prices_location_structure.format(collection=collection)
        print(prices_csv)
        data = combined_data(prices_csv, rarity, collections)
        all_data.append(data)
    print(all_data)  
    '''

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
    
    previous_max_float = 0 # Initialize previous_max_float with 0
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
                    split_factor = split[i] # Calculate the probability
                    outcome_count = sum(split[j]*len(all_data[j][0]) for j in range(len(collections)))
                    prob = split_factor / outcome_count

                    for skin in skins:
                        wear = wear_combination[global_skin_index]  # use global_skin_index here
                        #expected_value = max_seller_price(prices['USD'][skin][wear]) * prob
                        expected_value = (prices['USD'][skin][wear]) * prob
                        #st_expected_value = max_seller_price(prices['EUR'][skin]["ST " + wear]) * prob
                        expected_values.append(expected_value)
                        #st_expected_values.append(st_expected_value)

                        global_skin_index += 1  # increment global_skin_index after using it

                all_expected_values.append(sum(expected_values))
                all_st_expected_values.append(sum(st_expected_values))

            # Calculate splits
            split = {'-'.join(map(str, split)): {
                'ev': round(all_expected_values[i], 2),
                #'st_ev': round(all_st_expected_values[i], 2)
            } for i, split in enumerate(split_combinations)}

            combined_float_ranges['+'.join(wear_combination)] = {
                'min_float': min_float_value,
                'max_float': max_float,
                'split': split
            }

    sorted_combined_float_ranges = sorted(combined_float_ranges.items(), key=lambda x: x[1]['max_float'])
    return collections, rarity, oldest_timestamp, sorted_combined_float_ranges

def main(collections, rarities):
    num_collections = len(collections)
    for rarity in rarities: # Loop over all rarities
        all_expected_values = []
        
        for r in range(1, num_collections + 1): # Loop over all possible numbers of collections in the combination
            for collection_combo in itertools.combinations(collections, r): # Generate all combinations of collections of this size
                ev = calculate_expected_values(list(collection_combo), rarity) # Calculate the expected value for this rarity
                all_expected_values.append(ev)

        
        ev_file = f'ev_{rarity}.json' # Save data to JSON file specific for the rarity
        with open(ev_file, 'w') as json_file:
            json.dump(all_expected_values, json_file, indent=2)
        print(f"Expected values for rarity '{rarity}' exported to {ev_file}")

start_time = time.time()
float_round_decimals = 7 #14

wear_floats = {
    "FN": round(0.07 - 10**(-float_round_decimals), float_round_decimals),
    "MW": round(0.15 - 10**(-float_round_decimals), float_round_decimals),
    "FT": round(0.38 - 10**(-float_round_decimals), float_round_decimals),
    "WW": round(0.45 - 10**(-float_round_decimals), float_round_decimals),
    "BS": 1
}

#collections = ["Clutch"]
collections = ["Danger_Zone", "Clutch"]
#collections = ["Danger_Zone"]
#collections = ["Recoil", "Danger_Zone", "Prisma"]
rarities = ["Covert"]
#rarities = ["Covert", "Classified", "Restricted"]

main(collections, rarities)

end_time = time.time() # end the timer and print the elapsed time
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")
from itertools import product
#from datetime import datetime
#import csv
#import math
#import sys
#import os
import time
#import random
#import json
import itertools
import pandas as pd

#collections = ["Recoil"]
#collections = ["Danger_Zone", "Recoil"]

#collections = ["Recoil", "Danger_Zone", "Prisma"]

#rarities = ["Covert", "Classified", "Restricted"]

prices_location_structure = "{collection}/{collection}_prices.csv"
float_round_decimals = 7 #14
#collection = "Recoil"
#collection = sys.argv[1]  # "Recoil"
#rarity = "Classified"
#prices_csv = f"{collection}/{collection}_prices.csv"
#ev_csv = f"{collection}/{collection}_EV.csv"

wear_floats = {
    "FN": round(0.07 - 10**(-float_round_decimals), float_round_decimals),
    "MW": round(0.15 - 10**(-float_round_decimals), float_round_decimals),
    "FT": round(0.38 - 10**(-float_round_decimals), float_round_decimals),
    "WW": round(0.45 - 10**(-float_round_decimals), float_round_decimals),
    "BS": 1
}



def calculate_wear_float_ranges(wear_floats, min_float, max_float, float_round_decimals):
    wear_float_ranges = {}
    for wear, wear_float_value in wear_floats.items():
        #print(wear_float_value)
        #print(min_float)
        float_range = (wear_float_value - min_float) / (max_float - min_float)
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
    print(collections)
    #all_data = []
    #collection = collections[0]
    #print(collection)
    all_data = pd.read_csv('prices.csv')
    item_data = all_data[all_data['collection'].isin(collections)]
    print(item_data)
    '''
    for collection in collections:
        prices_csv = prices_location_structure.format(collection=collection)
        data = combined_data(prices_csv, rarity)
        all_data.append(data)
    oldest_timestamp = min(min(data[4], key=parse_timestamp) for data in all_data)    
    '''


    float_ranges_list = []

    #for skins, min_floats, max_floats, prices, timestamps in all_data:
    #for item, MinF, MaxF, prices in all_data:
    for index, row in item_data.iterrows():
        #print(row['item'])
        #print(row['MinF'])
        #for MinF, MaxF in all_data: #in zip(MinFloats, MaxFloats):
        wear_float_ranges = calculate_wear_float_ranges(wear_floats, row['MinF'], row['MaxF'], float_round_decimals)
        float_ranges_list.append(wear_float_ranges)

    print(float_ranges_list)
    unique_floats = {}
    combined_float_ranges = {}
    all_wear_combinations = list(product(*float_ranges_list))
    #print(all_wear_combinations)

    #full_max_float = []
    #filtered_max_float = []

    #'''
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
            print(f"Min float value: ", min_float_value)
            #print(f"Max float value: ", max_float)   
            all_expected_values = []
            #all_st_expected_values = []
            #print("New wear level! The wear is: ", '+'.join(wear_combination))
            # Calculate all possible splits for the given number of collections
            split_combinations = partition_number(len(collections))
    
            for split in split_combinations:
                expected_values = []
                #st_expected_values = []
                global_skin_index = 0  # start global_skin_index at 0
                
                for i, (items, lowest_floats, highest_floats, prices) in enumerate(item_data):
                    #skin_count = len(skins)
                    # Calculate the probability
                    split_factor = split[i]
                    outcome_count = sum(split[j]*len(item_data[j][0]) for j in range(len(collections)))
                    prob = split_factor / outcome_count

                    for item in items:
                        wear = wear_combination[global_skin_index]  # use global_skin_index here
                        print(item)
                        print(prices[item][wear])
                        '''
                        #expected_value = max_seller_price(prices['EUR'][item][wear]) * prob
                        #st_expected_value = max_seller_price(prices['EUR'][skin]["ST " + wear]) * prob
                        expected_values.append(expected_value)
                        #st_expected_values.append(st_expected_value)

                        global_skin_index += 1  # increment global_skin_index after using it

                all_expected_values.append(sum(expected_values))
                all_st_expected_values.append(sum(st_expected_values))

            # Calculate splits
            split = {'-'.join(map(str, split)): {
                'ev': round(all_expected_values[i], 2)
                #'st_ev': round(all_st_expected_values[i], 2)
            } for i, split in enumerate(split_combinations)}

            combined_float_ranges['+'.join(wear_combination)] = {
                'min_float': min_float_value,
                'max_float': max_float,
                'split': split
            }

    sorted_combined_float_ranges = sorted(combined_float_ranges.items(), key=lambda x: x[1]['max_float'])
    return collections, rarity, sorted_combined_float_ranges
    '''

def main(collections, rarities):
    num_collections = len(collections)

    for rarity in rarities: # Loop over all rarities
        all_expected_values = []
        
        for r in range(1, num_collections + 1): # Loop over all possible numbers of collections in the combination
            for collection_combo in itertools.combinations(collections, r): # Generate all combinations of collections of this size
                #print(collection_combo)
                ev = calculate_expected_values(collection_combo, rarity) # Calculate the expected value for this rarity
                #all_expected_values.append(ev)

        #ev_file = f'ev_{rarity}.json' # Save data to JSON file specific for the rarity
        #with open(ev_file, 'w') as json_file:
        #    json.dump(all_expected_values, json_file, indent=2)

        #print(f"Expected values for rarity '{rarity}' exported to {ev_file}")

start_time = time.time() # start the timer

all_collections = ['Danger_Zone', 'Clutch']
rarities = ["Covert"]

#main(all_collections, rarities)

end_time = time.time() # end the timer and print the elapsed time
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")

#print(partition_number(1))

splits = partition_number(1)
print(splits)

for split in splits:
    print(split[0])

print(len(splits))
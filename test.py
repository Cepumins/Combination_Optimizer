from itertools import product
from datetime import datetime
import csv
import math
#import sys
import os
import time
import random
import json

collections = ["Recoil"]
#collections = ["Recoil", "Danger_Zone"]
rarities = ["Classified"]
#rarities = ["Covert", "Classified", "Restricted"]

prices_location_structure = "{collection}/{collection}_prices.csv"
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
                    "FN": float(row["FN"]),
                    "MW": float(row["MW"]),
                    "FT": float(row["FT"]),
                    "WW": float(row["WW"]),
                    "BS": float(row["BS"]),
                    "ST FN": float(row["FN ST"]),
                    "ST MW": float(row["MW ST"]),
                    "ST FT": float(row["FT ST"]),
                    "ST WW": float(row["WW ST"]),
                    "ST BS": float(row["BS ST"])
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

    for wear_combination in all_wear_combinations:
        max_float = min(wear_ranges[w] for wear_ranges, w in zip(float_ranges_list, wear_combination))

        if max_float not in unique_floats:
            unique_floats[max_float] = True
            
            all_expected_values = []
            all_st_expected_values = []
            #print("New wear level! The wear is: ", '+'.join(wear_combination))
            for split_factor in range(11):
                split_factor = split_factor / 10.0  # normalize to range 0.0-1.0
                expected_values = []
                st_expected_values = []
                total_skin_count = len(float_ranges_list)

                global_skin_index = 0  # start global_skin_index at 0

                for i, (skins, lowest_floats, highest_floats, prices, timestamps) in enumerate(all_data):
                    skin_count = len(skins)

                    if len(collections) == 1:
                        prob = 1/skin_count
                    else:
                        prob = (( (split_factor*skin_count)/(split_factor*skin_count+(1-split_factor)*(total_skin_count-skin_count)) ) if i == 0 else ( ((1-split_factor)*skin_count)/(((1-split_factor)*skin_count)+(split_factor*(total_skin_count-skin_count))) )) / skin_count
                        #print(f'( ({split_factor}*{skin_count}) / ({split_factor}*{skin_count}+(1-{split_factor})*({total_skin_count}-{skin_count}) )  if i == 0, else:')
                        #print(f'( (1-{split_factor}*{skin_count}) / ((1-{split_factor}*{skin_count}+({split_factor})*({total_skin_count}-{skin_count})) / {skin_count} )')
                    
                    for skin in skins:
                        wear = wear_combination[global_skin_index]  # use global_skin_index here
                        expected_value = max_seller_price(prices['EUR'][skin][wear]) * prob
                        st_expected_value = max_seller_price(prices['EUR'][skin]["ST " + wear]) * prob
                        #print('For item ', [skin], 'the wear is ', wear, ' and the price is ', prices['EUR'][skin][wear])
                        expected_values.append(expected_value)
                        st_expected_values.append(st_expected_value)

                        global_skin_index += 1  # increment global_skin_index after using it
                
                all_expected_values.append(sum(expected_values))
                all_st_expected_values.append(sum(st_expected_values))

            combined_float_ranges['+'.join(wear_combination)] = {
                'min_float': round(max_float - 10**(-float_round_decimals), float_round_decimals),
                'max_float': max_float,
                'expected_values': all_expected_values,
                'st_expected_values': all_st_expected_values
            }

    sorted_combined_float_ranges = sorted(combined_float_ranges.items(), key=lambda x: x[1]['max_float'])
    return rarity, oldest_timestamp, sorted_combined_float_ranges

all_expected_values = []
for rarity in rarities:
    all_expected_values.append(calculate_expected_values(collections, rarity))

# Get the lengths of the longest items in each column
spacing = 1 #1
rarity_len = max(len(rarity) for rarity, _, _ in all_expected_values) + spacing*2
wear_len = max(len(wear) for _, _, sorted_combined_float_ranges in all_expected_values for wear, _ in sorted_combined_float_ranges) + spacing*2
timestamp_len = max(len(timestamp) for _, timestamp, _ in all_expected_values) + spacing*2
float_len = len(f"{round(0.0, float_round_decimals)}") + (float_round_decimals-1) + spacing*2

# Get the lengths of the longest EV and ST EV
ev_len = max(len(f"{ev:<7.2f}") for _, _, sorted_combined_float_ranges in all_expected_values for _, data in sorted_combined_float_ranges for ev in data['expected_values']) + spacing
st_ev_len = max(len(f"{st_ev:<0.2f}") for _, _, sorted_combined_float_ranges in all_expected_values for _, data in sorted_combined_float_ranges for st_ev in data['st_expected_values']) + spacing

if len(collections) == 1:
    print(f"{'Rarity'},{'Wear'},{'Timestamp'},{'Min Float'},{'Max Float'},{'EV'},{'ST EV'}")
    for data_tuple in all_expected_values:
        rarity, oldest_timestamp, sorted_combined_float_ranges = data_tuple
        min_float = 0.0
        for wear, data in sorted_combined_float_ranges:
            print(
                f"{rarity},{wear},{oldest_timestamp},{min_float:<{float_len}.{float_round_decimals}f},{data['max_float']:<{float_len}.{float_round_decimals}f},{data['expected_values'][0]:.2f},{data['st_expected_values'][0]:.2f}"
            )
            min_float = round(data['max_float'] + 10**(-float_round_decimals), float_round_decimals)
else:
    print(f"{'Rarity':<{rarity_len}} {'Wear':<{wear_len}} {'Timestamp':<{timestamp_len}} {'Min Float':<{float_len}} {'Max Float':<{float_len+spacing}}", end="")
    for i in range(11):
        print(f"{f'{i}-{abs(i-10)} EV':<{ev_len}} {f'ST EV':<{st_ev_len+spacing}}", end="")
    print()

    for data_tuple in all_expected_values:
        rarity, oldest_timestamp, sorted_combined_float_ranges = data_tuple
        min_float = 0.0
        for wear, data in sorted_combined_float_ranges:
            print(
                f"{rarity:<{rarity_len}} {wear:<{wear_len}} {oldest_timestamp:<{timestamp_len}} {min_float:<{float_len}.{float_round_decimals}f} {data['max_float']:<{float_len}.{float_round_decimals}f}", end=""
            )
            for ev, st_ev in zip(data['expected_values'], data['st_expected_values']):
                print(f" {ev:<{ev_len}.2f} {st_ev:<{st_ev_len}.2f}", end="")
            print()
            min_float = round(data['max_float'] + 10**(-float_round_decimals), float_round_decimals)

'''
# Create the CSV file and write the header
directory = "EV"
if not os.path.exists(directory):
    os.makedirs(directory)
ev_csv = f"{directory}/{'_and_'.join(collections)}_EV.csv"

with open(ev_csv, 'w', newline='') as csvfile:
    csv_writer = csv.writer(csvfile)
    csv_writer.writerow(["Rarity", "Wear", "Timestamp", "Min Float", "Max Float", "EV", "ST EV"])

    for rarity, oldest_timestamp, sorted_combined_float_ranges in all_expected_values:
        min_float = 0.0
        for wear, data in sorted_combined_float_ranges:
            row = [
                rarity,
                wear,
                oldest_timestamp,
                round(min_float, float_round_decimals),
                round(data['max_float'], float_round_decimals),
                round(data['expected_value'], 2),
                round(data['st_expected_value'], 2),
            ]
            csv_writer.writerow(row)
            min_float = round(data['max_float'] + 10**(-float_round_decimals), float_round_decimals)

print("Expected values exported to:", ev_csv)
'''
# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")
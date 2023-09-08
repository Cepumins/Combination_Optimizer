import pandas as pd
import numpy as np
import math

float_round_decimals = 7 #14

wear_floats = {
    "FN": round(0.07 - 10**(-float_round_decimals), float_round_decimals),
    "MW": round(0.15 - 10**(-float_round_decimals), float_round_decimals),
    "FT": round(0.38 - 10**(-float_round_decimals), float_round_decimals),
    "WW": round(0.45 - 10**(-float_round_decimals), float_round_decimals),
    "BS": 1
}

collections = {"Recoil", "Danger_Zone"}
rarity = {"Covert"}

def load_and_filter_data(collections, rarity):
    df_list = []
    for collection in collections:
        df = pd.read_csv(f"{collection}/{collection}_prices.csv")
        df = df[df['Rarity'].isin(rarity)]
        df_list.append(df)
    return pd.concat(df_list)

def load_skin_data(collections):
    skin_data_list = []
    for collection in collections:
        df_skin = pd.read_csv(f"{collection}/{collection}.csv")
        skin_data = df_skin.groupby('Item').agg(MinF=('MinF', 'min'), MaxF=('MaxF', 'max')).reset_index()
        skin_data_list.append(skin_data)
    return pd.concat(skin_data_list)

def calculate_float_range(wear_value, min_float, max_float):
    return round((wear_value - min_float) / (max_float - min_float), float_round_decimals)

def calculate_avg_floats(wear, wear_floats, min_floats, max_floats):
    wear_value = wear_floats[wear]
    max_avg_floats = [calculate_float_range(wear_value, min_float, max_float) for min_float, max_float in zip(min_floats, max_floats)]
    max_avg_floats.sort()
    min_avg_floats = [0.0] + [max_float + 10**(-float_round_decimals) for max_float in max_avg_floats[:-1]]
    return min_avg_floats, max_avg_floats

def calculate_wear_ranges(min_floats, max_floats, max_avg_floats):
    wear_ranges = []
    for max_avg_float in max_avg_floats:
        wear_list = []
        for min_float, max_float in zip(min_floats, max_floats):
            calculated_wear = (max_float - min_float) * max_avg_float + min_float
            for wear, wear_value in wear_floats.items():
                if calculated_wear < wear_value + 10**(-float_round_decimals):
                    wear_list.append(wear)
                    break
        wear_ranges.append('+'.join(wear_list))
    return wear_ranges

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

df = load_and_filter_data(collections, rarity)
skin_data = load_skin_data(collections)

# Merge the two DataFrames on the 'Item' column
df = pd.merge(df, skin_data, how='inner', on='Item')

rarity_str = ', '.join(rarity)
collections_str = '&'.join(collections)

min_floats = df['MinF'].tolist()
max_floats = df['MaxF'].tolist()

min_avg_floats, max_avg_floats = calculate_avg_floats("FN", wear_floats, min_floats, max_floats)
wear_ranges = calculate_wear_ranges(min_floats, max_floats, max_avg_floats)

print(f"Rarity Collections Wear\t\tMin Avg Float\tMax Avg Float")
for min_avg_float, max_avg_float, wear_range in zip(min_avg_floats, max_avg_floats, wear_ranges):
    print(f"{rarity_str} {collections_str} {wear_range:<17}\t{min_avg_float:<16}\t{max_avg_float:<16}")

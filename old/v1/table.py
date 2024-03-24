import pandas as pd
import numpy as np
import json
import time

#just a test
collections = 'Recoil'
#collections = 'Danger_Zone'
rarity = 'Covert'
count = 100
round_digits = 2

# start the timer
start_time = time.time()

# Load the data from ev_Covert.json
with open(f'_ev/ev_{rarity}.json', 'r') as file:
    ev_data_content = json.load(file)

data = ev_data_content[0][3:]

# Get the correct item_rarity
rarity_levels = [
    'Covert', 
    'Classified', 
    'Restricted', 
    'Mil-Spec', 
    'Industrial', 
    'Consumer'
]
if rarity not in rarity_levels[:-1]:
    raise ValueError(f"There is no rarity below {rarity}.")
item_rarity = rarity_levels[rarity_levels.index(rarity) + 1]   

# Initialize the DataFrame
wear_values = [i / count for i in range(count + 1)]
df = pd.DataFrame({"wear_values": wear_values})

# Populate the DataFrame with EV and ST_EV values
df["ev"] = float("NaN")
df["st_ev"] = float("NaN")

for condition_set in data:
    for condition_entry in condition_set:
        condition = condition_entry[0]
        condition_data = condition_entry[1]
        min_float = condition_data["min_float"]
        max_float = condition_data["max_float"]
        ev = condition_data["split"]["10"]["ev"]
        st_ev = condition_data["split"]["10"]["st_ev"]
        
        df.loc[(df["wear_values"] >= min_float) & (df["wear_values"] <= max_float), "ev"] = ev
        df.loc[(df["wear_values"] >= min_float) & (df["wear_values"] <= max_float), "st_ev"] = st_ev

# Load and filter the Danger_Zone_prices.csv based on the rarity 'Classified'
prices_data = pd.read_csv(f'_collections/{collections}/{collections}_prices.csv')
filtered_items = prices_data[prices_data['Rarity'] == item_rarity]

# Define the combined interpolation function
def interpolate_prices_combined(item, is_stattrak=False):
    wear_values = [i / count for i in range(count + 1)]
    prices = []
    print(item["Item"])

    MaxF = item["MaxF"]
    MinF = item["MinF"]

    wear_mapping = {
        "FN": 0.07,
        "MW": 0.15,
        "FT": 0.38,
        "WW": 0.45,
        "BS": MaxF
    }   

    # If StatTrak, adjust the wear mapping to use ST prices and the price_mapping dictionary
    if is_stattrak:
        price_mapping = {key: item[key + " ST"] for key in ["FN", "MW", "FT", "WW", "BS"]}
        wear_mapping = {k + " ST": v for k, v in wear_mapping.items()}
    else:
        price_mapping = {key: item[key] for key in ["FN", "MW", "FT", "WW", "BS"]}

    # Pre-calculate slopes and intercepts
    slope_dict = {}
    intercept_dict = {}
    
    if price_mapping["MW"] is not None and price_mapping["FN"] is not None:
        slope_dict["FN"] = (price_mapping["MW"] - price_mapping["FN"]) / (0.15 - 0.07)
        intercept_dict["FN"] = price_mapping["FN"] - slope_dict["FN"] * 0.07
    if price_mapping["FT"] is not None and price_mapping["MW"] is not None:
        slope_dict["MW"] = (price_mapping["FT"]- price_mapping["MW"]) / (0.38 - 0.15)
        intercept_dict["MW"] = price_mapping["MW"] - slope_dict["MW"] * 0.15
    if price_mapping["WW"] is not None and price_mapping["FT"] is not None:
        slope_dict["FT"] = (price_mapping["WW"] - price_mapping["FT"]) / (0.45 - 0.38)
        intercept_dict["FT"] = price_mapping["FT"] - slope_dict["FT"] * 0.38
    if price_mapping["BS"] is not None and price_mapping["WW"] is not None:
        slope_dict["WW"] = (price_mapping["BS"] - price_mapping["WW"]) / (MaxF - 0.45)
        intercept_dict["WW"] = price_mapping["WW"] - slope_dict["WW"] * 0.45
    print(f'y={slope_dict} * x + {intercept_dict}')

    for wear_value in wear_values:
        if MinF <= wear_value <= MaxF:
            if wear_value <= 0.15 and 0.15 <= MaxF:
                wear_test = 'FN'
            elif 0.15 <= wear_value <= 0.38 and 0.38 <= MaxF:
                wear_test = 'MW'
            elif 0.38 <= wear_value <= 0.45 and 0.45 <= MaxF:
                wear_test = 'FT'
            elif 0.45 <= wear_value <= MaxF:
                wear_test = 'WW'
            else:
                wear_test = 'BS'
            
            if wear_test in slope_dict:
                slope = slope_dict[wear_test]
                intercept = intercept_dict[wear_test]
                price = (slope * wear_value + intercept)
                #price = (slope * wear_value + intercept) * 10
            else:
                price = np.nan

            # Extended calculations
            if pd.isnull(price):
                if MinF <= wear_value <= MaxF:
                    if MinF < 0.15 and 0.07 < wear_value <= 0.15 and "MW" in slope_dict:
                        slope = slope_dict["MW"]
                        intercept = intercept_dict["MW"]
                    elif 0.15 <= wear_value <= 0.38 and 0.15 < MinF < 0.38 and "FT" in slope_dict:
                        slope = slope_dict["FT"]
                        intercept = intercept_dict["FT"]
                    elif 0.38 <= wear_value <= 0.45 and 0.38 < MinF < 0.45 and "WW" in slope_dict:
                        slope = slope_dict["WW"]
                        intercept = intercept_dict["WW"]
                    elif 0.07 < wear_value < 0.15 and 0.07 < MaxF < 0.15 and "FN" in slope_dict:
                        slope = (price_mapping["MW"] - price_mapping["FN"]) / (MaxF - 0.07)
                        intercept = price_mapping["FN"] - slope * 0.07
                    elif 0.15 < wear_value < 0.38 and 0.15 < MaxF < 0.38 and "MW" in slope_dict:
                        slope = (price_mapping["FT"] - price_mapping["MW"]) / (MaxF - 0.15)
                        intercept = price_mapping["MW"] - slope * 0.15
                    elif 0.38 < wear_value < 0.45 and 0.38 < MaxF < 0.45 and "FT" in slope_dict:
                        slope = (price_mapping["WW"] - price_mapping["FT"]) / (MaxF - 0.38)
                        intercept = price_mapping["FT"] - slope * 0.38
                    price = (slope * wear_value + intercept) * 10
                else:
                    price = np.nan
        else:
            price = np.nan
        
        prices.append(price)

    df = pd.DataFrame({
        "wear_values": wear_values,
        "price": [round(p, round_digits) if pd.notnull(p) else p for p in prices]
    })
    
    return df

# Add the interpolated prices to the dataframe
for _, item_row in filtered_items.iterrows():
    item_prices = interpolate_prices_combined(item_row)
    df[item_row["Item"]] = item_prices["price"].values
    
    item_st_prices = interpolate_prices_combined(item_row, is_stattrak=True)
    df[item_row["Item"] + " ST"] = item_st_prices["price"].values

# Save the combined DataFrame to a CSV file
df.to_csv(f"_tables/table_data_{collections}_for_{rarity}.csv", index=False)

# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")
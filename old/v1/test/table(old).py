import pandas as pd
import numpy as np
import json
import time


collections = 'Danger_Zone'
rarity = 'Covert'
count = 100
round_digits = 2

# start the timer
start_time = time.time()

# Load the data from ev_Covert.json
with open(f'ev_{rarity}.json', 'r') as file:
    ev_data_content = json.load(file)
    
data = ev_data_content[0][3:]

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
prices_data = pd.read_csv(f'{collections}/{collections}_prices.csv')
filtered_items = prices_data[prices_data['Rarity'] == 'Restricted']

# Define the combined interpolation function
def interpolate_prices_combined(item, is_stattrak=False):
    wear_values = [i / count for i in range(count + 1)]
    df = pd.DataFrame({"wear_values": wear_values})

    MaxF = item["MaxF"]
    MinF = item["MinF"]
    
    #print(f'The MinF is {MinF} and the MaxF is {MaxF}')

    wear_mapping = {
        "FN": 0.07,
        "MW": 0.15,
        "FT": 0.38,
        "WW": 0.45,
        "BS": MaxF
    }
    
    if is_stattrak:
        wear_mapping = {k + " ST": v for k, v in wear_mapping.items()}

    for wear_value in wear_values:
        if MinF <= wear_value <= MaxF:
            #print(wear_value)
            # check even if the wear_value is between MinF and MaxF
            # remove MinF checks from regular lines (not extended)
            if wear_value <= 0.15 and 0.15 <= MaxF:
                slope = (item["MW"] - item["FN"]) / (0.15 - 0.07)
                intercept = item["FN"] - slope * 0.07
                wear_test = 'FN'
            elif 0.15 <= wear_value <= 0.38 and 0.38 <= MaxF:
                slope = (item["FT"] - item["MW"]) / (0.38 - 0.15)
                intercept = item["MW"] - slope * 0.15
                wear_test = 'MW'
            elif 0.38 <= wear_value <= 0.45 and 0.45 <= MaxF:
                slope = (item["WW"] - item["FT"]) / (0.45 - 0.38)
                intercept = item["FT"] - slope * 0.38
                wear_test = 'FT'
            elif 0.45 <= wear_value <= MaxF:
                slope = (item["BS"] - item["WW"]) / (MaxF - 0.45)
                intercept = item["WW"] - slope * 0.45
                wear_test = 'WW'
            else:
                #slope = 0  # or handle this case differently if needed
                #intercept = 0
                wear_test = 'BS'
            if wear_test == 'BS':
                df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"] = np.nan
            else:
                df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"] = (slope * wear_value + intercept) * 10
                #print(f'{round(((slope * wear_value + intercept) * 10), 2)}')
                #print(f'Wear is {wear_test}, the slope is {slope} and the intercept is {intercept}')

            # Extending to MinF and MaxF
            if pd.isnull(df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"].iloc[0]):
                if MinF <= wear_value <= MaxF:

                    # extending MinF
                    if MinF < 0.15 and 0.07 < wear_value <= 0.15:
                        min_slope = (item["FT"] - item["MW"]) / (0.38 - 0.15)
                        min_intercept = item["MW"] - min_slope * 0.15
                        min_wear_test = 'Min MW'
                    elif 0.15 < MinF < 0.38 and 0.15 < wear_value <= 0.38:
                        min_slope = (item["WW"] - item["FT"]) / (0.45 - 0.38)
                        min_intercept = item["FT"] - min_slope * 0.38
                        min_wear_test = 'Min FT'
                    elif 0.38 < MinF < 0.45 and 0.38 <= wear_value <= 0.45:
                        min_slope = (item["BS"] - item["WW"]) / (MaxF - 0.45)
                        min_intercept = item["WW"] - min_slope * 0.45
                        min_wear_test = 'Min WW'

                    # extending MaxF
                    elif 0.07 < wear_value < 0.15 and 0.07 < MaxF < 0.15:
                        min_slope = (item["MW"] - item["FN"]) / (MaxF - 0.07)
                        min_intercept = item["FN"] - min_slope * 0.07
                        min_wear_test = 'Max FN'
                    elif 0.15 < wear_value < 0.38 and 0.15 < MaxF < 0.38:
                        min_slope = (item["FT"] - item["MW"]) / (MaxF - 0.15)
                        min_intercept = item["MW"] - min_slope * 0.15
                        min_wear_test = 'Max MW'
                    elif 0.38 < wear_value < 0.45 and 0.38 < MaxF < 0.45:
                        min_slope = (item["WW"] - item["FT"]) / (MaxF - 0.38)
                        min_intercept = item["FT"] - min_slope * 0.38
                        min_wear_test = 'Max FT'
                    #print(f'extended MinF {MinF} with wear {min_wear_test}')
                    #print(f'{round(((min_slope * wear_value + min_intercept) * 10), 2)}')
                    df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"] = (min_slope * wear_value + min_intercept) * 10
                    #print(f'Wear is {min_wear_test}, the slope is {min_slope} and the intercept is {min_intercept}')
                else:
                    df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"] = np.nan
                    #print(f'Filled {wear_value} with NaN')
            #print()
        else:
            df.loc[abs(df["wear_values"] - wear_value) < 1e-5, "price"] = np.nan

    # Fill values outside MinF and MaxF range with NaN
    #df.loc[df["wear_values"] < MinF, "price"] = np.nan
    #df.loc[df["wear_values"] > MaxF, "price"] = np.nan
    #print()
    #print()

    # Round the prices
    df["price"] = df["price"].apply(lambda x: round(x, round_digits) if pd.notnull(x) else x)
    
    return df

# Add the interpolated prices to the dataframe
for _, item_row in filtered_items.iterrows():
    item_prices = interpolate_prices_combined(item_row)
    df[item_row["Item"]] = item_prices["price"].values
    
    item_st_prices = interpolate_prices_combined(item_row, is_stattrak=True)
    df[item_row["Item"] + " ST"] = item_st_prices["price"].values

# Save the combined DataFrame to a CSV file
df.to_csv(f"combined_data_{collections}_old.csv", index=False)

# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")
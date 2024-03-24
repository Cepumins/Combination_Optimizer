#import numpy as np
import pandas as pd
import time
#import os
import csv
import itertools

collection = "Recoil"
rarity = "Classified"
wear = "ALL"
StatTrak = False

prefix = '_collections'

# Read the CSV file
filename = f"{prefix}/{collection}/{collection}_EV.csv"
data_ev = pd.read_csv(filename)

# Define the rarity shift
rarity_shift = {
    "Consumer": "Industrial",
    "Industrial": "Mil-Spec",
    "Mil-Spec": "Restricted",
    "Restricted": "Classified",
    "Classified": "Covert"
}

# Shift the rarity for tradeup
tradeup_rarity = rarity_shift.get(rarity, rarity)

# total number of items
num_items = 10

# Read the data from the CSV file
combined_wear_data = {}
with open(filename, newline='') as csvfile:
    csv_reader = csv.DictReader(csvfile)
    for row in csv_reader:
        if row['Rarity'] == rarity_shift[rarity]:
            wear_key = row['Wear']
            min_float = float(row['Min Float'])
            max_float = float(row['Max Float'])
            expected_value = float(row['ST EV']) if StatTrak else float(row['EV'])
            combined_wear_data[wear_key] = (min_float, max_float, expected_value)

#for wear_outcome, wear_data in combined_wear_data.items():
#    min_floatWear, max_floatWear, expected_value = wear_data
#    print(wear_outcome, min_floatWear, max_floatWear, expected_value)

# start the timer
start_time = time.time()

data = pd.read_csv(f"{prefix}/{collection}/Items/filtered_data_{collection}_{rarity}_{wear}.csv")
#data = pd.read_csv(f"{output}\\{collection}\\filtered_data_{collection}_{rarity}_{wear}.csv")

def print_summary(print_data, title):
    avg_floatWear = print_data['floatWear'].mean()
    total_price = print_data['formattedPrice'].sum()
    print(title)
    print(f"Float: {avg_floatWear:.8f} - Price: {total_price:.2f}")
    print(print_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[True, True]).reset_index(drop=True))

def adjust_float_to_range(float_data, min_float, max_float, data):
    
    def within_range(value):
        return min_float <= value <= max_float

    #float_data = float_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])
    #data = data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])

    range_reached = True
    adjust_float_start_time = time.time()

    while not within_range(float_data['floatWear'].mean()):
        range_reached = False
        made_adjustment = False
        
        for _, row in float_data.iterrows():
            filtered_data = data[(data['formattedPrice'] * 1.25<= row['formattedPrice']) & (~data['ID'].isin(float_data['ID']))]
            #filtered_data = data[(data['formattedPrice'] <= row['formattedPrice']) & (~data['ID'].isin(float_data['ID']))]

            for _, data_row in filtered_data.iterrows():
                temp_float_data = float_data.copy()
                temp_float_data.loc[temp_float_data['ID'] == row['ID'], data.columns] = data_row.values

                old_mean = float_data['floatWear'].mean()
                new_mean = temp_float_data['floatWear'].mean()

                if old_mean < max_float and new_mean <= max_float and new_mean > old_mean:
                    made_adjustment = True
                    k = row['ID']
                    replacing_id = data_row['ID']
                    
                    #old_price = float_data.loc[float_data['ID'] == k, 'formattedPrice'].iloc[0]
                    #new_price = data_row['formattedPrice']
                    #price_decrease = round(old_price - new_price, 2)
                    #new_cost = float_data['formattedPrice'].sum() - price_decrease
                    
                    #print(f"Replacing item with ID {k} in float_data with item ID {replacing_id} from data")
                    #print(f"Price decreased by: {price_decrease}")
                    #print(f"After Float adjustment: Float - {new_mean:.8f}, Price: {new_cost:.2f}")

                    float_data.loc[float_data['ID'] == k, data.columns] = data_row.values
                    data.loc[data['ID'] == replacing_id, data.columns] = row.values

                    if within_range(new_mean):
                        range_reached = True
                        break

                elif new_mean > max_float:
                    continue

                if made_adjustment: 
                    break

            if made_adjustment:
                break

        adjust_float_elapsed_time = time.time() - adjust_float_start_time  # Calculate elapsed time
        if not made_adjustment and adjust_float_elapsed_time >= 0.5:
            print("Time passed")
            print("")
            print("")
            break

    #print_summary(float_data, "Float adjustment")
    return float_data, range_reached

def single_replacement(single_data, min_float, max_float, data):

    single_data = single_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])

    for _, row in single_data.iterrows():
        # Filter data by price and ID constraints
        filtered_data = data[(data['formattedPrice'] < row['formattedPrice']) & (~data['ID'].isin(single_data['ID']))]
        
        for _, data_row in filtered_data.iterrows():
            temp_single_data = single_data.copy()
            temp_single_data.loc[temp_single_data['ID'] == row['ID'], data.columns] = data_row.values

            temp_floatWear_mean = temp_single_data['floatWear'].mean()
            if min_float < temp_floatWear_mean < max_float:
                #old_price = single_data['formattedPrice'].sum()
                k = row['ID']
                replacing_id = data_row['ID']
                #print(f"Replacing item with ID {k} in single_data with item ID {replacing_id} from data")
                single_data.loc[single_data['ID'] == k, data.columns] = data_row.values
                data.loc[data['ID'] == replacing_id, data.columns] = row.values
                
                #new_price = single_data['formattedPrice'].sum()
                #price_decrease = round(old_price - new_price, 2)
                #print(f"Price decreased by: {price_decrease}")
                #avg_floatWear = single_data['floatWear'].mean()
                #print(f"After Single replacement: Float - {avg_floatWear:.8f}, Price: {new_price:.2f}")
                break

    #print_summary(single_data, "Single replacement")
    return single_data

def pair_replacement(pair_data, min_float, max_float, data):
    pair_data = pair_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])

    data_pairs = data.merge(data, how='cross', suffixes=('_x', '_y')).query('ID_x != ID_y')
    data_pairs['total_price'] = data_pairs['formattedPrice_x'] + data_pairs['formattedPrice_y']
    data_pairs = data_pairs.sort_values(by='total_price', ascending=True)

    improvement_found = True

    while improvement_found:
        improvement_found = False
        best_replacement = None
        best_price_decrease = 0

        pair_data_IDs = pair_data['ID'].values
        pair_combinations = list(itertools.combinations(pair_data.itertuples(), 2))

        for row1, row2 in pair_combinations:
            mask = (~data_pairs['ID_x'].isin(pair_data_IDs)) & (~data_pairs['ID_y'].isin(pair_data_IDs))
            mask &= (data_pairs['ID_x'] != row1.ID) & (data_pairs['ID_y'] != row2.ID)
            mask &= (data_pairs['total_price'] < row1.formattedPrice + row2.formattedPrice)
            mask &= (data_pairs['ID_x'] != data_pairs['ID_y'])

            valid_pairs = data_pairs.loc[mask]
            valid_pairs_copy = valid_pairs.copy()
            valid_pairs_copy.loc[:, 'new_avg_float'] = (pair_data.loc[:, 'floatWear'].sum() - row1.floatWear - row2.floatWear + valid_pairs_copy.loc[:, 'floatWear_x'] + valid_pairs_copy.loc[:, 'floatWear_y']) / len(pair_data)

            valid_pairs_copy = valid_pairs_copy[(valid_pairs_copy['new_avg_float'] > min_float) & (valid_pairs_copy['new_avg_float'] < max_float)]

            if not valid_pairs_copy.empty:
                best_pair = valid_pairs_copy.loc[valid_pairs_copy['total_price'].idxmin()]
                old_price = pair_data['formattedPrice'].sum()
                new_price = old_price - row1.formattedPrice - row2.formattedPrice + best_pair['formattedPrice_x'] + best_pair['formattedPrice_y']
                price_decrease = old_price - new_price

                if price_decrease > best_price_decrease:
                    best_price_decrease = price_decrease
                    best_replacement = (row1, row2, best_pair)

        if best_replacement:
            improvement_found = True
            row1, row2, best_pair = best_replacement
            old_price = pair_data['formattedPrice'].sum()

            k1, k2 = row1.ID, row2.ID
            #print(f"Replacing items with ID {k1} and ID {k2} in pair_data with items with ID {best_pair['ID_x']} and ID {best_pair['ID_y']} from data")

            pair_data.loc[pair_data['ID'] == k1, data.columns] = best_pair.filter(like='_x').values
            pair_data.loc[pair_data['ID'] == k2, data.columns] = best_pair.filter(like='_y').values

            data.loc[row1.Index, data.columns] = row1[1:]
            data.loc[row2.Index, data.columns] = row2[1:]


            pair_data = pair_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[True, True])
            new_price = pair_data['formattedPrice'].sum()
            #print(f"Price decreased by: {best_price_decrease:.2f}")
            #avg_floatWear = pair_data['floatWear'].mean()
            #print(f"After Pair replacement: Float - {avg_floatWear:.8f}, Price: {new_price:.2f}")

    #print_summary(pair_data, "Pair replacement")
    return pair_data

# Initialize best_data with the last 10 items in data
base_data = data.tail(num_items).reset_index(drop=True)
best_floatWear = base_data['floatWear'].mean()
best_value = base_data['formattedPrice'].sum()
best_data = base_data

# Add an empty DataFrame called best_summary_data
best_summary_data = pd.DataFrame()

# Create an empty DataFrame to store the results
results_df = pd.DataFrame(columns=["Wear", "Min Float", "Max Float", "Avg Float", "Cost", "Expected Value", "Expected Profit", "Exp Profit %"])

no_solution_found = False
adjust_float_to_range_function_elapsed_time = 0
single_replacement_function_elapsed_time = 0
pair_replacement_function_elapsed_time = 0

# Iterate through all wear outcomes
for wear_outcome, wear_data in combined_wear_data.items():

    # start the timer
    starting_time = time.time()
    
    # Get the min_floatWear, max_floatWear, and expected_value for the current wear outcome
    min_floatWear, max_floatWear, expected_value = wear_data
    expected_value = round(expected_value, 2)

    #print(wear_outcome, min_floatWear, max_floatWear, expected_value)

    if no_solution_found == True:
        result_row = pd.DataFrame({
            "Wear": [wear_outcome],
            "Min Float": [min_floatWear],
            "Max Float": [max_floatWear],
            "Avg Float": ["Null"],
            "Cost": ["Null"],
            "Expected Value": [expected_value],
            "Expected Profit": ["Null"],
            "Exp Profit %": ["Null"],
            "Best Data": [None]  # Include an empty value for the "Best Data" column
        })
        results_df = pd.concat([results_df, result_row], ignore_index=True)
        continue
    else:
        # Initialize best_data with the last 10 items in data for the current wear outcome
        #data_for_wear = data[data['formattedPrice'] <= ((expected_value + 15) / 3)]
        data_for_wear = data[data['formattedPrice'] <= ((expected_value) / 2)]
        #data_for_wear = data
        base_data = data_for_wear.tail(num_items).reset_index(drop=True)
        best_data = base_data

        #print_summary(best_data, "No replacement")
        # Run replacement functions for the current wear outcome
        adjust_float_to_range_function_start_time = time.time()
        best_data, range_reached = adjust_float_to_range(best_data, min_floatWear, max_floatWear, data.copy())
        adjust_float_to_range_function_end_time = time.time() - adjust_float_to_range_function_start_time
        adjust_float_to_range_function_elapsed_time = adjust_float_to_range_function_elapsed_time + adjust_float_to_range_function_end_time
        if range_reached:
            single_replacement_function_start_time = time.time()
            best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy())
            single_replacement_function_end_time = time.time() - single_replacement_function_start_time
            single_replacement_function_elapsed_time = single_replacement_function_elapsed_time + single_replacement_function_end_time
            pair_replacement_function_start_time = time.time()
            best_data = pair_replacement(best_data, min_floatWear, max_floatWear, data.copy())
            pair_replacement_function_end_time = time.time() - pair_replacement_function_start_time
            pair_replacement_function_elapsed_time = pair_replacement_function_elapsed_time + pair_replacement_function_end_time

        if not range_reached:
            total_price = "Null"
            average_float = "Null"
            expected_profit = "Null"
            ep_percentage = "Null"
            print(f"Float range not reached for {wear_outcome}")
            no_solution_found = True
        else:
            # Calculate the results for the current wear outcome
            total_price = best_data['formattedPrice'].sum()
            average_float = best_data['floatWear'].mean()
            expected_profit = round(expected_value - total_price, 2)
            ep_percentage = round((expected_value/total_price-1)*100, 2)

        # Add the results for the current wear outcome to the results DataFrame
        result_row = pd.DataFrame({
            "Wear": [wear_outcome],
            "Min Float": [min_floatWear],
            "Max Float": [max_floatWear],
            "Avg Float": [average_float],
            "Cost": [total_price],
            "Expected Value": [expected_value],
            "Expected Profit": [expected_profit],
            "Exp Profit %": [ep_percentage],
            "Best Data": [best_data]  # Include the best_data DataFrame in a new column
        })
        results_df = pd.concat([results_df, result_row], ignore_index=True)

    # end the timer
    ending_time = time.time()
    # Calculate and print the time required
    time_for_wear_outcome = ending_time - starting_time
    
    print(f"Time required for wear {wear_outcome}: {int(time_for_wear_outcome // 60):02d}:{int(time_for_wear_outcome % 60):02d}")

# Display the results DataFrame without the "Best Data" column
print(results_df.drop(columns=["Best Data"]))

# Get the wear outcome with the largest positive Expected Profit
filtered_results_df = results_df[results_df['Expected Profit'].apply(lambda x: float(x) > 0 if x != "Null" else False)]

# Call the print_summary function using the best wear outcome data
if not filtered_results_df.empty:
    best_wear_outcome = filtered_results_df.sort_values(by='Expected Profit', ascending=False).iloc[0]
    print_summary(best_wear_outcome['Best Data'], f"\nThe largest Expected Profit ({best_wear_outcome['Expected Profit']}) is for {best_wear_outcome['Wear']}")
else:
    print("\nNo positive Expected Profit found.")

# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}")
print(f"\nElapsed Time for Float function: {int(adjust_float_to_range_function_elapsed_time // 60):02d}:{int(adjust_float_to_range_function_elapsed_time % 60):02d}")
print(f"Elapsed Time for Single function: {int(single_replacement_function_elapsed_time // 60):02d}:{int(single_replacement_function_elapsed_time % 60):02d}")
print(f"Elapsed Time for Pair function: {int(pair_replacement_function_elapsed_time // 60):02d}:{int(pair_replacement_function_elapsed_time % 60):02d}")
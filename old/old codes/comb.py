#import numpy as np
import pandas as pd
import time
#import os
#import csv
import itertools
import json
from concurrent.futures import ProcessPoolExecutor

wear = "ALL"
StatTrak = False
prefix = '_collections'

# Read the CSV file
#filename = f"{prefix}/{collection}/{collection}_EV.csv"
#data_ev = pd.read_csv(filename)

rarity_shift = { # Define the rarity shift
    "Consumer": "Industrial",
    "Industrial": "Mil-Spec",
    "Mil-Spec": "Restricted",
    "Restricted": "Classified",
    "Classified": "Covert"
}

num_items = 10 # total number of items

def print_summary(print_data, title):
    avg_floatWear = print_data['Float'].mean()
    total_price = print_data['Price'].sum()
    print(title)
    print(f"Float: {avg_floatWear:.8f} - Price: {total_price:.2f}")
    print(print_data.sort_values(by=['Price', 'Float'], ascending=[True, True]).reset_index(drop=True))

def adjust_float_to_range(float_data, min_float, max_float, data):
    
    def within_range(value):
        return min_float <= value <= max_float

    #float_data = float_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])
    #data = data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[False, False])
    data_sorted = data.sort_values(by=['Float', 'Price'], ascending=[False, False])
    '''
    print('head')
    print(data_sorted.head(1))
    print('tail')
    print(data_sorted.tail(1))   
    '''

    range_reached = True
    adjust_float_start_time = time.time()

    while not within_range(float_data['Float'].mean()):
        range_reached = False
        made_adjustment = False

        #print(data_sorted)
        #'''
        if data_sorted.iloc[0]['Float'] < min_float or data_sorted.iloc[-1]['Float'] > max_float:
            break
        avg_first_10_float = data_sorted.head(10)['Float'].mean() # average 'Float' of the first 10 items
        avg_last_10_float = data_sorted.tail(10)['Float'].mean() # average 'Float' of the last 10 items
        if avg_first_10_float < min_float or avg_last_10_float > max_float:
            break
        #'''

        data = (~data['Coll_ID'].isin(float_data['Coll_ID']))
        
        for _, row in float_data.iterrows():
            data = data[data['Collection'] == row['Collection']]
            filtered_data = (data['Price'] * 1.25<= row['Price'])
            #filtered_data = data[(data['formattedPrice'] <= row['formattedPrice']) & (~data['ID'].isin(float_data['ID']))]

            for _, data_row in filtered_data.iterrows():
                temp_float_data = float_data.copy()
                temp_float_data.loc[temp_float_data['Coll_ID'] == row['Coll_ID'], data.columns] = data_row.values

                old_mean = float_data['Float'].mean()
                new_mean = temp_float_data['Float'].mean()

                if old_mean < max_float and new_mean <= max_float and new_mean > old_mean:
                    made_adjustment = True
                    k = row['Coll_ID']
                    replacing_id = data_row['Coll_ID']
                    
                    #old_price = float_data.loc[float_data['ID'] == k, 'formattedPrice'].iloc[0]
                    #new_price = data_row['formattedPrice']
                    #price_decrease = round(old_price - new_price, 2)
                    #new_cost = float_data['formattedPrice'].sum() - price_decrease
                    
                    #print(f"Replacing item with ID {k} in float_data with item ID {replacing_id} from data")
                    #print(f"Price decreased by: {price_decrease}")
                    #print(f"After Float adjustment: Float - {new_mean:.8f}, Price: {new_cost:.2f}")

                    float_data.loc[float_data['Coll_ID'] == k, data.columns] = data_row.values
                    data.loc[data['Coll_ID'] == replacing_id, data.columns] = row.values

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
            #print("")
            break

    #print_summary(float_data, "Float adjustment")
    return float_data, range_reached

def single_replacement(single_data, min_float, max_float, data):

    data = data[~data['Coll_ID'].isin(single_data['Coll_ID'])]

    single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])

    temp_single_data = single_data.copy()

    for _, row in single_data.iterrows():
        # Filter data by price and ID constraints
        #filtered_data = data[(data['Price'] < row['Price']) & (~data['Coll_ID'].isin(single_data['Coll_ID']))]
        filtered_data = data[data['Collection'] == row['Collection']]
        filtered_data = filtered_data[filtered_data['Price'] < row['Price']]
        
        
        #temp_single_data = single_data.copy()
        for _, data_row in filtered_data.iterrows():
            
            temp_single_data.loc[temp_single_data['Coll_ID'] == row['Coll_ID'], data.columns] = data_row.values

            temp_floatWear_mean = temp_single_data['Float'].mean()
            if min_float < temp_floatWear_mean < max_float:
                #old_price = single_data['Price'].sum()
                k = row['Coll_ID']
                replacing_id = data_row['Coll_ID']
                #print(f"Replacing item with ID {k} in single_data with item ID {replacing_id} from data")
                single_data.loc[single_data['Coll_ID'] == k, data.columns] = data_row.values
                data.loc[data['Coll_ID'] == replacing_id, data.columns] = row.values
                
                #new_price = single_data['Price'].sum()
                #price_decrease = round(old_price - new_price, 2)
                #print(f"Price decreased by: {price_decrease}")
                #avg_floatWear = single_data['Float'].mean()
                #print(f"After Single replacement: Float - {avg_floatWear:.8f}, Price: {new_price:.2f}")
                break

    #print_summary(single_data, "Single replacement")
    return single_data

def pair_replacement(pair_data, min_float, max_float, data):
    pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[False, False])

    data_pairs = data.merge(data, how='cross', suffixes=('_x', '_y')).query('Coll_ID_x != Coll_ID_y')
    data_pairs['total_Price'] = data_pairs['Price_x'] + data_pairs['Price_y']
    data_pairs = data_pairs.sort_values(by='total_Price', ascending=True)

    improvement_found = True

    while improvement_found:
        improvement_found = False
        best_replacement = None
        best_price_decrease = 0

        pair_data_IDs = pair_data['Coll_ID'].values
        pair_combinations = list(itertools.combinations(pair_data.itertuples(), 2))

        for row1, row2 in pair_combinations:
            mask = (~data_pairs['Coll_ID_x'].isin(pair_data_IDs)) & (~data_pairs['Coll_ID_y'].isin(pair_data_IDs))
            mask &= (data_pairs['Coll_ID_x'] != data_pairs['Coll_ID_y'])
            mask &= (data_pairs['Coll_ID_x'] != row1.Coll_ID) & (data_pairs['Coll_ID_y'] != row2.Coll_ID)
            mask &= (data_pairs['total_Price'] < row1.Price + row2.Price)

                
            mask &= ( # Include collection matching conditions
                ((data_pairs['Collection_x'] == row1.Collection) & (data_pairs['Collection_y'] == row2.Collection)) |
                ((data_pairs['Collection_x'] == row2.Collection) & (data_pairs['Collection_y'] == row1.Collection))
            )
            '''
            Coll_ID_x = data_pairs['Coll_ID_x']
            Coll_ID_y = data_pairs['Coll_ID_y']
            mask = (~Coll_ID_x.isin(pair_data_IDs)) & (~Coll_ID_y.isin(pair_data_IDs))
            mask &= (Coll_ID_x != Coll_ID_y)
            mask &= (Coll_ID_x != row1.Coll_ID) & (Coll_ID_y != row2.Coll_ID)
            mask &= (Coll_ID_x != row2.Coll_ID) & (Coll_ID_y != row1.Coll_ID)
            mask &= (data_pairs['total_Price'] < row1.Price + row2.Price)
            '''
            

            valid_pairs = data_pairs.loc[mask]
            valid_pairs_copy = valid_pairs.copy()
            valid_pairs_copy.loc[:, 'new_avg_float'] = (pair_data.loc[:, 'Float'].sum() - row1.Float - row2.Float + valid_pairs_copy.loc[:, 'Float_x'] + valid_pairs_copy.loc[:, 'Float_y']) / len(pair_data)

            valid_pairs_copy = valid_pairs_copy[(valid_pairs_copy['new_avg_float'] > min_float) & (valid_pairs_copy['new_avg_float'] < max_float)]

            if not valid_pairs_copy.empty:
                best_pair = valid_pairs_copy.loc[valid_pairs_copy['total_Price'].idxmin()]
                old_price = pair_data['Price'].sum()
                new_price = old_price - row1.Price - row2.Price + best_pair['Price_x'] + best_pair['Price_y']
                price_decrease = old_price - new_price

                if price_decrease > best_price_decrease:
                    best_price_decrease = price_decrease
                    best_replacement = (row1, row2, best_pair)

        if best_replacement:
            improvement_found = True
            row1, row2, best_pair = best_replacement
            #old_price = pair_data['Price'].sum()

            k1, k2 = row1.Coll_ID, row2.Coll_ID
            #print(f"Replacing items with ID {k1} and ID {k2} in pair_data with items with ID {best_pair['ID_x']} and ID {best_pair['ID_y']} from data")

            pair_data.loc[pair_data['Coll_ID'] == k1, data.columns] = best_pair.filter(like='_x').values
            pair_data.loc[pair_data['Coll_ID'] == k2, data.columns] = best_pair.filter(like='_y').values

            data.loc[row1.Index, data.columns] = row1[1:]
            data.loc[row2.Index, data.columns] = row2[1:]


            pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[True, True])
            #new_price = pair_data['Price'].sum()
            #print(f"Price decreased by: {best_price_decrease:.2f}")
            #avg_floatWear = pair_data['Float'].mean()
            #print(f"After Pair replacement: Float - {avg_floatWear:.8f}, Price: {new_price:.2f}")

    #print_summary(pair_data, "Pair replacement")
    return pair_data

def process_wear_outcome(wear_outcome, wear_data, data):
    wear_starting_time = time.time() # start the timer
    adjust_float_to_range_function_end_time = 0
    single_replacement_function_end_time = 0
    pair_replacement_function_end_time = 0

    no_solution_found = False
    
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
        #results_df = pd.concat([results_df, result_row], ignore_index=True)
        #continue
    else:
        # Initialize best_data with the last 10 items in data for the current wear outcome
        #data_for_wear = data[data['formattedPrice'] <= ((expected_value + 15) / 3)]
        #data_for_wear = data[data['Price'] <= ((expected_value) / 2)]
        #data_for_wear = data[data['Float'] <= max_floatWear]
        #data_for_wear = data
        #base_data = data_for_wear.tail(num_items).reset_index(drop=True)
        #best_data = base_data

        float_data = data.sort_values(by='Float', ascending=False)
        data_for_wear = float_data[float_data['Float'] <= max_floatWear]
        #data_for_wear = data
        base_data = data_for_wear.head(num_items).reset_index(drop=True)
        best_data = base_data

        '''
        avg = best_data['Float'].mean()
        print(f'min float ${min_floatWear}')    
        print(f'max float ${max_floatWear}')
        print(f'avg float ${avg}')        
        '''

        #print_summary(best_data, "No replacement")
        # Run replacement functions for the current wear outcome
        adjust_float_to_range_function_start_time = time.time()
        best_data, range_reached = adjust_float_to_range(best_data, min_floatWear, max_floatWear, data.copy())
        adjust_float_to_range_function_end_time = time.time() - adjust_float_to_range_function_start_time
        #adjust_float_to_range_function_elapsed_time = adjust_float_to_range_function_elapsed_time + adjust_float_to_range_function_end_time
        if range_reached:
            single_replacement_function_start_time = time.time()
            best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy())
            single_replacement_function_end_time = time.time() - single_replacement_function_start_time
            #single_replacement_function_elapsed_time = single_replacement_function_elapsed_time + single_replacement_function_end_time
            pair_replacement_function_start_time = time.time()
            best_data = pair_replacement(best_data, min_floatWear, max_floatWear, data.copy())
            pair_replacement_function_end_time = time.time() - pair_replacement_function_start_time
            #pair_replacement_function_elapsed_time = pair_replacement_function_elapsed_time + pair_replacement_function_end_time
            #best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy())

        if not range_reached:
            total_price = "Null"
            average_float = "Null"
            expected_profit = "Null"
            ep_percentage = "Null"
            print(f"Float range not reached for {wear_outcome}")
            no_solution_found = True
        else:
            # Calculate the results for the current wear outcome
            total_price = best_data['Price'].sum()
            average_float = best_data['Float'].mean()
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
        #results_df = pd.concat([results_df, result_row], ignore_index=True)

    wear_ending_time = time.time() # end the timer
    
    time_for_wear_outcome = wear_ending_time - wear_starting_time # Calculate and print the time required
    
    #print(f"Time required for wear {wear_outcome}: {int(time_for_wear_outcome // 60):02d}:{int(time_for_wear_outcome % 60):02d}")

    return result_row, time_for_wear_outcome, adjust_float_to_range_function_end_time, single_replacement_function_end_time, pair_replacement_function_end_time

def main():
    combined_wear_data = {}
    '''
    with open(filename, newline='') as csvfile: # Read the data from the CSV file
        csv_reader = csv.DictReader(csvfile)
        for row in csv_reader:
            if row['Rarity'] == rarity_shift[rarity]:
                wear_key = row['Wear']
                min_float = float(row['Min Float'])
                max_float = float(row['Max Float'])
                expected_value = float(row['ST EV']) if StatTrak else float(row['EV'])
                combined_wear_data[wear_key] = (min_float, max_float, expected_value)    
    '''
    '''
    wear_key = "FN+FN"
    min_float = 0.0307692
    max_float = 0.1399998
    expected_value = 44.75
    combined_wear_data[wear_key] = (min_float, max_float, expected_value)
    
    '''
    #print('here')
    first_col = 10
    sec_col = 10 - first_col

    with open(filename, 'r') as file: # Load the JSON data from the file
        data = json.load(file)

        for item in data:
            print(item[0])
            if item[0] == collection:
                if item[1] == tradeup_rarity:  # Check if the item is Covert
                    for wear_info in item[3]:  # item[3] contains the wear data
                        wear_key = wear_info[0]  # 'FN+FN', 'MW+FN', etc.
                        wear_details = wear_info[1]
                        min_float = wear_details['min_float']
                        max_float = wear_details['max_float']
                        #expected_value = wear_details['split'][f'{first_col}-{sec_col}']['ev']  # Assuming you want the 'ev' under 'split' '10'
                        expected_value = wear_details['split']['10']['ev']
                        # Store the extracted values in the dictionary
                        combined_wear_data[wear_key] = (min_float, max_float, expected_value)

    #print(combined_wear_data)

    #for wear_outcome, wear_data in combined_wear_data.items():
    #    min_floatWear, max_floatWear, expected_value = wear_data
    #    print(wear_outcome, min_floatWear, max_floatWear, expected_value)

    data = pd.read_csv(f'{collection[0]}/_{rarity}_comb_n_filt.csv')

    # Initialize best_data with the last 10 items in data
    base_data = data.tail(num_items).reset_index(drop=True)
    #best_floatWear = base_data['Float'].mean()
    #best_value = base_data['Price'].sum()
    best_data = base_data

    # Add an empty DataFrame called best_summary_data
    #best_summary_data = pd.DataFrame()

    # Create an empty DataFrame to store the results
    results_df = pd.DataFrame(columns=["Wear", "Min Float", "Max Float", "Avg Float", "Cost", "Expected Value", "Expected Profit", "Exp Profit %"])

    #no_solution_found = False
    adjust_float_to_range_function_elapsed_time = 0
    single_replacement_function_elapsed_time = 0
    pair_replacement_function_elapsed_time = 0

    for wear_outcome, wear_data in combined_wear_data.items(): # Iterate through all wear outcomes

        result_row, wear_time, float_time, single_time, pair_time = process_wear_outcome(wear_outcome, wear_data, data)
        results_df = pd.concat([results_df, result_row], ignore_index=True)
        print(f"Time for wear {wear_outcome}: {int(wear_time // 60):02d}:{int(wear_time % 60):02d}:{int((wear_time % 1) * 1000):03d}")
        adjust_float_to_range_function_elapsed_time += float_time
        single_replacement_function_elapsed_time += single_time
        pair_replacement_function_elapsed_time += pair_time

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


    #print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}")
    #print(f"\nElapsed Time for Float function: {int(adjust_float_to_range_function_elapsed_time // 60):02d}:{int(adjust_float_to_range_function_elapsed_time % 60):02d}")
    #print(f"Elapsed Time for Single function: {int(single_replacement_function_elapsed_time // 60):02d}:{int(single_replacement_function_elapsed_time % 60):02d}")
    #print(f"Elapsed Time for Pair function: {int(pair_replacement_function_elapsed_time // 60):02d}:{int(pair_replacement_function_elapsed_time % 60):02d}")

    print(f"\nElapsed Time for Float function: {int(adjust_float_to_range_function_elapsed_time // 60):02d}:{int(adjust_float_to_range_function_elapsed_time % 60):02d}:{int((adjust_float_to_range_function_elapsed_time % 1) * 1000):03d}")
    print(f"Elapsed Time for Single function: {int(single_replacement_function_elapsed_time // 60):02d}:{int(single_replacement_function_elapsed_time % 60):02d}:{int((single_replacement_function_elapsed_time % 1) * 1000):03d}")
    print(f"Elapsed Time for Pair function: {int(pair_replacement_function_elapsed_time // 60):02d}:{int(pair_replacement_function_elapsed_time % 60):02d}:{int((pair_replacement_function_elapsed_time % 1) * 1000):03d}")

start_time = time.time() # start the timer

collection = ["Danger_Zone"]
rarity = "Classified"

tradeup_rarity = rarity_shift.get(rarity, rarity) # Shift the rarity for tradeup
#print(tradeup_rarity)
filename = f'ev_{tradeup_rarity}.json'

main()

elapsed_time = time.time() - start_time # end the timer and print the elapsed time
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int((elapsed_time % 1) * 1000):03d}")
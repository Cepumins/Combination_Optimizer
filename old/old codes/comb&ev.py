import pandas as pd
import time
import itertools
from itertools import product
import json
import csv
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime

wear = "ALL"
StatTrak = False
prefix = '_collections'

float_round_decimals = 7 #14

wear_floats = {
    "FN": round(0.07 - 10**(-float_round_decimals), float_round_decimals),
    "MW": round(0.15 - 10**(-float_round_decimals), float_round_decimals),
    "FT": round(0.38 - 10**(-float_round_decimals), float_round_decimals),
    "WW": round(0.45 - 10**(-float_round_decimals), float_round_decimals),
    "BS": 1
}

rarity_shift = {
    "Industrial": "Consumer",
    "Mil-Spec": "Industrial",
    "Restricted": "Mil-Spec",
    "Classified": "Restricted",
    "Covert": "Classified"
}

def format_time(duration):
    minutes = int(duration // 60)
    seconds = int(duration % 60)
    milliseconds = int((duration % 1) * 1000)
    return f"{minutes:02d}:{seconds:02d}:{milliseconds:03d}"

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

def print_summary(print_data, title):
    avg_floatWear = print_data['Float'].mean()
    total_price = print_data['Price'].sum()
    print(title)
    print(f"Float: {avg_floatWear:.8f} - Price: {total_price:.2f}")
    #print_data = print_data.sort_values(by=['Price', 'Float'], ascending=[True, True]).reset_index(drop=True)
    print(print_data)

def process_wear_outcome(wear_outcome, wear_data, data, combo, split):
    def adjust_float(float_data, min_float, max_float, data, combo, print_f, split):
        range_reached = False
        impossible_range = False

        def within_range(value):
            return min_float < value < max_float
        if within_range(float_data['Float'].mean()):
            #print('Already in range')
            range_reached = True
        
        if range_reached == False: # checks the possibility of this combination
            minimal_item_float = data['Float'].min()
            maximal_item_float = data['Float'].max()
            if maximal_item_float < min_float or minimal_item_float > max_float:
                #print("Outside float range")
                impossible_range = True
                #break
            else: # checks the possibility by taking lowest/highest 10 floats
                data_sorted = data.sort_values(by='Float', ascending=False)
                #print(split)
                if split == [10]:
                    #print('Calculating mean without filtering')
                    maximal_item_float = data_sorted.head(10)['Float'].mean() # average 'Float' of the first 10 items
                    minimal_item_float = data_sorted.tail(10)['Float'].mean() # average 'Float' of the last 10 items
                else:
                    #print('Calculating mean with filtering')
                    maximal_floats = []
                    minimal_floats = []
                    for collection, count in zip(combo, split):
                        collection_data = data_sorted[data_sorted['Collection'] == collection]
                        maximal_floats.append(collection_data.head(count)['Float'])
                        minimal_floats.append(collection_data.tail(count)['Float'])
                    #print(f'Maximal floats: \n{maximal_floats}')
                    #print(f'Minimal floats: \n{minimal_floats}')
                    maximal_item_float = pd.concat(maximal_floats).mean()
                    minimal_item_float = pd.concat(minimal_floats).mean()
                    
                #print(minimal_item_float)
                if maximal_item_float < min_float or minimal_item_float > max_float:
                    #print("Outside float range")
                    impossible_range = True
                #break
                    
        adjust_float_start_time = time.time()
        while not range_reached and not impossible_range:
            adjust_float_elapsed_time = time.time() - adjust_float_start_time
            if adjust_float_elapsed_time > 0.5:
                print('Timed out')
                impossible_range = True
                break
            #print('loop from start')
            
            old_mean = float_data['Float'].mean()
            if old_mean < min_float:
                float_data = float_data.sort_values(by='Float', ascending=True)
                #data = data.sort_values(by='Float', ascending=False)
                data = data_sorted
            else:
                float_data = float_data.sort_values(by='Float', ascending=False)
                #data = data.sort_values(by='Float', ascending=True)
                data = data_sorted.iloc[::-1].reset_index(drop=True)

            for _, row in float_data.iterrows():
                if range_reached:
                    break
                #print(f'Checking row: {row}')
                old_mean = float_data['Float'].mean()
                old_distance = abs(max_float - old_mean) + abs(min_float - old_mean)
                lowest_distance = old_distance

                other_9_item_float = old_mean * 10 - row['Float']

                filt_data = data.copy()
                filt_data = filt_data[~filt_data['DF_ID'].isin(float_data['DF_ID'])] 
                if len(combo) > 1:
                    #print('Filtering by Collection in Float function')
                    filt_data = filt_data[filt_data['Collection'] == row['Collection']]

                # vectorize this bitch
                filt_data['new_mean'] = (other_9_item_float + filt_data['Float']) / 10
                filt_data['new_distance'] = abs(max_float - filt_data['new_mean']) + abs(min_float - filt_data['new_mean'])
                best_replacement_row = filt_data.loc[filt_data['new_distance'].idxmin()]
                if best_replacement_row['new_distance'] < lowest_distance:
                    #best_replacement = best_replacement_index
                    best_replacement_id = best_replacement_row['DF_ID']
                    n = best_replacement_id
                    o = row['DF_ID']
                    
                    best_replacement = data.loc[data['DF_ID'] == n].iloc[0]
                    float_data.loc[float_data['DF_ID'] == o, data.columns] = best_replacement.values
                    data.loc[data['DF_ID'] == n, data.columns] = row.values
                    
                    new_mean = (other_9_item_float + best_replacement['Float']) / 10
                    if within_range(new_mean):
                        #print('Now in range')
                        range_reached = True
                    
                    break

        float_data = float_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
        if print_f == True:
            print_summary(float_data, "Float adjustment")
        return float_data, range_reached  
    
    def single_replacement(single_data, min_float, max_float, data, combo, print_s):
        data = data[~data['DF_ID'].isin(single_data['DF_ID'])]

        #single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
        #temp_single_data = single_data.copy()
        #print('Single data: ')
        #print(single_data)
        for _, row in single_data.iterrows():
            data = data[data['Price'] < row['Price']]
            if data.empty:
                #print("No more items to consider after price filtering.")
                break  # Exit the loop as there are no more items to process
            #print(data)
            total_single_data_float = single_data['Float'].sum()
            single_data_float_with_9 = total_single_data_float - row['Float']
            min_item_float = min_float * 10 - single_data_float_with_9
            max_item_float = max_float * 10 - single_data_float_with_9
            
            #temp_data = data.copy()
            #filtered_temp_data = temp_data[(temp_data['Float'] > min_item_float) & (temp_data['Float'] < max_item_float)] # Pre-filter temp_data based on float constraints before the loop
            mask = (data['Float'] > min_item_float) & \
            (data['Float'] < max_item_float)
            if len(combo) > 1: # Include collection filtering conditions
                mask &= (data['Collection'] == row['Collection'])

            filt_data = data.loc[mask]
            if not filt_data.empty:
                #best_replacement_row = filtered_temp_data.loc[filtered_temp_data['Price'].idxmin()] # Find the row in filtered_temp_data with the lowest 'Price'
                sorted_data = filt_data.sort_values(by=['Price', 'Float'], ascending=[True, True])
                best_replacement_row = sorted_data.iloc[0]

                o = row['DF_ID']  # The original item's ID you're replacing
                n = best_replacement_row['DF_ID']  # The replacement item's ID
                #print(f"Replacing item {o} in  with item {n}")
                single_data.loc[single_data['DF_ID'] == o, data.columns] = best_replacement_row.values
                data.loc[data['DF_ID'] == n, data.columns] = row.values
                #print('New single data: ')
                #print(single_data)

        single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
        if print_s == True:
            print_summary(single_data, "Single replacement")
        return single_data   
    
    def pair_replacement(pair_data, min_float, max_float, data, combo, print_p):
        data_reduced = data[['DF_ID', 'Price', 'Float', 'Collection']]
        data_pairs = data_reduced.merge(data, how='cross', suffixes=('_x', '_y')).query('DF_ID_x != DF_ID_y')
        data_pairs['pair'] = data_pairs.apply(lambda x: tuple(sorted([x['DF_ID_x'], x['DF_ID_y']])), axis=1)
        data_pairs = data_pairs.drop_duplicates(subset='pair')
        data_pairs = data_pairs.drop(columns='pair')
        data_pairs['TPrice'] = data_pairs['Price_x'] + data_pairs['Price_y']
        data_pairs['CFloat'] = data_pairs['Float_x'] + data_pairs['Float_y']
        data_pairs = data_pairs[['DF_ID_x', 'DF_ID_y', 'TPrice', 'CFloat', 'Collection_x', 'Collection_y']]
        data_pairs = data_pairs.sort_values(by=['TPrice', 'CFloat'], ascending=[True, True])
        data_pairs.reset_index(drop=True, inplace=True)
        #print(f'Time to generate data_pairs: {format_time(time.time()-data_pairs_time)}')
        #print(data_pairs)

        improvement_found = True
        #last_imporvement_time = time.time()
        while improvement_found:
            #print(f'Rechecking improvement possibility')
            improvement_found = False

            pair_data_IDs_set = set(pair_data['DF_ID'])
            #filt_data_pairs = data_pairs.copy()
            filt_data_pairs = data_pairs[~data_pairs['DF_ID_x'].isin(pair_data_IDs_set) & ~data_pairs['DF_ID_y'].isin(pair_data_IDs_set)]

            pair_data_float = pair_data['Float'].sum()
            fair_price = pair_data.iloc[0]['Price'] + pair_data.iloc[1]['Price']
            filt_data_pairs = filt_data_pairs[filt_data_pairs['TPrice'] < fair_price]

            minimal_float_of_2_items = min_float * 10 - pair_data_float
            maximal_float_of_2_items = max_float * 10 - pair_data_float

            for row1, row2 in itertools.combinations(pair_data.itertuples(), 2):
                pair_price = row1.Price + row2.Price
                pair_float = row1.Float + row2.Float

                min_items_float = minimal_float_of_2_items + pair_float
                max_items_float = maximal_float_of_2_items + pair_float

                mask = (filt_data_pairs['TPrice'] < pair_price) & \
                    (filt_data_pairs['CFloat'] > min_items_float) & \
                    (filt_data_pairs['CFloat'] < max_items_float)
                '''
                if len(combo) > 1: # Include collection filtering conditions
                    mask &= ( 
                        ((filt_data_pairs['Collection_x'] == row1.Collection) & (filt_data_pairs['Collection_y'] == row2.Collection)) |
                        ((filt_data_pairs['Collection_x'] == row2.Collection) & (filt_data_pairs['Collection_y'] == row1.Collection))
                    )            
                '''
                if len(combo) > 1: # Include collection filtering conditions
                    row1_collection = row1.Collection
                    row2_collection = row2.Collection
                    mask &= ( 
                        ((filt_data_pairs['Collection_x'] == row1_collection) & (filt_data_pairs['Collection_y'] == row2_collection)) |
                        ((filt_data_pairs['Collection_x'] == row2_collection) & (filt_data_pairs['Collection_y'] == row1_collection))
                    )
                
                valid_pairs = filt_data_pairs.loc[mask]  

                if not valid_pairs.empty:
                    best_pair = valid_pairs.iloc[0]
                    #imporvement_time = time.time() - last_imporvement_time
                    #last_imporvement_time = time.time()
                    o1, o2 = row1.DF_ID, row2.DF_ID
                    n1, n2 = best_pair['DF_ID_x'], best_pair['DF_ID_y']
                    improvement_found = True
                    #print(f"Replacing IDs {o1} and {o2} with ID {n1} and ID {n2}, {format_time(imporvement_time)}")
                    #print(f'Current pair cost: {round(pair_price, 2)}, Best pair cost: {round(best_pair["TPrice"], 2)}')
                    pair_data = pair_data[~pair_data['DF_ID'].isin([o1, o2])]
                    pair_data = pair_data._append(data[data['DF_ID'].isin([n1, n2])], ignore_index=True)
                    pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
                    #print('New pair_data: ')
                    #print(pair_data)
                    #last_imporvement_time = time.time()
                    break

        if print_p == True:
            print_summary(pair_data, "Pair replacement")
        return pair_data
    
    wear_starting_time = time.time() # start the timer
    adjust_float_to_range_function_end_time = 0
    single_replacement_function_end_time = 0
    pair_replacement_function_end_time = 0

    if len(combo) == 1:
        base_data = data.tail(10).reset_index(drop=True) # Initialize base_data with the last 10 items in data
    else:
        frames = []  # List to hold the selected data from each collection
        for collection, num_items in zip(combo, split):
            collection_data = data[data['Collection'] == collection] # Filter 'data' for the current collection
            selected_data = collection_data.tail(num_items).reset_index(drop=True) # Select the last 'num_items' rows for this collection
            frames.append(selected_data) # Append the selected data to the 'frames' list

        base_data = pd.concat(frames, ignore_index=True) # Concatenate all selected data into a single DataFrame

    min_floatWear, max_floatWear, expected_value = wear_data # Get the min_floatWear, max_floatWear, and expected_value for the current wear outcome
    expected_value = round(expected_value, 2)
    #print(wear_outcome, min_floatWear, max_floatWear, expected_value)
    '''
    avg = best_data['Float'].mean()
    print(f'min float ${min_floatWear}')    
    print(f'max float ${max_floatWear}')
    print(f'avg float ${avg}')        
    '''

    print_all = False
    print_base = print_all #or True
    print_float = print_all #or True
    print_single = print_all #or True
    print_pair = print_all #or True  
    if print_base == True:
        print_summary(base_data, "No replacement")

    # Run replacement functions for the base wear outcome
    adjust_float_to_range_function_start_time = time.time()
    best_data, range_reached = adjust_float(base_data, min_floatWear, max_floatWear, data.copy(), combo, print_f = print_float, split = split)
    adjust_float_to_range_function_end_time = time.time() - adjust_float_to_range_function_start_time
    #adjust_float_to_range_function_elapsed_time = adjust_float_to_range_function_elapsed_time + adjust_float_to_range_function_end_time
    '''
    #if wear_outcome != 'MW+FN+FN+FN':
    if wear_outcome != 'MW+FN+MW+FN':
        range_reached = False    
    '''
    
    if range_reached:
        single_replacement_function_start_time = time.time()
        best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_s = print_single)
        single_replacement_function_end_time = time.time() - single_replacement_function_start_time
        #single_replacement_function_elapsed_time = single_replacement_function_elapsed_time + single_replacement_function_end_time
        pair_replacement_function_start_time = time.time()
        best_data = pair_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_p = print_pair)
        pair_replacement_function_end_time = time.time() - pair_replacement_function_start_time
        #pair_replacement_function_elapsed_time = pair_replacement_function_elapsed_time + pair_replacement_function_end_time
                
        total_price = best_data['Price'].sum() # Calculate the results for the current wear outcome
        average_float = best_data['Float'].mean()
        expected_profit = round(expected_value - total_price, 2)
        ep_percentage = round((expected_value/total_price-1)*100, 2)    
    else:
        total_price = "Null"
        average_float = "Null"
        expected_profit = "Null"
        ep_percentage = "Null"
        #print(f"Float range not reached for {wear_outcome}")

    wear_ending_time = time.time() # end the timer
    time_for_wear_outcome = wear_ending_time - wear_starting_time # Calculate and print the time required
    
    result_row = pd.DataFrame({ # Add the results for the current wear outcome to the results DataFrame
        "Wear": [wear_outcome],
        "Min Float": [min_floatWear],
        "Max Float": [max_floatWear],
        "Avg Float": [average_float],
        "Cost": [total_price],
        "Expected Value": [expected_value],
        "Expected Profit": [expected_profit],
        "Exp Profit %": [ep_percentage],
        "Time": [format_time(time_for_wear_outcome)],
        "Best Data": [best_data]  # Include the best_data DataFrame in a new column
    })
    #print(f"Time required for wear {wear_outcome}: {int(time_for_wear_outcome // 60):02d}:{int(time_for_wear_outcome % 60):02d}")

    return result_row, time_for_wear_outcome, adjust_float_to_range_function_end_time, single_replacement_function_end_time, pair_replacement_function_end_time

def process_wear_outcome_wrapper(args):
    wear_outcome, wear_data, data, combo, split = args
    return process_wear_outcome(wear_outcome, wear_data, data, combo, split)

def comb_main(all_collections, rarities):
    print_times = True
    print_outcomes = True
    
    def print_elapsed_time(print_times, adjust_float_time, single_time, pair_time, start_time, combo, total_collections):
        if print_times == True:
            print(f"\nElapsed Time for Float function: {format_time(adjust_float_time)}")
            print(f"Elapsed Time for Single function: {format_time(single_time)}")
            print(f"Elapsed Time for Pair function: {format_time(pair_time)}")
            functions_total_time = adjust_float_time + single_time + pair_time
            print(f"Elapsed Time for All functions: {format_time(functions_total_time)}")
            if total_collections > 1:
                coll_elapsed_time = time.time() - start_time  # End the timer and print the elapsed time
                print(f"Elapsed Time for {list(combo)}: {format_time(coll_elapsed_time)}")
                print('')
    
    def print_wear_outcome_results(print_outcomes, wear_df):
        if print_outcomes == True:
            print(wear_df.drop(columns=["Best Data"]))  # Display the results DataFrame without the "Best Data" column

            filt_wear_df = wear_df[wear_df['Expected Profit'].apply(lambda x: float(x) > 0 if x != "Null" else False)]  # Filter for positive Expected Profit
            if not filt_wear_df.empty:
                best_wear_outcome = filt_wear_df.sort_values(by='Expected Profit', ascending=False).iloc[0]
                print_summary(best_wear_outcome['Best Data'], f"\nThe largest Expected Profit ({best_wear_outcome['Expected Profit']}) is for {best_wear_outcome['Wear']}")
            else:
                print("No positive Expected Profit found.")
    
    for rarity in rarities:
        item_rarity = rarity_shift.get(rarity, rarity) # Shift the rarity for tradeup
        print(f'\nRarity: {rarity}')

        filename = f'ev_{rarity}.json'
        with open(filename, 'r') as file:
            all_wear_data = json.load(file) # load min, max floats and evs

        collection_data = {}
        collections_for_this_rarity = []
        for collection in all_collections: # load collection df for each collection
            try:
                collection_data[collection] = pd.read_csv(f'{collection}/_{item_rarity}_comb_n_filt.csv')
                collections_for_this_rarity.append(collection)
            except FileNotFoundError:
                print(f"CSV file for '{collection}' in {item_rarity} rarity not found. Skipping this collection.")
        collections = collections_for_this_rarity

        total_num_collections = len(collections)
        for r in range(1, total_num_collections + 1):
            for combo in itertools.combinations(collections, r):
            #for collection in collections:
                coll_start_time = time.time()
                print(f'Collection: {list(combo)}')

                num_collections = len(combo)
                if num_collections == 1:
                    data = collection_data[combo[0]]  # Directly use the DataFrame from collection_data
                else:
                    frames = [collection_data[collection] for collection in combo if collection in collection_data]  # Use list comprehension to gather DataFrames
                    # Concatenate all DataFrames in the list to form a single DataFrame
                    data = pd.concat(frames, ignore_index=True)  # ignore_index will reindex the new DataFrame
                    data = data.sort_values(by=['Price', 'Float'], ascending=[True, True])
                data['DF_ID'] = range(1, len(data) + 1)
                cols = ['DF_ID'] + [col for col in data.columns if col != 'DF_ID']
                data = data[cols]
                
                wear_data_json = {}
                for item in all_wear_data: # Pre-extract min_float, max_float, and wear_key for each combo and rarity
                    if item[0] == list(combo) and item[1] == rarity:
                        for wear_info in item[3]:  # item[3] contains the wear data as a list of lists
                            wear_key = wear_info[0]  # 'FN+FN', 'MW+FN', etc.
                            wear_details = wear_info[1]  # The dictionary with min_float, max_float, and split
                            min_float = wear_details['min_float']
                            max_float = wear_details['max_float']
                            wear_data_json[wear_key] = {"min_float": min_float, "max_float": max_float, "split": wear_details['split']}

                splits = partition_number(num_collections)
                for split in splits: # start the loop for each split possible
                    split_name = '-'.join(map(str, split))
                    if num_collections > 1:
                        print(f'Split: {split_name}')

                    combined_wear_data = {}
                    for wear_key, details in wear_data_json.items():
                        expected_value = details['split'][f'{split_name}']['ev']  # Extract expected value based on current split
                        combined_wear_data[wear_key] = (details["min_float"], details["max_float"], expected_value)

                    adjust_float_to_range_function_elapsed_time = 0
                    single_replacement_function_elapsed_time = 0
                    pair_replacement_function_elapsed_time = 0

                    wear_df = pd.DataFrame(columns=["Wear", "Min Float", "Max Float", "Avg Float", "Cost", "Expected Value", "Expected Profit", "Exp Profit %", "Time"]) # Create an empty DataFrame to store the results

                    wear_rows = []
                    #'''
                    for wear_outcome, wear_data in combined_wear_data.items(): # Iterate through all wear outcomes
                        #print(wear_outcome)
                        result_row, wear_time, float_time, single_time, pair_time = process_wear_outcome(wear_outcome, wear_data, data, combo, split)
                        #results_df = pd.concat([results_df, result_row], ignore_index=True)
                        wear_rows.append(result_row)
                        #print(f"Time for wear {wear_outcome}: {format_time(wear_time)}")
                        adjust_float_to_range_function_elapsed_time += float_time
                        single_replacement_function_elapsed_time += single_time
                        pair_replacement_function_elapsed_time += pair_time                
                    #'''
                        
                    # parrallel this bitch
                    '''
                    with ProcessPoolExecutor(max_workers=7) as executor: # Use ProcessPoolExecutor to parallelize the tasks
                        tasks = [(wear_outcome, wear_data, data.copy(), combo, split) for wear_outcome, wear_data in combined_wear_data.items()]
                        futures = [executor.submit(process_wear_outcome_wrapper, task) for task in tasks]

                        for future in as_completed(futures):
                            try:
                                result_row, wear_time, float_time, single_time, pair_time = future.result()
                                #results_df = pd.concat([results_df, result_row], ignore_index=True)
                                result_rows.append(result_row)
                                adjust_float_to_range_function_elapsed_time += float_time
                                single_replacement_function_elapsed_time += single_time
                                pair_replacement_function_elapsed_time += pair_time
                            except Exception as exc:
                                print(f'Generated an exception: {exc}')

                    results_df = results_df.sort_values(by='Min Float', ascending=True)                
                    '''
                    wear_df = pd.concat(wear_rows, ignore_index=True)

                    
                    print_wear_outcome_results(print_outcomes, wear_df)
                    
                    '''
                    print(wear_df.drop(columns=["Best Data"])) # Display the results DataFrame without the "Best Data" column

                    filt_wear_df = wear_df[wear_df['Expected Profit'].apply(lambda x: float(x) > 0 if x != "Null" else False)] # Get the wear outcome with the largest positive Expected Profit
                    if not filt_wear_df.empty: # Call the print_summary function using the best wear outcome data
                        best_wear_outcome = filt_wear_df.sort_values(by='Expected Profit', ascending=False).iloc[0]
                        print_summary(best_wear_outcome['Best Data'], f"\nThe largest Expected Profit ({best_wear_outcome['Expected Profit']}) is for {best_wear_outcome['Wear']}")
                    else:
                        print("No positive Expected Profit found.")                    
                    '''

                    print_elapsed_time(print_times, adjust_float_to_range_function_elapsed_time, single_replacement_function_elapsed_time, pair_replacement_function_elapsed_time, coll_start_time, combo, total_num_collections)
                    '''
                    print(f"\nElapsed Time for Float function: {format_time(adjust_float_to_range_function_elapsed_time)}")
                    print(f"Elapsed Time for Single function: {format_time(single_replacement_function_elapsed_time)}")
                    print(f"Elapsed Time for Pair function: {format_time(pair_replacement_function_elapsed_time)}")
                    functions_total_time = adjust_float_to_range_function_elapsed_time + single_replacement_function_elapsed_time + pair_replacement_function_elapsed_time
                    print(f"Elapsed Time for All functions: {format_time(functions_total_time)}")
                    if total_num_collections > 1:
                        coll_elapsed_time = time.time() - coll_start_time # end the timer and print the elapsed time
                        print(f"Elapsed Time for {list(combo)}: {format_time(coll_elapsed_time)}")
                        print('')                    
                    '''

def ev_main(collections, rarities, print_ev_time):
    def calculate_expected_values(collections, rarity):
        def combined_data(filename, rarity, collections):
            skins = []
            lowest_floats = []
            highest_floats = []
            prices = {}
            timestamps = []

            with open(filename, 'r', encoding='utf-8-sig') as csvfile:
                reader = csv.DictReader(csvfile, delimiter=',')
                for row in reader:
                    #print(row)
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
        
        def calculate_wear_float_ranges(wear_float, lowest_float, highest_float, float_round_decimals):
            wear_float_ranges = {}
            for wear, wear_float_value in wear_float.items():

                float_range = (wear_float_value - lowest_float) / (highest_float - lowest_float)
                capped_float_range = round(min(max(float_range, 0), 1), float_round_decimals)
                wear_float_ranges[wear] = capped_float_range
            return wear_float_ranges
        
        all_data = []
        prices_csv = 'prices.csv'
        for collection in collections:
            #print(collections)
            #print(collection)
            #prices_csv = prices_location_structure.format(collection=collection)
            #print(prices_csv)
            data = combined_data(prices_csv, rarity, collection)
            #print(data)
            
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

        #print(all_data)
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

    ev_start_time = time.time()
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
        print(f"Expected values for {list(collections)} rarity '{rarity}' exported to {ev_file}")
    ev_elapsed_time = time.time() - ev_start_time
    if print_ev_time == True:
        print(f'Elapsed time for creating EV json: {format_time(ev_elapsed_time)}')

start_time = time.time() # start the timer

def main(all_collections, rarities):
    #tradeup_rarity = rarity_shift.get(rarity, rarity)
    ev_main(all_collections, rarities, True)
    comb_main(all_collections, rarities)

#all_collections = ["Danger_Zone"]
#all_collections = ["Clutch"]
all_collections = ["Danger_Zone", "Clutch"]
#rarities = ["Classified"]
rarities = ["Covert"]

#main(collections, rarities)
if __name__ == '__main__':
    main(all_collections, rarities)

elapsed_time = time.time() - start_time # end the timer and print the elapsed time
print(f"\nElapsed Time: {format_time(elapsed_time)}")
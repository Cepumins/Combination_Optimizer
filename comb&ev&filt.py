import pandas as pd
import time
import itertools
import json
import csv
#from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime
import numpy as np
from numba import jit, njit, vectorize

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

def print_np_summary(print_data_np, title, data):
    df_ids = print_data_np[:, 0]
    print_data = data[data['DF_ID'].isin(df_ids)].copy()
    avg_floatWear = print_data['Float'].mean()
    total_price = print_data['Price'].sum()
    print(title)
    print(f"Float: {avg_floatWear:.8f} - Price: {total_price:.2f}")
    #print_data = print_data.sort_values(by=['Price', 'Float'], ascending=[True, True]).reset_index(drop=True)
    print(print_data)

def process_wear_outcome(wear_outcome, wear_data, data, combo, split, data_float_sorted):
    
    def check_possibility(check_data, min_float, max_float, data_float_sorted, combo, split):
        range_reached = False
        impossible_range = False

        '''
        def within_range(value):
            return min_float < value < max_float
        if within_range(float_data['Float'].mean()):
            #print('Already in range')
            range_reached = True        
        '''
        if min_float < check_data['Float'].mean() < max_float:
            range_reached =  True
        
        if range_reached == False: # checks the possibility of this combination
            #minimal_item_float = data['Float'].min()
            #maximal_item_float = data['Float'].max()
            minimal_item_float = data_float_sorted['Float'].iloc[0]  # Last item in sorted list
            maximal_item_float = data_float_sorted['Float'].iloc[-1]  
            if maximal_item_float < min_float or minimal_item_float > max_float:
                #print("Outside float range")
                impossible_range = True
                #break
            else: # checks the possibility by taking lowest/highest 10 floats
                #data_sorted = data.sort_values(by='Float', ascending=False)
                #print(split)
                if split == [10]:
                    #print('Calculating mean without filtering')
                    minimal_item_float = data_float_sorted.head(10)['Float'].mean() # average 'Float' of the first 10 items
                    maximal_item_float = data_float_sorted.tail(10)['Float'].mean() # average 'Float' of the last 10 items
                else:
                    #print('Calculating mean with filtering')
                    maximal_floats = []
                    minimal_floats = []
                    for collection, count in zip(combo, split):
                        '''
                        collection_data = data_float_sorted[data_float_sorted['Collection'] == collection]
                        minimal_floats.append(collection_data.head(count)['Float'])
                        maximal_floats.append(collection_data.tail(count)['Float'])
                    #print(f'Maximal floats: \n{maximal_floats}')
                    #print(f'Minimal floats: \n{minimal_floats}')
                    minimal_item_float = pd.concat(minimal_floats).mean()
                    maximal_item_float = pd.concat(maximal_floats).mean()                  
                        '''
                        collection_data = data_float_sorted.loc[data_float_sorted['Collection'] == collection, 'Float']
                        minimal_floats.extend(collection_data.head(count))
                        maximal_floats.extend(collection_data.tail(count))
                    
                    minimal_item_float = np.mean(minimal_floats)
                    maximal_item_float = np.mean(maximal_floats)
                    
                #print(minimal_item_float)
                if maximal_item_float < min_float or minimal_item_float > max_float:
                    #print("Outside float range")
                    impossible_range = True

        return range_reached, impossible_range
    
    def new_simple_adjust_float(float_data_np, min_float, max_float, data_np, combo, split):
        range_reached = False
        impossible_range = False
        DF_ID_idx, Price_idx, Float_idx, Collection_idx = 0, 1, 2, 3

        # Main loop for adjusting floats
        #print(f'Float range possible, starting main loop, float_data: ')
        #print(float_data_np)
        #start_time = time.time()
        #data_sorted_desc = data_sorted_asc[::-1]

        while not range_reached and not impossible_range:
            start_time = time.time()
            data_sorted_asc = data_np[np.argsort(data_np[:, Float_idx])]
            data_sorted_desc = data_sorted_asc[::-1]
            # Timeout check
            if time.time() - start_time > 0.5:
                impossible_range = True
                print('Timed out')
                break

            used_replacements = set()
            old_mean = np.mean(float_data_np[:, Float_idx])
            # Decide the sorting order based on the current mean
            if old_mean < min_float:
                data_in_order = data_sorted_desc
                float_data_np = float_data_np[np.argsort(float_data_np[:, Float_idx])]
            else:
                data_in_order = data_sorted_asc
                float_data_np = float_data_np[np.argsort(float_data_np[:, Float_idx])[::-1]]

            float_data_ids = set(float_data_np[:, DF_ID_idx])

            # Vectorized filtering and distance calculations
            for row in float_data_np:
                old_mean = np.mean(float_data_np[:, Float_idx])
                other_float_sum = old_mean * 10 - row[Float_idx]

                # Create a boolean mask for matching Collection_idx values
                collection_mask = data_in_order[:, Collection_idx] == row[Collection_idx]

                #available_data_np = data_in_order[~np.isin(data_in_order[:, DF_ID_idx], list(used_replacements) + list(float_data_ids))]
                available_data_mask = (~np.isin(data_in_order[:, DF_ID_idx], list(used_replacements) + list(float_data_ids))) & collection_mask

                # Apply the combined mask to data_in_order to get available_data_np
                available_data_np = data_in_order[available_data_mask]

                candidate_floats = available_data_np[:, Float_idx]
                new_means = (other_float_sum + candidate_floats) / 10
                new_distances = np.abs(max_float - new_means) + np.abs(min_float - new_means)

                # Find the best replacement
                best_idx = np.argmin(new_distances)
                best_replacement = available_data_np[best_idx]
                n = best_replacement[DF_ID_idx]
                o = row[DF_ID_idx]
                #print(f'Replacing {o} with {n}')
                used_replacements.update([o, n])
                float_data_ids.remove(o)
                float_data_ids.add(n)

                mask = np.isin(data_np[:, DF_ID_idx], list(float_data_ids))
                float_data_np = data_np[mask]

                new_mean = np.mean(float_data_np[:, Float_idx])

                if min_float < new_mean < max_float:
                    range_reached = True
                    break

        return float_data_np, range_reached

    def new_single_replacement(single_data, min_float, max_float, data_np, combo):
        DF_ID_idx, Price_idx, Float_idx, Collection_idx = 0, 1, 2, 3  # Indexes of columns in your NumPy arrays

        sorted_indices = np.lexsort((-single_data[:, Float_idx], -single_data[:, Price_idx]))
        single_data_np = single_data[sorted_indices]
        
        # Filter out the items from data_np that are in single_data_np based on DF_ID
        data_np = data_np[~np.isin(data_np[:, DF_ID_idx], single_data_np[:, DF_ID_idx])]

        used_replacements = set()  # Track DF_IDs used as replacements

        for row in single_data_np:
            #print(f'Considering now {row[DF_ID_idx]}')
            available_data_np = data_np[~np.isin(data_np[:, DF_ID_idx], list(used_replacements) + list(single_data_np[:, DF_ID_idx]))]

            data_price_filtered = available_data_np[available_data_np[:, Price_idx] < row[Price_idx]]
            if data_price_filtered.size == 0:
                #print("No more items to consider after price filtering.")
                break  # Exit if there are no items cheaper than the current one

            total_single_data_float = np.sum(single_data_np[:, Float_idx])
            single_data_float_with_9 = total_single_data_float - row[Float_idx]
            min_item_float = min_float * 10 - single_data_float_with_9
            max_item_float = max_float * 10 - single_data_float_with_9

            # Apply float constraints
            float_mask = (data_price_filtered[:, Float_idx] > min_item_float) & (data_price_filtered[:, Float_idx] < max_item_float)
            data_float_filtered = data_price_filtered[float_mask]

            if len(combo) > 1:
                # Apply collection filter if necessary
                collection_mask = data_float_filtered[:, Collection_idx] == row[Collection_idx]
                data_float_filtered = data_float_filtered[collection_mask]

            if data_float_filtered.size > 0:
                # Find the best replacement (lowest price and then lowest float)
                sorted_indices = np.lexsort((data_float_filtered[:, Float_idx], data_float_filtered[:, Price_idx]))
                best_replacement = data_float_filtered[sorted_indices[0]]

                # Ensure the replacement is not the item itself and has not been used already
                if best_replacement[DF_ID_idx] != row[DF_ID_idx] and best_replacement[DF_ID_idx] not in used_replacements:
                    #print(f'Replacing item {row[DF_ID_idx]} with {best_replacement[DF_ID_idx]}')
                    # Replace the item in single_data_np with the best replacement
                    single_data_np[single_data_np[:, DF_ID_idx] == row[DF_ID_idx]] = best_replacement

                    # Mark the replacement as used
                    used_replacements.add(best_replacement[DF_ID_idx])

        # Sort single_data_np by Price and Float in descending order before returning
        sorted_indices = np.lexsort((-single_data_np[:, Float_idx], -single_data_np[:, Price_idx]))
        sorted_single_data_np = single_data_np[sorted_indices]
        #print(sorted_single_data_np)
        return sorted_single_data_np
      
    def new_pair_replacement(pair_data_np, min_float, max_float, data_np, combo):
        #zero_time = 0
        DF_ID_idx, Price_idx, Float_idx, Collection_idx = 0, 1, 2, 3 # pair_data indexing
        DF_ID_x_idx, DF_ID_y_idx, TPrice_idx, CFloat_idx, Collection_x_idx, Collection_y_idx = 0, 1, 2, 3, 4, 5 # data_np pairs indexing

        n = len(data_np)
        indices = np.triu_indices(n, k=1)  # Create all possible index combinations for pairs
        # Accessing data by index
        df_id_x = data_np[indices[0], DF_ID_idx]
        df_id_y = data_np[indices[1], DF_ID_idx]
        tprice = data_np[indices[0], Price_idx] + data_np[indices[1], Price_idx]
        cfloat = data_np[indices[0], Float_idx] + data_np[indices[1], Float_idx]
        # Assuming collections are encoded as integers for simplicity
        collection_x = data_np[indices[0], Collection_idx]
        collection_y = data_np[indices[1], Collection_idx]

        # Combine all pair attributes into a single 2D array
        data_pairs = np.stack((df_id_x, df_id_y, tprice, cfloat, collection_x, collection_y), axis=-1)

        # Sorting by TPrice and then by CFloat
        sorted_indices = np.lexsort((data_pairs[:, CFloat_idx], data_pairs[:, TPrice_idx]))
        sorted_data_pairs = data_pairs[sorted_indices]
        #print(sorted_data_pairs)
        #zero_time_end = time.time()
        #print(f'Time creating np array of combinations: {format_time(zero_time_end-zero_time_start)}')

        #print('Data pairs sorted NP (2D):')
        #print(sorted_data_pairs)
        #print(f'Dim: {sorted_data_pairs.ndim}')

        improvement_found = True

        #print('Pair Data NP: ')
        #print(pair_data_np)
        #print(f'Dim: {pair_data_np.ndim}')
        comb_indices = np.array(list(itertools.combinations(range(10), 2)))

        while improvement_found:
            sorted_indices = np.lexsort((-pair_data_np[:, Float_idx], -pair_data_np[:, Price_idx]))
            pair_data_np = pair_data_np[sorted_indices]
            #print(f'Rechecking improvement possibility')
            improvement_found = False

            pair_data_ids = set(pair_data_np[:, DF_ID_idx])

            #fair_price = pair_data.iloc[0]['Price'] + pair_data.iloc[1]['Price']
            fair_price = pair_data_np[0, Price_idx] + pair_data_np[1, Price_idx]

            pair_data_ids_np = np.array(list(pair_data_ids))

            # Create boolean masks to identify pairs where both DF_ID_x and DF_ID_y are not in pair_data_ids
            mask_df_id_x = ~np.isin(sorted_data_pairs[:, DF_ID_x_idx], pair_data_ids_np)
            mask_df_id_y = ~np.isin(sorted_data_pairs[:, DF_ID_y_idx], pair_data_ids_np)

            # Combine masks to filter out rows where both conditions are met
            mask_combined = (sorted_data_pairs[:, TPrice_idx] < fair_price) & mask_df_id_x & mask_df_id_y
            filt_data_pairs_np = sorted_data_pairs[mask_combined]

            pair_data_float = pair_data_np[:, Float_idx].sum()

            minimal_float_of_2_items = min_float * 10 - pair_data_float
            maximal_float_of_2_items = max_float * 10 - pair_data_float

            pair_prices = pair_data_np[comb_indices[:, 0], Price_idx] + pair_data_np[comb_indices[:, 1], Price_idx]
            pair_floats = pair_data_np[comb_indices[:, 0], Float_idx] + pair_data_np[comb_indices[:, 1], Float_idx]

            for i, (pair_price, pair_float) in enumerate(zip(pair_prices, pair_floats)):
                min_items_float = minimal_float_of_2_items + pair_float
                max_items_float = maximal_float_of_2_items + pair_float

                # Apply filtering conditions to filt_data_pairs_np
                valid_mask = (filt_data_pairs_np[:, TPrice_idx] < pair_price) & \
                            (filt_data_pairs_np[:, CFloat_idx] > min_items_float) & \
                            (filt_data_pairs_np[:, CFloat_idx] < max_items_float)

                # Additional collection-based filtering if needed
                if len(combo) > 1:
                    # Retrieve collections for the current pair from pair_data_np
                    collection1 = pair_data_np[comb_indices[i, 0], Collection_idx]
                    collection2 = pair_data_np[comb_indices[i, 1], Collection_idx]

                    # Create masks for collection conditions
                    mask_collection_match = (
                        (filt_data_pairs_np[:, Collection_x_idx] == collection1) & (filt_data_pairs_np[:, Collection_y_idx] == collection2)
                    ) | (
                        (filt_data_pairs_np[:, Collection_x_idx] == collection2) & (filt_data_pairs_np[:, Collection_y_idx] == collection1)
                    )

                    # Update the valid_mask to include the collection matching condition
                    valid_mask &= mask_collection_match

                valid_pairs = filt_data_pairs_np[valid_mask]

                if valid_pairs.size > 0:
                    # Find the minimum TPrice value
                    min_tprice = np.min(valid_pairs[:, TPrice_idx])
                    # Filter valid_pairs to those with the minimum TPrice
                    min_tprice_pairs = valid_pairs[valid_pairs[:, TPrice_idx] == min_tprice]
                    # Among the pairs with the minimum TPrice, find the one with the lowest CFloat
                    best_pair_idx = np.argmin(min_tprice_pairs[:, CFloat_idx])
                    best_pair = min_tprice_pairs[best_pair_idx]

                    # IDs of the pair being replaced
                    o1, o2 = pair_data_np[comb_indices[i, 0], DF_ID_idx], pair_data_np[comb_indices[i, 1], DF_ID_idx]
                    # IDs of the best replacement pair
                    n1, n2 = best_pair[DF_ID_x_idx], best_pair[DF_ID_y_idx]
                    #print(f"Replacing IDs {o1} and {o2} with ID {n1} and ID {n2}")
                    # Remove o1 and o2 from the set of IDs
                    pair_data_ids.remove(o1)
                    pair_data_ids.remove(o2)
                    pair_data_ids.update([n1, n2])
                    #print(f'New pair_data ids: {pair_data_ids}')
                    improvement_found = True

                    mask = np.isin(data_np[:, DF_ID_idx], list(pair_data_ids))
                    pair_data_np = data_np[mask]
                    #last_imporvement_time = time.time()
                    break

        #print(f'Total time spent filtering: {format_time(zero_time)}')
        return pair_data_np

    wear_starting_time = time.time() # start the timer
    check_def_time_elapsed = 0
    float_def_time_elapsed = 0
    single_def_time_elapsed = 0
    pair_def_time_elapsed = 0

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

    print_all = False
    print_base = print_all #or True
    print_float = print_all #or True
    print_single = print_all #or True
    print_pair = print_all #or True  
    if print_base == True:
        print(f'Wear: {wear_outcome}')
        print_summary(base_data, "No replacement")

    impossible_range = False
    # Run replacement functions for the base wear outcome
    check_def_time_start = time.time()
    range_reached_already, impossible_range = check_possibility(base_data, min_floatWear, max_floatWear, data_float_sorted, combo, split)
    check_def_time_elapsed = time.time() - check_def_time_start
    if impossible_range == False:
        data_copy = data.copy()
        collection_mapping = {name: idx for idx, name in enumerate(all_collections)}
        data_copy['Collection'] = data_copy['Collection'].map(collection_mapping)
        data_copy['Collection'] = data_copy['Collection'].astype(int)
        data_np = data_copy[['DF_ID', 'Price', 'Float', 'Collection']].to_numpy()
        ids = set(base_data['DF_ID'])
        
        base_data_np = np.array([row for row in data_np if row[0] in ids])
        if range_reached_already == True:
            best_data_np = base_data_np
            range_reached = range_reached_already
        else:
            float_def_time_start = time.time()
            best_data_np, range_reached = new_simple_adjust_float(base_data_np, min_floatWear, max_floatWear, data_np, combo, split)    
            float_def_time_elapsed = time.time() - float_def_time_start
    
        if range_reached:
            if print_float:
                print_np_summary(best_data_np, 'Float def', data)

            single_def_time_start = time.time()
            best_data_np = new_single_replacement(best_data_np, min_floatWear, max_floatWear, data_np, combo)
            if print_single:
                print_np_summary(best_data_np, 'Single def', data)
            single_def_time_elapsed = time.time() - single_def_time_start

            pair_def_time_start = time.time()
            best_data_np = new_pair_replacement(best_data_np, min_floatWear, max_floatWear, data_np, combo)
            if print_pair:
                print_np_summary(best_data_np, 'Pair def', data)
            pair_def_time_elapsed = time.time() - pair_def_time_start

            #total_price = best_data_np[:, 1].sum() 
            #average_float = best_data_np[:, 2].mean()
            total_price = np.sum(best_data_np[:, 1])
            average_float = np.mean(best_data_np[:, 2])
            expected_profit = round(expected_value - total_price, 2)
            ep_percentage = round((expected_value/total_price-1)*100, 2)    

            ids = best_data_np[:, 0]
            best_data = data[data['DF_ID'].isin(ids)]
            best_data = best_data.sort_values(by=['Price', 'Float'], ascending=[False, False])        
                    
            #total_price = best_data['Price'].sum() # Calculate the results for the current wear outcome
            #average_float = best_data['Float'].mean()
            #expected_profit = round(expected_value - total_price, 2)
            #ep_percentage = round((expected_value/total_price-1)*100, 2)    
        
        else:
            best_data = None
            total_price = "Null"
            average_float = "Null"
            expected_profit = "Null"
            ep_percentage = "Null"
    else:
        best_data = None
        total_price = "Null"
        average_float = "Null"
        expected_profit = "Null"
        ep_percentage = "Null"
        #print(f"Float range not reached for {wear_outcome}")

    time_for_wear_outcome = time.time() - wear_starting_time 
    
    result_row = pd.DataFrame({ # Add the results for the current wear outcome to the results DataFrame
        "Wear": [wear_outcome],
        "Min Float": [min_floatWear],
        "Max Float": [max_floatWear],
        "Avg Float": [average_float],
        "Cost": [total_price],
        "Expected Value": [expected_value],
        "Expected Profit": [expected_profit],
        "Exp Profit %": [ep_percentage],
        "Time": [format_time(time_for_wear_outcome)]
        #"Best Data": [best_data]  # Include the best_data DataFrame in a new column
    })
    #print(f"Time required for wear {wear_outcome}: {int(time_for_wear_outcome // 60):02d}:{int(time_for_wear_outcome % 60):02d}")

    return result_row, best_data, time_for_wear_outcome, check_def_time_elapsed, float_def_time_elapsed, single_def_time_elapsed, pair_def_time_elapsed

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
    
    def filter_data(combined_data, filter_count):
        # Convert 'Float' column to a NumPy array
        float_array = combined_data['Float'].to_numpy()

        # Compute ranks based on the 'Float' values
        # This is a simple ranking; for more complex ranking methods, additional logic will be needed
        float_ranks = np.argsort(np.argsort(float_array))

        # Initialize a boolean mask for filtering, starting with the first 'filter_count' items included
        filter_mask = np.arange(len(combined_data)) < filter_count

        for i in range(filter_count, len(combined_data)):
            # Count how many items in the filtered data have a lower rank (higher 'Float' value)
            num_lower_float_score = np.sum(float_ranks[:i] < float_ranks[i])

            # If fewer than 'filter_count' items have a lower rank, include this item
            if num_lower_float_score < filter_count:
                filter_mask[i] = True

        # Apply the filter mask to select the rows to include in the filtered data
        filtered_data = combined_data[filter_mask].copy()
        return filtered_data
    
    for rarity in rarities:
        item_rarity = rarity_shift.get(rarity, rarity) # Shift the rarity for tradeup
        #print(f'\nRarity: {rarity}')

        filename = f'ev/ev_{rarity}.json'
        with open(filename, 'r') as file:
            all_wear_data = json.load(file) # load min, max floats and evs

        collection_data = {}
        collections_for_this_rarity = []

        check_def_time_elapsed_total = 0
        float_def_time_elapsed_total = 0
        single_def_time_elapsed_total = 0
        pair_def_time_elapsed_total = 0
        processing_time_total = 0
    
        '''
        for idx, collection in enumerate(all_collections):
            try:
                # Load the collection data from CSV
                df = pd.read_csv(f'Items/{item_rarity}/{collection}/_{item_rarity}_comb_n_filt.csv')
                # Replace the 'Collection' column with the numerical identifier (idx)
                df['Collection'] = idx
                # Store the processed DataFrame in the collection_data dictionary
                collection_data[collection] = df
                # Add the collection to the list of collections for this rarity
                collections_for_this_rarity.append(collection)
        '''
        for collection in all_collections: # load collection df for each collection
            try:
                collection_data[collection] = pd.read_csv(f'Items/{item_rarity}/{collection}/_{item_rarity}_comb_n_filt.csv')
                collections_for_this_rarity.append(collection)    
            except FileNotFoundError:
                print(f"CSV file for '{collection}' in {item_rarity} rarity not found. Skipping this collection.")
        collections = collections_for_this_rarity
        #print(collection_data)

        results = {}
        total_num_collections = len(collections)
        for r in range(1, total_num_collections + 1):
            for combo in itertools.combinations(collections, r):
                combo_key = "+".join(combo)
                results[combo_key] = {}
                coll_time_start = time.time()
                num_collections = len(combo)
                
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
                    split_key = '-'.join(map(str, split))
                    split_time_start = time.time()
                    results[combo_key][split_key] = {'outcomes': [], 'total_time': None}
                    '''
                    if num_collections > 1:
                        #print(split)
                        print(f'Split: {split_name}')                    
                    '''

                    if num_collections == 1:
                        data = collection_data[combo[0]]  # Directly use the DataFrame from collection_data
                    else:
                        filtered_frames = []
                        # Iterate over each collection and its corresponding filter count in the split
                        for collection, filter_count in zip(combo, split):
                            if collection in collection_data:
                                # Filter the data for the current collection
                                #filtered_df = collection_data[collection]
                                filtered_df = filter_data(collection_data[collection], filter_count)
                                # Add the filtered DataFrame to the list
                                filtered_frames.append(filtered_df)

                        # Concatenate all filtered DataFrames to form a single DataFrame
                        data = pd.concat(filtered_frames, ignore_index=True)
                        data = data.sort_values(by=['Price', 'Float'], ascending=[True, True])   
                        '''
                        #frames = [collection_data[collection] for collection in combo if collection in collection_data]  # Use list comprehension to gather DataFrames
                        frames = [filter_data(collection_data[collection], filter_count) for collection, filter_count in zip(combo, split) if collection in collection_data]
                        # Concatenate all DataFrames in the list to form a single DataFrame
                        data = pd.concat(frames, ignore_index=True)  # ignore_index will reindex the new DataFrame
                        data = data.sort_values(by=['Price', 'Float'], ascending=[True, True])                        
                        '''

                    data['DF_ID'] = range(1, len(data) + 1)
                    cols = ['DF_ID'] + [col for col in data.columns if col != 'DF_ID']
                    data = data[cols]

                    data_float_sorted = data.sort_values(by='Float', ascending=True) 
                    
                    combined_wear_data = {}
                    for wear_key, details in wear_data_json.items():
                        expected_value = details['split'][f'{split_key}']['ev']  # Extract expected value based on current split
                        combined_wear_data[wear_key] = (details["min_float"], details["max_float"], expected_value)

                    check_def_time_elapsed = 0
                    float_def_time_elapsed = 0
                    single_def_time_elapsed = 0
                    pair_def_time_elapsed = 0

                    wear_df = pd.DataFrame(columns=["Wear", "Min Float", "Max Float", "Avg Float", "Cost", "Expected Value", "Expected Profit", "Exp Profit %", "Time"]) # Create an empty DataFrame to store the results

                    wear_rows = []
                    #'''
                    for wear_outcome, wear_data in combined_wear_data.items(): # Iterate through all wear outcomes
                        #print(wear_outcome)
                        processing_time_start = time.time()
                        result_row, best_data, wear_time, check_time, float_time, single_time, pair_time = process_wear_outcome(wear_outcome, wear_data, data, combo, split, data_float_sorted)
                        processing_time_total += time.time() - processing_time_start
                        #results_df = pd.concat([results_df, result_row], ignore_index=True)
                        #print(result_row)
                        wear_rows.append(result_row)

                        expected_profit = result_row['Expected Profit'].item()
                        if pd.notnull(expected_profit) and isinstance(expected_profit, (int, float)):
                            # Further, check if it's positive
                            if expected_profit > 0:
                                print_summary(best_data, wear_outcome)   
                        #print(best_data)
                        #results[combo_key][split_key]['Best Data'] = best_data
                        #print(best_data)
                        #outcome_time = time.time() - outcome_time_start
                        #results[combo_key][split_key]['outcomes'].append(result_row)
                        #print(f"Time for wear {wear_outcome}: {format_time(wear_time)}")
                        check_def_time_elapsed += check_time
                        float_def_time_elapsed += float_time
                        single_def_time_elapsed += single_time
                        pair_def_time_elapsed += pair_time                
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
                    #print(wear_df)
                    results[combo_key][split_key]['outcomes'].append(wear_df)

                    
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

                    '''
                    for combo_key, combo_val in results.items():
                        print(f'\nRarity: {rarity}')
                        print(f"Combo: {combo_key}")
                        for split_key, split_val in combo_val.items():
                            print(f" Split: {split_key}")
                            print(results[combo_key][split_key])
                            print(f"  Time: {split_val['total_time']}")
                        print()                    
                    '''

                    split_time = time.time() - split_time_start
                    results[combo_key][split_key]['total_time'] = split_time
                    
                    if num_collections > 1:
                        print(f'\nCollections: {combo_key}')
                        print(f'Split: {split_key}')
                    else:
                        print(f'\nCollection: {combo_key}')
                    #largest_profit = 0
                    for outcome_df in results[combo_key][split_key]['outcomes']:
                        #print(outcome_df.drop(columns=["Best Data"]))
                        print(outcome_df)
                        #print(outcome_df['Best Data'])

                    check_def_time_elapsed_total += check_def_time_elapsed
                    float_def_time_elapsed_total += float_def_time_elapsed
                    single_def_time_elapsed_total += single_def_time_elapsed
                    pair_def_time_elapsed_total += pair_def_time_elapsed

                    print_elapsed_time(print_times, float_def_time_elapsed_total, single_def_time_elapsed, pair_def_time_elapsed, coll_time_start, combo, total_num_collections)
                    if num_collections > 1:
                        print(f"Time for split: {format_time(results[combo_key][split_key]['total_time'])}")
                
                coll_time = time.time() - coll_time_start
                print(f'Collection {combo_key} time: {format_time(coll_time)}')

        if total_num_collections > 1:
            print(f'\nCheck def total time: {format_time(check_def_time_elapsed_total)}')
            print(f'Float def total time: {format_time(float_def_time_elapsed_total)}')
            print(f'Single def total time: {format_time(single_def_time_elapsed_total)}')
            print(f'Pair def total time: {format_time(pair_def_time_elapsed_total)}')
            all_defs_time_total = check_def_time_elapsed_total + float_def_time_elapsed_total + single_def_time_elapsed_total + pair_def_time_elapsed_total
            print(f'ALL Def total time: {format_time(all_defs_time_total)}')
            print(f'Processing time outside defs: {format_time(processing_time_total-all_defs_time_total)}')
        '''
        outcomes = results[combo_key][split_key]['outcomes']
        json_outcomes = [df.to_dict(orient='records') for df in outcomes]
        json_results = results.copy()
        json_results[combo_key][split_key]['outcomes'] = json_outcomes
        with open(f'results_{rarity}.json', 'w') as f:
            json.dump(json_results, f, indent=4)        
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
            #formats = ["%m/%d/%Y %H:%M", "%m/%d/%Y %H:%M:%S"]
            formats = ["%Y-%m-%d %H:%M:%S"]
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
        prices_csv = f'prices/{rarity}/_prices_{rarity}.csv'
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
        all_wear_combinations = list(itertools.product(*float_ranges_list))

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

        
        ev_file = f'ev/ev_{rarity}.json' # Save data to JSON file specific for the rarity
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
#all_collections = ["Danger_Zone"]
#all_collections = ["Revolution"]
#all_collections = ["Danger_Zone", "Revolution"]
#rarities = ["Classified"]
rarities = ["Covert"]

#main(collections, rarities)
if __name__ == '__main__':
    main(all_collections, rarities)

elapsed_time = time.time() - start_time # end the timer and print the elapsed time
print(f"\nElapsed Time: {format_time(elapsed_time)}")
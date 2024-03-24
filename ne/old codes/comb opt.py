#import numpy as np
import pandas as pd
import time
#import os
#import csv
import itertools
import json
from concurrent.futures import ProcessPoolExecutor
import numpy as np

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

def adjust_float_to_range(float_data, min_float, max_float, data, combo, print_f):
    
    def within_range(value):
        return min_float < value < max_float

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
            print("Outside float range")
            break
        avg_first_10_float = data_sorted.head(10)['Float'].mean() # average 'Float' of the first 10 items
        avg_last_10_float = data_sorted.tail(10)['Float'].mean() # average 'Float' of the last 10 items
        if avg_first_10_float < min_float or avg_last_10_float > max_float:
            print("Outside float range")
            break
        #'''

        filtered_data = data[~data['Coll_ID'].isin(float_data['Coll_ID'])]
        
        for _, row in float_data.iterrows():
            if len(combo) > 1:
                print('Filtering by Collection in Float function')
                filtered_data = filtered_data[filtered_data['Collection'] == row['Collection']]

            for _, data_row in filtered_data.iterrows():
                temp_float_data = float_data.copy()
                temp_float_data.loc[temp_float_data['Coll_ID'] == row['Coll_ID'], data.columns] = data_row.values

                old_mean = float_data['Float'].mean()
                new_mean = temp_float_data['Float'].mean()
                old_distance = abs(max_float - old_mean) + abs(min_float - old_mean)
                new_distance = abs(max_float - new_mean) + abs(min_float - new_mean)

                #if old_mean < max_float and new_mean <= max_float and new_mean > old_mean:
                if new_distance < old_distance:
                    made_adjustment = True
                    k = row['Coll_ID']
                    replacing_id = data_row['Coll_ID']
                    
                    #old_price = float_data.loc[float_data['ID'] == k, 'formattedPrice'].iloc[0]
                    #new_price = data_row['formattedPrice']
                    #price_decrease = round(old_price - new_price, 2)
                    #new_cost = float_data['formattedPrice'].sum() - price_decrease
                    '''
                    print(f"Replacing item with ID {k} in float_data with item ID {replacing_id} from data")
                    print('Replaced item: ')
                    print(row)
                    print('Replacing item: ')
                    print(data_row)                    
                    '''

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

    if print_f == True:
        print_summary(float_data, "Float adjustment")
    return float_data, range_reached

def opt_adjust_float_to_range(float_data, min_float, max_float, data, combo, print_f, split):
    range_reached = False
    impossible_range = False

    def within_range(value):
        return min_float < value < max_float

    if within_range(float_data['Float'].mean()):
        print('Already in range')
        range_reached = True
    
    if range_reached == False: # checks the possibility of this combination
        minimal_item_float = data['Float'].min()
        maximal_item_float = data['Float'].max()
        if maximal_item_float < min_float or minimal_item_float > max_float:
            print("Outside float range")
            impossible_range = True
            #break
        else: # checks the possibility by taking lowest/highest 10 floats
            data_sorted = data.sort_values(by='Float', ascending=False)
            print(split)
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
                print("Outside float range")
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

            '''
            best_replacement = None
            for _, data_row in filt_data.iterrows():
                new_mean = (other_9_item_float + data_row['Float']) / 10
                new_distance = abs(max_float - new_mean) + abs(min_float - new_mean)
                if new_distance < lowest_distance:
                    lowest_distance = new_distance
                    n = data_row['DF_ID']
                    best_replacement = data_row
            if best_replacement is not None:            
            '''
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
                    print('Now in range')
                    range_reached = True
                
                break
    
                #float_data.loc[replacement_mask, 'Float'] = data_row['Float']

                #temp_float_data = float_data.copy()
                #temp_float_data.loc[temp_float_data['Coll_ID'] == row['Coll_ID']] = data_row
                #temp_float_data.loc[temp_float_data['DF_ID'] == row['DF_ID'], data.columns] = data_row.values

                #new_mean = temp_float_data['Float'].mean()
                #new_distance = abs(max_float - new_mean) + abs(min_float - new_mean)

                #if old_mean < max_float and new_mean <= max_float and new_mean > old_mean:
                #if new_distance < old_distance:
                    #old_distance = new_distance

                    #k = row['DF_ID']
                    #replacing_id = data_row['DF_ID']
                    #made_adjustment = True
                    #print('Old float data: ')
                    #print(float_data)
                    #original_float_data = float_data.loc[replacement_mask, 'Float'].copy()
                    #print('New float data: ')
                    #print(original_float_data)
                    #float_data.loc[float_data['Coll_ID'] == row['Coll_ID']] = data_row
                    #print(f"Replacing item with ID {k} in float_data with item ID {replacing_id} from data")
                    #float_data.loc[replacement_mask, 'Float'] = original_float_data

                    
                    #old_price = float_data.loc[float_data['ID'] == k, 'formattedPrice'].iloc[0]
                    #new_price = data_row['formattedPrice']
                    #price_decrease = round(old_price - new_price, 2)
                    #new_cost = float_data['formattedPrice'].sum() - price_decrease
                    #'''
                    #print(f"Replacing item with ID {k} in float_data with item ID {replacing_id} from data")
                    #print('Replaced item: ')
                    #print(row)
                    #print('Replacing item: ')
                    #print(data_row)                    
                    #'''

                    #print(f"Price decreased by: {price_decrease}")
                    #print(f"After Float adjustment: Float - {new_mean:.8f}, Price: {new_cost:.2f}")

                    #float_data.loc[float_data['Coll_ID'] == k, data.columns] = data_row.values
                    #data.loc[data['Coll_ID'] == replacing_id, data.columns] = row.values

                    #filtered_data = data[~data['Coll_ID'].isin(float_data['Coll_ID'])]

    float_data = float_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
    if print_f == True:
        print_summary(float_data, "Float adjustment")
    return float_data, range_reached

def single_replacement(single_data, min_float, max_float, data, combo, print_s):

    data = data[~data['Coll_ID'].isin(single_data['Coll_ID'])]

    single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])

    #temp_single_data = single_data.copy()

    for _, row in single_data.iterrows():
        # Filter data by price and ID constraints
        #filtered_data = data[(data['Price'] < row['Price']) & (~data['Coll_ID'].isin(single_data['Coll_ID']))]
        if len(combo) > 1:
            data = data[data['Collection'] == row['Collection']]
        filtered_data = data[data['Price'] < row['Price']]
        '''
        print(f"row with coll_id: {row['Coll_ID']} collection: {row['Collection']}")
        print('data: ')
        print(filtered_data)        
        '''

        
        #temp_single_data = single_data.copy()
        for _, data_row in filtered_data.iterrows():
            temp_single_data = single_data.copy()
            
            temp_single_data.loc[temp_single_data['Coll_ID'] == row['Coll_ID'], data.columns] = data_row.values

            temp_floatWear_mean = temp_single_data['Float'].mean()
            #print(f'New temp float: {temp_floatWear_mean}')
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

    if print_s == True:
        print_summary(single_data, "Single replacement")
    return single_data

def opt_single_replacement(single_data, min_float, max_float, data, combo, print_s):
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

        old_price = pair_data['Price'].sum()

        for row1, row2 in pair_combinations:
            mask = (~data_pairs['Coll_ID_x'].isin(pair_data_IDs)) & (~data_pairs['Coll_ID_y'].isin(pair_data_IDs))
            mask &= (data_pairs['Coll_ID_x'] != data_pairs['Coll_ID_y'])
            mask &= (data_pairs['Coll_ID_x'] != row1.Coll_ID) & (data_pairs['Coll_ID_y'] != row2.Coll_ID)
            mask &= (data_pairs['total_Price'] < row1.Price + row2.Price)

            if len(combo) > 1:
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
                #old_price = pair_data['Price'].sum()
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
            #print(f"Replacing items with ID {k1} and ID {k2} in pair_data with items with ID {best_pair['Coll_ID_x']} and ID {best_pair['Coll_ID_y']} from data")

            pair_data.loc[pair_data['Coll_ID'] == k1, data.columns] = best_pair.filter(like='_x').values
            pair_data.loc[pair_data['Coll_ID'] == k2, data.columns] = best_pair.filter(like='_y').values

            data.loc[row1.Index, data.columns] = row1[1:]
            data.loc[row2.Index, data.columns] = row2[1:]


            pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[True, True])
            #new_price = pair_data['Price'].sum()
            #print(f"Price decreased by: {best_price_decrease:.2f}")
            #avg_floatWear = pair_data['Float'].mean()
            #print(f"After Pair replacement: Float - {avg_floatWear:.8f}, Price: {new_price:.2f}")

    if print_p == True:
        print_summary(pair_data, "Pair replacement")
    return pair_data

def opt_pair_replacement(pair_data, min_float, max_float, data, combo, print_p):
    #pair_data = pair_data.iloc[::-1].reset_index(drop=True)

    data_pairs = data.merge(data, how='cross', suffixes=('_x', '_y')).query('DF_ID_x != DF_ID_y')
    data_pairs['total_Price'] = data_pairs['Price_x'] + data_pairs['Price_y']
    data_pairs = data_pairs.sort_values(by='total_Price', ascending=True)    

    improvement_found = True
    last_imporvement_time = time.time()
    
    used_ids = set()
    while improvement_found:
        #print('Rechecking improvement possibility')
        improvement_found = False
        #print(pair_data)
        
        pair_data_IDs_set = set(pair_data['DF_ID'])
        filt_data_pairs = data_pairs.copy()
        filt_data_pairs = filt_data_pairs[~filt_data_pairs['DF_ID_x'].isin(pair_data_IDs_set) & ~filt_data_pairs['DF_ID_y'].isin(pair_data_IDs_set)]
        
        pair_combinations = itertools.combinations(pair_data.itertuples(), 2)
        for row1, row2 in pair_combinations:
            if row1.DF_ID in used_ids or row2.DF_ID in used_ids:
                continue  # Skip this combination and move to the next
            #valid_pairs = filt_data_pairs.copy()
            pair_price = row1.Price + row2.Price
            #print(f'Checking row1: {row1.DF_ID} & row2: {row2.DF_ID}')
            mask = (~filt_data_pairs['DF_ID_x'].isin(used_ids)) & (~filt_data_pairs['DF_ID_y'].isin(used_ids))
            mask &= (filt_data_pairs['DF_ID_x'] != row1.DF_ID) & (filt_data_pairs['DF_ID_y'] != row2.DF_ID)
            mask &= (filt_data_pairs['DF_ID_y'] != row1.DF_ID) & (filt_data_pairs['DF_ID_x'] != row2.DF_ID)
            mask &= (filt_data_pairs['total_Price'] < pair_price)

            if len(combo) > 1: # Include collection filtering conditions
                mask &= ( 
                    ((filt_data_pairs['Collection_x'] == row1.Collection) & (filt_data_pairs['Collection_y'] == row2.Collection)) |
                    ((filt_data_pairs['Collection_x'] == row2.Collection) & (filt_data_pairs['Collection_y'] == row1.Collection))
                )
            
            valid_pairs_copy = filt_data_pairs.loc[mask].copy()
            #valid_pairs_copy = valid_pairs.copy()
            pair_data_float_with_8 = pair_data['Float'].sum() - row1.Float - row2.Float
            min_items_float = min_float * 10 - pair_data_float_with_8
            max_items_float = max_float * 10 - pair_data_float_with_8
            
            #valid_pairs_copy['new_avg_float'] = (total_float + valid_pairs_copy['Float_x'] + valid_pairs_copy['Float_y']) / len(pair_data)
            valid_pairs_copy['combined_float'] = valid_pairs_copy['Float_x'] + valid_pairs_copy['Float_y']
            valid_pairs_copy = valid_pairs_copy[(valid_pairs_copy['combined_float'] > min_items_float) & (valid_pairs_copy['combined_float'] < max_items_float)]

            if not valid_pairs_copy.empty:
                best_pair = valid_pairs_copy.nsmallest(1, ['total_Price', 'combined_float']).iloc[0]
                #sorted_pairs = valid_pairs.sort_values
                #price_decrease = pair_price - (best_pair['total_Price'])
                #if price_decrease > 0:
                imporvement_time = time.time() - last_imporvement_time
                o1, o2 = row1.DF_ID, row2.DF_ID
                n1, n2 = best_pair['DF_ID_x'], best_pair['DF_ID_y']
                improvement_found = True
                used_ids.update([o1, o2, n1, n2])
                #print(f"Replacing IDs {o1} and {o2} with ID {n1} and ID {n2}, {format_time(imporvement_time)}")
                #print(f'Used ids: {used_ids}')
                # might be very time expensive to update dfs fully
                pair_data = pair_data[~pair_data['DF_ID'].isin([o1, o2])]
                pair_data = pair_data._append(data[data['DF_ID'].isin([n1, n2])], ignore_index=True)
                #print('New pair_data: ')
                #print(pair_data)
                last_imporvement_time = time.time()
        
        # before clearing and restarting  find a way to try new replacements,
        # since iterating full loop to only find 1 improvement is expensive
        used_ids.clear() # clerar used_ids after all combinations exhausted
        pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
        #print('After loop pair_data: ')
        #print(pair_data)

    if print_p == True:
        print_summary(pair_data, "Pair replacement")
    return pair_data

def new_opt_pair_replacement_without_breaking(pair_data, min_float, max_float, data, combo, print_p):
    #pair_data = pair_data.iloc[::-1].reset_index(drop=True)

    #print(data)
    #data_pairs_time = time.time()
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
    
    #used_ids = set()
    while improvement_found:
        #print('Rechecking improvement possibility')
        improvement_found = False
        #print(pair_data)
        '''
        pair_data_IDs_set = set(pair_data['DF_ID'])
        filt_data_pairs = data_pairs.copy()
        filt_data_pairs = filt_data_pairs[~filt_data_pairs['DF_ID_x'].isin(pair_data_IDs_set) & ~filt_data_pairs['DF_ID_y'].isin(pair_data_IDs_set)]        
        '''

        #print(filt_data_pairs)
        
        #pair_combinations = itertools.combinations(pair_data.itertuples(), 2)
        #for row1, row2 in pair_combinations:
        for row1, row2 in itertools.combinations(pair_data.itertuples(), 2):
            #'''
            pair_data_IDs_set = set(pair_data['DF_ID'])
            if row1.DF_ID not in pair_data_IDs_set or row2.DF_ID not in pair_data_IDs_set:
                continue
            #print(f'Checking row1: {row1.DF_ID} & row2: {row2.DF_ID}')       
            #'''

            '''
            if row1.DF_ID in used_ids or row2.DF_ID in used_ids:
                continue  # Skip this combination and move to the next            
            '''
            
            '''
            filt_data_pairs = data_pairs.copy()
            filt_data_pairs = filt_data_pairs[~filt_data_pairs['DF_ID_x'].isin(pair_data_IDs_set) & ~filt_data_pairs['DF_ID_y'].isin(pair_data_IDs_set)]
            #valid_pairs = filt_data_pairs.copy()
            pair_price = row1.Price + row2.Price
            #print(f'Checking row1: {row1.DF_ID} & row2: {row2.DF_ID}')
            #mask = (~filt_data_pairs['DF_ID_x'].isin(used_ids)) & (~filt_data_pairs['DF_ID_y'].isin(used_ids))
            #mask = (filt_data_pairs['DF_ID_x'] != row1.DF_ID) & (filt_data_pairs['DF_ID_y'] != row2.DF_ID)
            #mask &= (filt_data_pairs['DF_ID_y'] != row1.DF_ID) & (filt_data_pairs['DF_ID_x'] != row2.DF_ID)
            mask = (filt_data_pairs['TPrice'] < pair_price)

            if len(combo) > 1: # Include collection filtering conditions
                mask &= ( 
                    ((filt_data_pairs['Collection_x'] == row1.Collection) & (filt_data_pairs['Collection_y'] == row2.Collection)) |
                    ((filt_data_pairs['Collection_x'] == row2.Collection) & (filt_data_pairs['Collection_y'] == row1.Collection))
                )
            
            valid_pairs = filt_data_pairs.loc[mask]
            #valid_pairs_copy = valid_pairs.copy()
            pair_data_float_with_8 = pair_data['Float'].sum() - row1.Float - row2.Float
            min_items_float = min_float * 10 - pair_data_float_with_8
            max_items_float = max_float * 10 - pair_data_float_with_8
            
            valid_pairs = valid_pairs[(valid_pairs['CFloat'] > min_items_float) & (valid_pairs['CFloat'] < max_items_float)]            
            '''
            pair_price = row1.Price + row2.Price
            pair_data_float_with_8 = pair_data['Float'].sum() - row1.Float - row2.Float
            min_items_float = min_float * 10 - pair_data_float_with_8
            max_items_float = max_float * 10 - pair_data_float_with_8
            #'''
            mask = (~data_pairs['DF_ID_x'].isin(pair_data_IDs_set)) & \
                (~data_pairs['DF_ID_y'].isin(pair_data_IDs_set)) & \
                (data_pairs['TPrice'] < pair_price) & \
                (data_pairs['CFloat'] > min_items_float) & \
                (data_pairs['CFloat'] < max_items_float)            
            
            valid_pairs = data_pairs[mask].copy()
            '''
            mask = (filt_data_pairs['TPrice'] < pair_price) & \
                (filt_data_pairs['CFloat'] > min_items_float) & \
                (filt_data_pairs['CFloat'] < max_items_float)
            
            valid_pairs = filt_data_pairs.loc[mask]  
            '''

            #if best_pair is not None:
            if not valid_pairs.empty:
                #best_pair = valid_pairs.nsmallest(1, ['TPrice', 'CFloat']).iloc[0]
                best_pair = valid_pairs.iloc[0]
                #sorted_pairs = valid_pairs.sort_values
                #price_decrease = pair_price - (best_pair['total_Price'])
                #if price_decrease > 0:
                #imporvement_time = time.time() - last_imporvement_time
                #last_imporvement_time = time.time()
                o1, o2 = row1.DF_ID, row2.DF_ID
                n1, n2 = best_pair['DF_ID_x'], best_pair['DF_ID_y']
                improvement_found = True
                #used_ids.update([o1, o2, n1, n2])
                #print(f"Replacing IDs {o1} and {o2} with ID {n1} and ID {n2}, {format_time(imporvement_time)}")
                #print(f'Current pair cost: {round(pair_price, 2)}, Best pair cost: {round(best_pair["TPrice"], 2)}')
                #print(f'Used ids: {used_ids}')
                # might be very time expensive to update dfs fully
                pair_data = pair_data[~pair_data['DF_ID'].isin([o1, o2])]
                pair_data = pair_data._append(data[data['DF_ID'].isin([n1, n2])], ignore_index=True)
                pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
                #print('New pair_data: ')
                #print(pair_data)
                #last_imporvement_time = time.time()
                #break
                
        # before clearing and restarting  find a way to try new replacements,
        # since iterating full loop to only find 1 improvement is expensive
        #used_ids.clear() # clerar used_ids after all combinations exhausted
        #pair_data = pair_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
        #print('After loop pair_data: ')
        #print(pair_data)

    if print_p == True:
        print_summary(pair_data, "Pair replacement")
    return pair_data

def new_opt_pair_replacement(pair_data, min_float, max_float, data, combo, print_p):
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
        #print('Rechecking improvement possibility')
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
            if len(combo) > 1: # Include collection filtering conditions
                mask &= ( 
                    ((filt_data_pairs['Collection_x'] == row1.Collection) & (filt_data_pairs['Collection_y'] == row2.Collection)) |
                    ((filt_data_pairs['Collection_x'] == row2.Collection) & (filt_data_pairs['Collection_y'] == row1.Collection))
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

def process_wear_outcome(wear_outcome, wear_data, data, combo, split):
    wear_starting_time = time.time() # start the timer
    adjust_float_to_range_function_end_time = 0
    single_replacement_function_end_time = 0
    pair_replacement_function_end_time = 0

    #no_solution_found = False
    
    # Get the min_floatWear, max_floatWear, and expected_value for the current wear outcome
    min_floatWear, max_floatWear, expected_value = wear_data
    expected_value = round(expected_value, 2)

    #print(wear_outcome, min_floatWear, max_floatWear, expected_value)
    '''
    #if wear_outcome != 'MW+FN+FN+FN':
    if wear_outcome != 'MW+FN+MW+FN':
        no_solution_found = True    
    '''

    num_collections = len(combo)
    if num_collections == 1:
        base_data = data.tail(10).reset_index(drop=True) # Initialize best_data with the last 10 items in data
    else:
        frames = []  # List to hold the selected data from each collection
        for collection, num_items in zip(combo, split):
            collection_data = data[data['Collection'] == collection] # Filter 'data' for the current collection
            selected_data = collection_data.tail(num_items).reset_index(drop=True) # Select the last 'num_items' rows for this collection
            frames.append(selected_data) # Append the selected data to the 'frames' list

        base_data = pd.concat(frames, ignore_index=True) # Concatenate all selected data into a single DataFrame
    best_data = base_data

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
        print_summary(best_data, "No replacement")
    # Run replacement functions for the current wear outcome
    adjust_float_to_range_function_start_time = time.time()
    #best_data, range_reached = adjust_float_to_range(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_f = print_float)
    best_data, range_reached = opt_adjust_float_to_range(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_f = print_float, split = split)
    adjust_float_to_range_function_end_time = time.time() - adjust_float_to_range_function_start_time
    #adjust_float_to_range_function_elapsed_time = adjust_float_to_range_function_elapsed_time + adjust_float_to_range_function_end_time
    if range_reached:
        single_replacement_function_start_time = time.time()
        #best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_s = print_single)
        best_data = opt_single_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_s = print_single)
        single_replacement_function_end_time = time.time() - single_replacement_function_start_time
        #single_replacement_function_elapsed_time = single_replacement_function_elapsed_time + single_replacement_function_end_time
        pair_replacement_function_start_time = time.time()
        #best_data = pair_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_p = print_pair)
        #best_data = opt_pair_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_p = print_pair)
        best_data = new_opt_pair_replacement(best_data, min_floatWear, max_floatWear, data.copy(), combo, print_p = print_pair)
        pair_replacement_function_end_time = time.time() - pair_replacement_function_start_time
        #pair_replacement_function_elapsed_time = pair_replacement_function_elapsed_time + pair_replacement_function_end_time
        #best_data = single_replacement(best_data, min_floatWear, max_floatWear, data.copy())

    if not range_reached:
        total_price = "Null"
        average_float = "Null"
        expected_profit = "Null"
        ep_percentage = "Null"
        print(f"Float range not reached for {wear_outcome}")
        #no_solution_found = True
    else:
        # Calculate the results for the current wear outcome
        total_price = best_data['Price'].sum()
        average_float = best_data['Float'].mean()
        expected_profit = round(expected_value - total_price, 2)
        ep_percentage = round((expected_value/total_price-1)*100, 2)

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
    #results_df = pd.concat([results_df, result_row], ignore_index=True)

    #print(f"Time required for wear {wear_outcome}: {int(time_for_wear_outcome // 60):02d}:{int(time_for_wear_outcome % 60):02d}")

    return result_row, time_for_wear_outcome, adjust_float_to_range_function_end_time, single_replacement_function_end_time, pair_replacement_function_end_time

def main(collections, rarities):
    for rarity in rarities:
        total_num_collections = len(collections)
        for r in range(1, total_num_collections + 1):
            for combo in itertools.combinations(collections, r):
            #for collection in collections:
                coll_start_time = time.time()
                print(f'\nCollection: {list(combo)}')

                num_collections = len(combo)
                '''
                if num_collections == 1:
                    break                
                '''

                #print(num_collections)

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
                if num_collections == 1:
                    split = [10]
                else:
                    #split = [6, 4]
                    first = 6
                    split = [first, 10-first]

                #print(split)
                split_name = '-'.join(map(str, split))
                #print(split_name)
                #first_col = 10
                #sec_col = 10 - first_col

                tradeup_rarity = rarity_shift.get(rarity, rarity) # Shift the rarity for tradeup
                print(f'Rarity: {tradeup_rarity}')
                filename = f'ev_{tradeup_rarity}.json'
                with open(filename, 'r') as file: # Load the JSON data from the file
                    data = json.load(file)

                    for item in data:
                        #print(item[0])
                        #print(list(combo))
                        if item[0] == list(combo):
                            if item[1] == tradeup_rarity:  # Check if the item is Covert
                                for wear_info in item[3]:  # item[3] contains the wear data
                                    wear_key = wear_info[0]  # 'FN+FN', 'MW+FN', etc.
                                    wear_details = wear_info[1]
                                    min_float = wear_details['min_float']
                                    max_float = wear_details['max_float']
                                    #expected_value = wear_details['split'][f'{first_col}-{sec_col}']['ev']  # Assuming you want the 'ev' under 'split' '10'
                                    expected_value = wear_details['split'][f'{split_name}']['ev']
                                    # Store the extracted values in the dictionary
                                    combined_wear_data[wear_key] = (min_float, max_float, expected_value)

                #print(combined_wear_data)

                #for wear_outcome, wear_data in combined_wear_data.items():
                #    min_floatWear, max_floatWear, expected_value = wear_data
                #    print(wear_outcome, min_floatWear, max_floatWear, expected_value)
                                    
                #collection = collections[0]
                                    
                if num_collections == 1:
                    data = pd.read_csv(f'{combo[0]}/_{rarity}_comb_n_filt.csv')
                else:
                    frames = []
                    for collection in combo:
                        print(collection)
                        frame = pd.read_csv(f'{collection}/_{rarity}_comb_n_filt.csv')
                        frames.append(frame)
                    # Concatenate all DataFrames in the list to form a single DataFrame
                    data = pd.concat(frames, ignore_index=True)  # ignore_index will reindex the new DataFrame
                    data = data.sort_values(by=['Price', 'Float'], ascending=[True, True])
                data['DF_ID'] = range(1, len(data) + 1)
                cols = ['DF_ID'] + [col for col in data.columns if col != 'DF_ID']
                data = data[cols]
                #print(data)
                #print(data.head(50))

                if num_collections == 1:
                    base_data = data.tail(10).reset_index(drop=True) # Initialize best_data with the last 10 items in data
                    
                else:
                    frames = []  # List to hold the selected data from each collection
                    for collection, num_items in zip(combo, split):
                        collection_data = data[data['Collection'] == collection] # Filter 'data' for the current collection
                        selected_data = collection_data.tail(num_items).reset_index(drop=True) # Select the last 'num_items' rows for this collection
                        frames.append(selected_data) # Append the selected data to the 'frames' list

                    base_data = pd.concat(frames, ignore_index=True) # Concatenate all selected data into a single DataFrame
                    #print(base_data)
                #best_floatWear = base_data['Float'].mean()
                #best_value = base_data['Price'].sum()
                best_data = base_data

                # Add an empty DataFrame called best_summary_data
                #best_summary_data = pd.DataFrame()

                # Create an empty DataFrame to store the results
                results_df = pd.DataFrame(columns=["Wear", "Min Float", "Max Float", "Avg Float", "Cost", "Expected Value", "Expected Profit", "Exp Profit %", "Time"])

                #no_solution_found = False
                adjust_float_to_range_function_elapsed_time = 0
                single_replacement_function_elapsed_time = 0
                pair_replacement_function_elapsed_time = 0

                for wear_outcome, wear_data in combined_wear_data.items(): # Iterate through all wear outcomes

                    print(wear_outcome)
                    #if wear_outcome != 'FN+FN+FN+FN':
                    #if wear_outcome != 'MW+FN+FN+FN':
                        #break
                        #no_solution_found = False
                    #print(wear_data)
                    #print(data)
                    #print(combo)
                    result_row, wear_time, float_time, single_time, pair_time = process_wear_outcome(wear_outcome, wear_data, data, combo, split)
                    results_df = pd.concat([results_df, result_row], ignore_index=True)
                    print(f"Time for wear {wear_outcome}: {format_time(wear_time)}")
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

                print(f"\nElapsed Time for Float function: {format_time(adjust_float_to_range_function_elapsed_time)}")
                print(f"Elapsed Time for Single function: {format_time(single_replacement_function_elapsed_time)}")
                print(f"Elapsed Time for Pair function: {format_time(pair_replacement_function_elapsed_time)}")
                functions_total_time = adjust_float_to_range_function_elapsed_time + single_replacement_function_elapsed_time + pair_replacement_function_elapsed_time
                print(f"Elapsed Time for All functions: {format_time(functions_total_time)}")
                if total_num_collections > 1:
                    coll_elapsed_time = time.time() - coll_start_time # end the timer and print the elapsed time
                    print(f"Elapsed Time for {list(combo)}: {format_time(coll_elapsed_time)}")

start_time = time.time() # start the timer

collections = ["Danger_Zone"]
#collections = ["Clutch"]
#collections = ["Danger_Zone", "Clutch"]
rarities = ["Classified"]

main(collections, rarities)

elapsed_time = time.time() - start_time # end the timer and print the elapsed time
print(f"\nElapsed Time: {format_time(elapsed_time)}")
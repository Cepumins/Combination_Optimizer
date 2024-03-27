import csv
import numpy as np
import pandas as pd
import time
#from numba import njit, jit
import itertools

data = pd.read_csv(f'Items/Classified/Danger_Zone/_Classified_comb_n_filt.csv')

def format_time(duration):
    minutes = int(duration // 60)
    seconds = int(duration % 60)
    milliseconds = int((duration % 1) * 1000)
    return f"{minutes:02d}:{seconds:02d}:{milliseconds:03d}"

def print_summary(print_data, title):
    avg_floatWear = print_data['Float'].mean()
    total_price = print_data['Price'].sum()
    print(title)
    print(f"Float: {avg_floatWear:.8f} - Price: {total_price:.2f}")
    print_data = print_data.sort_values(by=['Price', 'Float'], ascending=[True, True]).reset_index(drop=True)
    print(print_data)

def pair_replacement(pair_data, min_float, max_float, data, combo, print_p):
    data_reduced = data[['DF_ID', 'Price', 'Float', 'Collection']].copy() # Use only necessary columns to reduce memory footprint
    #zero_time_start = time.time()
    indices = np.triu_indices(len(data_reduced), k=1) # Create all possible index combinations for pairs   
    df_id_x = data_reduced.iloc[indices[0]]['DF_ID'].values # Get the values for each combination by indexing into the data_reduced DataFrame
    df_id_y = data_reduced.iloc[indices[1]]['DF_ID'].values
    price_x = data_reduced.iloc[indices[0]]['Price'].values
    price_y = data_reduced.iloc[indices[1]]['Price'].values
    float_x = data_reduced.iloc[indices[0]]['Float'].values
    float_y = data_reduced.iloc[indices[1]]['Float'].values
    collection_x = data_reduced.iloc[indices[0]]['Collection'].values
    collection_y = data_reduced.iloc[indices[1]]['Collection'].values

    tprice = price_x + price_y # Calculate total price and combined float
    cfloat = float_x + float_y

    #zero_time_end = time.time()
    #print(f'Time creating np array of combinations: {format_time(zero_time_end-zero_time_start)}')

    data_pairs = pd.DataFrame({ # Create a DataFrame from the numpy arrays
        'DF_ID_x': df_id_x,
        'DF_ID_y': df_id_y,
        'TPrice': tprice,
        'CFloat': cfloat,
        'Collection_x': collection_x,
        'Collection_y': collection_y
    })

    data_pairs.sort_values(by=['TPrice', 'CFloat'], ascending=[True, True], inplace=True) # Sort values by total price and combined float in ascending orderv
    data_pairs.reset_index(drop=True, inplace=True)
    #print(data_pairs)

    improvement_found = True
    #last_imporvement_time = time.time()

    while improvement_found:
        test_start_time = time.time()
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

        #est_end_time = time.time() - test_start_time
        #zero_time += test_end_time
        

        for row1, row2 in itertools.combinations(pair_data.itertuples(), 2):
            pair_price = row1.Price + row2.Price
            pair_float = row1.Float + row2.Float

            min_items_float = minimal_float_of_2_items + pair_float
            max_items_float = maximal_float_of_2_items + pair_float

            mask = (filt_data_pairs['TPrice'] < pair_price) & \
                (filt_data_pairs['CFloat'] > min_items_float) & \
                (filt_data_pairs['CFloat'] < max_items_float)
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
                # remove o1 and o2 from pair_data and add n1 and n2
                improvement_found = True
                #print(f"Replacing IDs {o1} and {o2} with ID {n1} and ID {n2}, {format_time(imporvement_time)}")
                #print(f'Current pair cost: {round(pair_price, 2)}, Best pair cost: {round(best_pair["TPrice"], 2)}')
                mask = ~pair_data['DF_ID'].isin([o1, o2])
                pair_data_filtered = pair_data.loc[mask].to_numpy()
                new_data = data[data['DF_ID'].isin([n1, n2])].to_numpy() # Find the data to append and convert it to a NumPy array
                pair_data_combined = np.vstack((pair_data_filtered, new_data)) # Append the data using NumPy
                sorted_indices = np.lexsort((-pair_data_combined[:, 4], -pair_data_combined[:, 3])) # Sort the combined data, which is now a NumPy array
                pair_data_sorted = pair_data_combined[sorted_indices]
                pair_data = pd.DataFrame(pair_data_sorted, columns=pair_data.columns) # Convert the sorted NumPy array back to a DataFrame
                #print('New pair_data: ')
                #print(pair_data)
                #last_imporvement_time = time.time()
                break

    #print(f'Test section time: {format_time(zero_time)}')
    if print_p == True:
        print_summary(pair_data, "Pair replacement")
    return pair_data

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
    # Then, apply these indices to data_pairs to get the sorted array
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


df_ids = {65, 64, 63, 60, 57, 49, 28, 4, 2, 1}
data_df = data.copy()
data_df['DF_ID'] = range(1, len(data_df) + 1)
cols = ['DF_ID'] + [col for col in data_df.columns if col != 'DF_ID']
data_df = data_df[cols]
#print(data_df)
starting_data = data_df[data_df['DF_ID'].isin(df_ids)].copy()
starting_data = starting_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
#print(starting_data)
print_summary(starting_data, 'Starting')


#best_data = new_single_replacement(starting_data, min_float=, max_float=, data, combo=, False)
original_def_start_time = time.time()
og_best_data = pair_replacement(starting_data, min_float=0.140000, max_float=0.153846, data=data_df, combo=['Danger_Zone'], print_p=False)
original_def_end_time = time.time()
original_def_time = original_def_end_time - original_def_start_time
print(f'Original function time: {format_time(original_def_time)}')
og_best_data = og_best_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
print_summary(og_best_data, 'Original function')

new_data_df = data_df.copy()
#print(new_data_df)
new_def_start_time = time.time()
new_data_df['Collection'] = new_data_df['Collection'].replace('Danger_Zone', 0)
data_np = new_data_df[['DF_ID', 'Price', 'Float', 'Collection']].to_numpy()
#data_np = new_data_df[['DF_ID', 'Price', 'Float', 'Collection']].astype({'DF_ID': 'float16', 'Price': 'float16', 'Float': 'float16', 'Collection': 'float16'}).to_numpy()
#print(data_np)
#df_ids_np = [81. 80. 79.  78. 77. 76. 75. 75. 4. 1.]
new_starting_data = np.array([row for row in data_np if row[0] in df_ids])
#print(new_starting_data)
#print('New starting data in NP')
#print(new_starting_data)
#sorted_indices = np.lexsort((-new_starting_data[:, 2], -new_starting_data[:, 1]))
#sorted_new_starting_data = new_starting_data[sorted_indices]
#print('New starting data in NP (sorted)')
#print(sorted_new_starting_data)
#def_time = time.time()
new_best_data_np = new_pair_replacement(new_starting_data, min_float=0.140000, max_float=0.153846, data_np=data_np, combo=['Danger_Zone'])
#print(f'new def time itself: {format_time(time.time() - def_time)}')
#new_best_data_np = njit_single_replacement(sorted_new_starting_data, min_float=0.140000, max_float=0.153846, data_np=data_np, combo=['Danger_Zone'])
#print('New best data in NP (sorted)')
#print(new_best_data_np)
#'''
new_df_ids = new_best_data_np[:, 0]
#print(new_df_ids)
filtered_df = data_df[data_df['DF_ID'].isin(new_df_ids)]
#print(filtered_df)

#'''
new_def_end_time = time.time()
new_def_time = new_def_end_time - new_def_start_time
print(f'New function time: {format_time(new_def_time)}')
print_summary(filtered_df, 'New function')
print(f'Total improvement: {round(original_def_time/new_def_time, 3)}x')
#print_summary(new_best_data_np, 'New function')
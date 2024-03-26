import csv
import numpy as np
import pandas as pd
import time
from numba import njit, jit

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

def single_replacement(single_data, min_float, max_float, data, combo, print_s):
    data = data[~data['DF_ID'].isin(single_data['DF_ID'])]

    #single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
    #temp_single_data = single_data.copy()
    #print('Single data: ')
    #print(single_data)
    for _, row in single_data.iterrows():
        #print(f'Considering now {row['DF_ID']}')
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

    #single_data = single_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
    #if print_s == True:
        #print_summary(single_data, "Single replacement")
    return single_data

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
    '''
    print('Final combination: ')
    print(single_data_np)
    return single_data_np    
    '''



df_ids = {81, 80, 79, 78, 77, 76, 75, 5, 4, 1}
data_df = data.copy()
data_df['DF_ID'] = range(1, len(data_df) + 1)
cols = ['DF_ID'] + [col for col in data_df.columns if col != 'DF_ID']
data_df = data_df[cols]
#print(data_df)
starting_data = data_df[data_df['DF_ID'].isin(df_ids)].copy()
starting_data = starting_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
#print(starting_data)
# Initialize an empty set for DF_IDs

df_ids_test = set(starting_data['DF_ID'])

# Print the resulting set of DF_IDs
print(f"df_ids = {df_ids_test}")

print_summary(starting_data, 'Starting')


#best_data = new_single_replacement(starting_data, min_float=, max_float=, data, combo=, False)
original_def_start_time = time.time()
og_best_data = single_replacement(starting_data, min_float=0.140000, max_float=0.153846, data=data_df, combo=['Danger_Zone'], print_s=False)
original_def_end_time = time.time()
original_def_time = original_def_end_time - original_def_start_time
print(f'Original function time: {format_time(original_def_time)}')
og_best_data = og_best_data.sort_values(by=['Price', 'Float'], ascending=[False, False])
print_summary(og_best_data, 'Original function')

new_data_df = data_df.copy()
#print(new_data_df)
new_def_start_time = time.time()
#new_data_df['Collection'] = new_data_df['Collection'].replace('Danger_Zone', 0)
data_np = new_data_df[['DF_ID', 'Price', 'Float', 'Collection']].to_numpy()
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
new_best_data_np = new_single_replacement(new_starting_data, min_float=0.140000, max_float=0.153846, data_np=data_np, combo=['Danger_Zone'])
#new_best_data_np = njit_single_replacement(sorted_new_starting_data, min_float=0.140000, max_float=0.153846, data_np=data_np, combo=['Danger_Zone'])
#print('New best data in NP (sorted)')
#print(new_best_data_np)
new_df_ids = new_best_data_np[:, 0]
#print(new_df_ids)
filtered_df = data_df[data_df['DF_ID'].isin(new_df_ids)]
#print(filtered_df)
new_def_end_time = time.time()
new_def_time = new_def_end_time - new_def_start_time
print(f'New function time: {format_time(new_def_time)}')
print_summary(filtered_df, 'New function')

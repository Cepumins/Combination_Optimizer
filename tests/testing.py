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
                print(f'Replacing {o} with {n}')
                
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

def new_adjust_float(float_data_np, min_float, max_float, data_np, combo, split):
    range_reached = False
    impossible_range = False
    DF_ID_idx, Price_idx, Float_idx, Collection_idx = 0, 1, 2, 3

    # Initial range check
    if min_float < np.mean(float_data_np[:, Float_idx]) < max_float:
        range_reached = True

    if not range_reached:  # Check possibility of this combination
        minimal_item_float = np.min(data_np[:, Float_idx])
        maximal_item_float = np.max(data_np[:, Float_idx])
        if maximal_item_float < min_float or minimal_item_float > max_float:
            impossible_range = True
        else:
            # Sorting data by 'Float' in descending order
            #sorted_indices = np.argsort(data_np[:, Float_idx])[::-1]
            #data_sorted = data_np[sorted_indices]
            data_sorted_asc = data_np[np.argsort(data_np[:, Float_idx])]

            if split == [10]:
                minimal_item_float = np.mean(data_sorted_asc[:10, Float_idx])
                maximal_item_float = np.mean(data_sorted_asc[-10:, Float_idx])
            else:
                maximal_floats = []
                minimal_floats = []
                for collection, count in zip(combo, split):
                    # Filtering by collection
                    #collection_mask = data_sorted[:, Collection_idx] == collection
                    #collection_data = data_sorted[collection_mask]
                    collection_data = data_sorted_asc[data_sorted_asc[:, Collection_idx] == collection]

                    # Appending means
                    minimal_floats.append(np.mean(collection_data[:count, Float_idx]))
                    maximal_floats.append(np.mean(collection_data[-count:, Float_idx]))

                minimal_item_float = np.mean(minimal_floats)
                maximal_item_float = np.mean(maximal_floats)

            if maximal_item_float < min_float or minimal_item_float > max_float:
                impossible_range = True

    # Main loop for adjusting floats
    #print(f'Float range possible, starting main loop, float_data: ')
    #print(float_data_np)
    start_time = time.time()
    data_sorted_desc = data_sorted_asc[::-1]

    while not range_reached and not impossible_range:
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

    # Final sorting if needed
    #sorted_indices = np.lexsort((float_data_np[:, Float_idx], float_data_np[:, Price_idx]))[::-1]
    #float_data_np = float_data_np[sorted_indices]

    return float_data_np, range_reached

df_ids = {74, 75, 76, 77, 78, 79, 80, 81, 82, 83}
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
og_best_data, range_reached = adjust_float(starting_data, min_float=0.140000, max_float=0.153846, data=data_df, combo=['Danger_Zone'], print_f=False, split = [10])
print(f'Range reached: {range_reached}')
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
new_best_data_np, range_reached = new_adjust_float(new_starting_data, min_float=0.140000, max_float=0.153846, data_np=data_np, combo=['Danger_Zone'], split = [10])
print(f'Range reached: {range_reached}')
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
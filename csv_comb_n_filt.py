import pandas as pd
import os
import time
import sys
import numpy as np

def read_links_csv(file_path, collection, quality): # Read the links CSV
    links = pd.read_csv(file_path)
    filtered_links = links[(links['collection'] == collection) & (links['quality'] == quality)] # Filter based on collection and quality
    return filtered_links

def process_item_data(item_name, collection, quality, wear_levels):
    item_combined_data = pd.DataFrame()
    for wear in wear_levels:
        file_path = f"items/{quality}/{collection}/{item_name}_({wear}).csv"
        if os.path.exists(file_path):
            data = pd.read_csv(file_path)
            valid_data = data.loc[(data['Float'] > 0) & (data['Float'] < 1)]
            item_combined_data = pd.concat([item_combined_data, valid_data])
    return item_combined_data

def filter_data(combined_data, filter_count):
    filtered_data = pd.DataFrame(columns=combined_data.columns) # initialize an empty DataFrame to hold the filtered data
    for i in range(len(combined_data)):
        item = combined_data.iloc[i]
        num_lower_floatwear = (filtered_data['Float'] < item['Float']).sum() # count the number of items in filtered_data with lower floatWear
        if num_lower_floatwear < filter_count: # add the item to filtered_data if there are fewer than 'filter_count' items with lower floatWear
            filtered_data = pd.concat([filtered_data, item.to_frame().T], ignore_index=True)
        filtered_data = filtered_data.sort_values(by=['Price', 'Float'], ascending=[True, True])
    return filtered_data

def filter_data_optimized(combined_data, filter_count):
    combined_data['Float_Score'] = combined_data['Float'].rank(method='min').astype(int)
    filtered_data = combined_data[:filter_count].copy()  # Automatically include the first 'filter_count' items
  
    for i in range(filter_count, len(combined_data)): # Iterate over items starting from the 'filter_count'th item
        item = combined_data.iloc[i]
        
        num_lower_float_score = filtered_data[filtered_data['Float_Score'] < item['Float_Score']].shape[0] # Count how many items in the filtered data have a lower Float_Score than the current item
        
        if num_lower_float_score < filter_count: # If the number of items with a lower float score is less than 'filter_count', include this item
            filtered_data = pd.concat([filtered_data, item.to_frame().T], ignore_index=True)

    filtered_data.drop(columns=['Float_Score'], inplace=True)
    return filtered_data

def new_filter_data(combined_data, filter_count):
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

def main(collection, quality):
    wear_levels = ["FN", "MW", "FT", "WW", "BS"]
    links_file_path = f'links/links_{quality}.csv'
    filtered_links = read_links_csv(links_file_path, collection, quality)
    combined_data = pd.DataFrame()
    for _, row in filtered_links.iterrows():
        item_name = row['item']
        #print(item_name)
        item_data = process_item_data(item_name, collection, quality, wear_levels)
        combined_data = pd.concat([combined_data, item_data])

    #print(combined_data)
    combined_data = combined_data.rename(columns={'Index': 'Item_ID'})
    #print(combined_data)
    combined_data = combined_data.sort_values(by=['Price', 'Float'], ascending=[True, True])
    
    
    #combined_data = combined_data
    #float_score_data = combined_data.copy()
    #float_score_data = float_score_data.sort_values(by='Float_Score', ascending=True)
    #print('Sorted  by float score: ')
    #print(float_score_data)
    #print('Regular order: ')
    #print(combined_data)
    filter_start = time.time()
    #final_data = filter_data(combined_data, 10)
    #final_data = filter_data_optimized(combined_data, 10)
    final_data = new_filter_data(combined_data, 10)
    filter_time = time.time() - filter_start
    print(f'Filter time: {filter_time}')
    final_data['Coll_ID'] = range(1, len(final_data) + 1)
    #print(final_data)
    cols = ['Coll_ID'] + [col for col in final_data.columns if col != 'Coll_ID']
    final_data = final_data[cols]
    final_data['Collection'] = collection
    print('Combined & Filtered data: ')
    #print(final_data.head(10))
    print(final_data)
    
    final_data.to_csv(f"items/{quality}/{collection}/_{quality}_comb_n_filt.csv", index=False)    

#collection = 'Clutch'

collection = 'Danger_Zone'
quality = 'Classified'
#main(collection, quality)
#'''
if __name__ == '__main__':
    main(collection, quality)
'''

if __name__ == '__main__':
    if len(sys.argv) == 3:  # Script name is the first argument, so we expect 3 in total
        #start_time = time.time()
        main(sys.argv[1], sys.argv[2])
        #end_time = time.time() - start_time
        #print(f'Time: {end_time}')
    else:
        print("Incorrect number of arguments provided. Expected 'collection' and 'quality'.")
#'''

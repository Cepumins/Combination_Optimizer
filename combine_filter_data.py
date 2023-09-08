import pandas as pd
import os
import sys

# read in the data from the two files
def combine_data(file1, file2):
    # select the first two columns from each file
    data1 = pd.read_csv(file1, usecols=[0, 1, 2, 3, 4, 5, 6, 7])
    data2 = pd.read_csv(file2, usecols=[0, 1, 2, 3, 4, 5, 6, 7])

    # combine the data
    combined_data = pd.concat([data1, data2])
    # sort the data by formattedPrice and floatWear in ascending order
    combined_data = combined_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[True, True])
    return combined_data

def filter_data(combined_data):
    # initialize an empty DataFrame to hold the filtered data
    filtered_data = pd.DataFrame(columns=combined_data.columns)
    for i in range(len(combined_data)):
        item = combined_data.iloc[i]
        # count the number of items in filtered_data with lower floatWear
        num_lower_floatwear = (filtered_data['floatWear'] < item['floatWear']).sum()
        # add the item to filtered_data if there are fewer than 10 items with lower floatWear
        if num_lower_floatwear < 10:
            filtered_data = pd.concat([filtered_data, item.to_frame().T], ignore_index=True)
        filtered_data = filtered_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[True, True])
    return filtered_data

def process_collection(collection, rarity, wear):
    #collection = os.path.join(collection)
    # Read the Recoil.csv file
    items = pd.read_csv(f'{prefix}/{collection}.csv', delimiter=";")

    # Filter the items based on the rarity
    items = items[items['Rarity'] == rarity]

    # Loop through the filtered items and combine their data based on the wear values
    combined_data = pd.DataFrame()
    for _, item in items.iterrows():
        name = item['Name']

        if wear == "ALL":
            wears_list = ["FN", "MW", "FT", "WW", "BS"]
        elif wear == "FN":
            wears_list = ["FN", "MW"]
        elif wear == "MW":
            wears_list = ["MW", "FT"]
        elif wear == "FT":
            wears_list = ["FT", "WW"]
        elif wear == "WW":
            wears_list = ["WW", "BS"]
        elif wear == "BS":
            wears_list = ["BS"]
        else:
            wears_list = [wear]

        item_data = pd.DataFrame()
        for wear_item in wears_list:
            file = os.path.join(prefix, f"Items/SCM/{rarity}", f'{name} ({wear_item}).csv').replace('\\', '/')
            if os.path.exists(file):
                item_data_wear = pd.read_csv(file, usecols=[0, 1, 2, 3, 4, 5, 6, 7])
                item_data_wear = item_data_wear[item_data_wear['formattedPrice'] >= 0.03]
                item_data = pd.concat([item_data, item_data_wear])
            else:
                print(f"Skipping item {name} ({wear_item}) [no .csv found]")

        combined_data = pd.concat([combined_data, item_data])

    combined_data = combined_data.sort_values(by=['formattedPrice', 'floatWear'], ascending=[True, True])

    # Save the combined data to a CSV
    combined_data = combined_data.drop(columns=['price', 'currencyCode'])
    combined_data.reset_index(drop=True).to_csv(os.path.join(f'{prefix}/Items/SCM/{rarity}/_combined_data_{collection}_{rarity}_{wear}.csv'), index_label='ID')

    # Filter the combined data
    filtered_data = filter_data(combined_data)

    # Save the filtered data to a CSV file
    filtered_data.reset_index(drop=True).to_csv(os.path.join(f'{prefix}/Items/filtered_data_{collection}_{rarity}_{wear}.csv'), index_label='ID')

#collection = "Recoil"
collection = sys.argv[1]  # "Recoil"
#rarity = "Restricted"
rarity = sys.argv[2]  # "Restricted"
wear = "ALL"

prefix = f"{collection}"

process_collection(collection, rarity, wear)
print(f"Created output file for {collection} {rarity} {wear}")
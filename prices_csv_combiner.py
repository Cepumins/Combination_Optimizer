import os
import pandas as pd
import sys

def adjust_prices_by_tax(df, tax_rate, site_name):
    # Adjust prices by tax rate
    for column in ['FN', 'MW', 'FT', 'WW', 'BS']:
        if column in df.columns:
            df[column] = df[column] * (1 - tax_rate / 100)
            df[column + '_Site'] = site_name
    return df

def merge_dataframes(combined_df, new_df):
    # Create a list of condition grades and their corresponding site columns
    conditions = ['FN', 'MW', 'FT', 'WW', 'BS']
    condition_sites = [f'{cond}_Site' for cond in conditions]

    # If the combined DataFrame is empty, simply return the new DataFrame
    if combined_df.empty:
        return new_df

    # Merge based on 'Item', 'Collection', 'Rarity', and 'CUR'
    merged_df = pd.merge(combined_df, new_df, on=['Item', 'Collection', 'Rarity', 'CUR'], how='outer', suffixes=('', '_new'))

    # Iterate over each condition to update values and site information
    for condition, site in zip(conditions, condition_sites):
        # Determine the maximum value and update the site information accordingly
        condition_new = condition + '_new'
        for index, row in merged_df.iterrows():
            if pd.isna(row[condition]) or row[condition_new] > row[condition]:
                merged_df.at[index, condition] = row[condition_new]
                merged_df.at[index, site] = row[site + '_new']

        # Remove the temporary columns used for comparison
        merged_df.drop(columns=[condition_new, site + '_new'], inplace=True)

    # Handle 'MinF' and 'MaxF' by taking non-NaN values if available
    for field in ['MinF', 'MaxF']:
        merged_df[field] = merged_df[field].fillna(merged_df[field + '_new'])
        merged_df.drop(columns=[field + '_new'], inplace=True)

    merged_df['Timestamp'] = pd.to_datetime(merged_df['Timestamp'])
    merged_df['Timestamp_new'] = pd.to_datetime(merged_df['Timestamp_new'])
    merged_df['Timestamp'] = merged_df.apply(lambda x: min(x['Timestamp'], x['Timestamp_new']), axis=1)
    merged_df.drop(columns=['Timestamp_new'], inplace=True)

    return merged_df

def check_and_read_csvs(rarity, base_directory, directory_path, site_names, taxes):
    # Navigate to the directory
    directory_path = os.path.join(base_directory, f"prices/{rarity}")

    # Check if the directory exists before trying to change to it
    if not os.path.exists(directory_path):
        print(f"Directory does not exist: {directory_path}")
        return
    
    columns = ['Item', 'Collection', 'Rarity', 'MinF', 'MaxF', 'Timestamp', 'CUR', 'FN', 'MW', 'FT', 'WW', 'BS', 'Site']
    combined_data = pd.DataFrame(columns=columns)

    # Loop through the names to construct file names and check for their existence
    for name in site_names:
        file_name = f"{name}_prices_{rarity}.csv"
        full_path = os.path.join(directory_path, file_name)
        if os.path.isfile(full_path):
            print(f"Found: {full_path}")
            df = pd.read_csv(full_path)
            df = adjust_prices_by_tax(df, taxes.get(name, 0), name)
            #print(f'{name}:')
            #print(df.head())
            '''
            if combined_data.empty:
                combined_data = df
            else:
                combined_data = pd.concat([combined_data, df], ignore_index=True)            
            '''
            combined_data = merge_dataframes(combined_data, df)

        else:
            print(f"Not found: {full_path}")
    
    print('Combined data: ')
    print(combined_data)

    price_columns = ['FN', 'MW', 'FT', 'WW', 'BS']
    combined_data[price_columns] = combined_data[price_columns].round(4)

    save_path = os.path.join(base_directory, f"prices/{rarity}/_prices_{rarity}.csv")
    combined_data.to_csv(save_path, index=False)

base_directory = "C:/Users/Kristaps/Desktop/TUP-main/"
#site_names = ["Halo", "CS2GO", "CS2GOsteam"]
site_names = ['A_Port', 'A_DM']
taxes = {
    "Halo": 3,
    "CS2GO": 2,
    "CS2GOsteam": 15,
    "Buff": 2.5,
    "Stash": 15,
    "StashBit": 10,
    "A_Port": 12,
    'A_DM': 3
}

def main(rarity):
    directory_path = f"prices/{rarity}" 
    check_and_read_csvs(rarity, base_directory, directory_path, site_names, taxes)

#main('Classified')

#'''
if __name__ == '__main__':
    if len(sys.argv) == 2:  # Script name is the first argument, so we expect 3 in total
        #start_time = time.time()
        main(sys.argv[1])
        #end_time = time.time() - start_time
        #print(f'Time: {end_time}')
    else:
        print("Incorrect number of arguments provided. Expected 'collection' and 'quality'.")
#'''
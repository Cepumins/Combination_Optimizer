import numpy as np
import pandas as pd

# Interpolation functions
def price_mecha(wear_value):
    if 0 <= wear_value < 0.15:
        return -49.75 * wear_value + 12.983
    elif 0.15 <= wear_value < 0.38:
        return -7.739 * wear_value + 6.681
    elif 0.38 <= wear_value < 0.45:
        return 7.714 * wear_value + 0.809
    elif 0.45 <= wear_value:
        return -6.8 * wear_value + 7.34
    else:
        return np.nan

def price_ice_coaled(wear_value):
    if 0 <= wear_value < 0.15:
        return -192.5 * wear_value + 46.075
    elif 0.15 <= wear_value < 0.38:
        return -33 * wear_value + 22.15
    elif 0.38 <= wear_value < 0.45:
        return 3 * wear_value + 8.47
    elif 0.45 <= wear_value:
        return -11.094 * wear_value + 14.812
    else:
        return np.nan

# Function to find the optimal combination for a given wear value
def find_optimal_combination(target_wear_value):
    # Initialize minimum price and best wear values
    min_price = float('inf')
    best_mecha_wear = None
    best_ice_coaled_wear = None
    
    # Iterate over possible wear values for Mecha Industries within its valid range
    for mecha_wear in np.arange(0.05, 1.005, 0.005):
        # Calculate corresponding wear value for Ice Coaled based on the target average wear value
        ice_coaled_wear = (10 * target_wear_value - mecha_wear) / 9
        
        # Ensure wear values are within permissible range
        if 0 <= ice_coaled_wear <= 1:
            # Calculate prices
            mecha_price = price_mecha(mecha_wear)
            ice_coaled_price = price_ice_coaled(ice_coaled_wear)

            # Calculate combined price
            combination_price = mecha_price + 9 * ice_coaled_price

            # Update minimum price and best wear values if current combination is cheaper
            if combination_price < min_price:
                min_price = combination_price
                best_mecha_wear = mecha_wear
                best_ice_coaled_wear = ice_coaled_wear
    
    # If no valid combination found, return NaN values
    if best_mecha_wear is None:
        return {
            "wear_value": target_wear_value,
            "combination_price": np.nan,
            "mecha_industries_float": np.nan,
            "mecha_industries_price": np.nan,
            "ice_coaled_float": np.nan,
            "ice_coaled_price": np.nan
        }
    
    # Return the best combination found
    return {
        "wear_value": target_wear_value,
        "combination_price": min_price,
        "mecha_industries_float": best_mecha_wear,
        "mecha_industries_price": price_mecha(best_mecha_wear),
        "ice_coaled_float": best_ice_coaled_wear,
        "ice_coaled_price": price_ice_coaled(best_ice_coaled_wear)
    }

# Compute optimal combinations for wear values from 0 to 1 with a step size of 0.005
wear_values = np.arange(0, 1.005, 0.005)
results_optimal = [find_optimal_combination(wear_value) for wear_value in wear_values]

# Convert results to a DataFrame
df_combinations_optimal = pd.DataFrame(results_optimal)

# Display the first few rows (optional, if needed)
print(df_combinations_optimal.head(50))

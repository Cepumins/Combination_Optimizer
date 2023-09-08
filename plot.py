import matplotlib.pyplot as plt
import json
import pandas as pd
import math
import time
from matplotlib.transforms import Affine2D
import numpy as np
from scipy.interpolate import interp1d
from matplotlib.legend_handler import HandlerLine2D
from matplotlib.lines import Line2D

collections = "Danger_Zone"
rarities = "Classified"

color_pairs = [
    'skyblue',
    'blue',
    'red',
    'darkred',
    'khaki',
    'darkkhaki',
    'peachpuff',
    'darkorange',
    'lightpink',
    'darkviolet',
    'gold',
    'darkgoldenrod',
    'lightskyblue',
    'teal',
    'lightsteelblue',
    'steelblue',
    'plum',
    'darkmagenta'
]

# start the timer
start_time = time.time()

# Wear values
wear_values = {
    "FN": 0.07,
    "MW": 0.15,
    "FT": 0.38,
    "WW": 0.45,
    "BS": 1,
}

# Define function to calculate slope and intercept
def calculate_slope_intercept(x1, y1, x2, y2):
    slope = (y2 - y1) / (x2 - x1)
    intercept = y1 - slope * x1
    return slope, intercept

prices_csv = f"{collections}/{collections}_prices.csv"
df = pd.read_csv(prices_csv)

classified_df = df[df['Rarity'] == rarities]

regular_columns = ['FN', 'MW', 'FT', 'WW', 'BS']
st_columns = ['FN ST', 'MW ST', 'FT ST', 'WW ST', 'BS ST']

# Open the JSON file and load the data
with open('ev_Covert.json') as f:
    data_json = json.load(f)

# Extract the data for the plot
ev_data = data_json[0][3]
ev = {}
st_ev = {}
for item in ev_data:
    ev[round(float(item[1]['max_float']), 4)] = item[1]['split']['10']['ev']
    st_ev[round(float(item[1]['max_float']), 4)] = item[1]['split']['10']['st_ev']

x_ticks = sorted({0.0000} | set(wear_values.values()) | {round(float(item[1]['max_float']), 3) for item in ev_data})

# Set y-values at x=0 and x=1 to the first and last points for EV and StatTrak EV
ev[0] = ev[list(ev.keys())[0]]
ev[1] = ev[list(ev.keys())[-2]]
st_ev[0] = st_ev[list(st_ev.keys())[0]]
st_ev[1] = st_ev[list(st_ev.keys())[-2]]

# Sort the dictionaries by the keys (wear values) again to include the new points at x=0 and x=1
ev_prices = dict(sorted(ev.items()))
st_ev_prices = dict(sorted(st_ev.items()))

fig, axs = plt.subplots(1, 2, figsize=(20, 8))

# Function to calculate the 'Best' line
def calculate_best_line(item_prices):
    # Creating a list to store all x and y points of the 'Best' line
    best_line_points = []

    # Get the lowest MinF and highest MaxF
    min_wear = min(item['MinF'] for item in item_prices)
    max_wear = max(item['MaxF'] for item in item_prices)
    print(f'The min float is {min_wear} and the max float is {max_wear}')

    # Iterate over all x values (wear values)
    for x in np.linspace(0.0, max_wear, num=1000):
        # List to store all interpolated prices at this x value
        interpolated_prices = []

        # Iterate over all items
        for prices in item_prices:
            item_min_wear = prices['MinF']
            item_max_wear = prices['MaxF']
            # Filter the prices dictionary to include only the wear values within the item's range
            prices = {k: v for k, v in prices.items() if isinstance(k, (int, float)) and min_wear <= k <= max_wear and k not in {'Item', 'MinF', 'MaxF', 'Rarity', 'Timestamp', 'CUR'}}

            # Check if there are enough points to calculate a slope and intercept
            if len(prices) > 3:
                wear_keys = list(prices.keys())
                # Calculate slope and intercept for regular and StatTrak wears
                slope_left, intercept_left = calculate_slope_intercept(wear_keys[0], prices[wear_keys[0]], wear_keys[1], prices[wear_keys[1]])

                # Add extrapolated points at MinF
                prices[item_min_wear] = slope_left * item_min_wear + intercept_left

            if prices and min(prices.keys()) <= x <= max(prices.keys()):
                # Interpolate the item's price at this x value and store it
                interpolate = interp1d(list(prices.keys()), list(prices.values()))
                interpolated_prices.append(interpolate(x))

        # If there is at least one price available at this x value
        if interpolated_prices:
            # Find the lowest price
            best_price = min(interpolated_prices)

            # Append the x value and the best price to the 'Best' line points
            best_line_points.append((x, best_price))

    return best_line_points

# Function to plot the 'Best' line
def plot_best_line(ax, best_line_points):
    x_values, y_values = zip(*best_line_points)
    ax.plot(x_values, y_values, color='black')

# Replace the 'plot_prices' function in the script with a new version that calculates and plots the 'Best' line
def plot_prices(ax, ev_prices, item_prices, title, color_pairs, is_st=False):
    # Plot the EV line
    line_ev, = ax.step(list(ev_prices.keys()), list(ev_prices.values()), marker='o', color='lightgreen')
    legend_labels = ['EV']
    line_objects = [line_ev]

    # Add BS price at MaxF x-value
    for prices in item_prices:
        if "BS" in prices and "MaxF" in prices:
            prices[prices["MaxF"]] = prices["BS"]

    for i, prices in enumerate(item_prices):
        # Get the item's specific range of wear values
        item_name = prices["Item"]
        item_min_wear = prices['MinF']
        item_max_wear = prices['MaxF']
        # Filter the prices dictionary to include only the wear values within the item's range
        prices = {k: v for k, v in prices.items() if str(k).replace('.', '', 1).isdigit() and item_min_wear <= float(k) <= item_max_wear}

        # Check if there are enough points to calculate a slope and intercept
        if len(prices) > 3:
            wear_keys = list(prices.keys())
            # Calculate slope and intercept for regular and StatTrak wears
            slope_left, intercept_left = calculate_slope_intercept(wear_keys[0], prices[wear_keys[0]], wear_keys[1], prices[wear_keys[1]])

            # Add extrapolated points at MinF
            prices[item_min_wear] = slope_left * item_min_wear + intercept_left

        # Sort the price dictionary by the keys (wear values)
        prices = dict(sorted(prices.items()))

        # Plot the prices
        line, = ax.plot(list(prices.keys()), list(prices.values()), marker='o', color=color_pairs[i])
        legend_labels.append(f'{item_name} {"StatTrak" if is_st else ""}')
        line_objects.append(line)

    # Update the wear_values dictionary
    for prices in item_prices:
        wear_values.update(prices)

    # Calculate the 'Best' line points
    best_line_points = calculate_best_line(item_prices)

    # Create a new Line2D object for the 'Best' line
    line_best = Line2D([0], [0], color='black')
    line_objects.append(line_best)
    legend_labels.append('Best')

    # Plot the 'Best' line (after all item lines)
    plot_best_line(ax, best_line_points)

    ax.legend(line_objects, legend_labels, loc='upper center', bbox_to_anchor=(0.5, -0.05), fancybox=True, shadow=True, ncol=2)
    ax.set_xlabel('Float')
    ax.set_ylabel('Price (EUR)')
    ax.set_title(title)
    
    ax.grid(True)
    ax.set_xlim([0, 1])  # Set x-limit
    ax.set_xticks(x_ticks)
    # Stagger x-axis labels
    for i, label in enumerate(ax.xaxis.get_ticklabels()):
        if i % 2 == 0:
            label.set_transform(label.get_transform() + Affine2D().translate(-1, 5))
        else:
            label.set_transform(label.get_transform() + Affine2D().translate(1, -5))

regular_item_prices = []
st_item_prices = []
for i, (_, row) in enumerate(classified_df.iterrows()):
    # Get the regular and StatTrak prices
    regular_prices = {wear_values[key]: row[key]*10 for key in regular_columns}
    regular_prices[row["MaxF"]] = row["BS"]*10
    st_prices = {wear_values[key.replace(' ST', '')]: row[key]*10 for key in st_columns}
    st_prices[row["MaxF"]] = row["BS ST"]*10
    regular_prices["Item"] = row["Item"]
    st_prices["Item"] = row["Item"]
    regular_prices["MinF"] = row["MinF"]
    regular_prices["MaxF"] = row["MaxF"]
    st_prices["MinF"] = row["MinF"]
    st_prices["MaxF"] = row["MaxF"]

    regular_item_prices.append(regular_prices)
    st_item_prices.append(st_prices)

# Plot the EV and regular lines
plot_prices(axs[0], ev_prices, regular_item_prices, 'Regular', color_pairs)

# Plot the StatTrak EV and StatTrak lines
plot_prices(axs[1], st_ev_prices, st_item_prices, 'StatTrak', color_pairs, is_st=True)

# end the timer and print the elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
milliseconds = (elapsed_time % 1) * 1000
print(f"\nElapsed Time: {int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}:{int(milliseconds):03d}")

plt.subplots_adjust(left=0.06, right=0.98, top=0.96, hspace=0.4)
plt.tight_layout()
plt.show()

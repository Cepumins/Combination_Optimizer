import numpy as np
import matplotlib.pyplot as plt

'''

def get_random_weighted_towards_center(rolls):
    #num_random = 3  # Increase for a tighter concentration around the mean
    sum_random = sum(np.random.random() for _ in range(rolls))
    return sum_random / rolls

def get_random_weighted_towards_number(weight_towards):
    num_random = 3  # Number of random values to generate
    power = np.log(weight_towards) / np.log(0.5)  # Adjust this power to control the skew. Smaller values increase density towards 0.
    # Generate random numbers, raise them to a power to skew towards lower values, then scale to adjust the mean.
    sum_random = sum((np.random.random() ** power) for _ in range(num_random))
    return sum_random / num_random

def calculate_timeout(mean_timeout):

    #range_timeout = max_timeout - min_timeout

    #random_num = (np.random.random() - 0.5) * 2  # Normalized to range -1 to 1
    
    random_num = (get_random_weighted_towards_center()) * 2

    #weight = mean_timeout / range_timeout

    timeout_duration = random_num * mean_timeout + 50

    return timeout_duration


mean_timeout = 3000
min_timeout = 0
max_timeout = 1
'''


def get_random_weighted_towards_center(num_random):
    return sum(np.random.random() for _ in range(num_random)) / num_random

# Running the simulation
numbers_to_test = [3, 5, 7, 10]
colors = ['blue', 'green', 'red', 'purple']  # List of colors for each plot

# Create bins for histogram
bins = np.linspace(0, 1, 101)  # 100 bins between 0 and 1

for number, color in zip(numbers_to_test, colors):
    # Generate data
    data = [get_random_weighted_towards_center(number) for _ in range(500000)]
    
    # Calculate histogram
    hist, bin_edges = np.histogram(data, bins=bins, density=True)
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])  # Calculate bin centers
    
    # Plotting the histogram as a line plot
    plt.plot(bin_centers, hist, color=color, label=f'n={number}')

plt.legend()
plt.title('Density Plots of Weighted Random Numbers')
plt.xlabel('Value')
plt.ylabel('Density')
plt.show()

'''
a = [get_random_weighted_towards_center(10) for _ in range(500000)]
b = [get_random_weighted_towards_center(7) for _ in range(500000)]

# Plotting the results
plt.hist(a, bins=100, color='blue', alpha=0.7)
plt.hist(b, bins=100, color='red', alpha=0.7)


plt.xlabel('Timeout')
plt.ylabel('Frequency')
plt.title('Distribution of Timeouts')
plt.grid(True)
plt.show()
'''
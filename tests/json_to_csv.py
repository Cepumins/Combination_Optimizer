import pandas as pd
import numpy as np

data = [
  {
    'index': 1,
    'price': 0.98,
    'float': 0.4339288,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 2,
    'price': 0.92,
    'float': 0.4193778,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 3,
    'price': 0.61,
    'float': 0.4212178,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 4,
    'price': 0.42,
    'float': 0.4399548,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 5,
    'price': 0.94,
    'float': 0.4483848,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 6,
    'price': 0.86,
    'float': 0.4489968,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 7,
    'price': 3.43,
    'float': 0.4384438,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 8,
    'price': 1.04,
    'float': 0.4408308,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 9,
    'price': 0.42,
    'float': 0.4404818,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 10,
    'price': 1.03,
    'float': 0.4139388,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 11,
    'price': 0.51,
    'float': 0.3828638,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 12,
    'price': 0.48,
    'float': 0.4021448,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 13,
    'price': 0.51,
    'float': 0.3805788,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 14,
    'price': 0.47,
    'float': 0.4453818,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 15,
    'price': 5.35,
    'float': 0.4367648,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 16,
    'price': 2.9,
    'float': 0.4216188,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 17,
    'price': 3.43,
    'float': 0.4258928,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 18,
    'price': 3.43,
    'float': 0.4189138,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 19,
    'price': 0.39,
    'float': 0.4413288,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 20,
    'price': 0.48,
    'float': 0.4451398,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 21,
    'price': 0.39,
    'float': 0.3851328,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 22,
    'price': 0.39,
    'float': 0.4149468,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 23,
    'price': 0.39,
    'float': 0.4002828,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 24,
    'price': 0.47,
    'float': 0.4271798,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 25,
    'price': 0.4,
    'float': 0.4282948,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 26,
    'price': 0.4,
    'float': 0.4102118,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 27,
    'price': 0.4,
    'float': 0.3803048,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 28,
    'price': 0.39,
    'float': 0.4057598,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 29,
    'price': 0.47,
    'float': 0.4144518,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 30,
    'price': 1.04,
    'float': 0.4206668,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:05'
  },
  {
    'index': 31,
    'price': 0.26,
    'float': 0.6450358,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 32,
    'price': 0.26,
    'float': 0.4588378,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 33,
    'price': 0.26,
    'float': 0.5172428,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 34,
    'price': 0.26,
    'float': 0.4506208,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 35,
    'price': 0.26,
    'float': 0.6574318,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 36,
    'price': 0.27,
    'float': 0.4501398,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 37,
    'price': 0.39,
    'float': 0.4024048,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 38,
    'price': 0.39,
    'float': 0.4491308,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 39,
    'price': 1,
    'float': 0.3548998,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 40,
    'price': 1,
    'float': 0.3350798,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 41,
    'price': 0.28,
    'float': 0.5748608,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 42,
    'price': 1.03,
    'float': 0.3719738,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 43,
    'price': 1.03,
    'float': 0.2638768,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 44,
    'price': 1.03,
    'float': 0.3778838,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 45,
    'price': 1.03,
    'float': 0.3586798,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 46,
    'price': 1.03,
    'float': 0.3793468,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 47,
    'price': 1.03,
    'float': 0.2614168,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 48,
    'price': 1.03,
    'float': 0.3467898,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 49,
    'price': 1.03,
    'float': 0.2748338,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 50,
    'price': 1.03,
    'float': 0.3754938,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 51,
    'price': 1.03,
    'float': 0.3233748,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:13'
  },
  {
    'index': 52,
    'price': 6.99,
    'float': 0.2253818,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 53,
    'price': 11.23,
    'float': 0.2577598,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 54,
    'price': 11.23,
    'float': 0.2609078,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 55,
    'price': 11.23,
    'float': 0.2695908,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 56,
    'price': 8.64,
    'float': 0.2707278,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 57,
    'price': 8.64,
    'float': 0.2709868,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 58,
    'price': 7.25,
    'float': 0.2746808,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 59,
    'price': 1.08,
    'float': 0.2757258,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 60,
    'price': 8.64,
    'float': 0.2815328,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 61,
    'price': 7.25,
    'float': 0.2815828,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 62,
    'price': 1.31,
    'float': 0.2822008,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 63,
    'price': 5,
    'float': 0.2854788,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 64,
    'price': 1.27,
    'float': 0.2857478,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 65,
    'price': 3.5,
    'float': 0.2863578,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 66,
    'price': 1.85,
    'float': 0.2873668,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 67,
    'price': 1.27,
    'float': 0.2880538,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 68,
    'price': 7.25,
    'float': 0.2882598,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 69,
    'price': 3.5,
    'float': 0.2898488,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 70,
    'price': 3,
    'float': 0.2903128,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 71,
    'price': 1.54,
    'float': 0.2911058,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 72,
    'price': 1.27,
    'float': 0.2936418,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 73,
    'price': 1.31,
    'float': 0.2940078,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 74,
    'price': 1.42,
    'float': 0.2969798,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 75,
    'price': 1.2,
    'float': 0.2982038,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 76,
    'price': 3.5,
    'float': 0.3080768,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 77,
    'price': 1.23,
    'float': 0.3081778,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 78,
    'price': 1.23,
    'float': 0.3127388,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:21'
  },
  {
    'index': 79,
    'price': 0.31,
    'float': 0.7024828,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 80,
    'price': 0.31,
    'float': 0.7785738,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 81,
    'price': 0.31,
    'float': 0.6799728,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 82,
    'price': 0.34,
    'float': 0.4547098,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 83,
    'price': 0.39,
    'float': 0.5154008,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 84,
    'price': 0.41,
    'float': 0.4599588,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 85,
    'price': 0.45,
    'float': 0.4737718,
    'condition': 'BS',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 86,
    'price': 0.45,
    'float': 0.4438888,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:28'
  },
  {
    'index': 87,
    'price': 0.47,
    'float': 0.4390838,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:47'
  },
  {
    'index': 88,
    'price': 1.03,
    'float': 0.3266698,
    'condition': 'FT',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:47'
  },
  {
    'index': 89,
    'price': 0.47,
    'float': 0.4284648,
    'condition': 'WW',
    'name': 'MAC-10_Sakkaku',
    'site': 'Bit',
    'timestamp': '2024-04-12 13:19:47'
  }
]

def new_filter_data(combined_data, filter_count):
    # Convert 'Float' column to a NumPy array
    float_array = combined_data['float'].to_numpy()

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

# Convert the list of dictionaries to a DataFrame
df = pd.DataFrame(data)

df = df.sort_values(by=['price', 'float'], ascending=[True, True])

final_data = new_filter_data(df, 10)

final_data = final_data.sort_values(by='index', ascending=True)

# Path to save the CSV file
csv_file_path = 'tests/MAC_10_Sakkaku_Data.csv'

# Save the DataFrame to a CSV file
final_data.to_csv(csv_file_path, index=False)

csv_file_path
import itertools
import pandas as pd

def coll_count():
    collections = ["Recoil", "Danger_Zone", "Prisma"]
    #collections = ["1", "2", '3', '4', '5', '6', '7', '8', '9', '10']

    num = len(collections)

    #print(num)
    count = 0

    for r in range(0, num):
        print(r)
        for combo in itertools.combinations(collections, r):
            print(combo)
            count += 1
            
    print(count)

#coll_count()
    
#collection = 'Clutch'
#data = pd.read_csv(f'Clutch/_Classified_comb_n_filt.csv')
'''
combination = pd.DataFrame()

def min_floats(collection, count):
    global combination
    data = pd.read_csv(f'{collection}/_Classified_comb_n_filt.csv')
    data = data.sort_values(by=['Float', 'Price'], ascending=[True, True])
    items = data.head(count)

    print(items)

    combination = pd.concat([combination, items], ignore_index=True)
    combination = combination.sort_values(by=['Price', 'Float'], ascending=[True, True])
    #print(data)


first = 6

min_floats('Danger_Zone', first)
min_floats('Clutch', (10 - first))

print(combination)

print(combination['Float'].mean())

'''
'''
num = 5
range_reached = False

while not range_reached:
    if num > 6:
        range_reached = True
        break
    print(f'Number: {num}')
    num += 1
'''


'''
def format_time(duration):
    minutes = int(duration // 60)
    seconds = int(duration % 60)
    milliseconds = int((duration % 1) * 1000)
    return f"{minutes:02d}:{seconds:02d}:{milliseconds:03d}"

adjust_float_to_range_function_elapsed_time = 123.456  # Example duration in seconds
formatted_time = format_time(adjust_float_to_range_function_elapsed_time)
print(formatted_time)  # Output will be in the format "MM:SS:MMM"
'''

def partition_number(k):
    n = 10
    if k == 1:
        return [[n]]
    elif k == 2:
        return [[i, n - i] for i in range(1, n)]
    else:
        def _partition_number(n, k, pre):
            if n == 0 and k == 0:
                yield pre
            elif n > 0 and k > 0:
                for i in reversed(range(1, n+1)):
                    yield from _partition_number(n - i, k - 1, pre + [i])

        return sorted(list(_partition_number(n, k, [])), key=lambda x: (x[0], x[1], x[2]))
    
partitions = (partition_number(3))
print(len(partitions))
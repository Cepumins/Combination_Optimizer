from concurrent.futures import ThreadPoolExecutor

def test_function(msg):
    return msg

with ThreadPoolExecutor(max_workers=6) as executor:
    future = executor.submit(test_function, 'Hello from ThreadPoolExecutor')
    print(future.result())
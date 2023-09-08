from selenium import webdriver
from selenium.webdriver.support.ui import Select
import time
import random

def random_delay():
    delay = random.uniform(1, 5)
    time.sleep(delay)

def print_times():
    # Step 4: Find the earliest available spot on date selector and click find
    select_date_element = driver.find_element_by_xpath('//*[@id="datums"]')
    select_date = Select(select_date_element)
    select_date.select_by_index(0)
    selected_date = select_date.first_selected_option.text
    random_delay()
    driver.find_element_by_xpath('//*[@id="find"]').click()

    # Step 5: Print the times available
    select_time_element = driver.find_element_by_xpath('//*[@id="laiks"]')
    select_time = Select(select_time_element)
    available_times = [option.text for option in select_time.options]
    print("Available times for date", selected_date, "are:", available_times)

# Open Chrome
driver = webdriver.Chrome()
driver.get('https://e.csdd.lv/examp')

# Wait for the user to log in manually
input("Press Enter after you have logged in...")

# Step 1: Select the option and click find
select_element = driver.find_element_by_xpath('//*[@id="nodala"]')
select = Select(select_element)
select.select_by_index(8)
random_delay()
driver.find_element_by_xpath('//*[@id="find"]').click()

# Step 2: Select the next option and click find
driver.find_element_by_xpath('//*[@id="uniforma"]/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/fieldset/label').click()
random_delay()
driver.find_element_by_xpath('//*[@id="find"]').click()

# Step 3: Select the next option
driver.find_element_by_xpath('//*[@id="uniforma"]/div[1]/table/tbody/tr/td/div/table/tbody/tr[1]/td/fieldset/label').click()

# Wait for the user to solve the captcha manually
input("Solve the captcha and then press Enter...")

random_delay()
driver.find_element_by_xpath('//*[@id="find"]').click()

# Print the times initially
print_times()

# Loop to print times every 2.5-5 minutes
while True:
    delay_minutes = random.uniform(150, 300)
    time.sleep(delay_minutes)
    print_times()

# Note: The browser will no longer close automatically since we are in an infinite loop

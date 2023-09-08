from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

def open_chrome_mobile(url):
    mobile_emulation = {
        "deviceName": "iPhone X"
    }

    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_experimental_option("mobileEmulation", mobile_emulation)

    driver = webdriver.Chrome(options=chrome_options)
    driver.get(url)
    return driver

# Open Chrome in mobile mode
driver = open_chrome_mobile('https://e.csdd.lv/examp')

# Use an explicit wait to wait for the option '- Izvēle no saraksta -' to be visible
wait = WebDriverWait(driver, 600)  # Wait up to 10 minutes
option = wait.until(EC.visibility_of_element_located((By.XPATH, "//select[@id='datums']/option[@value='-1']")))

if option:
    print('Izvēlies laiku!')

# Keep the browser open
while True:
    pass

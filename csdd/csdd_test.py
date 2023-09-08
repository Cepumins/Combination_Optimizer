from selenium import webdriver

def open_chrome_mobile_with_persistence(url):
    mobile_emulation = { "deviceName": "iPhone X" }
    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_argument('C:/Users/Kristaps/Desktop/Random/Chrome104/chrome_temp')
    chrome_options.add_experimental_option("mobileEmulation", mobile_emulation)
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(url)
    return driver

driver = open_chrome_mobile_with_persistence('https://e.csdd.lv/examp')

# Keep the browser open
while True:
    pass

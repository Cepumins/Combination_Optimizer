import pandas as pd

print("Loading the rates...")
# Read the data from the Google Sheets document
url = "https://docs.google.com/spreadsheets/d/1WPHTFDSabird_q4NYR-xKze2qpB3Jt0YOK0bOIS6dwU/edit#gid=0"
df = pd.read_html(url, skiprows=2)[0].iloc[:, :3]
df = df[df[df.columns[1]].notna()]
df.to_csv('currency_data.csv', index=False)

steam_currencies =      ['A$', 'ARS$', 'R$', 'CDN$',  'CHF',  'CLP$',    None,  'COL$',   '₡',   '€',   '£', 'HK$',   '₪',  'Rp',   '₹',   '¥',   '₩',  'KD',    '₸', 'Mex$',  'RM',  'kr', 'NZ$',  'S/.',    'P',   'zł',   'QR',  'pуб.',   'SR',   'S$',   '฿',  'TL',  'NT$',   '₴',   '$',  '$U',  '₫',     'R', 'kr']
ISO4217_CurrencyCodes = ['AUD','ARS' , 'BRL',  'CAD',  'CHF',   'CLP',  'CNY',  'COP',  'CRC', 'EUR', 'GBP', 'HKD', 'ILS', 'IDR', 'INR', 'JPY', 'KRW', 'KWD',  'KZT',  'MXN', 'MYR', 'NOK', 'NZD',  'PEN',  'PHP',  'PLN',  'QAR',  'RUB',  'SAR',  'SGD', 'THB', 'TRY',  'TWD', 'UAH', 'USD', 'UYU', 'VND',  'ZAR','SEK']
# Create the mapping dictionary
currency_mapping = dict(zip(ISO4217_CurrencyCodes, steam_currencies))

df['Steam Currency'] = df['Currency'].map(currency_mapping)

df.to_csv('currency_data.csv', index=False)
print("Conversion rates loaded!")
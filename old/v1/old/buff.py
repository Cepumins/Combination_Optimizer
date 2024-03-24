import requests

eur_to_yuan = 7.31

item_id = 900492
res= requests.get('https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=' + str(item_id) + '#page_num=4_=1657808768032').json()

market_hash_name = res['data']['goods_infos'][str(item_id)]['market_hash_name']
print(market_hash_name)

items = res['data']['items']
prices = [item['price'] for item in items]
prices_float = [float(price) for price in prices]
price_eur = [round(float(price) / eur_to_yuan, 2) for price in prices]
paintwears = [item['asset_info']['paintwear'] for item in items]

for price, paintwear in zip(price_eur, paintwears):
    print(f'Price: {price} EUR | Float: {paintwear}')

import math

def max_seller_price(buyer_price):
    def buyer_price_calculation(seller_price):
        s = seller_price
        steam_fee = max(1, math.floor(s * 0.05))
        publisher_fee = max(1, math.floor(s * 0.10))
        buyer_price_cents = s + steam_fee + publisher_fee
        return buyer_price_cents

    original_buyer_price_cents = buyer_price * 100
    #if original_buyer_price_cents == 3:
        #return "Maximum sellers price is:\n0.01"
    #if original_buyer_price_cents < 3:
        #return "Maximum sellers price is:\n0.00"

    seller_price_cents = math.floor(original_buyer_price_cents / 1.15)

    while buyer_price_calculation(seller_price_cents) < original_buyer_price_cents:
        seller_price_cents += 1

    seller_price = seller_price_cents / 100
    calculated_buyer_price = buyer_price_calculation(seller_price_cents) / 100

    if buyer_price == calculated_buyer_price:
        #return f"Maximum sellers price is:\n{seller_price:.2f}"
        return f"{seller_price:.2f}"
    elif buyer_price == buyer_price_calculation(seller_price_cents - 1) / 100:
        #return f"Maximum sellers price is:\n{(seller_price_cents - 1) / 100:.2f}"
        return f"{(seller_price_cents - 1) / 100:.2f}"
    else:
        #return f"Maximum sellers price is:\n{seller_price - 0.01:.2f}"
        return f"{seller_price - 0.01:.2f}"

# Example usage:
#original_buyer_price = float(input("Enter the buyer's price in euros: "))
#result = max_seller_price(original_buyer_price)
#print(result)

print(max_seller_price(2.67))

prices_after_tax = []
aug = [25.17, 5.29, 1.71, 1.35, 1.35, 83.68, 16.03, 3.95, 2.84, 2.71]  # list, not set
xm = [9.18, 1.6, 1.65, 1.3, 40.68, 2.98, 2.4, 2.51]
r8 = [1.6, 1.3, 1.34, 3.49, 2.63, 2.12]
for price in r8:
     prices_after_tax.append(max_seller_price(price))  # append new price to the list
#print(prices_after_tax)

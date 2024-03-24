rarity = 'Consumer'
rarity_levels = ['Covert', 'Classified', 'Restricted', 'Mil-Spec', 'Industrial', 'Consumer']
print(rarity)

if rarity not in rarity_levels[:-1]:
    raise ValueError(f"There is no rarity below {rarity}.")

item_rarity = rarity_levels[rarity_levels.index(rarity) + 1]
print(item_rarity)

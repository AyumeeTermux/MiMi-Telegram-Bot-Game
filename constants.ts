
import { Item, ItemCategory, Rarity, Monster, Pet, Dungeon, Skill, PlayerClass } from './types';

export const INITIAL_ITEMS: Item[] = [
  { name: "🪵 Wood Sword", category: ItemCategory.WEAPON, damage: 5, crit: 0, price: 100, rarity: Rarity.COMMON },
  { name: "🔥 Flame Katana", category: ItemCategory.WEAPON, damage: 30, crit: 5, price: 1200, rarity: Rarity.RARE },
  { name: "⚡ Thunder Spear", category: ItemCategory.WEAPON, damage: 55, crit: 10, price: 2500, rarity: Rarity.EPIC },
  { name: "💀 Soul Reaper", category: ItemCategory.WEAPON, damage: 80, crit: 15, price: 5000, rarity: Rarity.LEGENDARY },
  { name: "🌟 Celestial Blade", category: ItemCategory.WEAPON, damage: 150, crit: 25, price: 12000, rarity: Rarity.MYTHIC },
  { name: "🛡️ Iron Armor", category: ItemCategory.ARMOR, hp: 50, price: 300, rarity: Rarity.COMMON },
  { name: "👑 Royal Guard", category: ItemCategory.ARMOR, hp: 120, price: 1800, rarity: Rarity.RARE },
  { name: "🐲 Dragon Scale", category: ItemCategory.ARMOR, hp: 250, price: 6000, rarity: Rarity.LEGENDARY },
  { name: "✨ Divine Armor", category: ItemCategory.ARMOR, hp: 400, price: 12000, rarity: Rarity.MYTHIC },
  { name: "💍 Ring of Luck", category: ItemCategory.ACCESSORY, hp: 10, price: 2500, rarity: Rarity.EPIC },
  { name: "📿 Necklace of Power", category: ItemCategory.ACCESSORY, damage: 15, price: 1200, rarity: Rarity.RARE },
  { name: "🪶 Phoenix Feather", category: ItemCategory.ACCESSORY, hp: 100, price: 6500, rarity: Rarity.LEGENDARY },
  { name: "🧪 Small Potion", category: ItemCategory.POTION, heal: 20, price: 50, rarity: Rarity.COMMON },
  { name: "🧴 Medium Potion", category: ItemCategory.POTION, heal: 50, price: 120, rarity: Rarity.COMMON },
  { name: "🌟 God Potion", category: ItemCategory.POTION, heal: 999, price: 5000, rarity: Rarity.MYTHIC },
];

export const SKILL_TREE: Record<PlayerClass, Skill[]> = {
  'Warrior': [
    { name: 'Power Slash', bonus: 20, description: 'Increases Damage' },
    { name: 'Critical Master', bonus: 10, description: 'Increases Crit' }
  ],
  'Mage': [
    { name: 'Fireball', bonus: 30, description: 'High Burst Damage' },
    { name: 'Mana Boost', bonus: 15, description: 'Bonus Damage from Mana' }
  ],
  'Assassin': [
    { name: 'Shadow Strike', bonus: 20, description: 'Quick Lethal Damage' },
    { name: 'Stealth', bonus: 15, description: 'Critical Strike Chance' }
  ],
  'None': []
};

export const MONSTERS: Monster[] = [
  { name: "👹 Goblin", level: 1, hp: 50, damage: 5, xp: 10, drop: "👂 Goblin Ear" },
  { name: "🐺 Wolf", level: 3, hp: 120, damage: 15, xp: 25, drop: "🦷 Wolf Fang" },
  { name: "🟢 Slime King", level: 5, hp: 200, damage: 20, xp: 50, drop: "🧩 Slime Core" },
  { name: "🐉 Dragon", level: 15, hp: 1000, damage: 80, xp: 200, drop: "🐲 Dragon Scale" },
  { name: "🔥 Demon Lord", level: 30, hp: 3000, damage: 200, xp: 500, drop: "❤️ Demon Heart" },
];

export const PETS: Pet[] = [
  { name: "🐰 Forest Bunny", damage: 5, evolveLevel: 10, nextForm: "🌑 Shadow Bunny" },
  { name: "🌑 Shadow Bunny", damage: 25, evolveLevel: 25, nextForm: "🌌 Void Bunny" },
  { name: "🐲 Mini Dragon", damage: 25, evolveLevel: 20, nextForm: "🔥 Ancient Dragon" },
  { name: "🔥 Phoenix", damage: 80, evolveLevel: 40, nextForm: "🌟 Celestial Phoenix" },
];

export const DUNGEONS: Dungeon[] = [
  { name: "🕳️ Dark Cave", levelReq: 5, boss: "Cave Troll", rewardXp: 100 },
  { name: "❄️ Frozen Castle", levelReq: 15, boss: "Ice King", rewardXp: 300 },
  { name: "🔥 Hell Gate", levelReq: 30, boss: "Demon Lord", rewardXp: 800 },
];

export const RANKS = [
  { name: "Bronze", min: 1 },
  { name: "Silver", min: 10 },
  { name: "Gold", min: 20 },
  { name: "Platinum", min: 35 },
  { name: "Diamond", min: 50 },
  { name: "Mythic", min: 80 },
  { name: "Legend", min: 120 },
];

export const GACHA_RATES = {
  [Rarity.COMMON]: 60,
  [Rarity.RARE]: 25,
  [Rarity.EPIC]: 10,
  [Rarity.LEGENDARY]: 4,
  [Rarity.MYTHIC]: 1,
};

export const VIP_CONFIG = {
  bonusCoins: 1.5,
  bonusXp: 1.3,
  extraDaily: true
};

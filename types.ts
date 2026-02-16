
export enum Rarity {
  COMMON = 'Common',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary',
  MYTHIC = 'Mythic'
}

export enum ItemCategory {
  WEAPON = 'Weapon',
  ARMOR = 'Armor',
  ACCESSORY = 'Accessory',
  POTION = 'Potion'
}

export type PlayerClass = 'Warrior' | 'Mage' | 'Assassin' | 'None';

export interface Skill {
  name: string;
  bonus: number;
  description: string;
}

export interface Item {
  name: string;
  category: ItemCategory;
  damage?: number;
  crit?: number;
  hp?: number;
  heal?: number;
  price: number;
  rarity: Rarity;
}

export interface Monster {
  name: string;
  level: number;
  hp: number;
  damage: number;
  xp: number;
  drop: string;
}

export interface Pet {
  name: string;
  damage: number;
  evolveLevel: number;
  nextForm: string;
}

export interface Dungeon {
  name: string;
  levelReq: number;
  boss: string;
  rewardXp: number;
}

export interface Guild {
  name: string;
  leader: string;
  level: number;
  xp: number;
  coins: number;
  members: string[];
}

export interface Player {
  id: string;
  username: string;
  playerClass: PlayerClass;
  level: number;
  xp: number;
  coins: number;
  hp: number;
  maxHp: number;
  baseDamage: number;
  baseCrit: number;
  inventory: string[];
  equippedWeapon?: string;
  equippedArmor?: string;
  equippedAccessory?: string;
  pets: string[];
  activePet?: string;
  guild: string;
  rank: string;
  vip: boolean;
  dailyClaimed: boolean;
  dailyDate: string;
  registerDate: string;
  dungeonsCleared: number;
}

export interface GameMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

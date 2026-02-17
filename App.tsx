
import React, { useState, useEffect, useRef } from 'react';
import { Player, Item, Monster, PlayerClass, Rarity, ItemCategory, GlobalState, ActiveItem, EventData } from './types';
import { INITIAL_ITEMS, MONSTERS_LOW, MONSTERS_MID, MONSTERS_HIGH, BOSS_MONSTERS } from './constants';
import { createNewPlayer, getPlayerTotalStats, handleLevelUp } from './gameLogic';

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const DEFAULT_TOKEN = "8444920948:AAFnK4FWUo1xwNv_xdCqdI8GQZ-Oj824dXU";
const GROUP_CHAT_ID = -1003750633888; 
const OFFICIAL_CHANNEL = "-1003755267859"; 
const OFFICIAL_GROUP_LINK = "https://t.me/+fb10AiZUKo02MzA1";

const GUILD_MARKET = [
  { name: "👑 OLYMPUS LORDS", price: 100000, topic: 15, link: "https://t.me/c/3750633888/15", msg: "Selamat bergabung di 👑 OLYMPUS LORDS! Kekuasaan langit kini bersamamu.", rewards: ["🌟 Celestial Blade", "✨ Divine Armor"] },
  { name: "⚔️ VALKYRIE ELITE", price: 80000, topic: 16, link: "https://t.me/c/3750633888/16", msg: "Selamat bergabung di ⚔️ VALKYRIE ELITE! Pedangmu akan menjadi legenda.", rewards: ["💀 Soul Reaper", "🐲 Dragon Scale"] },
  { name: "🌌 VOID SPECTRES", price: 50000, topic: 17, link: "https://t.me/c/3750633888/17", msg: "Selamat bergabung di 🌌 VOID SPECTRES! Kegelapan tunduk padamu.", rewards: ["⚡ Thunder Spear", "👑 Royal Guard"] },
  { name: "🔥 PHOENIX ORDER", price: 20000, topic: 20, link: "https://t.me/c/3750633888/20", msg: "Selamat bergabung di 🔥 PHOENIX ORDER! Bangkitlah dari abu kejayaan.", rewards: ["🔥 Flame Katana"] },
  { name: "🍃 FOREST RANGERS", price: 7000, topic: 21, link: "https://t.me/c/3750633888/21", msg: "Selamat bergabung di 🍃 FOREST RANGERS! Alam melindungimu.", rewards: ["🪵 Wood Sword", "💍 Ring of Luck"] }
];

const CLOUD_BUCKET_ID = "mimi_rpg_v36_event_engine";
const CLOUD_API_URL = `https://kvdb.io/${CLOUD_BUCKET_ID}/global_state`;

export const App: React.FC = () => {
  const [token] = useState<string>(DEFAULT_TOKEN);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'server' | 'players'>('server');
  const [globalState, setGlobalState] = useState<GlobalState>({
    players: {}, guilds: {}, metadata: { lastOffset: 0, serverStartTime: new Date().toISOString(), totalCommandsProcessed: 0 }
  });
  
  // CRITICAL: This Ref holds the "Real Truth" of the data to avoid React render lags
  const stateRef = useRef<GlobalState>(globalState);
  const offsetRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);
  const processedUpdates = useRef<Set<number>>(new Set());
  const [logs, setLogs] = useState<{ id: string; type: 'in' | 'out' | 'sys' | 'err'; text: string; user: string; time: Date }[]>([]);
  const [uptime, setUptime] = useState<string>("00:00:00");

  // DYNAMIC KEYBOARD GENERATOR
  const getMainKeyboard = (isEventActive: boolean | undefined) => {
    const baseKeyboard = [
      [{ text: "👤 Profile" }, { text: "⚔️ Hunt" }],
      [{ text: "🏰 Guild" }, { text: "⚔️ Battle" }],
      [{ text: "🛒 Shop" }, { text: "🎒 Inventory" }],
      [{ text: "🏆 Top" }, { text: "👥 Online Players" }],
      [{ text: "🎀 Donasi" }]
    ];

    if (isEventActive) {
      return {
        keyboard: [
          [{ text: "🌟 JOIN EVENT SEKARANG! 🌟" }], 
          ...baseKeyboard
        ],
        resize_keyboard: true
      };
    }

    return { keyboard: baseKeyboard, resize_keyboard: true };
  };

  const KEYBOARD_HUNT = {
    keyboard: [[{ text: "🟢 Rendah (Lv 1-20)" }], [{ text: "🟡 Sedang (Lv 21-50)" }], [{ text: "🔴 Tinggi (Lv 51+)" }], [{ text: "🔙 Kembali" }]],
    resize_keyboard: true
  };

  const KEYBOARD_BATTLE = {
    keyboard: [[{ text: "🔥 PvP Players" }], [{ text: "🐲 Boss Monster" }], [{ text: "🔙 Kembali" }]],
    resize_keyboard: true
  };

  const KEYBOARD_SHOP = {
    keyboard: [
      [{ text: "🔱 Spear of Eternity (100k)" }, { text: "🐉 Emperor Plate (75k)" }],
      [{ text: "⚡ Void Dagger (50k)" }, { text: "🔥 Phoenix Amulet (25k)" }],
      [{ text: "❄️ Frost Shield (10k)" }, { text: "🩸 Warrior Band (5k)" }],
      [{ text: "🧪 Power Elixir (2k)" }, { text: "🪵 Wood Staff (500)" }],
      [{ text: "🩹 Small Bandage (200)" }, { text: "🦴 Rusty Dagger (50)" }],
      [{ text: "🔙 Kembali" }]
    ], resize_keyboard: true
  };

  useEffect(() => {
    // Only update ref from state if the state is newer (this handles initial load)
    if (Object.keys(globalState.players).length > 0 && Object.keys(stateRef.current.players).length === 0) {
         stateRef.current = globalState; 
    }
    if (offsetRef.current === 0) offsetRef.current = globalState.metadata.lastOffset;
  }, [globalState]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isBotRunning) return;
      
      // ALWAYS read from REF to get the absolute latest data, ignoring React render cycles
      const currentState = { ...stateRef.current };
      let changed = false;

      const start = new Date(currentState.metadata.serverStartTime).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);

      const now = Date.now();
      const isEventActive = currentState.activeEvent?.isActive && new Date(currentState.activeEvent.endTime).getTime() > now;

      for (const uid in currentState.players) {
        const p = currentState.players[uid];
        const expired = p.activeItems.filter(ai => ai.expiresAt && ai.expiresAt <= now);
        if (expired.length > 0) {
          p.activeItems = p.activeItems.filter(ai => !ai.expiresAt || ai.expiresAt > now);
          changed = true;
          expired.forEach(ex => {
            const msg = `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .📜 ITEM EXPIRED\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ Pahlawan *${p.username}*!\n┃ \n┃ Masa berlaku *${ex.name}*\n┃ telah habis (Waktu Habis).\n┃ Kekuatan anda telah normal.\n┃ \n┃ 🛒 Segera beli lagi di Shop!\n┗━━━━━━━━━━━━━━━━━━━━┛`;
            sendMessage(uid, "EXPIRED", msg, getMainKeyboard(isEventActive));
          });
        }
      }
      
      if (!isEventActive && Math.random() < 0.05) {
        const duration = 10 * 60 * 1000;
        currentState.activeEvent = {
          isActive: true,
          theme: "BERKAH MIMI (XP BOOST 65%)",
          startTime: new Date().toISOString(),
          endTime: new Date(now + duration).toISOString(),
          xpMultiplier: 1.65
        };
        changed = true;
        const eventStartMsg = `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .🌟 GLOBAL EVENT\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ *${currentState.activeEvent.theme}*\n┃ \n┃ Takdir berpihak pada kita!\n┃ Selama 10 menit kedepan,\n┃ XP Hunt meningkat 65%!\n┃ \n┃ 🔥 AYO HUNTING SEKARANG!\n┃ \n┃ 🔗 [Join Group](${OFFICIAL_GROUP_LINK})\n┗━━━━━━━━━━━━━━━━━━━━┛`;
        await sendMessage(OFFICIAL_CHANNEL, "EVENT START", eventStartMsg, null);
        await sendMessage(GROUP_CHAT_ID, "EVENT START", eventStartMsg, null);
      } else if (currentState.activeEvent?.isActive && !isEventActive) {
        currentState.activeEvent.isActive = false;
        changed = true;
        const eventEndMsg = `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .✨ EVENT SELESAI\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ Berkah Mimi telah usai.\n┃ XP kembali normal.\n┃ \n┃ 🏆 Sampai jumpa di event\n┃ berikutnya, pahlawan!\n┃ \n┃ 🔗 [Join Group](${OFFICIAL_GROUP_LINK})\n┗━━━━━━━━━━━━━━━━━━━━┛`;
        await sendMessage(OFFICIAL_CHANNEL, "EVENT END", eventEndMsg, null);
        await sendMessage(GROUP_CHAT_ID, "EVENT END", eventEndMsg, null);
      }
      
      if (changed) {
        // CRITICAL: Update REF immediately, then State
        stateRef.current = currentState;
        setGlobalState(currentState);
        await syncWithCloud(currentState);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isBotRunning]);

  const addLog = (type: 'in' | 'out' | 'sys' | 'err', text: string, user: string = "System") => {
    setLogs(prev => [{ id: Math.random().toString(), type, text, user, time: new Date() }, ...prev].slice(0, 50));
  };

  const syncWithCloud = async (newState?: GlobalState) => {
    try {
      const options: RequestInit = newState ? { method: 'POST', body: JSON.stringify(newState) } : { method: 'GET' };
      const res = await fetch(CLOUD_API_URL, options);
      if (res.ok) {
        // FIX: ONLY update local state from cloud when it is a GET request (newState is undefined).
        // If it is a POST, we assume our local state is the latest (Source of Truth) and do NOT overwrite it.
        if (!newState) {
            const data = await res.json();
            if (data?.players) {
                setGlobalState(data);
                stateRef.current = data;
            }
        }
      }
    } catch (e) {}
  };

  const sendMessage = async (chatId: number | string, title: string, content: string, keyboard: any, threadId?: number) => {
    const buildBox = (t: string, c: string) => `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .${t.toUpperCase()}\n┣━━━━━━━━━━━━━━━━━━━━┫\n${c}\n┗━━━━━━━━━━━━━━━━━━━━┛`;
    const finalContent = content.startsWith('┏') || content.startsWith('✨') || content.startsWith('🥀') || content.startsWith('@') ? content : buildBox(title, content);
    
    const payload: any = {
      chat_id: chatId,
      text: finalContent,
      parse_mode: 'Markdown',
    };
    
    if (keyboard) payload.reply_markup = keyboard;
    if (threadId) payload.message_thread_id = threadId;

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok) {
        addLog('err', `API Error: ${data.description}`, `ID:${chatId} T:${threadId || 'N'}`);
      } else {
        addLog('out', `${title}`, `ID:${chatId}`);
      }
    } catch (e) {
      addLog('err', `Net Error: ${(e as Error).message}`, `ID:${chatId}`);
    }
  };

  const escapeMd = (str: string) => str.replace(/[_*[`]/g, '\\$&');

  const processCommand = async (chatId: number, first_name: string, text: string, threadId?: number, senderId?: string, rawUsername?: string) => {
    // 1. READ LATEST STATE FROM REF (Source of Truth)
    const currentState = { ...stateRef.current };
    const uid = senderId || chatId.toString();
    
    const safeFirstName = escapeMd(first_name);
    const safeUsername = rawUsername ? escapeMd(rawUsername) : undefined;
    const mention = safeUsername ? `@${safeUsername}` : safeFirstName;
    
    const isGod = rawUsername?.toLowerCase() === 'haiyumee';
    
    if (!currentState.players[uid]) {
      currentState.players[uid] = createNewPlayer(safeFirstName, 'Warrior');
    }
    let p = currentState.players[uid];

    if (isGod) {
      p.level = 9999; p.coins = 9999999; p.maxHp = 9999; p.hp = 9999; p.baseDamage = 9999; p.baseCrit = 9999; p.rank = "OVERLORD 🔱"; p.vip = true;
    }
    
    const cmd = text.trim();
    const say = (t: string, c: string, k: any) => sendMessage(chatId, t, c, k, threadId);
    
    const isEventActive = currentState.activeEvent?.isActive && new Date(currentState.activeEvent.endTime).getTime() > Date.now();
    const currentMainKeyboard = getMainKeyboard(isEventActive);

    // PRIORITY ROUTING
    if (cmd === "/start" || cmd === "🔙 Kembali") {
      const dashboardMsg = `✨ ════════════════════ ✨\n       🏰 *MIMI RPG CENTRAL*\n✨ ════════════════════ ✨\n\n👤 *Commander:* ${mention}\n\n⚔️ "Keberanian bukan berarti\ntidak takut, tetapi bertindak\nwalau sedang ketakutan."\n\n📊 *QUICK STATUS*\n┣ 🎖️ ${p.rank}\n┣ 💰 ${p.coins.toLocaleString()} G\n┗ 🏰 ${p.guild || "Ronin (No Guild)"}\n\n👇 *AKSES MENU UTAMA*\n✨ ════════════════════ ✨`;
      say("DASHBOARD", dashboardMsg, currentMainKeyboard);
    } 
    else if (cmd === "🌟 JOIN EVENT SEKARANG! 🌟") {
       if (isEventActive) {
         say("ZONA EVENT", "🔥 *MODE EVENT AKTIF!*\n\nAnda memasuki zona Hunt Event.\nXP Boost (+65%) otomatis aktif saat anda berburu monster!", KEYBOARD_HUNT);
       } else {
         say("EVENT BERAKHIR", "Maaf, event telah berakhir.", currentMainKeyboard);
       }
    }
    else if (cmd === "👤 Profile") {
      // FORCE REFRESH STATS
      const s = getPlayerTotalStats(p);
      const xpNeeded = p.level * 100;

      // GET ACTIVE EQUIPMENT
      const weapon = p.activeItems.find(ai => INITIAL_ITEMS.find(ii => ii.name === ai.name)?.category === ItemCategory.WEAPON)?.name || "Tinju Kosong";
      const armor = p.activeItems.find(ai => INITIAL_ITEMS.find(ii => ii.name === ai.name)?.category === ItemCategory.ARMOR)?.name || "Kaos Oblong";

      const statusBox = `┏━━━━━━━━━━━━━━━━━━━━┓\n┃               📜 STATUS\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ 👤 User   : ${mention}\n┃ 🌟 Lvl    : ${p.level}\n┃ ✨ XP     : ${p.xp}/${xpNeeded}\n┃ 💰 Koin   : ${p.coins.toLocaleString()}\n┃ ❤️ HP     : ${p.hp}/${s.hp}\n┃ ⚔️ Dmg    : ${s.damage}\n┃ 💥 Crit   : ${s.crit}%\n┃ 🛡️ Rank   : ${p.rank}\n┃ 👑 VIP    : ${p.vip ? "VVIP👑" : "Free User"}\n┃ ⚔️ Senjata : ${weapon}\n┃ 🛡️ Armor  : ${armor}\n┗━━━━━━━━━━━━━━━━━━━━┛`;
      say("STATUS", statusBox, currentMainKeyboard);
    } else if (cmd === "🛒 Shop") {
      say("MARKET", "Silakan pilih item legendaris untuk dibeli:", KEYBOARD_SHOP);
    } else if (cmd === "⚔️ Hunt") {
      say("ZONA HUNT", "Pilih tingkat kesulitan monster:", KEYBOARD_HUNT);
    } 
    // HUNT LOGIC: DYNAMIC COINS
    else if (cmd.startsWith("🟢") || cmd.startsWith("🟡") || cmd.startsWith("🔴")) {
      let monster;
      let xpGain = 0;
      let coinGain = 0;
      const xpNeeded = p.level * 100;

      if (cmd.startsWith("🟢")) {
        monster = MONSTERS_LOW[Math.floor(Math.random() * MONSTERS_LOW.length)];
        xpGain = Math.floor(xpNeeded * 0.10); 
        coinGain = 50 + Math.floor(Math.random() * 50); // 50 - 100 Coins
      } else if (cmd.startsWith("🟡")) {
        if (p.level < 21 && !isGod) { say("HUNT", "❌ Level anda terlalu rendah! Minimal Lv 21.", KEYBOARD_HUNT); return; }
        monster = MONSTERS_MID[Math.floor(Math.random() * MONSTERS_MID.length)];
        xpGain = Math.floor(xpNeeded * 0.03); 
        coinGain = 300 + Math.floor(Math.random() * 200); // 300 - 500 Coins
      } else {
        if (p.level < 51 && !isGod) { say("HUNT", "❌ Level anda terlalu rendah! Minimal Lv 51.", KEYBOARD_HUNT); return; }
        monster = MONSTERS_HIGH[Math.floor(Math.random() * MONSTERS_HIGH.length)];
        xpGain = Math.floor(xpNeeded * 0.03); 
        coinGain = 1000 + Math.floor(Math.random() * 1000); // 1000 - 2000 Coins
      }
      
      const isEventActive = currentState.activeEvent?.isActive && new Date(currentState.activeEvent.endTime).getTime() > Date.now();
      if (isEventActive) xpGain = Math.floor(xpGain * 1.65);

      // LIVE UPDATE
      p.xp += xpGain; 
      p.coins += coinGain;
      
      let resultMsg = `⚔️ Kamu menghancurkan *${monster.name}*!\n✨ XP +${xpGain}${isEventActive ? " (🌟 EVENT BOOST 65%)" : ""}\n💰 Koin +${coinGain}\n💎 Sisa Koin: ${p.coins.toLocaleString()}`;
      
      p.activeItems = p.activeItems.filter(ai => {
        if (ai.remainingUses !== undefined) {
          ai.remainingUses -= 1;
          if (ai.remainingUses <= 0) {
            say("ITEM EXPIRED", `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .📜 ITEM HABIS\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ *${ai.name}* anda telah\n┃ habis masa pakainya.\n┃ (Habis Digunakan)\n┗━━━━━━━━━━━━━━━━━━━━┛`, currentMainKeyboard);
            return false;
          }
        }
        return true;
      });

      const lvlUpMsg = handleLevelUp(p);
      if (lvlUpMsg) resultMsg += `\n\n${lvlUpMsg}`;
      say("HUNT RESULT", resultMsg, KEYBOARD_HUNT);
    } 
    // SHOP & GUILD LOGIC: STRICT DEDUCTION & FEEDBACK
    else if (cmd.includes("(") && (cmd.includes(")") || cmd.includes("k)"))) {
      const isGuildBtn = GUILD_MARKET.some(g => cmd.includes(g.name));
      if (!isGuildBtn) {
        // SHOP ITEM
        const cleanName = cmd.split(" (")[0].replace(/[🔱🐉⚡🔥❄️🩸🧪🪵🩹🦴⚔️✨💀🐲🌟]/g, "").trim();
        const item = INITIAL_ITEMS.find(i => i.name.toLowerCase().includes(cleanName.toLowerCase()));
        
        if (item && (p.coins >= item.price || isGod)) {
          if (!isGod) p.coins -= item.price; // Deduct Coins
          p.inventory.push(item.name);
          say("SHOP", `✅ *SUKSES MEMBELI*\n\n🎁 Item: ${item.name}\n💸 Harga: ${item.price.toLocaleString()}\n💰 Sisa Koin: ${p.coins.toLocaleString()}\n\nSilakan Cek Inventory anda.`, KEYBOARD_SHOP);
        } else if (item) {
          say("SHOP", `❌ *GAGAL MEMBELI*\n\nKoin tidak cukup!\n💰 Koin Anda: ${p.coins.toLocaleString()}\n💸 Harga: ${item.price.toLocaleString()}`, KEYBOARD_SHOP);
        }
      } else {
        // GUILD JOIN
        const gName = cmd.split(" (")[0];
        const gData = GUILD_MARKET.find(g => g.name === gName);
        if (gData && (p.coins >= gData.price || isGod)) {
          if (!isGod) p.coins -= gData.price; // Deduct Coins
          p.guild = gName; p.inventory.push(...gData.rewards);
          
          const joinMsg = `✨ ════════════════════ ✨\n       🎉 *NEW ALLIANCE* 🎉\n✨ ════════════════════ ✨\n\n👤 *Warrior:* ${mention}\n🏰 *Guild:* ${gName}\n\n"Takdir mempertemukan kekuatan baru.\nJadilah pedang dan perisai bagi saudaramu."\n\n🔥 *GLORY TO THE GUILD!*\n\n🔗 [Masuk Markas](${gData.link})\n✨ ════════════════════ ✨`;
          
          await sendMessage(OFFICIAL_CHANNEL, "GUILD JOIN", joinMsg, null);
          await sendMessage(GROUP_CHAT_ID, "GUILD JOIN", joinMsg, null);

          if (gData.topic) {
             const safeGName = escapeMd(gName);
             const safeMsg = escapeMd(gData.msg);
             const topicWelcome = `${mention}, Selamat datang di pasukan elit *${safeGName}*!\n\n"${safeMsg}"`;
             await sendMessage(GROUP_CHAT_ID, "WELCOME RECRUIT", topicWelcome, null, gData.topic);
          }

          say("GUILD", `✅ *SUKSES BERGABUNG*\n\n🏰 Guild: ${gName}\n💸 Biaya: ${gData.price.toLocaleString()}\n💰 Sisa Koin: ${p.coins.toLocaleString()}\n\nCek Inventory untuk reward guild!`, currentMainKeyboard);
        } else if (gData) {
           say("GUILD", `❌ *GAGAL BERGABUNG*\n\nKoin tidak cukup!\n💰 Koin Anda: ${p.coins.toLocaleString()}\n💸 Biaya: ${gData.price.toLocaleString()}`, KEYBOARD_SHOP);
        }
      }
    } 
    else if (cmd === "🏰 Guild") {
      if (p.guild) {
        const gData = GUILD_MARKET.find(g => g.name === p.guild);
        say("GUILD INFO", `Anda adalah bagian dari faksi *${p.guild}*.\n\n🔗 [Masuk Markas Guild](${gData?.link || OFFICIAL_GROUP_LINK})`, { keyboard: [[{ text: "👥 Lihat Anggota" }, { text: "🚪 Keluar" }], [{ text: "🔙 Kembali" }]], resize_keyboard: true });
      } else {
        const guildBtns = GUILD_MARKET.map(g => [{ text: `${g.name} (${g.price/1000}k)` }]);
        say("MARKET GUILD", "Silakan pilih faksi untuk bergabung:", { keyboard: [...guildBtns, [{ text: "🔙 Kembali" }]], resize_keyboard: true });
      }
    } else if (cmd === "👥 Lihat Anggota") {
      const members = Object.values(currentState.players).filter((pl): pl is Player => (pl as Player).guild === p.guild);
      const list = members.map((m, i) => `┃ ${i+1}. ${m.username} (Lv ${m.level})`).join('\n');
      say("GUILD MEMBERS", `Daftar Anggota *${p.guild}*:\n\n${list}`, { keyboard: [[{ text: "🔙 Kembali" }]], resize_keyboard: true });
    } else if (cmd === "🚪 Keluar") {
      const oldGuildName = p.guild;
      p.guild = "";
      say("GUILD", "👋 Anda telah meninggalkan Guild.", currentMainKeyboard);

      if (oldGuildName) {
        const leaveMsg = `🥀 ════════════════════ 🥀\n       💔 *A WARRIOR DEPARTS* 💔\n🥀 ════════════════════ 🥀\n\n👤 *Wanderer:* ${mention}\n🏰 *Left:* ${oldGuildName}\n\n"Setiap pertemuan ada perpisahan.\nJejak langkahmu akan abadi dalam sejarah kami."\n\n🌫️ *SAFE TRAVELS...*\n\n🔗 [Join Group](${OFFICIAL_GROUP_LINK})\n🥀 ════════════════════ 🥀`;
        await sendMessage(OFFICIAL_CHANNEL, "GUILD LEAVE", leaveMsg, null);
        await sendMessage(GROUP_CHAT_ID, "GUILD LEAVE", leaveMsg, null);
      }
    } else if (cmd === "⚔️ Battle") {
      say("ARENA BATTLE", "Siapa lawanmu hari ini?", KEYBOARD_BATTLE);
    } else if (cmd === "🔥 PvP Players") {
      const others = Object.values(currentState.players).filter((pl): pl is Player => (pl as Player).id !== uid);
      if (others.length === 0) say("BATTLE", "❌ Tidak ada player lain.", KEYBOARD_BATTLE);
      else {
        const opp = others[Math.floor(Math.random() * others.length)];
        const win = isGod || Math.random() > 0.4;
        if (win) { 
          p.xp += 150; 
          p.coins += 500; 
          say("PvP RESULT", `🔥 Kamu menang melawan *${opp.username}*!\n✨ XP +150 | 💰 Koin +500`, KEYBOARD_BATTLE); 
        }
        else { p.hp = 10; say("PvP RESULT", `💀 Kamu dikalahkan oleh *${opp.username}*.`, KEYBOARD_BATTLE); }
      }
    } else if (cmd === "🐲 Boss Monster") {
      if (p.level < 200 && !isGod) say("BATTLE", "❌ Minimal Level 200 untuk Boss!", KEYBOARD_BATTLE);
      else {
        const boss = BOSS_MONSTERS[Math.floor(Math.random() * BOSS_MONSTERS.length)];
        const win = isGod || Math.random() > 0.7;
        if (win) { 
          p.xp += 5000; 
          p.coins += 10000; 
          p.inventory.push(boss.drop); 
          say("BOSS RESULT", `🐲 Tumbang! *${boss.name}*\n✨ XP +5000 | 💰 Koin +10,000`, KEYBOARD_BATTLE); 
        }
        else { p.hp = 0; say("BOSS RESULT", `🔥 Kalah!`, KEYBOARD_BATTLE); }
      }
    } else if (cmd === "🎒 Inventory") {
      const invKeyboard = Array.from(new Set(p.inventory)).map(item => [{ text: `Gunakan: ${item}` }]);
      const list = p.inventory.length > 0 ? p.inventory.map((i, idx) => `┃ ${idx+1}. ${i}`).join('\n') : "┃ (Kosong)";
      const activeList = p.activeItems.length > 0 ? p.activeItems.map(ai => `✨ ${ai.name} (${ai.expiresAt ? new Date(ai.expiresAt).toLocaleTimeString() : ai.remainingUses + ' sisa pakau'})`).join('\n') : "Tidak ada";
      say("INVENTORY", `Tas Anda:\n${list}\n\n🔥 *Aktif saat ini:*\n${activeList}`, { keyboard: [...invKeyboard, [{ text: "🔙 Kembali" }]], resize_keyboard: true });
    } else if (cmd.startsWith("Gunakan: ")) {
      const itemToEquip = cmd.replace("Gunakan: ", "");
      const found = INITIAL_ITEMS.find(i => i.name === itemToEquip);
      if (found) {
        const idx = p.inventory.indexOf(found.name);
        if (idx > -1) p.inventory.splice(idx, 1);
        const newActive: ActiveItem = { name: found.name };
        if (found.durationHours) newActive.expiresAt = Date.now() + (found.durationHours * 3600000);
        if (found.maxUses) newActive.remainingUses = found.maxUses;
        p.activeItems.push(newActive);
        say("INVENTORY", `✅ *DONE!*\nBerhasil menggunakan *${found.name}*.`, currentMainKeyboard);
      }
    } else if (cmd === "🏆 Top") {
      // LIVE LEADERBOARD (Sorts latest data)
      const top = Object.values(currentState.players).sort((a,b) => (b as Player).level - (a as Player).level).slice(0, 10);
      const list = top.map((tp, i) => `┃ ${i+1}. ${(tp as Player).username} (Lv ${(tp as Player).level})`).join('\n');
      say("TOP HEROES", `Peringkat Pahlawan Terkuat:\n\n${list}`, currentMainKeyboard);
    } else if (cmd === "👥 Online Players") {
      const communityMsg = `🌐 *KOMUNITAS OFFICIAL*\n\nSilakan pilih platform komunitas kami di bawah ini untuk bergabung:`;
      const linkKeyboard = {
        inline_keyboard: [
          [{ text: "🔵 Grup Telegram", url: "https://t.me/+fb10AiZUKo02MzA1" }],
          [{ text: "🟢 Grup Whatsapp", url: "https://chat.whatsapp.com/LibqGtsq7FK6qShltnfSlS?mode=gi_t" }]
        ]
      };
      say("COMMUNITY", communityMsg, linkKeyboard);
    } else if (cmd === "🎀 Donasi") {
      const donasiMsg = `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .🎀 DONASI ADMIN\n┣━━━━━━━━━━━━━━━━━━━━┫\n┃ 💌 Pesan Admin :\n┃ Haiiii gaeeessss\n┃ Donasi Seikhlasnya aja yaa😻\n┃ \n┃ Makasi banyak yang udh donasi\n┃ moga berkah selalu🩵\n┃ \n┃ ✨ *Donasi Untuk Admin Superrr Cuteeee*\n┃ [KLIK DI SINI](https://t.me/MiMi_RPG_Gamess/5)\n┗━━━━━━━━━━━━━━━━━━━━┛`;
      say("DONASI", donasiMsg, currentMainKeyboard);
    }

    currentState.metadata.totalCommandsProcessed += 1;
    
    // 2. FORCE UPDATE REFERENCE (This prevents the 'undo' bug)
    stateRef.current = currentState; 

    // 3. Trigger UI Render & Save
    setGlobalState(currentState);
    await syncWithCloud(currentState);
  };

  const poll = async () => {
    if (isPollingRef.current || !isBotRunning) return;
    isPollingRef.current = true;
    try {
      const res = await fetch(`${TELEGRAM_API_BASE}${token}/getUpdates?offset=${offsetRef.current}&timeout=30`);
      const data = await res.json();
      if (data.ok) {
        for (const update of data.result) {
          if (processedUpdates.current.has(update.update_id)) continue;
          processedUpdates.current.add(update.update_id);
          offsetRef.current = update.update_id + 1;
          const msg = update.message;
          if (msg?.text) {
            await processCommand(msg.chat.id, msg.from.first_name || "User", msg.text, msg.message_thread_id, msg.from.id.toString(), msg.from.username);
            addLog('in', msg.text, msg.from.first_name);
          }
        }
      }
    } catch (e) {} finally { isPollingRef.current = false; }
  };

  useEffect(() => {
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [isBotRunning]);

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans flex overflow-hidden">
      {!isBotRunning ? (
        <div className="fixed inset-0 bg-[#020617] z-50 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl animate-pulse border-4 border-indigo-400/20"><i className="fa-solid fa-star text-4xl"></i></div>
          <h1 className="text-4xl font-black mb-12 tracking-tighter uppercase italic text-indigo-500">MIMI RPG V3.6.3</h1>
          <button onClick={() => { syncWithCloud(); setIsBotRunning(true); }} className="bg-indigo-600 px-16 py-5 rounded-2xl font-black hover:scale-105 transition-all uppercase text-[10px] tracking-widest shadow-xl border border-indigo-400/50">START ENGINE</button>
        </div>
      ) : (
        <>
          <aside className="w-80 bg-[#070a13] border-r border-white/5 flex flex-col shadow-2xl">
            <div className="p-10 border-b border-white/5 flex items-center gap-3">
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-black tracking-tighter italic uppercase">MIMI <span className="text-indigo-500 text-sm">OS</span></h2>
            </div>
            <nav className="p-6 flex-1 space-y-3 mt-6">
              <button onClick={() => setActiveTab('server')} className={`w-full text-left px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'server' ? 'bg-indigo-600' : 'text-slate-500 hover:bg-white/5'}`}>Active Logs</button>
              <button onClick={() => setActiveTab('players')} className={`w-full text-left px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'players' ? 'bg-indigo-600' : 'text-slate-500 hover:bg-white/5'}`}>Player Database</button>
            </nav>
            <div className="p-10 border-t border-white/5 text-center font-mono text-2xl font-black text-indigo-400">{uptime}</div>
          </aside>
          <main className="flex-1 flex flex-col bg-[#020617] p-12 overflow-hidden">
            <div className="mb-8 flex justify-between items-center bg-[#070a13] p-6 rounded-[2rem] border border-white/5">
               <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Global Event Status</h3>
                  <p className={`font-black uppercase italic ${globalState.activeEvent?.isActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}>
                    {globalState.activeEvent?.isActive ? globalState.activeEvent.theme : 'No Active Event'}
                  </p>
               </div>
               <div className="text-right">
                  <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Commands Processed</h3>
                  <p className="font-black text-indigo-400 text-xl">{globalState.metadata.totalCommandsProcessed}</p>
               </div>
            </div>
            {activeTab === 'server' && (
              <div className="flex-1 bg-black/40 rounded-[3rem] border border-white/5 p-10 font-mono text-[10px] overflow-y-auto scrollbar-hide">
                {logs.map(l => (
                  <div key={l.id} className="flex gap-6 opacity-80 border-b border-white/5 pb-2">
                    <span className="text-slate-700">[{l.time.toLocaleTimeString()}]</span>
                    <span className={`font-black uppercase text-[7px] ${l.type === 'in' ? 'text-emerald-400' : 'text-sky-400' || l.type === 'err' ? 'text-red-500' : ''}`}>{l.type}</span>
                    <span className="text-slate-400">@{l.user}: <span className="text-white">{l.text}</span></span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'players' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto scrollbar-hide">
                {(Object.values(globalState.players) as Player[]).sort((a,b) => b.level - a.level).map(p => (
                  <div key={p.id} className="p-8 rounded-[2.5rem] bg-[#070a13] border border-white/5 relative overflow-hidden group">
                    {p.vip && <div className="absolute top-0 right-0 bg-amber-500 text-[8px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest text-black">VIP</div>}
                    <div className="flex justify-between mb-4">
                      <h4 className="font-black text-lg">{p.username}</h4>
                      <span className="text-emerald-400 font-bold">{p.coins.toLocaleString()} 💰</span>
                    </div>
                    <div className="flex gap-4 text-[10px] text-slate-500 uppercase font-bold">
                       <span className="bg-white/5 px-2 py-1 rounded">Lv {p.level}</span>
                       <span className="bg-white/5 px-2 py-1 rounded">{p.rank}</span>
                       <span className="bg-white/5 px-2 py-1 rounded">{p.guild || 'No Guild'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
};

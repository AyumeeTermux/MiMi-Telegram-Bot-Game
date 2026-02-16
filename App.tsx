
import React, { useState, useEffect, useRef } from 'react';
import { Player, GameMessage, Item, Monster, PlayerClass, Rarity } from './types';
import { INITIAL_ITEMS, MONSTERS, VIP_CONFIG } from './constants';
import { createNewPlayer, getPlayerTotalStats, handleLevelUp, rollGacha, checkRandomEvent, equipItem } from './gameLogic';

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const GOD_ID = "8408747449";

// Defined Keyboards for Telegram
const KEYBOARD_MAIN = {
  keyboard: [
    [{ text: "👤 Profile" }, { text: "⚔️ Hunt" }],
    [{ text: "🎒 Inventory" }, { text: "🛒 Shop" }],
    [{ text: "🏆 Leaderboard" }, { text: "❓ Help" }]
  ],
  resize_keyboard: true
};

const KEYBOARD_SHOP = {
  keyboard: [
    [{ text: "⚔️ Katana (1200)" }, { text: "🔱 Spear (2500)" }],
    [{ text: "🛡️ Armor (1800)" }, { text: "🎰 Gacha (500)" }],
    [{ text: "🌟 VIP (10000)" }, { text: "🔙 Kembali" }]
  ],
  resize_keyboard: true
};

const App: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isBotStarted, setIsBotStarted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'console' | 'database' | 'players'>('console');
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const playersRef = useRef<Record<string, Player>>({});
  const [logs, setLogs] = useState<{ id: string; type: 'in' | 'out' | 'sys'; text: string; user: string; time: Date }[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    const saved = localStorage.getItem('mimi_players_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPlayers(parsed);
        playersRef.current = parsed;
      } catch (e) {
        console.error("Failed to parse players db", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mimi_players_db', JSON.stringify(players));
  }, [players]);

  const addLog = (type: 'in' | 'out' | 'sys', text: string, user: string = "System") => {
    const newLog = { id: Math.random().toString(), type, text, user, time: new Date() };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  /**
   * Strictly updated wrapInBox as per user's visual request:
   * ┏━━━━━━━━━━━━━━━━━━━━━━
   * ┃ TITLE
   * ┣━━━━━━━━━━━━━━━━━━━━━━
   * ┃ CONTENT
   * ┗━━━━━━━━━━━━━━━━━━━━━━
   */
  const wrapInBox = (title: string, content: string): string => {
    const BORDER_CHAR_COUNT = 24; 
    const hLine = "━".repeat(BORDER_CHAR_COUNT);
    
    const lines = content.split('\n');
    let boxed = `\`\`\`\n`;
    boxed += `┏${hLine}\n`;
    boxed += `┃ ${title.toUpperCase()}\n`;
    boxed += `┣${hLine}\n`;
    
    lines.forEach(line => {
      const text = line.trim();
      if (text.length > 0) {
        boxed += `┃ ${text}\n`;
      }
    });
    
    boxed += `┗${hLine}\n`;
    boxed += `\`\`\``;
    return boxed;
  };

  const seedGodUser = (targetId: string = GOD_ID) => {
    const godUser: Player = {
      id: targetId,
      username: "@haiyumee",
      playerClass: 'Warrior',
      level: 9999,
      xp: 0,
      coins: 9999999,
      hp: 1000000,
      maxHp: 1000000,
      baseDamage: 9999,
      baseCrit: 100,
      inventory: INITIAL_ITEMS.map(i => i.name),
      equippedWeapon: "🌟 Celestial Blade",
      equippedArmor: "✨ Divine Armor",
      equippedAccessory: "🪶 Phoenix Feather",
      pets: ["🔥 Phoenix"],
      activePet: "🔥 Phoenix",
      guild: "GODS",
      rank: "Legend",
      vip: true,
      dailyClaimed: false,
      dailyDate: "",
      registerDate: new Date().toISOString(),
      dungeonsCleared: 999,
    };

    setPlayers(prev => {
      const updated = { ...prev, [targetId]: godUser };
      playersRef.current = updated;
      return updated;
    });
    return godUser;
  };

  const sendMessage = async (chatId: number, title: string, content: string, keyboard: any = KEYBOARD_MAIN) => {
    const formattedText = wrapInBox(title, content);
    try {
      await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: formattedText, 
          parse_mode: 'MarkdownV2',
          reply_markup: keyboard
        })
      });
      addLog('out', `[${title}] ${content}`, `Chat ID: ${chatId}`);
    } catch (error) {
      addLog('sys', `Error sending message: ${error}`);
    }
  };

  const processCommand = (chatId: number, username: string, rawText: string) => {
    const userId = chatId.toString();
    
    // Auto-apply VVIP stats if the user matches the GOD_ID
    if (userId === GOD_ID && (!playersRef.current[userId] || playersRef.current[userId].level < 9999)) {
      seedGodUser(userId);
    }
    
    let player = playersRef.current[userId];
    const text = rawText.trim();

    let cmd = text.toLowerCase();
    
    if (text === "👤 Profile") cmd = "/profile";
    if (text === "⚔️ Hunt") cmd = "/hunt";
    if (text === "🎒 Inventory") cmd = "/inv";
    if (text === "🛒 Shop") cmd = "/shop";
    if (text === "🏆 Leaderboard") cmd = "/leaderboard";
    if (text === "❓ Help") cmd = "/help";
    if (text === "🔙 Kembali") cmd = "/start";
    
    if (text.includes("Katana")) cmd = "/buy_katana";
    if (text.includes("Spear")) cmd = "/buy_spear";
    if (text.includes("Armor")) cmd = "/buy_armor";
    if (text.includes("Gacha")) cmd = "/buy_gacha";
    if (text.includes("VIP")) cmd = "/buy_vip";
    
    if (text.startsWith("🔧 Gunakan ")) {
      const itemName = text.replace("🔧 Gunakan ", "");
      cmd = `/use ${itemName}`;
    }

    const [command, ...args] = cmd.split(' ');
    const argStr = args.join(' ');

    if (command === '/start') {
      if (!player) {
        const newP = createNewPlayer(username, 'Warrior');
        setPlayers(prev => {
           const updated = { ...prev, [userId]: newP };
           playersRef.current = updated;
           return updated;
        });
        sendMessage(chatId, "🎮 NEW PLAYER", `Selamat Datang!\n${username}\n\n🏷️ Class: Warrior\n💰 Koin: 100\n\nAyo mulai berburu!`, KEYBOARD_MAIN);
      } else {
        sendMessage(chatId, "🏠 HOME MENU", `Halo ${player.username}!\n\n🌟 Level: ${player.level}\n💰 Koin : ${player.coins}\n❤️ HP   : ${player.hp}\n\nKlik menu di bawah!`, KEYBOARD_MAIN);
      }
      return;
    }

    if (!player) {
      sendMessage(chatId, "⚠️ SYSTEM", "Ketik /start\nuntuk mendaftar!", KEYBOARD_MAIN);
      return;
    }

    let up = { ...player, inventory: [...player.inventory] };

    if (command === '/profile' || command === '/me') {
      const stats = getPlayerTotalStats(up);
      const isGod = userId === GOD_ID;
      
      // Specifically formatted for the requested look
      let content = "";
      if (isGod) {
        content = `👤 User  : ${up.username}\n👑 Status: VVIP👑\n🌟 Lvl   : ${up.level}\n💰 Coin  : ${up.coins}\n❤️ HP    : ${up.hp}/${stats.hp}\n⚔️ Dmg   : ${stats.damage}\n💥 Crit  : ${stats.crit}%\n🛡️ Rank  : Legend\n🎒 Inv   : Full Item\n\n⚔️ Senjata: ${up.equippedWeapon || '-'}\n🛡️ Armor: ${up.equippedArmor || '-'}`;
      } else {
        const vipTag = up.vip ? "VVIP👑" : "TIDAK";
        content = `👤 User  : ${up.username}\n🌟 Lvl   : ${up.level}\n✨ XP    : ${up.xp}/${up.level * 100}\n💰 Koin  : ${up.coins}\n❤️ HP    : ${up.hp}/${stats.hp}\n⚔️ Dmg   : ${stats.damage}\n💥 Crit  : ${stats.crit}%\n\n🛡️ Rank  : ${up.rank}\n👑 Status: ${vipTag}\n\n⚔️ Senjata: ${up.equippedWeapon || '-'}\n🛡️ Armor: ${up.equippedArmor || '-'}`;
      }
      
      sendMessage(chatId, "📜 STATUS", content, KEYBOARD_MAIN);
    } else if (command === '/hunt') {
      const availableMonsters = MONSTERS.filter(m => m.level <= up.level + 2);
      const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
      const stats = getPlayerTotalStats(up);
      const turnsToKill = Math.ceil(monster.hp / stats.damage);
      const totalDamageTaken = turnsToKill * monster.damage;
      
      if (up.hp <= totalDamageTaken) {
        up.hp = Math.max(10, up.hp);
        sendMessage(chatId, "💀 KEKALAHAN", `Lawan: ${monster.name}\n\nStatus: KALAH!\n❤️ HP Sisa: ${up.hp}\n\nIstirahat dulu\natau beli Potion!`, KEYBOARD_MAIN);
      } else {
        up.hp -= totalDamageTaken;
        let xpGain = monster.xp;
        let coinGain = Math.floor(monster.xp * 1.5);
        if (up.vip) {
          xpGain = Math.floor(xpGain * VIP_CONFIG.bonusXp);
          coinGain = Math.floor(coinGain * VIP_CONFIG.bonusCoins);
        }
        up.xp += xpGain;
        up.coins += coinGain;
        let result = `Lawan: ${monster.name}\n\nStatus: MENANG!\n💰 +${coinGain} Koin\n✨ +${xpGain} XP\n❤️ HP : ${up.hp}`;
        
        const lvlMsg = handleLevelUp(up);
        if (lvlMsg) result += `\n\n🆙 LEVEL UP!`;
        const eventMsg = checkRandomEvent(up);
        if (eventMsg) result += `\n\n⚠️ EVENT TERJADI!`;
        
        sendMessage(chatId, "⚔️ PERTEMPURAN", result, KEYBOARD_MAIN);
      }
    } else if (command === '/shop') {
      sendMessage(chatId, "🛒 MIMI SHOP", `💰 Koin: ${up.coins}\n\nPilih item hebat\ndi bawah ini:`, KEYBOARD_SHOP);
    } else if (command === '/inv' || command === '/inventory') {
      const invList = up.inventory.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
      const uniqueItems = Array.from(new Set(up.inventory));
      const buttons = uniqueItems.map(item => [{ text: `🔧 Gunakan ${item}` }]);
      buttons.push([{ text: "🔙 Kembali" }]);
      
      const invKeyboard = {
        keyboard: buttons,
        resize_keyboard: true
      };

      sendMessage(chatId, "🎒 TAS PEMAIN", (invList || "Tas Kosong...") + "\n\nKlik tombol item\nuntuk menggunakan!", invKeyboard);
    } else if (command === '/use') {
      if (!argStr) {
        sendMessage(chatId, "❌ ERROR", "Item tidak valid!", KEYBOARD_MAIN);
      } else {
        const result = equipItem(up, argStr);
        sendMessage(chatId, "🔧 MANAJEMEN ITEM", result, KEYBOARD_MAIN);
      }
    } else if (command.startsWith('/buy')) {
      let price = 0;
      let itemName = "";
      if (command === '/buy_katana') { price = 1200; itemName = "🔥 Katana"; }
      if (command === '/buy_spear') { price = 2500; itemName = "⚡ Spear"; }
      if (command === '/buy_armor') { price = 1800; itemName = "🛡️ Armor"; }
      if (command === '/buy_gacha') { price = 500; }
      if (command === '/buy_vip') { price = 10000; }

      if (up.coins >= price) {
        if (command === '/buy_gacha') {
          up.coins -= 500;
          const gItem = rollGacha();
          up.inventory = [...up.inventory, gItem.name];
          sendMessage(chatId, "🎰 GACHA ROLL", `Dapat: ${gItem.name}\n\nRare: ${gItem.rarity}\n\nSelamat!`, KEYBOARD_SHOP);
        } else if (command === '/buy_vip') {
          up.coins -= 10000;
          up.vip = true;
          sendMessage(chatId, "👑 STATUS VIP", "BERHASIL!\n\nBonus XP & Koin\nKini Aktif!\n\nStatus: VVIP👑", KEYBOARD_SHOP);
        } else {
          up.coins -= price;
          up.inventory = [...up.inventory, itemName];
          sendMessage(chatId, "✅ PEMBELIAN", `Item : ${itemName}\nKoin : -${price}\n\nBerhasil beli!`, KEYBOARD_SHOP);
        }
      } else {
        sendMessage(chatId, "❌ GAGAL", `Koin Kurang!\nButuh: ${price}\n\nBerburu lagi!`, KEYBOARD_SHOP);
      }
    } else if (command === '/help') {
      const help = "Daftar Menu:\n\n👤 Profile : Status\n⚔️ Hunt    : Berburu\n🎒 Bag     : Item\n🛒 Shop    : Toko\n🏆 Top     : Peringkat";
      sendMessage(chatId, "❓ BANTUAN", help, KEYBOARD_MAIN);
    } else if (command === '/leaderboard') {
      const sorted = (Object.values(playersRef.current) as Player[]).sort((a, b) => b.level - a.level).slice(0, 5);
      const list = sorted.map((p, i) => `${i+1}. ${p.username} (Lv ${p.level})`).join('\n');
      sendMessage(chatId, "🏆 TOP PLAYERS", list || "Kosong", KEYBOARD_MAIN);
    } else {
      sendMessage(chatId, "❓ UNKNOWN", "Klik menu\ndi bawah!", KEYBOARD_MAIN);
    }

    setPlayers(prev => {
      const updated = { ...prev, [userId]: up };
      playersRef.current = updated;
      return updated;
    });
  };

  const pollUpdates = async () => {
    if (!token || isPolling) return;
    setIsPolling(true);
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          if (update.message && update.message.text) {
            addLog('in', update.message.text, update.message.from.first_name || "User");
            processCommand(update.message.chat.id, update.message.from.first_name || "Adventurer", update.message.text);
          }
          setOffset(update.update_id + 1);
        }
      }
    } catch (e) {
      addLog('sys', `Polling error: ${e}`);
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isBotStarted) {
      interval = setInterval(pollUpdates, 1000);
    }
    return () => clearInterval(interval);
  }, [isBotStarted, offset, token, isPolling]);

  if (!isBotStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-md w-full border-t-4 border-t-blue-500">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-blue-600/10 rounded-full mb-4">
              <i className="fa-brands fa-telegram text-blue-500 text-6xl animate-pulse"></i>
            </div>
            <h1 className="text-3xl font-black tracking-tight">MiMi RPG Bot</h1>
            <p className="text-slate-400 mt-2 font-medium tracking-wide text-xs uppercase">Telegram Bot Manager v2.7</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bot Token Key</label>
              <input 
                type="password" 
                placeholder="0000000000:AAHHH..."
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-white transition-all shadow-inner"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                if(token.includes(":")) {
                   setIsBotStarted(true);
                   addLog('sys', "Bot engine initialized.");
                } else {
                   alert("Token format salah!");
                }
              }}
              disabled={!token}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl shadow-blue-900/40"
            >
              <i className="fa-solid fa-play"></i> START SERVER
            </button>
            <p className="text-[9px] text-slate-600 text-center uppercase font-bold tracking-[0.2em] pt-2">Powered by oWo Server Engine</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <i className="fa-solid fa-ghost text-white text-base"></i>
          </div>
          <h2 className="text-xl font-black tracking-tight italic">MIMI <span className="text-blue-500">RPG</span></h2>
        </div>
        <nav className="flex-1 p-3 space-y-2 mt-4">
          <button onClick={() => setActiveTab('console')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'console' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-terminal text-sm"></i> Console
          </button>
          <button onClick={() => setActiveTab('players')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'players' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-user-shield text-sm"></i> Players
          </button>
          <button onClick={() => setActiveTab('database')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-box-archive text-sm"></i> Database
          </button>
        </nav>
        <div className="p-4 bg-slate-800/20 m-4 rounded-3xl border border-slate-800/60">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest">{isPolling ? 'Server Live' : 'Server Idle'}</span>
          </div>
          <button onClick={() => window.location.reload()} className="w-full text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black py-2.5 rounded-xl transition-all uppercase tracking-tighter border border-red-500/10">Terminate Engine</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">Live Event Logs</h3>
              <div className="flex gap-4">
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Database</p>
                    <p className="text-sm font-black text-blue-400">{Object.keys(players).length} Entitas</p>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-black/40 border border-slate-800 rounded-3xl p-6 font-mono text-[11px] overflow-y-auto space-y-3 scrollbar-hide backdrop-blur-sm">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <i className="fa-solid fa-tower-broadcast text-6xl mb-4"></i>
                  <p className="text-lg font-bold">MONITORING ACTIVE</p>
                </div>
              )}
              {logs.map(log => (
                <div key={log.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300 border-l-2 border-transparent hover:border-blue-500 pl-2">
                  <span className="text-slate-600 shrink-0">[{log.time.toLocaleTimeString()}]</span>
                  <span className={`shrink-0 font-black w-10 text-center rounded text-[10px] ${log.type === 'in' ? 'bg-green-500/10 text-green-500' : log.type === 'out' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {log.type === 'in' ? 'IN' : log.type === 'out' ? 'OUT' : 'SYS'}
                  </span>
                  <div className="flex-1">
                    <span className="text-slate-500 font-bold mr-2 italic">@{log.user}</span>
                    <span className="text-slate-200 break-words whitespace-pre-wrap">{log.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="p-8 overflow-y-auto">
             <h2 className="text-3xl font-black mb-8 tracking-tight">Active Users</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {(Object.values(players) as Player[]).map(p => (
                 <div key={p.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/40 transition-all hover:bg-slate-900 group">
                   <div className="flex justify-between items-center mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center font-black group-hover:bg-blue-600 transition-all shadow-lg text-sm text-white">
                          {p.username.charAt(0)}
                        </div>
                        <h4 className="font-black text-lg truncate w-32">{p.username}</h4>
                      </div>
                      <span className="bg-blue-600/10 text-blue-500 text-[10px] px-3 py-1 rounded-full font-black border border-blue-500/20">Lv {p.level}</span>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-xs bg-slate-800/30 p-2 rounded-xl"><span className="text-slate-500 font-bold uppercase tracking-tighter">Koin</span><span className="font-black text-amber-400">💰 {p.coins}</span></div>
                      <div className="flex justify-between text-xs bg-slate-800/30 p-2 rounded-xl"><span className="text-slate-500 font-bold uppercase tracking-tighter">Rank</span><span className="font-black text-blue-300">{p.rank}</span></div>
                      <div className="mt-4 pt-4 border-t border-slate-800">
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Inventory</p>
                        <div className="flex flex-wrap gap-1">
                          {p.inventory.slice(0, 5).map((item, idx) => (
                            <span key={idx} className="bg-slate-800 text-[9px] px-2 py-1 rounded-md text-slate-300 font-bold border border-slate-700">{item}</span>
                          ))}
                          {p.inventory.length > 5 && <span className="text-[9px] text-slate-500 font-bold px-1">+{p.inventory.length - 5} more</span>}
                          {p.inventory.length === 0 && <span className="text-[9px] text-slate-600 font-bold italic">No items</span>}
                        </div>
                      </div>
                   </div>
                 </div>
               ))}
               {Object.keys(players).length === 0 && (
                 <div className="col-span-full py-20 text-center opacity-30 text-xl font-black">NO PLAYERS REGISTERED</div>
               )}
             </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="p-8 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-3xl font-black mb-6 tracking-tight">System Storage</h2>
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-slate-500">MIMI_DB_EXPORT.JSON</span>
                    <button 
                      onClick={() => seedGodUser(GOD_ID)}
                      className="bg-amber-600/20 text-amber-500 border border-amber-600/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all"
                    >SEED VVIP USER</button>
                 </div>
                 <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(players));
                    alert("Database copied!");
                  }}
                  className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-black"
                 >COPY ALL</button>
              </div>
              <textarea 
                readOnly 
                value={JSON.stringify(players, null, 2)} 
                className="flex-1 bg-black/40 text-blue-400 font-mono text-[10px] p-6 rounded-3xl focus:outline-none resize-none border border-slate-800 scrollbar-hide shadow-inner"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

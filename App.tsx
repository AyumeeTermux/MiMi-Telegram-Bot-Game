
import React, { useState, useEffect, useRef } from 'react';
import { Player, GameMessage, Item, Monster, PlayerClass } from './types';
import { INITIAL_ITEMS, MONSTERS, VIP_CONFIG } from './constants';
import { createNewPlayer, getPlayerTotalStats, handleLevelUp, rollGacha, checkRandomEvent } from './gameLogic';

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

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
  const [logs, setLogs] = useState<{ id: string; type: 'in' | 'out' | 'sys'; text: string; user: string; time: Date }[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('mimi_players_db');
    if (saved) {
      try {
        setPlayers(JSON.parse(saved));
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
   * Enhanced wrapInBox with fixed-width alignment for a professional "Table" look
   */
  const wrapInBox = (title: string, content: string): string => {
    const BOX_WIDTH = 22; // Inner content space
    const borderTop = "═".repeat(BOX_WIDTH + 2);
    const separator = "═".repeat(BOX_WIDTH + 2);
    
    // Function to calculate visual length (handling some common emoji quirks in monospace)
    const getVisualLength = (str: string) => {
      // Very basic approximation: emojis often take 2 spaces in monospace
      // This is not perfect as different clients/fonts vary, but helps alignment.
      const emojiMatch = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\u200D|\uFE0F/g);
      return str.length + (emojiMatch ? emojiMatch.length : 0);
    };

    const padLine = (text: string) => {
      const len = getVisualLength(text);
      const padding = Math.max(0, BOX_WIDTH - len);
      return text + " ".repeat(padding);
    };

    const lines = content.split('\n');
    let boxed = `\`\`\`\n`;
    boxed += `╔${borderTop}╗\n`;
    boxed += `║ ${padLine(title.toUpperCase())} ║\n`;
    boxed += `╠${separator}╣\n`;
    
    lines.forEach(line => {
      // Split long lines or just pad them
      const text = line.trim();
      if (text === "") {
        boxed += `║ ${" ".repeat(BOX_WIDTH)} ║\n`;
      } else {
        boxed += `║ ${padLine(text)} ║\n`;
      }
    });
    
    boxed += `╚${borderTop}╝\n`;
    boxed += `\`\`\``;
    return boxed;
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
    let player = players[userId];
    const text = rawText.trim();

    // Map button text to internal commands
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

    const [command] = cmd.split(' ');

    if (command === '/start') {
      if (!player) {
        const newP = createNewPlayer(username, 'Warrior');
        setPlayers(prev => ({ ...prev, [userId]: newP }));
        sendMessage(chatId, "🎮 Welcome", "Selamat Datang di\nMiMi Games RPG!\n\nKarakter: Warrior\n\nKlik menu di bawah\nuntuk memulai!", KEYBOARD_MAIN);
      } else {
        sendMessage(chatId, "🏠 Main Menu", `Halo ${player.username}!\nLevel: ${player.level}\nCoins: ${player.coins}\n\nSiap berburu hari ini?`, KEYBOARD_MAIN);
      }
      return;
    }

    if (!player) {
      sendMessage(chatId, "⚠️ System", "Gunakan /start\nterlebih dahulu!", KEYBOARD_MAIN);
      return;
    }

    let up = { ...player };

    if (command === '/profile' || command === '/me') {
      const stats = getPlayerTotalStats(up);
      const content = `👤 User : ${up.username}\n🌟 Lvl  : ${up.level}\n✨ XP   : ${up.xp}/${up.level * 100}\n💰 Coin : ${up.coins}\n❤️ HP   : ${up.hp}/${stats.hp}\n⚔️ Dmg  : ${stats.damage}\n💥 Crit : ${stats.crit}%\n\n🛡️ Rank : ${up.rank}\n🌟 VIP  : ${up.vip ? 'Active' : 'No'}`;
      sendMessage(chatId, "📜 Profile", content, KEYBOARD_MAIN);
    } else if (command === '/hunt') {
      const availableMonsters = MONSTERS.filter(m => m.level <= up.level + 2);
      const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
      const stats = getPlayerTotalStats(up);
      const turnsToKill = Math.ceil(monster.hp / stats.damage);
      const totalDamageTaken = turnsToKill * monster.damage;
      
      if (up.hp <= totalDamageTaken) {
        up.hp = 10;
        sendMessage(chatId, "💀 Defeat", `Kalah vs ${monster.name}\nHP sisa: ${up.hp}\n\nIstirahat dulu\natau beli potion!`, KEYBOARD_MAIN);
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
        let result = `WIN vs ${monster.name}\n\n💰 +${coinGain} Coins\n✨ +${xpGain} XP\n❤️ HP: ${up.hp}`;
        const lvlMsg = handleLevelUp(up);
        if (lvlMsg) result += `\n\n🆙 LEVEL UP!`;
        const eventMsg = checkRandomEvent(up);
        if (eventMsg) result += `\n\n⚠️ EVENT TERJADI!`;
        sendMessage(chatId, "⚔️ Battle", result, KEYBOARD_MAIN);
      }
    } else if (command === '/shop') {
      sendMessage(chatId, "🛒 MiMi Shop", `Coins: ${up.coins}\n\nPilih item hebat\nuntuk memperkuat\ndirimu!`, KEYBOARD_SHOP);
    } else if (command === '/inv' || command === '/inventory') {
      const invList = up.inventory.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
      sendMessage(chatId, "🎒 Bag", invList || "Tas kosong...", KEYBOARD_MAIN);
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
          up.inventory.push(gItem.name);
          sendMessage(chatId, "🎰 Gacha", `Dapat item:\n${gItem.name}\n\nRarity: ${gItem.rarity}`, KEYBOARD_SHOP);
        } else if (command === '/buy_vip') {
          up.coins -= 10000;
          up.vip = true;
          sendMessage(chatId, "🌟 VIP", "BERHASIL!\nBonus XP & Coins\nkini aktif.", KEYBOARD_SHOP);
        } else {
          up.coins -= price;
          up.inventory.push(itemName);
          sendMessage(chatId, "✅ Success", `Beli ${itemName}\nberhasil!\n\nSisa koin: ${up.coins}`, KEYBOARD_SHOP);
        }
      } else {
        sendMessage(chatId, "❌ Gagal", `Coins kurang!\nButuh: ${price}`, KEYBOARD_SHOP);
      }
    } else if (command === '/help') {
      const help = "Bantuan Command:\n\n👤 Profile: Status\n⚔️ Hunt: Bertarung\n🎒 Bag: Item kamu\n🛒 Shop: Belanja\n🏆 Top: Peringkat\n\nMainkan setiap hari!";
      sendMessage(chatId, "❓ Info", help, KEYBOARD_MAIN);
    } else if (command === '/leaderboard') {
      const sorted = (Object.values(players) as Player[]).sort((a, b) => b.level - a.level).slice(0, 5);
      const list = sorted.map((p, i) => `${i+1}. ${p.username} (Lvl ${p.level})`).join('\n');
      sendMessage(chatId, "🏆 Top 5", list || "Kosong", KEYBOARD_MAIN);
    } else {
      sendMessage(chatId, "❓ Unknown", "Klik menu\ndi bawah ini!", KEYBOARD_MAIN);
    }

    setPlayers(prev => ({ ...prev, [userId]: up }));
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
  }, [isBotStarted, offset, token, isPolling, players]);

  if (!isBotStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-md w-full border-t-4 border-t-blue-500">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-blue-600/10 rounded-full mb-4">
              <i className="fa-brands fa-telegram text-blue-500 text-6xl animate-pulse"></i>
            </div>
            <h1 className="text-3xl font-black tracking-tight">MiMi RPG Bot</h1>
            <p className="text-slate-400 mt-2 font-medium">Text-Based RPG Server Dashboard</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Bot Token</label>
              <input 
                type="password" 
                placeholder="123456789:ABCDefgh..."
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-white transition-all"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                if(token.includes(":")) {
                   setIsBotStarted(true);
                   addLog('sys', "Bot engine initialized successfully.");
                } else {
                   alert("Format token tidak valid!");
                }
              }}
              disabled={!token}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl shadow-blue-900/40"
            >
              <i className="fa-solid fa-power-off"></i> START SERVER
            </button>
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center px-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">v2.5 Stable</span>
              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span> oWo Engine
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-gamepad text-white text-sm"></i>
          </div>
          <h2 className="text-xl font-black tracking-tight">MiMi RPG</h2>
        </div>
        <nav className="flex-1 p-3 space-y-2 mt-4">
          <button onClick={() => setActiveTab('console')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'console' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-terminal text-sm"></i> Console
          </button>
          <button onClick={() => setActiveTab('players')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'players' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-users-viewfinder text-sm"></i> Players
          </button>
          <button onClick={() => setActiveTab('database')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-database text-sm"></i> Database
          </button>
        </nav>
        <div className="p-4 bg-slate-800/30 m-4 rounded-3xl border border-slate-800/60">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest">{isPolling ? 'Server Online' : 'Server Down'}</span>
          </div>
          <button onClick={() => window.location.reload()} className="w-full text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black py-2.5 rounded-xl transition-all uppercase tracking-tighter border border-red-500/20">Stop Engine</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black">Live Logs</h3>
                <span className="bg-slate-800 text-[10px] px-2 py-0.5 rounded font-bold text-slate-400">WS-STREAM</span>
              </div>
              <div className="flex gap-4">
                 <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Sessions</p>
                    <p className="text-sm font-black text-blue-400">{Object.keys(players).length} Users</p>
                 </div>
              </div>
            </div>
            <div className="flex-1 bg-black/40 border border-slate-800 rounded-3xl p-6 font-mono text-[11px] overflow-y-auto space-y-3 scrollbar-hide backdrop-blur-sm">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <i className="fa-solid fa-satellite-dish text-4xl mb-4"></i>
                  <p className="text-sm">Menunggu aktivitas bot...</p>
                </div>
              )}
              {logs.map(log => (
                <div key={log.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300">
                  <span className="text-slate-600 shrink-0 select-none">[{log.time.toLocaleTimeString()}]</span>
                  <span className={`shrink-0 font-black w-10 text-center rounded px-1 ${log.type === 'in' ? 'bg-green-500/10 text-green-500' : log.type === 'out' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {log.type === 'in' ? 'RECV' : log.type === 'out' ? 'SEND' : 'SYST'}
                  </span>
                  <div className="flex-1">
                    <span className="text-slate-500 font-bold mr-2">@{log.user}:</span>
                    <span className="text-slate-200 break-words whitespace-pre-wrap">{log.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="p-8 overflow-y-auto">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black tracking-tight">Active Users</h2>
               <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-2xl flex items-center gap-3">
                  <i className="fa-solid fa-database text-blue-500"></i>
                  <span className="font-bold text-blue-400">{Object.keys(players).length} Total</span>
               </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {(Object.values(players) as Player[]).map(p => (
                 <div key={p.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/40 transition-all hover:bg-slate-900 group">
                   <div className="flex justify-between items-center mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                          {p.username.charAt(0)}
                        </div>
                        <h4 className="font-black text-lg">{p.username}</h4>
                      </div>
                      <span className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter border border-blue-500/20">Lv {p.level}</span>
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Coins</span>
                        <span className="font-black text-sm text-amber-400">💰 {p.coins}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Rank</span>
                        <span className="font-black text-xs text-blue-300">{p.rank}</span>
                      </div>
                      <div className="bg-slate-800/30 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Equipment</p>
                        <p className="font-bold text-xs truncate text-slate-300">{p.equippedWeapon || 'Basic Hands'}</p>
                      </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="p-8 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-3xl font-black mb-6 tracking-tight">System Database</h2>
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 overflow-hidden flex flex-col backdrop-blur-sm">
              <div className="mb-4 flex justify-between items-center">
                 <p className="text-sm font-bold text-slate-500">JSON PLAYER OBJECTS</p>
                 <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(players));
                    alert("Data pemain disalin!");
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-900/40"
                 >
                   COPY DATA
                 </button>
              </div>
              <textarea 
                readOnly 
                value={JSON.stringify(players, null, 2)} 
                className="flex-1 bg-black/40 text-blue-400 font-mono text-[10px] p-6 rounded-3xl focus:outline-none resize-none border border-slate-800 scrollbar-hide"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

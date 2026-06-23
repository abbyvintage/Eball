/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const STORE_FILE = path.join(process.cwd(), "data-store.json");

// Default State for E PLAYERS HUB Tanzania Gaming Platform
const DEFAULT_STORE = {
  users: {
    // Demo User
    "Dario Pro": {
      username: "Dario Pro",
      phone: "+255712345678",
      points: 750,
      moneyBalance: 3250, // 5000 * 0.65 derived
      teamName: "Dario Pro",
      password: "password123",
      hasConverted: true,
      language: "en",
      createdAt: new Date().toISOString(),
      stats: {
        wins: 12,
        losses: 4,
        pointsEarned: 7800,
        tournamentsPlayed: 5
      }
    },
    "Ngassa FC": {
      username: "Ngassa FC",
      phone: "+255685110220",
      points: 1200,
      moneyBalance: 5000,
      teamName: "Yanga Elite",
      password: "password123",
      hasConverted: true,
      language: "sw",
      createdAt: new Date().toISOString(),
      stats: {
        wins: 18,
        losses: 2,
        pointsEarned: 11000,
        tournamentsPlayed: 7
      }
    },
    "Simba Ultimate": {
      username: "Simba Ultimate",
      phone: "+255768991100",
      points: 900,
      moneyBalance: 1200,
      teamName: "Simba Kings",
      password: "password123",
      hasConverted: false,
      language: "sw",
      createdAt: new Date().toISOString(),
      stats: {
        wins: 9,
        losses: 6,
        pointsEarned: 5400,
        tournamentsPlayed: 4
      }
    }
  },
  tournaments: [],
  matches: [],
  transactions: [
    {
      id: "tx-demo-1",
      username: "Dario Pro",
      type: "deposit",
      amountPoints: 500,
      amountTsh: 325,
      transactionId: "PP260623AA99",
      status: "approved",
      phone: "+255712345678",
      timestamp: new Date().toISOString()
    }
  ],
  smsLogs: [
    {
      id: "sms-demo-1",
      phone: "+255712345678",
      text: "Karibu E PLAYERS HUB! Umepokea Welcome Bonus ya pointi 400 bure.",
      timestamp: new Date().toISOString(),
      status: "success"
    }
  ],
  chats: [
    {
      id: "chat-1",
      username: "Dario Pro",
      message: "Hey guys! Kila mtu ajiandae, mashindano yanaanza sasa hivi!",
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      tournamentId: "global"
    },
    {
      id: "chat-2",
      username: "Ngassa FC",
      message: "Nipo fiti kabisa na timu yangu ya Yanga Elite. Efootball tunaanza lini?",
      timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
      tournamentId: "global"
    }
  ],
  inbox: [
    {
      id: "sys-1",
      sender: "System",
      receiver: "Dario Pro",
      message: "Karibu E PLAYERS HUB! Umejidhaminia pointi 400 bure kwa kujisajili.",
      timestamp: new Date().toISOString()
    }
  ],
  replays: [
    {
      id: "rep-1",
      matchId: "match-1",
      player1: "Dario Pro",
      player2: "Ngassa FC",
      score1: 2,
      score2: 1,
      createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      events: [
        { time: 12, event: "pass", desc: "Dario Pro anamiliki mpira kwa pasi fupi katikati ya uwanja." },
        { time: 24, event: "goal", desc: "GOOOAL! Dario Pro anapiga shuti kali la mbali, 1 - 0!" },
        { time: 45, event: "pass", desc: "Kipindi cha kwanza kinaisha huku Ngassa FC akishambulia." },
        { time: 66, event: "goal", desc: "GOOOAL! Ngassa FC anasawazisha kwa goli safi la kichwa, 1 - 1!" },
        { time: 88, event: "goal", desc: "GOOOAL YA USHINDI! Dario Pro anafunga goli safi dakika za jioni, 2 - 1!" },
        { time: 90, event: "fulltime", desc: "Mechi imekwisha! Ushindi mnono kwa Dario Pro!" }
      ]
    }
  ],
  mutedUsers: [] as string[],
  systemConfig: {
    smsEnabled: true,
    minWithdrawalTsh: 5000,
    conversionRate: 0.65, // 1 Point = 0.65 TSH (Configurable)
    wakalaMpesaNumber: "0768 991 100",
    wakalaTigopesaNumber: "0672 550 440",
    wakalaAirtelNumber: "0685 110 220",
    pointPackages: [
      { id: "pkg-1", name: "Bronze Starter", points: 500, priceTsh: 325 },
      { id: "pkg-2", name: "Silver Contender", points: 1500, priceTsh: 975 },
      { id: "pkg-3", name: "Gold Champions", points: 5000, priceTsh: 3250 }
    ]
  },
  devDraft: null // Current live draft code in Sandbox
};

// State Helper Functions
function getStore() {
  if (!fs.existsSync(STORE_FILE)) {
    saveStore(DEFAULT_STORE);
    return DEFAULT_STORE;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    
    // Safety fallback properties to maintain seamless compatibility and no crashes
    return {
      users: {},
      tournaments: [],
      matches: [],
      transactions: [],
      smsLogs: [],
      chats: [],
      inbox: [],
      replays: [],
      mutedUsers: [],
      ...parsed,
      systemConfig: {
        ...DEFAULT_STORE.systemConfig,
        ...(parsed.systemConfig || {})
      }
    };
  } catch (err) {
    console.error("Failed to parse data store, resorting to default", err);
    return DEFAULT_STORE;
  }
}

function saveStore(data: any) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save data store", err);
  }
}

// NextSMS Notification Sender
async function sendNextSms(phone: string, text: string) {
  const store = getStore();
  if (!store.systemConfig.smsEnabled) {
    console.log(`[SMS-MOCKED] SMS is disabled. Ref: ${phone} -> "${text}"`);
    return false;
  }

  // NextSMS Details
  const username = "mwanyagalaabdul.02a";
  const password = "abc123@#$";
  // Clean phone to numeric 255 format (e.g. +255712... -> 255712...)
  let cleanPhone = phone.replace(/\+/g, "").trim();
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "255" + cleanPhone.substring(1);
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    const response = await fetch("https://messaging-service.co.tz/api/v1/sms/single", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        from: "NEXTSMS",
        to: cleanPhone,
        text: text
      })
    });

    const isSuccess = response.status === 200 || response.ok;
    const bodyText = await response.text();
    console.log(`[SMS-NEXTSMS] Sent to ${cleanPhone}. Status: ${response.status}`, bodyText);

    store.smsLogs.unshift({
      id: "sms-" + Math.random().toString(36).substring(2, 9),
      phone,
      text,
      timestamp: new Date().toISOString(),
      status: isSuccess ? "success" : "failed"
    });
    saveStore(store);
    return isSuccess;
  } catch (err) {
    console.error("[SMS-NEXTSMS] Error communicating with NextSMS API:", err);
    store.smsLogs.unshift({
      id: "sms-" + Math.random().toString(36).substring(2, 9),
      phone,
      text,
      timestamp: new Date().toISOString(),
      status: "failed"
    });
    saveStore(store);
    return false;
  }
}

// Middleware setup
app.use(express.json({ limit: "20mb" }));

// --- API ENDPOINTS ---

// Check session / get configuration
app.get("/api/system/status", (req: Request, res: Response) => {
  const store = getStore();
  res.json({
    config: store.systemConfig,
    smsLogs: store.smsLogs,
    tournamentsCount: store.tournaments.length
  });
});

// Update System Settings (Admin only)
app.post("/api/system/settings", (req: Request, res: Response) => {
  const { minWithdrawalTsh, smsEnabled, wakalaMpesaNumber, wakalaTigopesaNumber, wakalaAirtelNumber } = req.body;
  const store = getStore();

  if (minWithdrawalTsh !== undefined) store.systemConfig.minWithdrawalTsh = Number(minWithdrawalTsh);
  if (smsEnabled !== undefined) store.systemConfig.smsEnabled = Boolean(smsEnabled);
  if (wakalaMpesaNumber !== undefined) store.systemConfig.wakalaMpesaNumber = String(wakalaMpesaNumber);
  if (wakalaTigopesaNumber !== undefined) store.systemConfig.wakalaTigopesaNumber = String(wakalaTigopesaNumber);
  if (wakalaAirtelNumber !== undefined) store.systemConfig.wakalaAirtelNumber = String(wakalaAirtelNumber);

  saveStore(store);
  res.json({ success: true, config: store.systemConfig });
});

// User Registration
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, phone, teamName, language, password } = req.body;
  
  if (!username || !phone || !teamName || !password) {
    return res.status(400).json({ error: "Tafadhali jaza taarifa zote zilizokosekana (Please fill all info, including password)" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password lazima iwe na herufi kuanzia 6 (Password must be at least 6 characters)" });
  }

  // Check unique phone Tanzanian format
  if (!phone.startsWith("+255")) {
    return res.status(400).json({ error: "Namba ya simu lazima ianze na +255 (Phone number must start with +255)" });
  }

  const store = getStore();
  
  // Check unique phone duplicate
  const existingUserForPhone = Object.values(store.users).find((u: any) => {
    const cleanA = u.phone?.replace(/\+/g, "").replace(/\s+/g, "");
    const cleanB = phone?.replace(/\+/g, "").replace(/\s+/g, "");
    return cleanA === cleanB;
  });
  if (existingUserForPhone) {
    return res.status(400).json({ error: "change ur phone , this phone number has been used" });
  }

  if (store.users[username]) {
    return res.status(400).json({ error: "Username hii tayari inatumika (Username already taken)" });
  }

  // Create new user with 400 points signup bonus! Decoupled and holds stats
  const newUser = {
    username,
    phone,
    points: 400, // Welcome Bonus points bure
    moneyBalance: 0,
    teamName,
    password, // Store password
    hasConverted: false,
    language: language || "en",
    createdAt: new Date().toISOString(),
    stats: {
      wins: 0,
      losses: 0,
      pointsEarned: 400,
      tournamentsPlayed: 0
    }
  };

  store.users[username] = newUser;
  
  // Register initial transaction for welcome bonus points
  if (!store.transactions) store.transactions = [];
  store.transactions.unshift({
    id: "tx-welcome-" + Math.random().toString(36).substring(2, 9),
    username,
    type: "bonus" as const,
    amountPoints: 400,
    amountTsh: 0,
    transactionId: "WELCOME-BONUS",
    status: "approved" as const,
    phone,
    timestamp: new Date().toISOString()
  });
  
  // Send welcome automated mail directly to inbox
  if (!store.inbox) store.inbox = [];
  store.inbox.push({
    id: "sys-" + Math.random().toString(36).substring(2, 9),
    sender: "System",
    receiver: username,
    message: "Karibu kwenye E PLAYERS HUB! Umepokea salio la kuanzia la pointi 400 bure. Timu yako: " + teamName,
    timestamp: new Date().toISOString()
  });

  saveStore(store);

  // Send sms welcome if sms is active
  await sendNextSms(phone, `Karibu E PLAYERS HUB! Umefanikiwa kusajiliwa. Timu yako: ${teamName}. Zawadi ya pointi 400 bure imeongezwa kwenye akaunti yako.`);

  res.json({ success: true, user: newUser });
});

// Forgot Password - Step 1: Request Code
app.post("/api/auth/forgot-password/request", async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Namba ya simu inahitajika (Phone number is required)" });
  }

  const store = getStore();
  const user = Object.values(store.users).find(
    (u: any) => u.phone === phone || u.phone?.replace(/\s+/g, "") === phone.replace(/\s+/g, "")
  ) as any;

  if (!user) {
    return res.status(400).json({ error: "the phone number is out of our server" });
  }

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  if (!store.resetCodes) store.resetCodes = {};
  store.resetCodes[phone] = code;
  saveStore(store);

  // Send sms logs and sms
  await sendNextSms(phone, `E PLAYERS HUB: Code yako ya kurejesha password ni ${code}. Ingiza code hii kuweka password mpya.`);

  res.json({ success: true, message: "Code imetumwa kwenye namba yako ya simu", code });
});

// Forgot Password - Step 2: Verify Code
app.post("/api/auth/forgot-password/verify", (req: Request, res: Response) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: "Namba ya simu na code vinahitajika" });
  }

  const store = getStore();
  const correctCode = store.resetCodes?.[phone];
  if (!correctCode || correctCode !== code.trim()) {
    return res.status(400).json({ error: "Code ya uhakiki si sahihi au imeisha muda" });
  }

  res.json({ success: true, message: "Uhakiki ulikamilika kikamilifu" });
});

// Forgot Password - Step 3: Reset Password
app.post("/api/auth/forgot-password/reset", (req: Request, res: Response) => {
  const { phone, code, newPassword } = req.body;
  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: "Taarifa zote zinahitajika" });
  }

  const store = getStore();
  const correctCode = store.resetCodes?.[phone];
  if (!correctCode || correctCode !== code.trim()) {
    return res.status(400).json({ error: "Code ya uhakiki si sahihi kabisa au imeisha muda" });
  }

  const user = Object.values(store.users).find(
    (u: any) => u.phone === phone || u.phone?.replace(/\s+/g, "") === phone.replace(/\s+/g, "")
  ) as any;

  if (!user) {
    return res.status(400).json({ error: "Mtumiaji hakupatikana" });
  }

  user.password = newPassword;
  delete store.resetCodes[phone];
  saveStore(store);

  res.json({ success: true, message: "Password mpya imewekwa kikamilifu!" });
});

// User Login (Normal users or Super Admin check)
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Tafadhali jaza username na password" });
  }

  // Check Super Admin with lowercase/uppercase protection
  const cleanUsername = username.trim().toLowerCase();
  if ((cleanUsername === "abby vintage" || cleanUsername === "abbyvintage" || cleanUsername === "abby_vintage" || cleanUsername === "admin") && password === "abc123@#$") {
    return res.json({
      success: true,
      isAdmin: true,
      user: {
        username: "Abby vintage",
        isAdmin: true,
        points: 99999,
        moneyBalance: 99999,
        hasConverted: true,
        language: "sw"
      }
    });
  }

  const store = getStore();
  const user = store.users[username];
  if (!user) {
    return res.status(401).json({ error: "Mtumiaji hajapatikana. Hakikisha umeandika kwa usahihi. (User not found.)" });
  }

  // If password exists, check it
  if (user.password && user.password !== password) {
    return res.status(401).json({ error: "Nenosiri si sahihi (Incorrect password)" });
  }

  res.json({ success: true, user });
});

// Admin Impersonation / Direct Login to user accounts without password
app.post("/api/auth/impersonate", (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const store = getStore();
  const user = store.users[username];
  if (!user) {
    return res.status(404).json({ error: "Mtumiaji hajapatikana" });
  }

  res.json({ success: true, user });
});

// Fetch Single User details
app.get("/api/users/:username", (req: Request, res: Response) => {
  const store = getStore();
  const user = store.users[req.params.username];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

// Fetch user chronological transactions / log
app.get("/api/users/:username/transactions", (req: Request, res: Response) => {
  const { username } = req.params;
  const store = getStore();
  const list = store.transactions
    .filter(t => t.username === username)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // newest first
  res.json(list);
});

// Convert Points to Money Balance (TSH)
app.post("/api/wallet/convert", (req: Request, res: Response) => {
  const { username, pointsToConvert } = req.body;
  if (!username || !pointsToConvert) {
    return res.status(400).json({ error: "Missing arguments" });
  }

  const store = getStore();
  const user = store.users[username];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const pts = Number(pointsToConvert);
  if (isNaN(pts) || pts <= 0 || user.points < pts) {
    return res.status(400).json({ error: "Pointi hazitoshi (Insufficient points)" });
  }

  // secret calculation: 1 Point = 0.65 TSH
  const cashAmount = pts * store.systemConfig.conversionRate;
  
  user.points -= pts;
  user.moneyBalance += cashAmount;
  user.hasConverted = true; // Shows conditional UI for balance/withdrawals

  saveStore(store);
  res.json({ success: true, user });
});

// Deposit Point Request (Manual Deposit with Lipa na Wakala, User inserts transaction ID)
app.post("/api/wallet/deposit", async (req: Request, res: Response) => {
  const { username, transactionId, amountPoints, phone } = req.body;
  if (!username || !transactionId || !amountPoints) {
    return res.status(400).json({ error: "Tafadhali weka Transaction ID pamoja na points" });
  }

  const store = getStore();
  const user = store.users[username];
  if (!user) return res.status(404).json({ error: "User not found" });

  const points = Number(amountPoints);
  const tshEquivalent = points * store.systemConfig.conversionRate;

  // check duplicate transaction ID
  const duplicate = store.transactions.find(t => t.transactionId.toUpperCase() === transactionId.toUpperCase());
  if (duplicate) {
    return res.status(400).json({ error: "Kumbukumbu ya Transaction ID hii tayari ipo kwenye mfumo. (Transaction ID already claimed)" });
  }

  const newTx = {
    id: "tx-" + Math.random().toString(36).substring(2, 9),
    username,
    type: "deposit" as const,
    amountPoints: points,
    amountTsh: tshEquivalent,
    transactionId: transactionId.toUpperCase(),
    status: "pending" as const,
    phone: phone || user.phone,
    timestamp: new Date().toISOString()
  };

  store.transactions.unshift(newTx);
  saveStore(store);

  // Notify Admin or SMS notify
  await sendNextSms(user.phone, `Ombi la kuongeza Pointi ${points} kupitia Transaction ID: ${transactionId} limepokelewa. Mhakiki ataangalia na kuongeza salio lako mara moja.`);

  res.json({ success: true, transaction: newTx });
});

// Manual Withdrawal request
app.post("/api/wallet/withdraw", async (req: Request, res: Response) => {
  const { username, amountTsh, phone } = req.body;
  if (!username || !amountTsh || !phone) {
    return res.status(400).json({ error: "Jaza kiasi cha kutoa na namba ya kupokelea pesa" });
  }

  const store = getStore();
  const user = store.users[username];
  if (!user) return res.status(404).json({ error: "User not found" });

  const amt = Number(amountTsh);
  if (amt < store.systemConfig.minWithdrawalTsh) {
    return res.status(400).json({ error: `Kiwango cha chini cha kutoa ni TSH ${store.systemConfig.minWithdrawalTsh}` });
  }

  if (user.moneyBalance < amt) {
    return res.status(400).json({ error: "Kiwango cha Salio Hakitoshi (Insufficient money balance)" });
  }

  const ptsDeducted = Math.round(amt / store.systemConfig.conversionRate);

  const newTx = {
    id: "tx-" + Math.random().toString(36).substring(2, 9),
    username,
    type: "withdraw" as const,
    amountPoints: ptsDeducted,
    amountTsh: amt,
    transactionId: "WDR-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    status: "pending" as const,
    phone,
    timestamp: new Date().toISOString()
  };

  // Lock money balance on server pending side
  user.moneyBalance -= amt;

  store.transactions.unshift(newTx);
  saveStore(store);

  await sendNextSms(phone, `Ombi lako la kutoa TSH ${amt} kwenda namba ${phone} limepokelewa na limewekwa 'Pending'. Subiri malipo kutoka kwa Wakala.`);

  res.json({ success: true, user, transaction: newTx });
});

// Admin Approve Deposit Transaction ID (Manual Verification)
app.post("/api/admin/transactions/:id/approve", async (req: Request, res: Response) => {
  const { id } = req.params;
  const store = getStore();
  const tx = store.transactions.find(t => t.id === id);

  if (!tx) {
    return res.status(404).json({ error: "Moja ya muamala haukupatikana" });
  }
  if (tx.status !== "pending") {
    return res.status(400).json({ error: "Muamala ulishashughulikiwa tayari" });
  }

  tx.status = "approved";

  if (tx.type === "deposit") {
    const user = store.users[tx.username];
    if (user) {
      user.points += tx.amountPoints;
      saveStore(store);
      await sendNextSms(user.phone, `Uthibitisho: Ombi lako la kuongeza Pointi ${tx.amountPoints} (Transaction ID: ${tx.transactionId}) limekubaliwa! Salio lako jipya ni pointi ${user.points}. Shukrani!`);
    }
  } else if (tx.type === "withdraw") {
    // Already deducted during request, so keep it approved
    saveStore(store);
    const user = store.users[tx.username];
    if (user) {
      await sendNextSms(tx.phone, `Uthibitisho: Wakala amekutumia TSH ${tx.amountTsh} kwenda namba yako ${tx.phone}. Ombi la kutoa pesa limekamilika!`);
    }
  }

  res.json({ success: true, transaction: tx });
});

// Admin Reject/Reject Withdrawal or Deposit
app.post("/api/admin/transactions/:id/reject", async (req: Request, res: Response) => {
  const { id } = req.params;
  const store = getStore();
  const tx = store.transactions.find(t => t.id === id);

  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  if (tx.status !== "pending") return res.status(400).json({ error: "Already processed" });

  tx.status = "rejected";

  if (tx.type === "withdraw") {
    // Return money balance to user
    const user = store.users[tx.username];
    if (user) {
      user.moneyBalance += tx.amountTsh;
      saveStore(store);
      await sendNextSms(tx.phone, `Ujumbe: Ombi lako la kutoa TSH ${tx.amountTsh} limekataliwa na kurejeshwa kwenye Salio lako la Pesa. Tafadhali wasiliana na super admin.`);
    }
  } else {
    saveStore(store);
    const user = store.users[tx.username];
    if (user) {
      await sendNextSms(user.phone, `Ujumbe: Ombi lako la Pointi ${tx.amountPoints} (TxID: ${tx.transactionId}) limekataliwa. Hakikisha uliandika Transaction ID sahihi.`);
    }
  }

  res.json({ success: true, transaction: tx });
});

// Fetch all transactions (Admin feed)
app.get("/api/admin/transactions", (req: Request, res: Response) => {
  const store = getStore();
  res.json(store.transactions);
});

// --- TOURNAMENTS & MATCHES ---

// Fetch tournaments
app.get("/api/tournaments", (req: Request, res: Response) => {
  const store = getStore();
  res.json(store.tournaments);
});

// Create Tournament (with uploaded Image Base64)
app.post("/api/tournaments", (req: Request, res: Response) => {
  const { name, prizePool, timerSeconds, capacity, imageUrl } = req.body;
  if (!name || !prizePool) {
    return res.status(400).json({ error: "Missing tournament details" });
  }

  const store = getStore();
  const newT = {
    id: "tn-" + Math.random().toString(36).substring(2, 9),
    name,
    prizePool: Number(prizePool),
    timerSeconds: Number(timerSeconds || 300),
    capacity: Number(capacity || 16),
    joinedUsers: [],
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=60",
    active: true,
    createdAt: new Date().toISOString()
  };

  store.tournaments.unshift(newT);
  saveStore(store);
  res.json({ success: true, tournament: newT });
});

// Helper to complete match, record a simulation event log for replays, and update stats instantly
function finishMatchAndSaveStats(store: any, match: any, score1: number, score2: number, winner: string | null) {
  match.score1 = score1;
  match.score2 = score2;
  match.winner = winner || (score1 > score2 ? match.player1 : (score2 > score1 ? match.player2 : "TIE"));
  match.status = "completed";

  // Create simulated match event timeline for the replay system
  const events = [
    { time: 0, event: "kickoff", desc: `Kipenga cha kuanza kimepulizwa! Mechi kali inaandaliwa kati ya ${match.player1} na ${match.player2}.` },
    { time: 14, event: "pass", desc: `${match.player1} anaanzisha shambulizi la haraka akigawa pasi nzuri wingi ya kulia.` },
    { time: 32, event: "save", desc: `Kipa wa ${match.player2} anafanya kazi ya ziada na kuokoa shuti kali la kichwa!` },
    { time: 45, event: "halftime", desc: `Mapumziko! Timu zinaenda kupanga mikakati upya. Matokeo kwa sasa ni ${score1} - ${score2}.` },
    { time: 65, event: "pass", desc: `${match.player2} anajibizana kwa kumiliki dimba la katikati na kutoa pasi kali za visigino.` },
    { time: 82, event: "shot", desc: "Shuti linalenga goli lakini linagonga mtambaa panya wa goli!" },
    { time: 90, event: "fulltime", desc: `Kipenga cha mwisho kinapulizwa! Mechi imekamilika rasmi. Matokeo ya mwisho: ${score1} - ${score2}. Mshindi: ${match.winner || 'TIE'}.` }
  ];

  if (score1 > 0) {
    events.splice(3, 0, { time: 25, event: "goal", desc: `GOOOAL ya kuongoza! ${match.player1} anatikisa nyavu kwa shuti kali kufuatia uzembe wa mabeki!` });
  }
  if (score2 > 0) {
    events.splice(events.length - 2, 0, { time: 74, event: "goal", desc: `GOOOAL ya kusawazisha! ${match.player2} anashangaza mashabiki kwa kupata goli safi.` });
  }

  // Save replay file
  if (!store.replays) store.replays = [];
  store.replays.push({
    id: "rep-" + Math.random().toString(36).substring(2, 9),
    matchId: match.id,
    player1: match.player1,
    player2: match.player2,
    score1: score1,
    score2: score2,
    createdAt: new Date().toISOString(),
    events
  });

  // Calculate stats
  const u1 = store.users[match.player1];
  const u2 = store.users[match.player2];

  if (u1) {
    if (!u1.stats) u1.stats = { wins: 0, losses: 0, pointsEarned: 0, tournamentsPlayed: 0 };
    u1.stats.tournamentsPlayed = (u1.stats.tournamentsPlayed || 0) + 1;
    if (match.winner === match.player1) {
      u1.stats.wins = (u1.stats.wins || 0) + 1;
      u1.stats.pointsEarned = (u1.stats.pointsEarned || 0) + 200;
      u1.points += 200; // award win points
    } else if (match.winner === match.player2) {
      u1.stats.losses = (u1.stats.losses || 0) + 1;
    }
  }

  if (u2) {
    if (!u2.stats) u2.stats = { wins: 0, losses: 0, pointsEarned: 0, tournamentsPlayed: 0 };
    u2.stats.tournamentsPlayed = (u2.stats.tournamentsPlayed || 0) + 1;
    if (match.winner === match.player2) {
      u2.stats.wins = (u2.stats.wins || 0) + 1;
      u2.stats.pointsEarned = (u2.stats.pointsEarned || 0) + 200;
      u2.points += 200;
    } else if (match.winner === match.player1) {
      u2.stats.losses = (u2.stats.losses || 0) + 1;
    }
  }
}

// Join Tournament with custom Entry Fee deduction and user statistics incrementing
app.post("/api/tournaments/:id/join", (req: Request, res: Response) => {
  const { id } = req.params;
  const { username } = req.body;

  const store = getStore();
  const tourn = store.tournaments.find(t => t.id === id);
  if (!tourn) return res.status(404).json({ error: "Tournament not found" });

  const user = store.users[username];
  if (!user) return res.status(404).json({ error: "User not found" });

  if (tourn.joinedUsers.includes(username)) {
    return res.status(400).json({ error: "Tayari umejiunga na mashindano haya! (Already joined)" });
  }

  if (tourn.joinedUsers.length >= tourn.capacity) {
    return res.status(400).json({ error: "Mashindano yamejaa (Tournament capacity reached)" });
  }

  // Deduct tournament Entry Fee
  const entryFee = tourn.entryFee || 0;
  const isBypassUser = user.isAdmin || user.username === "Admin";
  if (entryFee > 0 && !isBypassUser) {
    if (user.points < entryFee) {
      return res.status(400).json({ error: `Pointi zako hazitoshi kujiunga. Ada ya kujiunga ni pointi ${entryFee} na una pointi ${user.points} pekee.` });
    }
    user.points -= entryFee;
  }

  tourn.joinedUsers.push(username);

  // Update user tournament statistics
  if (!user.stats) {
    user.stats = { wins: 0, losses: 0, pointsEarned: 0, tournamentsPlayed: 0 };
  }
  user.stats.tournamentsPlayed = (user.stats.tournamentsPlayed || 0) + 1;

  // Auto-generate fresh fixtures matches once users join or just dynamically on matching click!
  if (tourn.joinedUsers.length % 2 === 1) {
    const oppNames = ["Ngassa FC", "Simba Ultimate", "Yanga Boyz", "Samata Pro", "Luton TZ", "Bocco FC"];
    const randomOpp = oppNames[Math.floor(Math.random() * oppNames.length)];
    
    const newMatch = {
      id: "match-" + Math.random().toString(36).substring(2, 9),
      tournamentId: tourn.id,
      player1: username,
      player2: randomOpp,
      score1: 0,
      score2: 0,
      winner: null,
      status: "pending" as const,
      createdAt: new Date().toISOString()
    };
    if (!store.matches) store.matches = [];
    store.matches.unshift(newMatch);
  }

  saveStore(store);
  res.json({ success: true, tournament: tourn, user });
});

// Matches list
app.get("/api/matches", (req: Request, res: Response) => {
  const store = getStore();
  res.json(store.matches || []);
});

// Submit/Set manual scores
app.post("/api/matches/:id/score", (req: Request, res: Response) => {
  const { id } = req.params;
  const { score1, score2, winner } = req.body;

  const store = getStore();
  const match = store.matches.find(m => m.id === id);
  if (!match) return res.status(404).json({ error: "Match fixture not found" });

  finishMatchAndSaveStats(store, match, Number(score1), Number(score2), winner);

  saveStore(store);
  res.json({ success: true, match });
});


// --- REAL-TIME ACTIVE CHATS ENDPOINTS ---

// Fetch chat messages
app.get("/api/chats", (req: Request, res: Response) => {
  const { tournamentId } = req.query;
  const store = getStore();
  let msgs = store.chats || [];
  if (tournamentId) {
    msgs = msgs.filter((c: any) => c.tournamentId === tournamentId);
  }
  res.json(msgs);
});

// Post a new chat item
app.post("/api/chats", (req: Request, res: Response) => {
  const { username, message, tournamentId } = req.body;
  if (!username || !message) {
    return res.status(400).json({ error: "Missing sender or text" });
  }

  const store = getStore();

  // Check if sender is muted by Admin
  if (store.mutedUsers && store.mutedUsers.includes(username)) {
    return res.status(403).json({ error: "Umezuiwa kutuma ujumbe (You are muted by Super Admin!)" });
  }

  const newMsg = {
    id: "chat-" + Math.random().toString(36).substring(2, 9),
    username,
    message,
    tournamentId: tournamentId || "global",
    timestamp: new Date().toISOString()
  };

  if (!store.chats) store.chats = [];
  store.chats.push(newMsg);
  saveStore(store);

  res.json({ success: true, chat: newMsg });
});

// Delete message (Admin moderation tool)
app.delete("/api/chats/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const store = getStore();
  
  if (!store.chats) store.chats = [];
  store.chats = store.chats.filter((c: any) => c.id !== id);
  saveStore(store);

  res.json({ success: true });
});

// Mute/Unmute user (Admin configuration)
app.post("/api/users/:username/mute", (req: Request, res: Response) => {
  const { username } = req.params;
  const { mute } = req.body; // boolean
  const store = getStore();

  if (!store.mutedUsers) store.mutedUsers = [];

  if (mute) {
    if (!store.mutedUsers.includes(username)) {
      store.mutedUsers.push(username);
    }
  } else {
    store.mutedUsers = store.mutedUsers.filter((u: string) => u !== username);
  }

  saveStore(store);
  res.json({ success: true, mutedUsers: store.mutedUsers });
});


// --- DIRECT INBOX / CHATTING ENDPOINTS ---

// Fetch incoming/outgoing direct private messages
app.get("/api/inbox/:username", (req: Request, res: Response) => {
  const { username } = req.params;
  const store = getStore();
  
  const inboxMsgs = (store.inbox || []).filter((i: any) => 
    i.receiver === username || i.sender === username
  );
  res.json(inboxMsgs);
});

// Send private inbox Direct Message to another user
app.post("/api/inbox", (req: Request, res: Response) => {
  const { sender, receiver, message } = req.body;
  if (!sender || !receiver || !message) {
    return res.status(400).json({ error: "Parameta zote zinatakiwa (All parameters required)" });
  }

  const store = getStore();
  const recipient = store.users[receiver];
  if (!recipient && receiver !== "System" && receiver !== "Admin") {
    return res.status(404).json({ error: "Mtumiaji anayepokea ujumbe hajapatikana" });
  }

  const newInbox = {
    id: "inb-" + Math.random().toString(36).substring(2, 9),
    sender,
    receiver,
    message,
    timestamp: new Date().toISOString()
  };

  if (!store.inbox) store.inbox = [];
  store.inbox.unshift(newInbox);
  saveStore(store);

  res.json({ success: true, mail: newInbox });
});


// --- MATCH REPLAY SYSTEM ENDPOINTS ---

// List completed replay logs
app.get("/api/replays", (req: Request, res: Response) => {
  const store = getStore();
  res.json(store.replays || []);
});

// Specific replay detail
app.get("/api/replays/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const store = getStore();
  const item = (store.replays || []).find((r: any) => r.id === id);
  if (!item) return res.status(404).json({ error: "Replay file not found" });
  res.json(item);
});


// --- SUPER ADMIN CONTROL PANEL: GRANT POINTS & ARBITRARY DATA ---

// Get all users in database
app.get("/api/admin/users", (req: Request, res: Response) => {
  const store = getStore();
  // Return values formatted as array
  const list = Object.values(store.users).map((u: any) => ({
    username: u.username,
    phone: u.phone,
    points: u.points,
    moneyBalance: u.moneyBalance,
    teamName: u.teamName,
    hasConverted: u.hasConverted,
    stats: u.stats || { wins: 0, losses: 0, pointsEarned: 0, tournamentsPlayed: 0 }
  }));
  res.json(list);
});

// Admin creates user directly (no password needed or empty password support)
app.post("/api/admin/users/create", async (req: Request, res: Response) => {
  const { username, phone, teamName } = req.body;
  if (!username || !phone || !teamName) {
    return res.status(400).json({ error: "Tafadhali jaza username, namba ya simu, na jina la timu" });
  }

  const store = getStore();
  if (store.users[username]) {
    return res.status(400).json({ error: "Username hii tayari imesajiliwa!" });
  }

  // Check unique phone duplicate
  const existingUserForPhone = Object.values(store.users).find((u: any) => {
    const cleanA = u.phone?.replace(/\+/g, "").replace(/\s+/g, "");
    const cleanB = phone?.replace(/\+/g, "").replace(/\s+/g, "");
    return cleanA === cleanB;
  });
  if (existingUserForPhone) {
    return res.status(400).json({ error: "change ur phone , this phone number has been used" });
  }

  const newUser = {
    username,
    phone,
    teamName,
    points: 400, // 400 welcome points!
    moneyBalance: 0,
    hasConverted: false,
    password: "", // empty password for direct login
    language: "sw",
    stats: {
      wins: 0,
      losses: 0,
      pointsEarned: 400,
      tournamentsPlayed: 0
    }
  };

  store.users[username] = newUser;
  saveStore(store);

  // Send NextSMS alert if active
  await sendNextSms(phone, `Karibu E PLAYERS HUB! Msimamizi amekutengenezea akaunti. Team yako ni ${teamName}. Unaweza kulogin moja kwa moja bila password.`);

  res.json({ success: true, user: newUser });
});

// Grant Points / Modify points balance of a single user
app.post("/api/admin/users/:username/grant", async (req: Request, res: Response) => {
  const { username } = req.params;
  const { points } = req.body; // absolute change (+/-)
  
  const store = getStore();
  const user = store.users[username];
  if (!user) return res.status(404).json({ error: "Mtumiaji hajapatikana" });

  const ptsAmount = Number(points);
  if (isNaN(ptsAmount)) return res.status(400).json({ error: "Kiasi kisicho sahihi" });

  user.points += ptsAmount;
  if (!user.stats) user.stats = { wins: 0, losses: 0, pointsEarned: 0, tournamentsPlayed: 0 };
  user.stats.pointsEarned = (user.stats.pointsEarned || 0) + (ptsAmount > 0 ? ptsAmount : 0);

  // Register transaction log for points granted
  if (!store.transactions) store.transactions = [];
  store.transactions.unshift({
    id: "tx-grant-" + Math.random().toString(36).substring(2, 9),
    username,
    type: "bonus" as const,
    amountPoints: ptsAmount,
    amountTsh: 0,
    transactionId: "ADMIN-AWARD-" + Math.random().toString(36).substring(2, 4).toUpperCase() + Math.floor(Math.random() * 100),
    status: "approved" as const,
    phone: user.phone,
    timestamp: new Date().toISOString()
  });

  // Send system alert to client private inbox
  if (!store.inbox) store.inbox = [];
  store.inbox.push({
    id: "sys-" + Math.random().toString(36).substring(2, 9),
    sender: "System",
    receiver: username,
    message: `Akaunti yako imehakikiwa na Super Admin! Umepokelewa pointi zawadi/marekebisho ya: ${ptsAmount} Points. Salio jipya ni pointi ${user.points}.`,
    timestamp: new Date().toISOString()
  });

  saveStore(store);

  // Send next SMS confirmation
  await sendNextSms(user.phone, `Ombi lako limekamilika! Super Admin ameidhinisha pointi ${ptsAmount} kwenye akaunti yako. Salio jipya ni pointi ya ${user.points}.`);

  res.json({ success: true, user });
});

// Dynamic Points Packages Set (Admin configurable)
app.post("/api/admin/packages", (req: Request, res: Response) => {
  const { packages } = req.body; // array
  if (!packages || !Array.isArray(packages)) return res.status(400).json({ error: "Sura isiyo sahihi ya point packages" });

  const store = getStore();
  store.systemConfig.pointPackages = packages;
  saveStore(store);

  res.json({ success: true, packages: store.systemConfig.pointPackages });
});


// --- GEMINI SCOREBOARD OCR PARSER ---
app.post("/api/scoreboard/parse", async (req: Request, res: Response) => {
  const { imageBase64, matchId } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "Scoreboard image required" });
  }

  const store = getStore();
  const match = store.matches.find(m => m.id === matchId) || store.matches[0];
  if (!match) {
    return res.status(444).json({ error: "No active match found to map this score" });
  }

  try {
    // Strip image schema prefix (e.g. "data:image/jpeg;base64,")
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
You are a Gaming Referee AI score extractor for "Mashindano Tournament Gaming App" in Tanzania.
We have a match between:
Player 1 (Home): "${match.player1}"
Player 2 (Away): "${match.player2}"

Look closely at this image. It is a screenshot of the end game results/match summary of a football (soccer) game or similar console game.
Identify the final score for each player. If the exact usernames are not shown on screen, assume player 1 is the home side / left-side score or active gaming camera profile score, and player 2 is the away side / right-side score.

Return a responses ONLY inside a JSON block with EXACTLY these keys (do not add conversational text, just valid JSON):
{
  "score1": <number for Player 1>,
  "score2": <number for Player 2>,
  "winner": "<player username or 'TIE' or 'UNKNOWN'>",
  "confidence": <decimal between 0.0 and 1.0 indicating clarity of score elements>,
  "analysis": "<short Swahili description of the game outcome visible on screen>"
}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsedText = response.text || "{}";
    const data = JSON.parse(parsedText);

    // Apply scores to match
    match.score1 = data.score1 !== undefined ? Number(data.score1) : match.score1;
    match.score2 = data.score2 !== undefined ? Number(data.score2) : match.score2;
    match.winner = data.winner && data.winner !== "UNKNOWN" ? data.winner : (match.score1 > match.score2 ? match.player1 : (match.score2 > match.score1 ? match.player2 : "TIE"));
    match.status = "completed";

    saveStore(store);

    // Notify user with SMS
    const user = store.users[match.player1];
    if (user) {
      await sendNextSms(user.phone, `Matokeo ya Mashindano! Mwamuzi wa AI amesoma scoreboard ya mechi yako dhidi ya ${match.player2}. Matokeo ni ${match.score1} - ${match.score2}. Mshindi: ${match.winner}.`);
    }

    res.json({
      success: true,
      rawOutput: parsedText,
      extractedData: {
        score1: match.score1,
        score2: match.score2,
        winner: match.winner,
        analysis: data.analysis || "Score updated automatically via Gemini Referee!"
      }
    });

  } catch (err: any) {
    console.error("Gemini score extract error:", err);
    res.status(500).json({ error: "Njia ya AI imeshindwa kusoma scoreboard yako. Jaribu tena au weka kwa njia ya kawaida.", details: err.message });
  }
});


// Dynamic point-altering & game assistant endpoints
app.post("/api/admin/assistant", async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Andika kitu kwa msaidizi wa AI" });

  const store = getStore();

  try {
    const aiSystemPrompt = `
You are the AI System Administrator and Code Assistant for the e-players-hub game tournament platform.
The user is the Super Admin. You have the power to execute changes on the system database, settings, or write code.

You must respond ONLY with a valid JSON object matching the following structure:
{
  "action": "config_update" | "create_tournament" | "code_draft" | "talk",
  "message": "A message explaining what you did in Tanzanian Swahili",
  "systemConfig": <Optional updated system config state>,
  "tournament": <Optional new tournament payload if requested to create or generate a tournament>
}

Core System Config fields:
- smsEnabled: boolean (toggles sms notifications)
- minWithdrawalTsh: number
- minDepositTsh: number
- conversionRate: number (multiplies points to shillings, currently 0.65 means 1 point = 0.65 TSH)
- pointPackages: array of package configurations e.g. [{"id": "pkg-1", "points": 1000, "priceTsh": 650, "popular": false}]

Tournaments payload schema:
- name: string (e.g. "Yanga vs Simba Super Cup")
- prizePool: number
- entryFee: number
- timerSeconds: number (duration in seconds e.g. 600)
- capacity: number (e.g. 16 or 32)
- imageUrl: string (any unsplash image url related to gaming/soccer e.g. "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800")

Current System Config:
${JSON.stringify(store.systemConfig)}

User Prompt: "${prompt}"

If the user wants to write/change the code of the application (e.g., add features, change tabs, fix layout, rewrite logic), set "action" to "code_draft".
Else if the user wants to update settings/configs (e.g., turn off SMS, increase withdrawal limit), set "action" to "config_update" and specify the exact updated "systemConfig" object.
Else if the user wants to create a new tournament or create gameplay, set "action" to "create_tournament" and fill "tournament" field with complete details.
Else (general conversation, question, or explanation), set "action" to "talk".

Ensure your JSON is 100% valid and there are no formatting wrappers outside the raw json string (do not wrap with markdown code blocks).
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: aiSystemPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || "{}");

    if (parsed.action === "config_update" && parsed.systemConfig) {
      store.systemConfig = { ...store.systemConfig, ...parsed.systemConfig };
      saveStore(store);
    } else if (parsed.action === "create_tournament" && parsed.tournament) {
      const tourn = parsed.tournament;
      const newT = {
        id: "tourn-" + Math.random().toString(36).substring(2, 9),
        name: tourn.name || "Custom Championship",
        prizePool: Number(tourn.prizePool) || 1000,
        entryFee: Number(tourn.entryFee) || 50,
        timerSeconds: Number(tourn.timerSeconds) || 600,
        startTime: new Date(Date.now() + (Number(tourn.timerSeconds) || 600) * 1000).toISOString(),
        capacity: Number(tourn.capacity) || 16,
        joinedUsers: [],
        imageUrl: tourn.imageUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",
        active: true,
        createdAt: new Date().toISOString()
      };
      if (!store.tournaments) store.tournaments = [];
      store.tournaments.unshift(newT);
      saveStore(store);
      parsed.message = `🏆 Tournament "${newT.name}" imetengenezwa safi kabisa! Ada ya kujiunga: ${newT.entryFee} pts, Shindano: ${newT.prizePool} pts.`;
    }

    res.json({ success: true, ...parsed });

  } catch (err: any) {
    console.error("Admin assistant error:", err);
    res.status(500).json({ error: "AI Assistant imeshindwa kusindika ombi lako", details: err.message });
  }
});


// --- AUTONOMOUS AI DEVELOPER ENDPOINTS ---

// Fetch original source code of APP to preview/sandbox
app.get("/api/developer/source", (req: Request, res: Response) => {
  const appPath = path.join(process.cwd(), "src/App.tsx");
  try {
    const liveCode = fs.readFileSync(appPath, "utf-8");
    const store = getStore();
    res.json({
      liveCode,
      draft: store.devDraft
    });
  } catch (err) {
    res.status(500).json({ error: "Cannot read source file" });
  }
});

// Prompt AI to generate draft code edits
app.post("/api/developer/draft", async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Tafadhali andika maelekezo ya kodi (Prompt is required)" });

  const appPath = path.join(process.cwd(), "src/App.tsx");
  const liveCode = fs.readFileSync(appPath, "utf-8");

  try {
    const systemPrompt = `
You are the Autonomous AI Developer for the Tanzanian Mashindano Gaming Platform.
The user is a Super Admin who wants to make a modification to the React code stored in "/src/App.tsx".
Your task is to rewrite "/src/App.tsx" to implement their requested update perfectly.

Strict architectural constraints:
1. Return ONLY the complete modified source code of "/src/App.tsx", starting with \`import\` and ending with the default component export.
2. Ensure absolutely NO markdown blocks, commentary, prefaces, or explanation. Output pure TypeScript React code.
3. Keep the theme (Tanzanite Eclipse & Gold Accent), support Swahili, English, French.
4. Keep all components responsive and modular.
5. Utilize Lucide React icons.

=== Current App.tsx ===
${liveCode}

=== Customer Request ===
"${prompt}"

Please generate the optimal updated file content.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt
    });

    let draftCode = response.text || "";
    // Clean any markdown formatting wrappers if model didn't follow instruction
    draftCode = draftCode.replace(/^```tsx\n/, "").replace(/^```typescript\n/, "").replace(/^```\n/, "").replace(/\n```$/, "");

    const store = getStore();
    store.devDraft = {
      id: "draft-" + Math.random().toString(36).substring(2, 9),
      prompt,
      targetFile: "src/App.tsx",
      currentCode: liveCode,
      draftCode: draftCode,
      status: "pending",
      timestamp: new Date().toISOString()
    };
    saveStore(store);

    res.json({ success: true, draft: store.devDraft });

  } catch (err: any) {
    console.error("AI developer panel error:", err);
    res.status(500).json({ error: "Gemini AI imeshindwa kutengeneza msimbo (Gemini failed to generate code)", details: err.message });
  }
});

// Approve/Apply code from sandbox directly to filesystem!
app.post("/api/developer/approve", (req: Request, res: Response) => {
  const store = getStore();
  const draft = store.devDraft;
  if (!draft) {
    return res.status(400).json({ error: "Hakuna mabadiliko kwenye Sandbox ya kuli-deploy (No draft on sandbox)" });
  }

  const appPath = path.join(process.cwd(), draft.targetFile);
  try {
    // Write code to disk live!
    fs.writeFileSync(appPath, draft.draftCode, "utf-8");
    
    // Log success
    store.devDraft = null;
    saveStore(store);

    console.log(`[AUTONOMOUS-AI-DEVELOPER] Successfully updated and deployed file: ${draft.targetFile}`);
    res.json({ success: true, message: "Kodi mpya imetumwa mtandaoni! Mfumo umereload (Code applied live successfully!)" });
  } catch (err: any) {
    res.status(500).json({ error: "Uandishi wa kodi kwenye faili umeshindwa", details: err.message });
  }
});

// Reject and delete Sandbox code Draft
app.post("/api/developer/reject", (req: Request, res: Response) => {
  const store = getStore();
  store.devDraft = null;
  saveStore(store);
  res.json({ success: true, message: "Sandbox imesafishwa na mabadiliko yamekataliwa." });
});


// --- VITE DEV AND PROD SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running securely on http://0.0.0.0:${PORT}`);
  });
}

startServer();

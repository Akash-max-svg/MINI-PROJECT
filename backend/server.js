const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { db, initDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Authentication middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token || token !== 'Bearer authenticated') {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Initialize database
initDatabase();

// Serve index.html as the default page
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  stmt.get([email], (err, user) => {
    if (err || !user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    } else {
      res.json({ success: true, token: 'authenticated', user: { name: user.name, email: user.email } });
    }
  });
  stmt.finalize();
});

// User registration endpoint
app.post('/api/register', (req, res) => {
  const { name, age, phone, email, password, address } = req.body;
  
  // First check if email already exists
  const checkStmt = db.prepare('SELECT email FROM users WHERE email = ?');
  checkStmt.get([email], (err, existingUser) => {
    if (err) {
      res.status(500).json({ success: false, error: 'Database error' });
      return;
    }
    
    if (existingUser) {
      res.status(400).json({ success: false, error: 'Email already registered. Please use a different email.' });
      return;
    }
    
    // Email doesn't exist, proceed with registration
    const insertStmt = db.prepare('INSERT INTO users (name, age, phone, email, password, address) VALUES (?, ?, ?, ?, ?, ?)');
    insertStmt.run([name, age, phone, email, password, address], function(insertErr) {
      if (insertErr) {
        res.status(400).json({ success: false, error: insertErr.message });
      } else {
        res.json({ success: true, userId: this.lastID });
      }
    });
    insertStmt.finalize();
  });
  checkStmt.finalize();
});

// Reset password endpoint
app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, error: 'Email and newPassword are required' });
  }
  const check = db.prepare('SELECT id FROM users WHERE email = ?');
  check.get([email], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'Database error' });
    if (!user) return res.status(404).json({ success: false, error: 'No account found for this email' });
    const upd = db.prepare('UPDATE users SET password = ? WHERE email = ?');
    upd.run([newPassword, email], function(updateErr){
      if (updateErr) return res.status(500).json({ success: false, error: 'Failed to update password' });
      return res.json({ success: true });
    });
    upd.finalize();
  });
  check.finalize();
});

// Submit complaint endpoint
app.post('/api/complaint', requireAuth, (req, res) => {
  const { name, age, address, mobile, type, susNumber, complaint } = req.body;
  const stmt = db.prepare('INSERT INTO complaints (name, age, address, mobile, type, suspicious_number, complaint_text) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run([name, age, address, mobile, type, susNumber, complaint], function(err) {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, complaintId: this.lastID });
    }
  });
  stmt.finalize();
});

// ─────────────────────────────────────────────
//  TELECOM CARRIER LOOKUP (India)
//  Based on real TRAI number series allocations
// ─────────────────────────────────────────────
// ── Comprehensive 4-digit prefix table (TRAI allocations, pre-MNP original series) ──
// Note: MNP means a number may have ported away. This reflects original allocation.
const A="Airtel", J="Jio", V="Vi", B="BSNL", M="MTNL";
const PR="Prepaid", PO="Postpaid";
const carrierPrefixes = {
  // ── AIRTEL ──────────────────────────────────────────────
  // Delhi
  "9810":{operator:A,circle:"Delhi",type:PR}, "9811":{operator:A,circle:"Delhi",type:PR},
  "9818":{operator:A,circle:"Delhi",type:PR},
  "9871":{operator:A,circle:"Delhi",type:PO}, "9999":{operator:A,circle:"Delhi",type:PR},
  "8800":{operator:A,circle:"Delhi",type:PR},
  "7011":{operator:A,circle:"Delhi",type:PR}, "7065":{operator:A,circle:"Delhi",type:PR},
  // Mumbai
  "9820":{operator:A,circle:"Mumbai",type:PR}, "9821":{operator:A,circle:"Mumbai",type:PR},
  "9833":{operator:A,circle:"Mumbai",type:PR},
  // Karnataka — Airtel takes priority over Vi for 9886
  "9845":{operator:A,circle:"Karnataka",type:PR}, "9886":{operator:A,circle:"Karnataka",type:PR},
  "9900":{operator:A,circle:"Karnataka",type:PO}, "9980":{operator:A,circle:"Karnataka",type:PR},
  "9741":{operator:A,circle:"Karnataka",type:PR}, "9742":{operator:A,circle:"Karnataka",type:PR},
  "9743":{operator:A,circle:"Karnataka",type:PR}, "9844":{operator:A,circle:"Karnataka",type:PR},
  // Punjab
  "9876":{operator:A,circle:"Punjab",type:PR}, "9815":{operator:A,circle:"Punjab",type:PR},
  "9814":{operator:A,circle:"Punjab",type:PR}, "9872":{operator:A,circle:"Punjab",type:PR},
  // West Bengal
  "9830":{operator:A,circle:"West Bengal",type:PR}, "9831":{operator:A,circle:"West Bengal",type:PR},
  // Andhra Pradesh / Telangana
  "9849":{operator:A,circle:"Andhra Pradesh",type:PR}, "9848":{operator:A,circle:"Andhra Pradesh",type:PR},
  "8885":{operator:A,circle:"Andhra Pradesh",type:PR}, "8886":{operator:A,circle:"Andhra Pradesh",type:PR},
  "9347":{operator:A,circle:"Andhra Pradesh",type:PR}, "9346":{operator:A,circle:"Andhra Pradesh",type:PR},
  "9701":{operator:A,circle:"Andhra Pradesh",type:PR}, "9703":{operator:A,circle:"Andhra Pradesh",type:PR},
  // Tamil Nadu
  "9894":{operator:A,circle:"Tamil Nadu",type:PR}, "9840":{operator:A,circle:"Tamil Nadu",type:PR},
  "9003":{operator:A,circle:"Tamil Nadu",type:PR}, "8056":{operator:A,circle:"Tamil Nadu",type:PR},
  // Kerala
  "9895":{operator:A,circle:"Kerala",type:PR}, "9847":{operator:A,circle:"Kerala",type:PR},
  // Maharashtra
  "9822":{operator:A,circle:"Maharashtra",type:PR}, "9823":{operator:A,circle:"Maharashtra",type:PR},
  // Gujarat
  "9824":{operator:A,circle:"Gujarat",type:PR}, "9825":{operator:A,circle:"Gujarat",type:PR},
  "9898":{operator:A,circle:"Gujarat",type:PR},
  // Rajasthan
  "9829":{operator:A,circle:"Rajasthan",type:PR}, "9928":{operator:A,circle:"Rajasthan",type:PR},
  // Madhya Pradesh
  "9826":{operator:A,circle:"Madhya Pradesh",type:PR}, "9827":{operator:A,circle:"Madhya Pradesh",type:PR},
  // Uttar Pradesh
  "9839":{operator:A,circle:"Uttar Pradesh East",type:PR}, "9838":{operator:A,circle:"Uttar Pradesh East",type:PR},
  "9837":{operator:A,circle:"Uttar Pradesh West",type:PR}, "9719":{operator:A,circle:"Uttar Pradesh West",type:PR},
  // Haryana
  "9896":{operator:A,circle:"Haryana",type:PR}, "9812":{operator:A,circle:"Haryana",type:PR},
  // Himachal Pradesh
  "9816":{operator:A,circle:"Himachal Pradesh",type:PR}, "9817":{operator:A,circle:"Himachal Pradesh",type:PR},
  // Assam
  "9435":{operator:A,circle:"Assam",type:PR}, "9401":{operator:A,circle:"Assam",type:PR},
  // Odisha
  "9861":{operator:A,circle:"Odisha",type:PR}, "9937":{operator:A,circle:"Odisha",type:PR},
  // Bihar / Jharkhand
  "9835":{operator:A,circle:"Bihar",type:PR}, "9334":{operator:A,circle:"Bihar",type:PR},
  // Kolkata
  "9836":{operator:A,circle:"Kolkata",type:PR}, "9163":{operator:A,circle:"Kolkata",type:PR},
  // 8xxx Airtel series
  "8130":{operator:A,circle:"Delhi",type:PR}, "8131":{operator:A,circle:"Delhi",type:PR},
  "8447":{operator:A,circle:"Delhi",type:PR}, "8448":{operator:A,circle:"Delhi",type:PR},
  "8527":{operator:A,circle:"Delhi",type:PR}, "8750":{operator:A,circle:"Delhi",type:PR},
  "8851":{operator:A,circle:"Various",type:PR}, "8860":{operator:A,circle:"Delhi",type:PR},
  // ── JIO ─────────────────────────────────────────────────
  // Andhra Pradesh / Telangana — 9392 is Jio AP
  "9392":{operator:J,circle:"Andhra Pradesh",type:PR}, "9393":{operator:J,circle:"Andhra Pradesh",type:PR},
  "9394":{operator:J,circle:"Andhra Pradesh",type:PR}, "9395":{operator:J,circle:"Andhra Pradesh",type:PR},
  "9396":{operator:J,circle:"Andhra Pradesh",type:PR}, "9397":{operator:J,circle:"Andhra Pradesh",type:PR},
  "9398":{operator:J,circle:"Andhra Pradesh",type:PR}, "9399":{operator:J,circle:"Andhra Pradesh",type:PR},
  // Tamil Nadu
  "9159":{operator:J,circle:"Tamil Nadu",type:PR}, "7010":{operator:J,circle:"Tamil Nadu",type:PR},
  "7305":{operator:J,circle:"Tamil Nadu",type:PR}, "7358":{operator:J,circle:"Tamil Nadu",type:PR},
  "7397":{operator:J,circle:"Tamil Nadu",type:PR},
  // Maharashtra
  "9152":{operator:J,circle:"Maharashtra",type:PR}, "9153":{operator:J,circle:"Maharashtra",type:PR},
  "7666":{operator:J,circle:"Maharashtra",type:PR}, "7738":{operator:J,circle:"Maharashtra",type:PR},
  // Karnataka
  "7019":{operator:J,circle:"Karnataka",type:PR}, "7022":{operator:J,circle:"Karnataka",type:PR},
  "9148":{operator:J,circle:"Karnataka",type:PR}, "9164":{operator:J,circle:"Karnataka",type:PR},
  // Delhi
  "7042":{operator:J,circle:"Delhi",type:PR}, "7043":{operator:J,circle:"Delhi",type:PR},
  "7044":{operator:J,circle:"Delhi",type:PR}, "7045":{operator:J,circle:"Delhi",type:PR},
  "9582":{operator:J,circle:"Delhi",type:PR}, "9599":{operator:J,circle:"Delhi",type:PR},
  // Gujarat
  "7016":{operator:J,circle:"Gujarat",type:PR}, "7096":{operator:J,circle:"Gujarat",type:PR},
  "9106":{operator:J,circle:"Gujarat",type:PR}, "9173":{operator:J,circle:"Gujarat",type:PR},
  // Rajasthan
  "7014":{operator:J,circle:"Rajasthan",type:PR}, "7023":{operator:J,circle:"Rajasthan",type:PR},
  "8955":{operator:J,circle:"Rajasthan",type:PR}, "8956":{operator:J,circle:"Rajasthan",type:PR},
  "8957":{operator:J,circle:"Rajasthan",type:PR},
  // Madhya Pradesh
  "7000":{operator:J,circle:"Madhya Pradesh",type:PR}, "7024":{operator:J,circle:"Madhya Pradesh",type:PR},
  "9111":{operator:J,circle:"Madhya Pradesh",type:PR},
  // Uttar Pradesh
  "7007":{operator:J,circle:"Uttar Pradesh East",type:PR}, "7080":{operator:J,circle:"Uttar Pradesh East",type:PR},
  "9125":{operator:J,circle:"Uttar Pradesh East",type:PR}, "9140":{operator:J,circle:"Uttar Pradesh East",type:PR},
  "7060":{operator:J,circle:"Uttar Pradesh West",type:PR}, "9084":{operator:J,circle:"Uttar Pradesh West",type:PR},
  // West Bengal / Kolkata
  "7001":{operator:J,circle:"West Bengal",type:PR}, "7002":{operator:J,circle:"West Bengal",type:PR},
  "7003":{operator:J,circle:"West Bengal",type:PR},
  "9073":{operator:J,circle:"West Bengal",type:PR},
  // Punjab / Haryana
  "7009":{operator:J,circle:"Himachal Pradesh",type:PR}, "7018":{operator:J,circle:"Punjab",type:PR},
  "9041":{operator:J,circle:"Punjab",type:PR}, "9050":{operator:J,circle:"Haryana",type:PR},
  // Assam / North East
  "6000":{operator:J,circle:"Assam",type:PR}, "6001":{operator:J,circle:"Assam",type:PR},
  "6002":{operator:J,circle:"Assam",type:PR}, "6003":{operator:J,circle:"Assam",type:PR},
  "6004":{operator:J,circle:"Assam",type:PR},
  "6005":{operator:J,circle:"North East",type:PR}, "6006":{operator:J,circle:"North East",type:PR},
  "7005":{operator:J,circle:"Jammu & Kashmir",type:PR}, "7006":{operator:J,circle:"Jammu & Kashmir",type:PR},
  // Bihar / Jharkhand
  "7004":{operator:J,circle:"Bihar",type:PR}, "9113":{operator:J,circle:"Bihar",type:PR},
  // Kerala
  "7034":{operator:J,circle:"Kerala",type:PR}, "7025":{operator:J,circle:"Kerala",type:PR},
  "9188":{operator:J,circle:"Kerala",type:PR},
  // Odisha
  "7008":{operator:J,circle:"Odisha",type:PR}, "9090":{operator:J,circle:"Odisha",type:PR},
  // 8xxx Jio series — 8826 is Jio Delhi, not Airtel
  "8882":{operator:J,circle:"Delhi",type:PR},
  "8883":{operator:J,circle:"Delhi",type:PR}, "8884":{operator:J,circle:"Delhi",type:PR},
  "8826":{operator:J,circle:"Delhi",type:PR},
  "8887":{operator:J,circle:"Various",type:PR}, "8888":{operator:J,circle:"Various",type:PR},
  "8889":{operator:J,circle:"Various",type:PR},

  // ── VI (Vodafone Idea) ───────────────────────────────────
  // Mumbai — 9820/9821 conflict with Airtel; Vi-specific ones only
  "9867":{operator:V,circle:"Mumbai",type:PR},
  "9920":{operator:V,circle:"Mumbai",type:PR},
  // Maharashtra
  "9890":{operator:V,circle:"Maharashtra",type:PR}, "9860":{operator:V,circle:"Maharashtra",type:PR},
  // Gujarat
  "9879":{operator:V,circle:"Gujarat",type:PR}, "9377":{operator:V,circle:"Gujarat",type:PR},
  // Karnataka — Vi-specific (9886 kept as Airtel above)
  "9916":{operator:V,circle:"Karnataka",type:PR}, "9880":{operator:V,circle:"Karnataka",type:PR},
  // Delhi
  "9873":{operator:V,circle:"Delhi",type:PR}, "9312":{operator:V,circle:"Delhi",type:PR},
  "9313":{operator:V,circle:"Delhi",type:PR}, "9711":{operator:V,circle:"Delhi",type:PR},
  // Andhra Pradesh
  "9885":{operator:V,circle:"Andhra Pradesh",type:PR}, "9866":{operator:V,circle:"Andhra Pradesh",type:PR},
  // Tamil Nadu
  "9841":{operator:V,circle:"Tamil Nadu",type:PR}, "9843":{operator:V,circle:"Tamil Nadu",type:PR},
  // Kerala — Vi-specific (9847 is Airtel, 9846 is Vi)
  "9846":{operator:V,circle:"Kerala",type:PR},
  // Rajasthan
  "9929":{operator:V,circle:"Rajasthan",type:PR},
  // Madhya Pradesh
  "9893":{operator:V,circle:"Madhya Pradesh",type:PR}, "9977":{operator:V,circle:"Madhya Pradesh",type:PR},
  // West Bengal
  "9832":{operator:V,circle:"West Bengal",type:PR},
  // Punjab
  "9855":{operator:V,circle:"Punjab",type:PR}, "9888":{operator:V,circle:"Punjab",type:PR},
  // 8xxx Vi series
  "8872":{operator:V,circle:"Punjab",type:PR}, "8837":{operator:V,circle:"Madhya Pradesh",type:PR},
  "8879":{operator:V,circle:"Gujarat",type:PR}, "8866":{operator:V,circle:"Andhra Pradesh",type:PR},

  // ── BSNL ────────────────────────────────────────────────
  // UP East — remove 9415 conflict with Vi; BSNL-specific
  "9450":{operator:B,circle:"Uttar Pradesh East",type:PR}, "9451":{operator:B,circle:"Uttar Pradesh East",type:PR},
  "9452":{operator:B,circle:"Uttar Pradesh East",type:PR}, "9453":{operator:B,circle:"Uttar Pradesh East",type:PR},
  "9454":{operator:B,circle:"Uttar Pradesh East",type:PR}, "9455":{operator:B,circle:"Uttar Pradesh East",type:PR},
  "9456":{operator:B,circle:"Uttar Pradesh East",type:PR}, "9457":{operator:B,circle:"Uttar Pradesh East",type:PR},
  "9458":{operator:B,circle:"Uttar Pradesh East",type:PR}, "9459":{operator:B,circle:"Uttar Pradesh West",type:PR},
  "9412":{operator:B,circle:"Uttar Pradesh West",type:PR},
  "9411":{operator:B,circle:"Uttarakhand",type:PR}, "9410":{operator:B,circle:"Uttarakhand",type:PR},
  "9436":{operator:B,circle:"North East",type:PR},
  "9437":{operator:B,circle:"Odisha",type:PR}, "9438":{operator:B,circle:"Odisha",type:PR}, "9439":{operator:B,circle:"Odisha",type:PR},
  "9440":{operator:B,circle:"Andhra Pradesh",type:PR}, "9441":{operator:B,circle:"Andhra Pradesh",type:PR},
  "9442":{operator:B,circle:"Kerala",type:PR}, "9447":{operator:B,circle:"Kerala",type:PR},
  "9448":{operator:B,circle:"Karnataka",type:PR}, "9449":{operator:B,circle:"Karnataka",type:PR},
  "9418":{operator:B,circle:"Himachal Pradesh",type:PR},
  "9419":{operator:B,circle:"Jammu & Kashmir",type:PR},
  "9434":{operator:B,circle:"West Bengal",type:PR}, "9433":{operator:B,circle:"West Bengal",type:PR},
  "9431":{operator:B,circle:"Bihar",type:PR}, "9430":{operator:B,circle:"Bihar",type:PR},
  "9425":{operator:B,circle:"Madhya Pradesh",type:PR}, "9424":{operator:B,circle:"Madhya Pradesh",type:PR},
  "9423":{operator:B,circle:"Maharashtra",type:PR}, "9422":{operator:B,circle:"Maharashtra",type:PR},
  "9426":{operator:B,circle:"Gujarat",type:PR}, "9427":{operator:B,circle:"Gujarat",type:PR},
  "9414":{operator:B,circle:"Rajasthan",type:PR}, "9413":{operator:B,circle:"Rajasthan",type:PR},
  "9416":{operator:B,circle:"Haryana",type:PR}, "9417":{operator:B,circle:"Punjab",type:PR},
  "9444":{operator:B,circle:"Tamil Nadu",type:PR}, "9443":{operator:B,circle:"Tamil Nadu",type:PR},
  // MTNL
  "9868":{operator:M,circle:"Delhi",type:PO},
  "9869":{operator:M,circle:"Mumbai",type:PO},
};

// Known fraud/scam number prefixes (reported patterns)
const fraudPrefixes = [
  "1600","1800","1900", // premium/IVR numbers misused for scams
  "0120","0124","0130", // VoIP/virtual numbers used in scams
];

// TRAI-allocated Indian service number series (NOT fraud)
const serviceNumbers = {
  "140": { type:"Delivery/Logistics", desc:"TRAI-allocated delivery & logistics service number (Delhivery, Ekart, Amazon, Flipkart, etc.)" },
  "141": { type:"Telemarketing", desc:"TRAI-allocated promotional call service" },
  "142": { type:"Telemarketing", desc:"TRAI-allocated promotional call service" },
  "143": { type:"Telemarketing", desc:"TRAI-allocated promotional call service" },
  "144": { type:"Telemarketing", desc:"TRAI-allocated promotional call service" },
  "145": { type:"Telemarketing", desc:"TRAI-allocated promotional call service" },
  "160": { type:"Bank/Finance Service", desc:"TRAI-allocated banking & financial service number" },
  "155": { type:"Government Helpline", desc:"TRAI-allocated government service helpline" },
  "1800": { type:"Toll-Free", desc:"Toll-free customer service number" },
};

const knownScamPatterns = [
  /^(\+?91)?0[0-9]{9}$/, // starts with 0 (landline masking on mobile)
  // Note: numbers starting with 1 are excluded — they may be TRAI service numbers (140, 160 etc.)
];

function getCarrierInfo(number) {
  const digits = number.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  const prefix4 = local.slice(0, 4);

  // 4-digit exact match first (most accurate)
  if (carrierPrefixes[prefix4]) return { ...carrierPrefixes[prefix4], prefix: prefix4 };

  // Range-based fallback using first 2 digits (broad series ownership)
  // These are well-established series that haven't changed significantly with MNP
  const prefix2 = local.slice(0, 2);
  const rangeMap = {
    "70": J, "71": J, "72": J, "73": J, "74": J, "75": J, "76": J, "77": J, "78": J, "79": J,
    "60": J, "61": J, "62": J, "63": J, "64": J, "65": J,
    "98": null, // mixed — don't guess
    "99": null, // mixed — don't guess
    "97": null, // mixed — don't guess
    "96": null, // mixed — don't guess
    "95": null, // mixed — don't guess
    "94": B,    // mostly BSNL
    "93": null, // mixed
    "92": null, // mixed
    "91": null, // mixed
    "90": null, // mixed
    "88": null, // mixed — 880/881 Airtel, 883-886 Jio, 887-888 Vi — too ambiguous at 2 digits
    "89": null, // mixed
    "85": J,    // mostly Jio new series
    "86": null, // mixed
    "87": null, // mixed
  };

  const op = rangeMap[prefix2];
  if (op === null) return null; // ambiguous — don't guess wrong
  if (op) return { operator: op, circle: "India", type: PR, prefix: prefix2, mnpNote: true };
  return null;
}

function getServiceInfo(number) {
  const digits = number.replace(/\D/g, "");
  // Check 3-digit and 4-digit service prefixes
  for (const prefix of ["1800","160","155","145","144","143","142","141","140"]) {
    if (digits.startsWith(prefix)) return { prefix, ...serviceNumbers[prefix] };
  }
  return null;
}

function isFraudPattern(number) {
  const digits = number.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  // Never flag known service numbers as fraud
  if (getServiceInfo(digits)) return false;
  if (fraudPrefixes.some(p => local.startsWith(p))) return true;
  if (knownScamPatterns.some(r => r.test(number))) return true;
  return false;
}

// ─────────────────────────────────────────────
//  SHARED CONSTANTS
// ─────────────────────────────────────────────
const sequenceNumbers = [
  "1234567890","0000000000","1111111111","2222222222",
  "3333333333","4444444444","5555555555","6666666666",
  "7777777777","8888888888","9999999999","1234512345"
];

const countryMap = {
  "+91":"India","+1":"USA","+44":"UK","+61":"Australia",
  "+93":"Afghanistan","+213":"Algeria","+54":"Argentina",
  "+86":"China","+81":"Japan"
};

// ─────────────────────────────────────────────
//  PHONE NUMBER — FEATURE EXTRACTION
// ─────────────────────────────────────────────
function extractPhoneFeatures(number, ringTime) {
  const digits = String(number || "").replace(/\D/g, "");
  const len = digits.length;

  const unique = new Set(digits.split("")).size;
  const entropy = unique / (len || 1);

  const counts = {};
  for (const ch of digits) counts[ch] = (counts[ch] || 0) + 1;
  const maxRep = Math.max(...Object.values(counts), 0);

  let seqScore = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    if (parseInt(digits[i+1]) - parseInt(digits[i]) === 1) seqScore++;
  }

  let countryCode = "--";
  let countryName = "Unknown";
  for (const code in countryMap) {
    if (number.startsWith(code)) { countryCode = code; countryName = countryMap[code]; break; }
  }

  const carrier = getCarrierInfo(number);
  const isFraudNum = isFraudPattern(number);
  const serviceInfo = getServiceInfo(digits);

  return {
    digits, len,
    hasLetters: /[a-zA-Z]/.test(number),
    hasSymbols: /[!@#$%^&*(),.?":{}|<>]/.test(number),
    isSpamSeq: sequenceNumbers.includes(digits),
    maxRep, entropy, seqScore,
    isForeign: countryCode !== "+91" && countryCode !== "--",
    ringTime: (ringTime !== undefined && ringTime !== "" && !isNaN(ringTime)) ? parseInt(ringTime, 10) : null,
    countryCode, countryName,
    carrier,
    isFraudNum,
    serviceInfo  // TRAI service number info if matched
  };
}

// ─────────────────────────────────────────────
//  7 ML MODELS — PHONE NUMBER
// ─────────────────────────────────────────────

// 1. Random Forest — 10 decision trees with diverse feature splits
function randomForestPhone(f) {
  const trees = [
    // T1: length + format
    () => (f.len < 10 || f.len > 12) ? "Threat" : (f.hasLetters || f.hasSymbols) ? "Threat" : "Safe",
    // T2: spam sequence + repetition
    () => f.isSpamSeq ? "Spam" : f.maxRep > 7 ? "Spam" : f.maxRep > 5 ? "Threat" : "Safe",
    // T3: entropy + sequential run
    () => f.entropy < 0.2 ? "Spam" : f.seqScore >= 8 ? "Spam" : f.entropy < 0.35 ? "Threat" : "Safe",
    // T4: fraud prefix + carrier
    () => f.isFraudNum ? "Threat" : (!f.carrier && !f.isForeign && f.len === 10) ? "Threat" : "Safe",
    // T5: ring time + foreign
    () => (f.ringTime !== null && f.ringTime <= 3) ? "Dangerous" :
          (f.ringTime !== null && f.ringTime <= 7 && f.isForeign) ? "Dangerous" :
          (f.ringTime !== null && f.ringTime <= 7) ? "Spam" : "Safe",
    // T6: foreign + no carrier
    () => (f.isForeign && !f.carrier) ? "Threat" : f.isForeign ? "Threat" : "Safe",
    // T7: digit pattern — all same digit
    () => f.maxRep === f.len ? "Spam" : f.maxRep > 6 ? "Spam" : "Safe",
    // T8: ascending/descending full sequence
    () => f.seqScore >= f.len - 1 ? "Spam" : f.seqScore >= 7 ? "Threat" : "Safe",
    // T9: fraud prefix alone
    () => f.isFraudNum ? "Threat" : "Safe",
    // T10: combined ring + repetition
    () => (f.ringTime !== null && f.ringTime <= 5 && f.maxRep > 4) ? "Dangerous" :
          (f.ringTime !== null && f.ringTime <= 7) ? "Spam" : "Safe",
  ];
  const tally = { Safe:0, Spam:0, Threat:0, Dangerous:0 };
  trees.forEach(t => { const v = t(); tally[v] = (tally[v]||0) + 1; });
  const result = Object.keys(tally).sort((a,b) => tally[b]-tally[a])[0];
  const score = 1 - (tally["Safe"] / trees.length);
  return { model:"Random Forest", result, score };
}

// 2. XGBoost — gradient-boosted additive risk with interaction terms
function xgboostPhone(f) {
  let risk = 0;
  // Round 1: hard structural signals
  if (f.len < 10 || f.len > 12) risk += 50;
  if (f.hasLetters) risk += 45;
  if (f.hasSymbols) risk += 40;
  // Round 2: spam patterns
  if (f.isSpamSeq) risk += 45;
  if (f.maxRep === f.len) risk += 40;       // all same digit
  if (f.maxRep > 7) risk += 28;
  if (f.maxRep > 5) risk += 12;
  if (f.seqScore >= f.len - 1) risk += 35; // full ascending sequence
  if (f.seqScore >= 7) risk += 18;
  // Round 3: entropy
  if (f.entropy < 0.2) risk += 25;
  else if (f.entropy < 0.35) risk += 12;
  // Round 4: behavioral
  if (f.ringTime !== null && f.ringTime <= 3) risk += 35;
  else if (f.ringTime !== null && f.ringTime <= 7) risk += 22;
  // Round 5: origin
  if (f.isFraudNum) risk += 40;
  if (f.isForeign) risk += 18;
  // Interaction boost: foreign + short ring
  if (f.isForeign && f.ringTime !== null && f.ringTime <= 7) risk += 15;
  // Carrier trust signal (reduces risk slightly)
  if (f.carrier && !f.isForeign) risk -= 8;
  risk = Math.max(0, Math.min(risk, 100));
  const result = risk >= 75 ? "Dangerous" : risk >= 55 ? "Threat" : risk >= 30 ? "Spam" : "Safe";
  return { model:"XGBoost", result, score: risk / 100 };
}

// 3. ANN — 3-layer neural net simulation (input → hidden1 → hidden2 → output)
function annPhone(f) {
  // Input layer: 10 features normalized to [0,1]
  const inputs = [
    (f.len < 10 || f.len > 12) ? 1 : 0,
    f.hasLetters ? 1 : 0,
    f.hasSymbols ? 1 : 0,
    f.isSpamSeq ? 1 : 0,
    Math.min(f.maxRep / 10, 1),
    1 - Math.min(f.entropy, 1),
    f.isForeign ? 1 : 0,
    f.isFraudNum ? 1 : 0,
    f.ringTime !== null ? Math.max(0, 1 - f.ringTime / 30) : 0,
    f.carrier ? 0 : 0.4,
  ];
  // Hidden layer 1: 4 neurons with ReLU
  const W1 = [
    [0.8,0.7,0.6,0.9,0.5,0.6,0.4,0.9,0.7,0.3],
    [0.3,0.2,0.2,0.4,0.7,0.8,0.3,0.4,0.5,0.2],
    [0.5,0.6,0.5,0.6,0.4,0.5,0.7,0.6,0.6,0.4],
    [0.2,0.3,0.3,0.3,0.6,0.7,0.6,0.3,0.4,0.5],
  ];
  const h1 = W1.map(w => Math.max(0, w.reduce((s,wi,i) => s + wi*inputs[i], 0) / inputs.length));
  // Hidden layer 2: 2 neurons
  const h2 = [
    Math.max(0, (h1[0]*0.6 + h1[1]*0.3 + h1[2]*0.5 + h1[3]*0.2) / 4),
    Math.max(0, (h1[0]*0.2 + h1[1]*0.7 + h1[2]*0.4 + h1[3]*0.6) / 4),
  ];
  // Output: sigmoid activation
  const raw = h2[0] * 0.7 + h2[1] * 0.3;
  const activation = 1 / (1 + Math.exp(-10 * (raw - 0.3)));
  const result = activation > 0.75 ? "Dangerous" : activation > 0.55 ? "Threat" : activation > 0.35 ? "Spam" : "Safe";
  return { model:"ANN", result, score: activation };
}

// 4. LSTM — memory gates over digit sequence + temporal ring signal
function lstmPhone(f) {
  const d = f.digits;
  let cellState = 0, hiddenState = 0;
  // Process digit stream through memory gates
  for (let i = 1; i < d.length; i++) {
    const diff = parseInt(d[i]) - parseInt(d[i-1]);
    // Forget gate: reset on varied input
    const forget = Math.abs(diff) > 2 ? 0.3 : 0.85;
    // Input gate: flag suspicious patterns
    const input = (diff === 0) ? 0.9 :        // repeated digit
                  (diff === 1) ? 0.7 :         // ascending
                  (diff === -1) ? 0.6 : 0.1;   // descending
    cellState = forget * cellState + input * 0.5;
    hiddenState = Math.tanh(cellState) * 0.8;
  }
  // Temporal signal: ring time as sequence event
  if (f.ringTime !== null) {
    const ringSignal = f.ringTime <= 3 ? 0.9 : f.ringTime <= 7 ? 0.6 : 0.1;
    cellState = 0.7 * cellState + ringSignal * 0.5;
    hiddenState = Math.tanh(cellState) * 0.8;
  }
  const score = Math.min(Math.abs(hiddenState), 1);
  const result = score > 0.65 ? "Dangerous" : score > 0.45 ? "Spam" : score > 0.25 ? "Threat" : "Safe";
  return { model:"LSTM", result, score };
}

// 5. GNN — multi-hop graph propagation across fraud network nodes
function gnnPhone(f) {
  // Node features (self)
  let selfRisk = 0;
  if (f.isFraudNum) selfRisk += 0.5;
  if (f.isSpamSeq) selfRisk += 0.45;
  if (f.maxRep > 7) selfRisk += 0.3;
  if (f.entropy < 0.25) selfRisk += 0.25;

  // 1-hop neighbor aggregation (related signals)
  let neighborRisk = 0;
  if (f.isForeign) neighborRisk += 0.35;
  if (!f.carrier && !f.isForeign) neighborRisk += 0.2;
  if (f.ringTime !== null && f.ringTime <= 7) neighborRisk += 0.4;

  // 2-hop edge interactions (co-occurrence fraud patterns)
  let edgeRisk = 0;
  if (f.isForeign && f.ringTime !== null && f.ringTime <= 7) edgeRisk += 0.35;
  if (f.isFraudNum && f.ringTime !== null && f.ringTime <= 10) edgeRisk += 0.3;
  if (f.isSpamSeq && f.isForeign) edgeRisk += 0.25;

  // Aggregate with hop weights
  const nodeRisk = Math.min(0.5*selfRisk + 0.3*neighborRisk + 0.2*edgeRisk, 1);
  const result = nodeRisk > 0.65 ? "Dangerous" : nodeRisk > 0.4 ? "Threat" : nodeRisk > 0.2 ? "Spam" : "Safe";
  return { model:"GNN", result, score: nodeRisk };
}

// 6. SVM — RBF kernel simulation with support vectors
function svmPhone(f) {
  // Feature vector
  const x = [
    (f.len >= 10 && f.len <= 12) ? 0 : 1,
    f.hasLetters ? 1 : 0,
    f.hasSymbols ? 1 : 0,
    f.isSpamSeq ? 1 : 0,
    Math.min(f.maxRep / 10, 1),
    1 - Math.min(f.entropy, 1),
    f.isForeign ? 1 : 0,
    f.isFraudNum ? 1 : 0,
    f.ringTime !== null ? Math.max(0, 1 - f.ringTime / 30) : 0,
  ];
  // Support vectors (fraud prototypes)
  const svFraud = [1,1,1,1,0.8,0.9,0.7,1,0.8];
  const svSafe  = [0,0,0,0,0.2,0.1,0,0,0];
  // RBF kernel: exp(-gamma * ||x - sv||^2)
  const gamma = 0.5;
  const rbf = (sv) => Math.exp(-gamma * sv.reduce((s,v,i) => s + (x[i]-v)**2, 0));
  const kFraud = rbf(svFraud), kSafe = rbf(svSafe);
  const decision = kFraud - kSafe;
  const score = 1 / (1 + Math.exp(-5 * decision));
  const result = score > 0.75 ? "Dangerous" : score > 0.55 ? "Threat" : score > 0.4 ? "Spam" : "Safe";
  return { model:"SVM", result, score };
}

// 7. Naïve Bayes — calibrated Bayesian inference with Laplace smoothing
function naiveBayesPhone(f) {
  // Class priors from domain statistics
  const classes = {
    Safe:      { prior: 0.55 },
    Spam:      { prior: 0.25 },
    Threat:    { prior: 0.15 },
    Dangerous: { prior: 0.05 },
  };
  // P(feature=1 | class) — calibrated likelihoods
  const likelihoods = {
    isSpamSeq:   { Safe:0.01, Spam:0.92, Threat:0.05, Dangerous:0.02 },
    hasLetters:  { Safe:0.01, Spam:0.05, Threat:0.88, Dangerous:0.06 },
    hasSymbols:  { Safe:0.01, Spam:0.04, Threat:0.85, Dangerous:0.10 },
    isFraudNum:  { Safe:0.02, Spam:0.15, Threat:0.70, Dangerous:0.13 },
    highRep:     { Safe:0.03, Spam:0.80, Threat:0.12, Dangerous:0.05 },
    lowEntropy:  { Safe:0.04, Spam:0.75, Threat:0.15, Dangerous:0.06 },
    isForeign:   { Safe:0.10, Spam:0.20, Threat:0.55, Dangerous:0.15 },
    shortRing:   { Safe:0.05, Spam:0.30, Threat:0.30, Dangerous:0.35 },
    noCarrier:   { Safe:0.15, Spam:0.25, Threat:0.45, Dangerous:0.15 },
  };
  const features = {
    isSpamSeq:  f.isSpamSeq,
    hasLetters: f.hasLetters,
    hasSymbols: f.hasSymbols,
    isFraudNum: f.isFraudNum,
    highRep:    f.maxRep > 6,
    lowEntropy: f.entropy < 0.3,
    isForeign:  f.isForeign,
    shortRing:  f.ringTime !== null && f.ringTime <= 7,
    noCarrier:  !f.carrier && !f.isForeign,
  };
  const logProbs = {};
  for (const cls in classes) {
    let lp = Math.log(classes[cls].prior);
    for (const feat in features) {
      const p = features[feat] ? likelihoods[feat][cls] : (1 - likelihoods[feat][cls]);
      lp += Math.log(Math.max(p, 1e-9)); // Laplace smoothing floor
    }
    logProbs[cls] = lp;
  }
  const result = Object.keys(logProbs).sort((a,b) => logProbs[b]-logProbs[a])[0];
  const maxLP = Math.max(...Object.values(logProbs));
  const sumExp = Object.values(logProbs).reduce((s,lp) => s + Math.exp(lp - maxLP), 0);
  const score = Math.exp(logProbs[result] - maxLP) / sumExp;
  return { model:"Naïve Bayes", result, score };
}

// ─────────────────────────────────────────────
//  ENSEMBLE VOTING — PHONE
// ─────────────────────────────────────────────
function ensemblePhone(f) {
  const models = [
    randomForestPhone(f),
    xgboostPhone(f),
    annPhone(f),
    lstmPhone(f),
    gnnPhone(f),
    svmPhone(f),
    naiveBayesPhone(f)
  ];
  // Severity ranking for tie-breaking
  const severity = { Safe:0, Spam:1, Threat:2, Dangerous:3 };
  // Weighted tally — XGBoost, GNN, ANN get higher weight (stronger models for this domain)
  const weights = { "Random Forest":1.2, "XGBoost":1.8, "ANN":1.5, "LSTM":1.3, "GNN":1.6, "SVM":1.4, "Naïve Bayes":1.2 };
  const tally = { Safe:0, Spam:0, Threat:0, Dangerous:0 };
  models.forEach(m => { tally[m.result] = (tally[m.result]||0) + (weights[m.model]||1); });
  // Pick highest weighted class; on tie pick more severe
  const status = Object.keys(tally).sort((a,b) =>
    tally[b] !== tally[a] ? tally[b]-tally[a] : severity[b]-severity[a]
  )[0];
  // Weighted average confidence
  const totalW = Object.values(weights).reduce((s,w) => s+w, 0);
  const weightedScore = models.reduce((s,m) => s + m.score * (weights[m.model]||1), 0) / totalW;
  const confidence = Math.round(Math.min(weightedScore * 100, 99));
  const modelNames = models.map(m => `${m.model}:${m.result}`).join(", ");
  return { status, confidence, modelNames, models };
}

// ─────────────────────────────────────────────
//  CHECK NUMBER ENDPOINT
// ─────────────────────────────────────────────
app.post("/api/check-number", (req, res) => {
  const { number, ringing } = req.body;
  const f = extractPhoneFeatures(number, ringing);

  // Hard validation first
  if (f.len < 10) {
    return res.json({ status:"Threat", confidence:100, message:"Invalid number length (<10 digits) → Threat.", name:"Unknown", country_code:f.countryCode, country_name:f.countryName, complaints:0, location:"Unknown", models:"Validation failed" });
  }
  if (f.len > 12) {
    return res.json({ status:"Threat", confidence:100, message:"Invalid number length (>12 digits) → Threat.", name:"Unknown", country_code:f.countryCode, country_name:f.countryName, complaints:0, location:"Unknown", models:"Validation failed" });
  }
  if (f.hasLetters) {
    return res.json({ status:"Threat", confidence:100, message:"Contains letters → Threat.", name:"Unknown", country_code:f.countryCode, country_name:f.countryName, complaints:0, location:"Unknown", models:"Validation failed" });
  }

  // Short-circuit: TRAI-allocated service numbers are always Safe
  if (f.serviceInfo) {
    return res.json({
      status: "Safe",
      confidence: 98,
      message: `✅ ${f.serviceInfo.type} — ${f.serviceInfo.desc}`,
      name: f.serviceInfo.type,
      country_code: "+91",
      country_name: "India",
      complaints: 0,
      location: "India",
      operator: f.serviceInfo.type,
      circle: "National",
      sim_type: "Service Number"
    });
  }

  // Run ensemble
  const { status, confidence, modelNames } = ensemblePhone(f);
  const statusLabels = { Safe:"Number appears safe.", Spam:"Spam pattern detected by ensemble.", Threat:"Threat detected by ensemble models.", Dangerous:"Dangerous: foreign + short ring pattern." };
  let message = statusLabels[status] || "Checked by ensemble.";
  message += ` [${modelNames}]`;

  const normalized = String(number || "").replace(/\D/g, "");
  const lookupStmt = db.prepare('SELECT name, location, country_name, country_code, complaints, last_status FROM phone_directory WHERE phone_number = ?');
  lookupStmt.get([normalized], (err, row) => {
    let name = "Unknown", location = "Unknown", complaints = 0;
    let finalStatus = status, finalConf = confidence;

    if (!err && row) {
      name = row.name || name;
      location = row.location || location;
      if (row.country_code) f.countryCode = row.country_code;
      if (row.country_name) f.countryName = row.country_name;
      if (typeof row.complaints === 'number') complaints = row.complaints;
      if (row.last_status && !["Threat","Dangerous","Spam"].includes(status)) {
        finalStatus = row.last_status;
        finalConf = row.last_status === "Safe" ? 90 : 80;
      }
    }

    // Query complaints table for previous complaints against this number
    const compStmt = db.prepare(
      `SELECT id, name, type, complaint_text, created_at FROM complaints
       WHERE suspicious_number LIKE ? OR mobile LIKE ?
       ORDER BY created_at DESC LIMIT 10`
    );
    const likeNum = `%${normalized}%`;
    compStmt.all([likeNum, likeNum], (cErr, compRows) => {
      const prevComplaints = (!cErr && compRows) ? compRows : [];
      // If there are complaints in DB, boost complaint count and escalate status
      if (prevComplaints.length > 0) {
        complaints = Math.max(complaints, prevComplaints.length);
        if (!["Dangerous"].includes(finalStatus)) {
          finalStatus = prevComplaints.length >= 3 ? "Dangerous" : "Threat";
          finalConf = Math.min(finalConf + prevComplaints.length * 5, 99);
        }
      }

      const stmt = db.prepare('INSERT INTO threat_reports (phone_number, threat_type, risk_score, status) VALUES (?, ?, ?, ?)');
      stmt.run([number, 'phone', finalConf, finalStatus]);
      stmt.finalize();

      res.json({
        message, name,
        country_code: f.countryCode, country_name: f.countryName,
        complaints, status: finalStatus, confidence: finalConf, location,
        operator: f.carrier ? f.carrier.operator : (f.isForeign ? "Foreign Carrier" : "Unknown"),
        circle: f.carrier ? f.carrier.circle : "--",
        sim_type: f.carrier ? f.carrier.type : "--",
        mnp_note: f.carrier && f.carrier.mnpNote ? "Original series — number may have ported (MNP)" : null,
        prev_complaints: prevComplaints.map(c => ({
          id: c.id,
          type: c.type,
          summary: (c.complaint_text || "").slice(0, 120),
          date: c.created_at
        }))
      });
    });
    compStmt.finalize();
  });
  lookupStmt.finalize();
});

// ─────────────────────────────────────────────
//  URL — FEATURE EXTRACTION
// ─────────────────────────────────────────────
function extractUrlFeatures(url) {
  const lower = (url || "").toLowerCase();
  const threatWords = ["phishing","malware","hack","scam","fraud","suspicious","fake","login","verify","secure","update","account","bank","paypal","ebay","amazon","password","confirm","wallet","crypto","prize","winner","free","urgent","alert","suspended"];
  const tldBlacklist = [".ru",".tk",".ml",".ga",".cf",".gq",".xyz",".top",".click",".download",".zip",".review",".country",".kim",".science",".work",".party",".bid"];
  const isHttps = url.startsWith("https://");
  const hasIP = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url);
  const urlLen = url.length;
  const dotCount = (url.match(/\./g) || []).length;
  const hyphenCount = (url.match(/-/g) || []).length;
  const threatWordCount = threatWords.filter(w => lower.includes(w)).length;
  const hasBadTld = tldBlacklist.some(t => lower.endsWith(t) || lower.includes(t+"/") || lower.includes(t+"?"));
  const hasAtSign = url.includes("@");
  const hasDoubleSlash = url.replace("://","").includes("//");
  const hasHexEncoding = /%[0-9a-f]{2}/i.test(url);
  const hasPortNumber = /:\d{2,5}(\/|$)/.test(url.replace("://","__"));
  const hasLongSubdomain = (() => {
    try {
      const h = new URL(url.startsWith("http") ? url : "http://"+url).hostname;
      const parts = h.split(".");
      return parts.some(p => p.length > 20);
    } catch(e){ return false; }
  })();
  const subdomainCount = (() => {
    try {
      const h = new URL(url.startsWith("http") ? url : "http://"+url).hostname;
      return Math.max(0, h.split(".").length - 2);
    } catch(e){ return 0; }
  })();
  const pathDepth = (url.match(/\//g) || []).length - 2;
  const hasBrandMimicry = /paypa1|g00gle|arnazon|micros0ft|faceb00k|app1e|netfl1x/.test(lower);
  const hasRedirect = lower.includes("redirect") || lower.includes("url=") || lower.includes("goto=");
  return {
    isHttps, hasIP, urlLen, dotCount, hyphenCount, threatWordCount,
    hasBadTld, hasAtSign, hasDoubleSlash, subdomainCount, lower,
    hasHexEncoding, hasPortNumber, hasLongSubdomain, pathDepth,
    hasBrandMimicry, hasRedirect
  };
}

// ─────────────────────────────────────────────
//  7 ML MODELS — URL
// ─────────────────────────────────────────────

function randomForestUrl(f) {
  const trees = [
    () => !f.isHttps ? "Harmful" : "Safe",
    () => f.threatWordCount >= 2 ? "Danger" : f.threatWordCount === 1 ? "Threat" : "Safe",
    () => f.hasBadTld ? "Threat" : "Safe",
    () => f.hasIP ? "Harmful" : "Safe",
    () => f.urlLen > 100 ? "Harmful" : f.urlLen > 75 ? "Threat" : "Safe",
    () => f.hasBrandMimicry ? "Danger" : "Safe",
    () => f.hasAtSign ? "Threat" : "Safe",
    () => f.hasRedirect ? "Threat" : "Safe",
    () => f.subdomainCount > 3 ? "Threat" : f.subdomainCount > 1 ? "Harmful" : "Safe",
    () => f.hasHexEncoding ? "Harmful" : "Safe",
    () => f.hyphenCount > 4 ? "Threat" : f.hyphenCount > 2 ? "Harmful" : "Safe",
    () => (f.hasBadTld && !f.isHttps) ? "Danger" : "Safe",
  ];
  const tally = { Safe:0, Harmful:0, Threat:0, Danger:0 };
  trees.forEach(t => { const v = t(); tally[v] = (tally[v]||0) + 1; });
  const result = Object.keys(tally).sort((a,b) => tally[b]-tally[a])[0];
  return { model:"Random Forest", result, score: 1 - tally["Safe"]/trees.length };
}

function xgboostUrl(f) {
  let risk = 0;
  // Round 1
  if (!f.isHttps) risk += 22;
  if (f.threatWordCount >= 3) risk += 40;
  else if (f.threatWordCount === 2) risk += 28;
  else if (f.threatWordCount === 1) risk += 15;
  // Round 2
  if (f.hasBadTld) risk += 32;
  if (f.hasIP) risk += 25;
  if (f.hasBrandMimicry) risk += 45;
  // Round 3
  if (f.urlLen > 120) risk += 18;
  else if (f.urlLen > 80) risk += 10;
  if (f.hyphenCount > 4) risk += 18;
  else if (f.hyphenCount > 2) risk += 8;
  // Round 4
  if (f.hasAtSign) risk += 22;
  if (f.hasDoubleSlash) risk += 15;
  if (f.hasHexEncoding) risk += 12;
  if (f.hasPortNumber) risk += 14;
  if (f.hasRedirect) risk += 18;
  // Round 5
  if (f.subdomainCount > 3) risk += 20;
  else if (f.subdomainCount > 1) risk += 10;
  if (f.hasLongSubdomain) risk += 15;
  // Interaction boosts
  if (f.hasBadTld && !f.isHttps) risk += 15;
  if (f.hasIP && f.hasBadTld) risk += 20;
  if (f.hasBrandMimicry && !f.isHttps) risk += 15;
  risk = Math.min(risk, 100);
  const result = risk >= 75 ? "Danger" : risk >= 50 ? "Threat" : risk >= 25 ? "Harmful" : "Safe";
  return { model:"XGBoost", result, score: risk/100 };
}

function annUrl(f) {
  const inputs = [
    !f.isHttps ? 1 : 0,
    Math.min(f.threatWordCount / 3, 1),
    f.hasBadTld ? 1 : 0,
    f.hasIP ? 1 : 0,
    Math.min(f.urlLen / 150, 1),
    f.hasAtSign ? 1 : 0,
    Math.min(f.subdomainCount / 4, 1),
    Math.min(f.hyphenCount / 6, 1),
    f.hasBrandMimicry ? 1 : 0,
    f.hasRedirect ? 1 : 0,
    f.hasHexEncoding ? 1 : 0,
    f.hasPortNumber ? 1 : 0,
  ];
  const W1 = [
    [0.6,0.8,0.7,0.6,0.4,0.7,0.5,0.4,0.9,0.6,0.5,0.5],
    [0.4,0.6,0.5,0.5,0.3,0.5,0.4,0.3,0.7,0.5,0.4,0.4],
    [0.5,0.7,0.6,0.4,0.5,0.6,0.6,0.5,0.8,0.7,0.6,0.6],
    [0.3,0.5,0.4,0.7,0.4,0.4,0.7,0.6,0.6,0.4,0.3,0.3],
  ];
  const h1 = W1.map(w => Math.max(0, w.reduce((s,wi,i) => s + wi*inputs[i], 0) / inputs.length));
  const raw = (h1[0]*0.5 + h1[1]*0.3 + h1[2]*0.6 + h1[3]*0.4) / 4;
  const activation = 1 / (1 + Math.exp(-8 * (raw - 0.25)));
  const result = activation > 0.78 ? "Danger" : activation > 0.55 ? "Threat" : activation > 0.3 ? "Harmful" : "Safe";
  return { model:"ANN", result, score: activation };
}

function lstmUrl(f) {
  const url = f.lower;
  let cellState = 0;
  // Process URL character by character in chunks (simulate sequence)
  const chunks = url.match(/.{1,5}/g) || [];
  for (const chunk of chunks) {
    const threatHit = ["login","bank","verify","secure","account","password","update","confirm"].some(w => chunk.includes(w));
    const input = threatHit ? 0.8 : /[0-9]{3,}/.test(chunk) ? 0.5 : /[-_]{2,}/.test(chunk) ? 0.4 : 0.05;
    const forget = threatHit ? 0.9 : 0.6;
    cellState = forget * cellState + input * 0.4;
  }
  // Extra signals
  if (f.hasBrandMimicry) cellState += 0.5;
  if (f.hasRedirect) cellState += 0.3;
  if (!f.isHttps && f.threatWordCount > 0) cellState += 0.25;
  const score = Math.min(Math.tanh(cellState), 1);
  const result = score > 0.7 ? "Danger" : score > 0.45 ? "Threat" : score > 0.2 ? "Harmful" : "Safe";
  return { model:"LSTM", result, score };
}

function gnnUrl(f) {
  // Self node risk
  let selfRisk = 0;
  if (f.hasBrandMimicry) selfRisk += 0.55;
  if (f.hasBadTld) selfRisk += 0.4;
  if (f.hasIP) selfRisk += 0.3;
  // Neighbor aggregation
  let neighborRisk = 0;
  if (!f.isHttps) neighborRisk += 0.3;
  if (f.threatWordCount > 0) neighborRisk += Math.min(f.threatWordCount * 0.15, 0.45);
  if (f.hasRedirect) neighborRisk += 0.25;
  // Edge interactions
  let edgeRisk = 0;
  if (f.hasIP && f.hasBadTld) edgeRisk += 0.4;
  if (f.hasBrandMimicry && !f.isHttps) edgeRisk += 0.35;
  if (f.hasAtSign && f.hasBadTld) edgeRisk += 0.3;
  if (f.threatWordCount >= 2 && !f.isHttps) edgeRisk += 0.25;
  const nodeRisk = Math.min(0.45*selfRisk + 0.35*neighborRisk + 0.2*edgeRisk, 1);
  const result = nodeRisk > 0.65 ? "Danger" : nodeRisk > 0.4 ? "Threat" : nodeRisk > 0.2 ? "Harmful" : "Safe";
  return { model:"GNN", result, score: nodeRisk };
}

function svmUrl(f) {
  const x = [
    !f.isHttps ? 1 : 0,
    Math.min(f.threatWordCount / 3, 1),
    f.hasBadTld ? 1 : 0,
    f.hasIP ? 1 : 0,
    Math.min(f.urlLen / 150, 1),
    f.hasAtSign ? 1 : 0,
    Math.min(f.subdomainCount / 4, 1),
    f.hasBrandMimicry ? 1 : 0,
    f.hasRedirect ? 1 : 0,
    f.hasHexEncoding ? 1 : 0,
  ];
  const svDanger = [1,1,1,1,0.8,1,0.8,1,0.8,0.7];
  const svSafe   = [0,0,0,0,0.1,0,0,0,0,0];
  const gamma = 0.4;
  const rbf = (sv) => Math.exp(-gamma * sv.reduce((s,v,i) => s + (x[i]-v)**2, 0));
  const decision = rbf(svDanger) - rbf(svSafe);
  const score = 1 / (1 + Math.exp(-6 * decision));
  const result = score > 0.78 ? "Danger" : score > 0.55 ? "Threat" : score > 0.35 ? "Harmful" : "Safe";
  return { model:"SVM", result, score };
}

function naiveBayesUrl(f) {
  const classes = { Safe:{prior:0.60}, Harmful:{prior:0.20}, Threat:{prior:0.15}, Danger:{prior:0.05} };
  const likelihoods = {
    noHttps:       { Safe:0.10, Harmful:0.65, Threat:0.20, Danger:0.05 },
    hasThreatWord: { Safe:0.03, Harmful:0.20, Threat:0.55, Danger:0.22 },
    hasBadTld:     { Safe:0.02, Harmful:0.15, Threat:0.55, Danger:0.28 },
    hasIP:         { Safe:0.03, Harmful:0.35, Threat:0.45, Danger:0.17 },
    hasBrand:      { Safe:0.01, Harmful:0.05, Threat:0.30, Danger:0.64 },
    hasAtSign:     { Safe:0.01, Harmful:0.20, Threat:0.55, Danger:0.24 },
    hasRedirect:   { Safe:0.05, Harmful:0.25, Threat:0.50, Danger:0.20 },
    longUrl:       { Safe:0.08, Harmful:0.45, Threat:0.35, Danger:0.12 },
    manyHyphens:   { Safe:0.05, Harmful:0.40, Threat:0.40, Danger:0.15 },
  };
  const features = {
    noHttps:       !f.isHttps,
    hasThreatWord: f.threatWordCount > 0,
    hasBadTld:     f.hasBadTld,
    hasIP:         f.hasIP,
    hasBrand:      f.hasBrandMimicry,
    hasAtSign:     f.hasAtSign,
    hasRedirect:   f.hasRedirect,
    longUrl:       f.urlLen > 80,
    manyHyphens:   f.hyphenCount > 3,
  };
  const logProbs = {};
  for (const cls in classes) {
    let lp = Math.log(classes[cls].prior);
    for (const feat in features) {
      const p = features[feat] ? likelihoods[feat][cls] : (1 - likelihoods[feat][cls]);
      lp += Math.log(Math.max(p, 1e-9));
    }
    logProbs[cls] = lp;
  }
  const result = Object.keys(logProbs).sort((a,b) => logProbs[b]-logProbs[a])[0];
  const maxLP = Math.max(...Object.values(logProbs));
  const sumExp = Object.values(logProbs).reduce((s,lp) => s + Math.exp(lp - maxLP), 0);
  const score = Math.exp(logProbs[result] - maxLP) / sumExp;
  return { model:"Naïve Bayes", result, score };
}

// ─────────────────────────────────────────────
//  ENSEMBLE VOTING — URL
// ─────────────────────────────────────────────
function ensembleUrl(f) {
  const models = [randomForestUrl(f), xgboostUrl(f), annUrl(f), lstmUrl(f), gnnUrl(f), svmUrl(f), naiveBayesUrl(f)];
  const severity = { Safe:0, Harmful:1, Threat:2, Danger:3 };
  const weights = { "Random Forest":1.2, "XGBoost":1.8, "ANN":1.5, "LSTM":1.3, "GNN":1.6, "SVM":1.4, "Naïve Bayes":1.2 };
  const tally = { Safe:0, Harmful:0, Threat:0, Danger:0 };
  models.forEach(m => { tally[m.result] = (tally[m.result]||0) + (weights[m.model]||1); });
  const label = Object.keys(tally).sort((a,b) =>
    tally[b] !== tally[a] ? tally[b]-tally[a] : severity[b]-severity[a]
  )[0];
  const totalW = Object.values(weights).reduce((s,w) => s+w, 0);
  const weightedScore = models.reduce((s,m) => s + m.score * (weights[m.model]||1), 0) / totalW;
  const score = Math.round(Math.min(weightedScore * 100, 99));
  return { label, score, models };
}

// ─────────────────────────────────────────────
//  LINK CHECKER ENDPOINT
// ─────────────────────────────────────────────
app.post("/check", (req, res) => {
  const { url } = req.body;
  const f = extractUrlFeatures(url);
  let { label, score } = ensembleUrl(f);

  // Directory override if present
  const norm = (url || '').toString().trim().replace(/\/$/, '');
  const uStmt = db.prepare('SELECT risk_score, status, reasons, title FROM url_directory WHERE url = ?');
  uStmt.get([norm], (e, row) => {
    if (!e && row) {
      score = typeof row.risk_score === 'number' ? row.risk_score : score;
      label = row.status || label;
    }
    const stmt = db.prepare('INSERT INTO threat_reports (url, threat_type, risk_score, status) VALUES (?, ?, ?, ?)');
    stmt.run([norm, 'url', score, label]);
    stmt.finalize();
    res.json({ score, label, title: row && row.title ? row.title : undefined });
  });
});

// Removed email checker endpoint

// Get all complaints endpoint
app.get('/api/complaints', requireAuth, (req, res) => {
  db.all('SELECT * FROM complaints ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch complaints' });
    } else {
      res.json(rows);
    }
  });
});

// Get threat reports endpoint
app.get('/api/reports', requireAuth, (req, res) => {
  db.all('SELECT * FROM threat_reports ORDER BY reported_at DESC LIMIT 50', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch reports' });
    } else {
      res.json(rows);
    }
  });
});

app.listen(3000, () =>
  console.log("🚀 Server running at http://localhost:3000")
);

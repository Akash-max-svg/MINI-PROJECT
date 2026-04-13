# Cyber Threat Checkur

AI-powered fraud detection system for phone numbers and malicious URLs.

## Project Structure

```
MINI-PROJECT-main/
├── backend/              ← Node.js + Express + SQLite
│   ├── server.js         ← Main server (API + static serving)
│   ├── database.js       ← SQLite setup & schema
│   ├── database.sql      ← SQL schema reference
│   ├── import-phones.js  ← Import phone CSV data
│   ├── import-emails.js  ← Import email CSV data
│   ├── import-urls.js    ← Import URL CSV data
│   ├── emails_sample.csv ← Sample data
│   └── package.json
│
└── frontend/             ← HTML + CSS + JS (served by backend)
    ├── index.html        ← Home page
    ├── login.html        ← Login / Register
    ├── number.html       ← Phone number checker
    ├── link.html         ← URL / link checker
    ├── complaint.html    ← File a complaint
    ├── style.css         ← Shared styles
    ├── script.js         ← Shared auth helpers
    └── assets/
        └── images/       ← All image assets
```

## Setup & Run

```bash
cd backend
npm install
npm start
```

Open: http://localhost:3000

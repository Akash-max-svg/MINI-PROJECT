# MySQL Workbench Setup Instructions

## 1. Install MySQL Server & Workbench
- Download MySQL Server from https://dev.mysql.com/downloads/mysql/
- Download MySQL Workbench from https://dev.mysql.com/downloads/workbench/

## 2. Setup Database
1. Open MySQL Workbench
2. Create new connection (localhost:3306)
3. Execute the SQL script from `database.sql`

## 3. Update Database Configuration
Edit `database.js` and update:
```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'YOUR_MYSQL_PASSWORD', // Change this
  database: 'cyber_threat_db'
};
```

## 4. Run Application
```bash
npm start
```

Access at: http://localhost:3000
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'PHONE1',      // <-- Update this if your MySQL password is different
  database: 'heat_risk_db'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Connected to MySQL');
});

// Create table if not exists
const createTableQuery = `
CREATE TABLE IF NOT EXISTS user_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  age INT,
  conditions TEXT,
  location VARCHAR(255),
  coordinates TEXT,
  temperature FLOAT,
  humidity FLOAT,
  risk VARCHAR(50),
  timestamp DATETIME
)`;
db.query(createTableQuery);

// API route to receive user data
app.post('/submit', (req, res) => {
  const {
    age, conditions, location, coordinates,
    temperature, humidity, risk, timestamp
  } = req.body;

  // Format the ISO timestamp string to MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS'
  const formattedTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

  const sql = `
    INSERT INTO user_data 
    (age, conditions, location, coordinates, temperature, humidity, risk, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    age,
    Array.isArray(conditions) ? conditions.join(',') : conditions,
    location,
    JSON.stringify(coordinates),
    temperature,
    humidity,
    risk,
    formattedTimestamp
  ], (err, result) => {
    if (err) {
      console.error('❌ DB insert error:', err);
      return res.status(500).json({ error: 'Database insert failed' });
    }
    res.status(200).json({ message: '✅ Data saved to MySQL', id: result.insertId });
  });
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});

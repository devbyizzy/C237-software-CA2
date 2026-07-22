const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'c237-eaint-mysql.mysql.database.azure.com',
  user: 'c237_001',
  password: 'c237001@2026!',
  database: 'c237_001_teamcmi',
  ssl: { rejectUnauthorized: true }
});

module.exports = pool;

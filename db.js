// db.js - one shared MySQL connection pool for the whole app.
// Every route file require()s this, runs SQL with pool.query(),
// and gets the database response back as a JavaScript array.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'rpconnect',
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;

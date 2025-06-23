const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../config.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // для локальной сети
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function connectDB() {
    try {
        await sql.connect(config);
        console.log('Connected to MSSQL');
    } catch (err) {
        console.error('Database Connection Failed! Bad Config: ', err);
    }
}

module.exports = {
    sql,
    connectDB
}; 
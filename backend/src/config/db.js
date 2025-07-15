const sql = require('mssql');
const path = require('path');
const { logger } = require('./logger');
require('dotenv').config({ path: path.join(__dirname, '../../config.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, 
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function connectDB() {
    try {
        await sql.connect(config);
        logger.verbose('Connect MSSQL');
    } catch (err) {
        logger.error('DB Connection Fail. Config error: ', err);
    }
}

module.exports = {
    sql,
    connectDB
}; 
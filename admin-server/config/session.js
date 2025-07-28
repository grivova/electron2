const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

module.exports = (session) => {
  return {
    secret: process.env.SECRET_KEY || 'mhmh4563463fds',
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore({
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    }),
    cookie: { 
      secure: false, 
      httpOnly: true, 
      maxAge: 10 * 60 * 60 * 1000 
    }
  };
};
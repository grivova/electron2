const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());

module.exports = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin not allowed'), false);
  },
  credentials: true
};
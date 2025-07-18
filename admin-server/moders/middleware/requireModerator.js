function requireModerator(req, res, next) {
  if (req.session && req.session.isModerator) return next();
  res.status(401).send('Unauthorized');
}
 
module.exports = requireModerator; 
module.exports = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

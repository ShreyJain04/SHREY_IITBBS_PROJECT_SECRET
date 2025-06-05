const adminAuth = (req, res, next) => {
  
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
  
  const ADMIN_KEY = process.env.ADMIN_API_KEY || 'admin123';
  
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin access required. Please provide valid admin key in x-admin-key header.'
    });
  }
  
  next();
};

module.exports = { adminAuth };
// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // From .env file

// Middleware to protect routes
const protect = (req, res, next) => {
	let token;

	// Check for token in Authorization header (Bearer token)
	if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
		try {
			// Get token from header (e.g., "Bearer <token>")
			token = req.headers.authorization.split(' ')[1];

			// Verify token
			const decoded = jwt.verify(token, JWT_SECRET);

			// Add decoded user payload (id, username, role) to request object
			// This makes it available in subsequent route handlers
			req.user = {
				id: decoded.userId, // Ensure consistency with token payload
				username: decoded.username,
				role: decoded.role
			};
			next(); // Proceed to the next middleware or route handler
		} catch (error) {
			console.error('Token verification error:', error.message);
			return res.status(401).json({ error: 'Not authorized, token failed' });
		}
	}

	if (!token) {
		return res.status(401).json({ error: 'Not authorized, no token provided' });
	}
};

// Middleware to authorize based on roles
const authorize = (...roles) => {
	return (req, res, next) => {
		if (!req.user || !roles.includes(req.user.role)) {
			return res.status(403).json({ error: `Access denied. User role '${req.user ? req.user.role : 'unknown'}' is not authorized for this resource.` });
		}
		next();
	};
};

module.exports = { protect, authorize };

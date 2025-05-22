// backend/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db'); // Assuming db.js exports the db instance

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', (req, res) => {
	const { email, password } = req.body;

	// Basic validation
	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password are required.' });
	}

	const sql = `SELECT id, username, email, password_hash, role FROM users WHERE email = ?`;
	db.get(sql, [email], async (err, user) => {
		if (err) {
			console.error("Database error during login:", err.message);
			return res.status(500).json({ error: 'Server error during login.' });
		}

		// Check if user exists
		if (!user) {
			return res.status(401).json({ error: 'Invalid credentials.' }); // Generic error
		}

		// Compare submitted password with stored hashed password
		try {
			const isMatch = await bcrypt.compare(password, user.password_hash);
			if (!isMatch) {
				return res.status(401).json({ error: 'Invalid credentials.' }); // Generic error
			}

			// User authenticated, create JWT
			const payload = {
				userId: user.id,
				username: user.username,
				role: user.role,
			};

			const token = jwt.sign(
				payload,
				JWT_SECRET,
				{ expiresIn: '12h' } // Token expires in 12 hours
			);

			res.json({
				message: 'Login successful!',
				token: token,
				user: { // Send back some user info (excluding password hash)
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role,
				},
			});

		} catch (compareError) {
			console.error("Error comparing passwords:", compareError);
			return res.status(500).json({ error: 'Server error during authentication.' });
		}
	});
});


// Placeholder for Password Reset routes (to be implemented later)
// router.post('/request-password-reset', (req, res) => { /* ... */ });
// router.post('/reset-password', (req, res) => { /* ... */ });


// (Optional) A protected route to test token verification
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware
router.get('/me', protect, (req, res) => {
	// If protect middleware passes, req.user will be populated
	// Fetch full user details again to ensure freshness and avoid sending sensitive data in token if not needed
	const sql = `SELECT id, username, email, role FROM users WHERE id = ?`;
	db.get(sql, [req.user.id], (err, user) => {
		if (err) {
			return res.status(500).json({ error: "Error fetching user details." });
		}
		if (!user) {
			return res.status(404).json({ error: "User not found." });
		}
		res.json(user);
	});
});


module.exports = router;

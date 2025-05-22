// backend/routes/characterRoutes.js
const express = require('express');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware'); // Import protect and authorize

const router = express.Router();

// --- All routes below are protected ---
router.use(protect); // Apply protect middleware to all routes in this file

// GET /api/characters - Get all character sheets for the logged-in user
router.get('/', (req, res) => {
	const userId = req.user.id; // req.user is populated by the 'protect' middleware

	const sql = `SELECT id, user_id, sheet_name, updated_at FROM character_sheets WHERE user_id = ? ORDER BY updated_at DESC`;
	db.all(sql, [userId], (err, rows) => {
		if (err) {
			console.error("Database error fetching character sheets:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve character sheets.' });
		}
		res.json(rows);
	});
});

// POST /api/characters - Create a new character sheet
router.post('/', (req, res) => {
	const userId = req.user.id;
	const { sheet_name, character_data } = req.body;

	if (!character_data || typeof character_data !== 'object') {
		return res.status(400).json({ error: 'Valid character_data (JSON object) is required.' });
	}

	const characterDataJson = JSON.stringify(character_data);
	const finalSheetName = sheet_name || 'New Character'; // Default name if not provided

	const sql = `INSERT INTO character_sheets (user_id, sheet_name, character_data) VALUES (?, ?, ?)`;
	db.run(sql, [userId, finalSheetName, characterDataJson], function (err) { // Use function() for this.lastID
		if (err) {
			console.error("Database error creating character sheet:", err.message);
			return res.status(500).json({ error: 'Failed to create character sheet.' });
		}
		res.status(201).json({
			id: this.lastID,
			user_id: userId,
			sheet_name: finalSheetName,
			character_data: character_data, // Send back the parsed object
			message: 'Character sheet created successfully.'
		});
	});
});

// GET /api/characters/:id - Get a specific character sheet by its ID
router.get('/:id', (req, res) => {
	const sheetId = req.params.id;
	const userId = req.user.id;

	// Ensure the user owns this sheet or is a DM (DMs can view all sheets - optional logic)
	const sql = `SELECT * FROM character_sheets WHERE id = ? AND user_id = ?`;
	// If DMs can see all:
	// const sql = req.user.role === 'DM' ?
	//   `SELECT * FROM character_sheets WHERE id = ?` :
	//   `SELECT * FROM character_sheets WHERE id = ? AND user_id = ?`;
	// const params = req.user.role === 'DM' ? [sheetId] : [sheetId, userId];

	db.get(sql, [sheetId, userId], (err, row) => {
		if (err) {
			console.error("Database error fetching character sheet:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve character sheet.' });
		}
		if (!row) {
			return res.status(404).json({ error: 'Character sheet not found or you are not authorized to view it.' });
		}
		try {
			// Parse the JSON string back into an object
			const characterSheet = { ...row, character_data: JSON.parse(row.character_data) };
			res.json(characterSheet);
		} catch (parseError) {
			console.error("Error parsing character_data from DB:", parseError);
			res.status(500).json({ error: 'Error processing character sheet data.' });
		}
	});
});

// PUT /api/characters/:id - Update an existing character sheet
router.put('/:id', (req, res) => {
	const sheetId = req.params.id;
	const userId = req.user.id;
	const { sheet_name, character_data } = req.body;

	if (!character_data && !sheet_name) {
		return res.status(400).json({ error: 'Either sheet_name or character_data must be provided for update.' });
	}

	let sqlParts = [];
	let params = [];

	if (sheet_name !== undefined) {
		sqlParts.push("sheet_name = ?");
		params.push(sheet_name);
	}
	if (character_data !== undefined) {
		if (typeof character_data !== 'object') {
			return res.status(400).json({ error: 'character_data must be a valid JSON object.' });
		}
		sqlParts.push("character_data = ?");
		params.push(JSON.stringify(character_data));
	}

	// Add sheetId and userId to params for WHERE clause
	params.push(sheetId);
	params.push(userId);

	// The updated_at trigger will handle the timestamp automatically
	const sql = `UPDATE character_sheets SET ${sqlParts.join(', ')} WHERE id = ? AND user_id = ?`;

	db.run(sql, params, function (err) {
		if (err) {
			console.error("Database error updating character sheet:", err.message);
			return res.status(500).json({ error: 'Failed to update character sheet.' });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: 'Character sheet not found or you are not authorized to update it.' });
		}
		res.json({ message: 'Character sheet updated successfully.' });
	});
});

// DELETE /api/characters/:id - Delete a character sheet
router.delete('/:id', (req, res) => {
	const sheetId = req.params.id;
	const userId = req.user.id;

	// Users can only delete their own sheets. DMs might have broader delete powers.
	const sql = `DELETE FROM character_sheets WHERE id = ? AND user_id = ?`;
	// If DMs can delete any:
	// const sql = req.user.role === 'DM' ?
	//   `DELETE FROM character_sheets WHERE id = ?` :
	//   `DELETE FROM character_sheets WHERE id = ? AND user_id = ?`;
	// const params = req.user.role === 'DM' ? [sheetId] : [sheetId, userId];

	db.run(sql, [sheetId, userId], function (err) {
		if (err) {
			console.error("Database error deleting character sheet:", err.message);
			return res.status(500).json({ error: 'Failed to delete character sheet.' });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: 'Character sheet not found or you are not authorized to delete it.' });
		}
		res.json({ message: 'Character sheet deleted successfully.' });
	});
});

module.exports = router;

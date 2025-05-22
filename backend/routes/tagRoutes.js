// backend/routes/tagRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');

// GET /api/tags - List all unique tags
// Accessible to all authenticated users (for suggestions/autocomplete)
router.get('/', protect, (req, res) => {
	const sql = "SELECT id, name FROM tags ORDER BY name ASC";
	db.all(sql, [], (err, rows) => {
		if (err) {
			console.error("Error fetching tags:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve tags.' });
		}
		res.json(rows);
	});
});

// POST /api/tags - Create a new tag (DM Only for direct creation)
// Tags are often created on-the-fly when assigning them to an entity,
// so this endpoint might be less used but good for explicit management.
router.post('/', protect, authorize('DM'), (req, res) => {
	const { name } = req.body;

	if (!name || name.trim() === '') {
		return res.status(400).json({ error: 'Tag name is required.' });
	}

	const tagName = name.trim();

	const sql = "INSERT INTO tags (name) VALUES (?)";
	db.run(sql, [tagName], function (err) {
		if (err) {
			if (err.message.includes('UNIQUE constraint failed: tags.name')) {
				// If tag already exists, find it and return it
				db.get("SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE", [tagName], (findErr, existingTag) => {
					if (findErr) {
						return res.status(500).json({ error: "Error checking for existing tag.", details: findErr.message });
					}
					if (existingTag) {
						return res.status(200).json({ message: 'Tag already exists.', tag: existingTag });
					}
					return res.status(409).json({ error: 'Tag already exists, but failed to retrieve it.' });
				});
			} else {
				console.error("Error creating tag:", err.message);
				return res.status(500).json({ error: 'Failed to create tag.' });
			}
		} else {
			res.status(201).json({ message: 'Tag created successfully', tag: { id: this.lastID, name: tagName } });
		}
	});
});


module.exports = router;

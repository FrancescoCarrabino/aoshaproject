// backend/routes/npcRoutes.js
const express = require('express');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadNpcImage, npcImageDir } = require('../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');
const { getOrCreateTagIds } = require('../utils/dbHelpers'); // Import the helper

const router = express.Router();

// Helper function to select NPC fields based on role
const selectNpcFieldsForRole = (role, alias = 'n') => {
	const prefix = alias ? `${alias}.` : '';
	let fields = `${prefix}id, ${prefix}name, ${prefix}title, ${prefix}image_url, ${prefix}description, ${prefix}created_at, ${prefix}updated_at`;
	if (role === 'DM') {
		fields += `, ${prefix}notes_dm_only, ${prefix}character_sheet_id, ${prefix}dm_id`;
	}
	return fields;
};

// GET /api/npcs - Fetch all NPCs
router.get('/', protect, async (req, res) => {
	const selectedFields = selectNpcFieldsForRole(req.user.role, 'n'); // Using 'n' as alias
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];

	let baseSql = `SELECT ${selectedFields} FROM npcs n`;
	let queryParams = [];
	let conditions = [];

	if (filterTagNames.length > 0) {
		try {
			const tagIdPlaceholders = filterTagNames.map(() => '?').join(',');
			const tagRows = await new Promise((resolve, reject) => {
				db.all(`SELECT id FROM tags WHERE name IN (${tagIdPlaceholders}) COLLATE NOCASE`, filterTagNames, (err, rows) => {
					err ? reject(err) : resolve(rows);
				});
			});
			const filterTagIds = tagRows.map(r => r.id);

			if (filterTagIds.length > 0) {
				const subQuery = `
                    SELECT nt.npc_id
                    FROM npc_tags nt
                    WHERE nt.tag_id IN (${filterTagIds.map(() => '?').join(',')})
                    GROUP BY nt.npc_id
                    HAVING COUNT(DISTINCT nt.tag_id) = ?
                `;
				conditions.push(`n.id IN (${subQuery})`);
				queryParams.push(...filterTagIds, filterTagIds.length);
			} else {
				return res.json([]); // If tags were specified for filtering but none matched existing tags
			}
		} catch (error) {
			console.error("Error processing NPC tag filters:", error);
			return res.status(500).json({ error: "Failed to process tag filters." });
		}
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY n.name ASC";

	db.all(baseSql, queryParams, async (err, npcs) => {
		if (err) {
			console.error("DB Error fetching NPCs:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve NPCs.' });
		}
		if (npcs.length === 0) return res.json([]);

		try {
			const npcsWithTags = await Promise.all(npcs.map(async (npc) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t
                                 JOIN npc_tags nt ON t.id = nt.tag_id
                                 WHERE nt.npc_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => {
					db.all(tagsSql, [npc.id], (tagErr, tagRows) => tagErr ? reject(tagErr) : resolve(tagRows));
				});
				return { ...npc, tags: tags || [] };
			}));
			res.json(npcsWithTags);
		} catch (tagFetchError) {
			console.error("Error fetching tags for NPCs list:", tagFetchError.message);
			return res.status(500).json({ error: 'Failed to retrieve tags for NPCs.' });
		}
	});
});

// GET /api/npcs/:id - Fetch a single NPC
router.get('/:id', protect, (req, res) => {
	const npcId = req.params.id;
	const selectedFields = selectNpcFieldsForRole(req.user.role, ''); // No alias needed for single query
	const sql = `SELECT ${selectedFields} FROM npcs WHERE id = ?`;

	db.get(sql, [npcId], (err, npc) => {
		if (err) {
			console.error("DB Error fetching NPC:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve NPC.' });
		}
		if (!npc) {
			return res.status(404).json({ error: 'NPC not found or not visible to you.' });
		}

		const tagsSql = `SELECT t.id, t.name FROM tags t
                         JOIN npc_tags nt ON t.id = nt.tag_id
                         WHERE nt.npc_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [npcId], (tagErr, tags) => {
			if (tagErr) {
				console.error("Error fetching tags for NPC:", tagErr.message);
				return res.json({ ...npc, tags: [], _tagError: "Failed to fetch tags: " + tagErr.message });
			}
			res.json({ ...npc, tags: tags || [] });
		});
	});
});

// POST /api/npcs - Create a new NPC
router.post('/', protect, authorize('DM'), async (req, res) => {
	const { name, title = null, description = null, notes_dm_only = null, character_sheet_id = null, tags } = req.body; // Added 'tags'
	const dmId = req.user.id;

	if (!name || name.trim() === "") {
		return res.status(400).json({ error: 'NPC name is required.' });
	}

	const insertSql = `INSERT INTO npcs (name, title, description, notes_dm_only, character_sheet_id, dm_id, image_url) VALUES (?, ?, ?, ?, ?, ?, NULL)`;

	db.run(insertSql, [name, title, description, notes_dm_only, character_sheet_id, dmId], async function (err) {
		if (err) {
			console.error("DB Error creating NPC:", err.message);
			return res.status(500).json({ error: 'Failed to create NPC.' });
		}
		const newNpcId = this.lastID;
		let assignedTagsData = [];

		if (tags && Array.isArray(tags) && tags.length > 0) {
			try {
				const tagIds = await getOrCreateTagIds(db, tags); // Pass db instance
				if (tagIds.length > 0) {
					const assignTagPromises = tagIds.map(tagId => {
						return new Promise((resolve, reject) => {
							db.run("INSERT INTO npc_tags (npc_id, tag_id) VALUES (?, ?)", [newNpcId, tagId], assignErr => assignErr ? reject(assignErr) : resolve());
						});
					});
					await Promise.all(assignTagPromises);
					// Fetch the names of assigned tags to return them
					assignedTagsData = await new Promise((resolve, reject) => {
						db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name ASC`, tagIds, (fetchErr, rows) => {
							fetchErr ? reject(fetchErr) : resolve(rows);
						});
					});
				}
			} catch (tagError) {
				console.error("Error assigning tags to new NPC:", tagError.message);
				// Log error but continue, NPC is created.
			}
		}

		const fetchSql = `SELECT * FROM npcs WHERE id = ?`;
		db.get(fetchSql, [newNpcId], (fetchErr, newNpcRow) => {
			if (fetchErr || !newNpcRow) {
				return res.status(201).json({
					id: newNpcId, name, title,
					tags: assignedTagsData, // Return tags even if fetching full NPC fails
					message: 'NPC created, but failed to fetch full details.'
				});
			}
			res.status(201).json({ ...newNpcRow, tags: assignedTagsData });
		});
	});
});

// PUT /api/npcs/:id - Update an NPC
router.put('/:id', protect, authorize('DM'), async (req, res) => {
	const npcId = req.params.id;
	const { name, title, description, notes_dm_only, character_sheet_id, tags } = req.body; // Added 'tags'

	db.serialize(async () => { // Use serialize to ensure transaction behavior
		try {
			await new Promise((resolve, reject) => db.run("BEGIN TRANSACTION", [], err => err ? reject(err) : resolve()));

			let setClauses = [];
			let coreParams = [];
			if (name !== undefined) { setClauses.push("name = ?"); coreParams.push(name); }
			if (title !== undefined) { setClauses.push("title = ?"); coreParams.push(title); }
			if (description !== undefined) { setClauses.push("description = ?"); coreParams.push(description); }
			if (notes_dm_only !== undefined) { setClauses.push("notes_dm_only = ?"); coreParams.push(notes_dm_only); }
			if (character_sheet_id !== undefined) {
				setClauses.push("character_sheet_id = ?");
				coreParams.push(character_sheet_id === "" || character_sheet_id === 0 ? null : character_sheet_id);
			}

			let coreFieldsUpdated = false;
			if (setClauses.length > 0) {
				coreParams.push(npcId); // For WHERE id = ?
				const updateSql = `UPDATE npcs SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
				await new Promise((resolve, reject) => {
					db.run(updateSql, coreParams, function (err) {
						if (err) return reject(err);
						if (this.changes > 0) coreFieldsUpdated = true;
						resolve();
					});
				});
			}

			let tagsUpdated = false;
			if (tags !== undefined && Array.isArray(tags)) {
				tagsUpdated = true;
				// 1. Delete existing tags for this NPC
				await new Promise((resolve, reject) => {
					db.run("DELETE FROM npc_tags WHERE npc_id = ?", [npcId], delErr => delErr ? reject(delErr) : resolve());
				});

				// 2. If new tags are provided, get/create them and assign
				if (tags.length > 0) {
					const tagIds = await getOrCreateTagIds(db, tags); // Pass db instance
					if (tagIds.length > 0) {
						const assignTagPromises = tagIds.map(tagId => {
							return new Promise((resolve, reject) => {
								db.run("INSERT INTO npc_tags (npc_id, tag_id) VALUES (?, ?)", [npcId, tagId], assignErr => assignErr ? reject(assignErr) : resolve());
							});
						});
						await Promise.all(assignTagPromises);
					}
				}
			}

			if (!coreFieldsUpdated && !tagsUpdated) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("No fields or tags to update provided."))));
				return res.status(400).json({ error: 'No fields or tags to update provided.' });
			}

			const npcExists = await new Promise((resolve, reject) => {
				db.get("SELECT 1 FROM npcs WHERE id = ?", [npcId], (err, row) => err ? reject(err) : resolve(!!row));
			});

			if (!npcExists) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("NPC not found."))));
				return res.status(404).json({ error: 'NPC not found.' });
			}

			await new Promise((resolve, reject) => db.run("COMMIT", [], err => err ? reject(err) : resolve()));

			// Fetch and return the updated NPC with tags
			const finalSelectedFields = selectNpcFieldsForRole(req.user.role, '');
			const fetchSql = `SELECT ${finalSelectedFields} FROM npcs WHERE id = ?`;
			db.get(fetchSql, [npcId], (fetchErr, updatedNpc) => {
				if (fetchErr || !updatedNpc) {
					return res.json({ message: 'NPC updated, but failed to fetch full details.' });
				}
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN npc_tags nt ON t.id = nt.tag_id WHERE nt.npc_id = ? ORDER BY t.name ASC`;
				db.all(tagsSql, [npcId], (tagErr, finalTags) => {
					if (tagErr) {
						return res.json({ ...updatedNpc, tags: [], _tagError: "Failed to fetch tags after update." });
					}
					res.json({ ...updatedNpc, tags: finalTags || [] });
				});
			});

		} catch (error) {
			await new Promise((resolve) => db.run("ROLLBACK", [], () => resolve())); // Ensure rollback on any error
			console.error("DB Error updating NPC with tags:", error.message);
			if (error.message.includes("No fields or tags")) return res.status(400).json({ error: error.message });
			if (error.message.includes("NPC not found")) return res.status(404).json({ error: error.message });
			return res.status(500).json({ error: 'Failed to update NPC.', details: error.message });
		}
	});
});

// POST /api/npcs/:id/upload-image - (No tag changes needed here)
router.post('/:id/upload-image', protect, authorize('DM'), uploadNpcImage.single('npcImage'), /* ... your existing code from original file ... */ async (req, res, next) => {
	const npcId = req.params.id;
	const dmId = req.user.id;

	if (!req.file) {
		return res.status(400).json({ error: 'No image file uploaded.' });
	}
	const imageUrl = `/uploads/npc_images/${req.file.filename}`;

	try {
		const getOldImageSql = `SELECT image_url FROM npcs WHERE id = ? AND dm_id = ?`;
		db.get(getOldImageSql, [npcId, dmId], (err, npc) => {
			if (err) { console.error("DB Error getting old NPC image URL:", err.message); }
			if (npc && npc.image_url) {
				const oldImagePath = path.join(npcImageDir, path.basename(npc.image_url));
				if (fs.existsSync(oldImagePath)) {
					fs.unlink(oldImagePath, (unlinkErr) => {
						if (unlinkErr) console.error("Error deleting old NPC image:", unlinkErr.message);
					});
				}
			}
			const updateSql = `UPDATE npcs SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND dm_id = ?`;
			db.run(updateSql, [imageUrl, npcId, dmId], function (updateErr) {
				if (updateErr) { return res.status(500).json({ error: 'Failed to update NPC image reference.' }); }
				if (this.changes === 0) {
					fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting orphaned uploaded image:", unlinkErr); });
					return res.status(404).json({ error: 'NPC not found or not authorized to update.' });
				}
				res.json({ message: 'NPC image uploaded and updated successfully.', imageUrl: imageUrl, npcId: npcId });
			});
		});
	} catch (error) {
		console.error("Server error during image upload processing:", error);
		fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting file after server error:", unlinkErr); });
		res.status(500).json({ error: 'Server error during image upload.' });
	}
}, (error, req, res, next) => { // Multer error handler - This needs to be here
	if (error && error.name === 'MulterError') { // Check specific error name for Multer
		return res.status(400).json({ error: `Multer error: ${error.message}` });
	} else if (error) { // Other errors passed from uploadNpcImage (like file type)
		return res.status(400).json({ error: error.message });
	}
	next(); // If no error, or not a multer/upload error, pass to next handler
});

// DELETE /api/npcs/:id - Delete an NPC
// (ON DELETE CASCADE on npc_tags handles tag associations)
router.delete('/:id', protect, authorize('DM'), /* ... your existing code from original file ... */(req, res) => {
	const npcId = req.params.id;
	const getSql = `SELECT image_url FROM npcs WHERE id = ?`;
	db.get(getSql, [npcId], (err, npc) => {
		if (err) { return res.status(500).json({ error: 'Error finding NPC before deletion.' }); }
		const deleteSql = `DELETE FROM npcs WHERE id = ?`;
		db.run(deleteSql, [npcId], function (delErr) {
			if (delErr) { return res.status(500).json({ error: 'Failed to delete NPC.' }); }
			if (this.changes === 0) { return res.status(404).json({ error: 'NPC not found.' }); }
			if (npc && npc.image_url) {
				const imagePath = path.join(npcImageDir, path.basename(npc.image_url));
				if (fs.existsSync(imagePath)) {
					fs.unlink(imagePath, (unlinkErr) => {
						if (unlinkErr) console.error("Error deleting NPC image file:", unlinkErr.message);
					});
				}
			}
			res.json({ message: 'NPC deleted successfully.' });
		});
	});
});

module.exports = router;

// backend/routes/storyRoutes.js
const express = require('express');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Helper function to get or create tag IDs by name
// Returns a Promise that resolves with an array of tag IDs
const getOrCreateTagIds = (tagNamesArray) => {
	return new Promise((resolve, reject) => {
		if (!tagNamesArray || tagNamesArray.length === 0) {
			return resolve([]);
		}

		const uniqueTagNames = [...new Set(tagNamesArray.map(name => name.trim()).filter(name => name !== ''))];
		if (uniqueTagNames.length === 0) {
			return resolve([]);
		}

		const tagPromises = uniqueTagNames.map(name => {
			return new Promise((tagResolve, tagReject) => {
				db.get("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [name], (err, row) => {
					if (err) return tagReject(err);
					if (row) {
						tagResolve(row.id);
					} else {
						db.run("INSERT INTO tags (name) VALUES (?)", [name], function (insertErr) {
							if (insertErr) {
								// Handle potential race condition if another request created the tag
								if (insertErr.message.includes('UNIQUE constraint failed: tags.name')) {
									db.get("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [name], (retryErr, retryRow) => {
										if (retryErr) return tagReject(retryErr);
										if (retryRow) return tagResolve(retryRow.id);
										return tagReject(new Error(`Tag '${name}' constraint failed but not found on retry.`));
									});
								} else {
									return tagReject(insertErr);
								}
							} else {
								tagResolve(this.lastID);
							}
						});
					}
				});
			});
		});

		Promise.all(tagPromises)
			.then(ids => resolve(ids.filter(id => id !== null)))
			.catch(reject);
	});
};

// GET /api/story - Fetch all story entries (hierarchical structure)
// MODIFIED: Includes tags for each entry and allows filtering by tags.
router.get('/', protect, async (req, res) => {
	// req.query.tags can be a comma-separated string of tag names: "quest,secret"
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];

	let baseSql;
	let queryParams = [];

	if (req.user.role === 'DM') {
		baseSql = `SELECT se.* FROM story_entries se`;
	} else {
		baseSql = `SELECT se.id, se.title, se.content, se.parent_id, se.sort_order, se.created_at, se.updated_at, se.is_visible_to_players
                   FROM story_entries se
                   WHERE se.is_visible_to_players = TRUE`;
	}

	let conditions = [];
	if (req.user.role !== 'DM') { // Player visibility condition already in baseSql if needed
		// No extra condition here as it's part of the base SQL for players
	}


	if (filterTagNames.length > 0) {
		try {
			const tagIdPlaceholders = filterTagNames.map(() => '?').join(',');
			const tagRows = await new Promise((resolve, reject) => {
				db.all(`SELECT id FROM tags WHERE name IN (${tagIdPlaceholders}) COLLATE NOCASE`, filterTagNames, (err, rows) => {
					if (err) reject(err); else resolve(rows);
				});
			});
			const filterTagIds = tagRows.map(r => r.id);

			if (filterTagIds.length > 0) {
				// Story entries must have ALL the specified tags
				const subQuery = `
                    SELECT st.story_entry_id
                    FROM story_entry_tags st
                    WHERE st.tag_id IN (${filterTagIds.map(() => '?').join(',')})
                    GROUP BY st.story_entry_id
                    HAVING COUNT(DISTINCT st.tag_id) = ?
                `;
				conditions.push(`se.id IN (${subQuery})`);
				queryParams.push(...filterTagIds, filterTagIds.length);
			} else {
				// If tags were specified for filtering but none of those tags exist in the DB, return empty
				return res.json([]);
			}
		} catch (error) {
			console.error("Error processing tag filters:", error);
			return res.status(500).json({ error: "Failed to process tag filters." });
		}
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}


	baseSql += " ORDER BY se.parent_id ASC, se.sort_order ASC, se.title ASC";

	db.all(baseSql, queryParams, async (err, rows) => {
		if (err) {
			console.error("DB Error fetching story entries:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve story entries.' });
		}
		if (rows.length === 0) {
			return res.json([]);
		}

		// For each story entry, fetch its tags
		try {
			const entriesWithTags = await Promise.all(rows.map(async (entry) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t
                                 JOIN story_entry_tags setj ON t.id = setj.tag_id
                                 WHERE setj.story_entry_id = ? ORDER BY t.name`;
				const tags = await new Promise((resolve, reject) => {
					db.all(tagsSql, [entry.id], (tagErr, tagRows) => {
						if (tagErr) reject(tagErr); else resolve(tagRows);
					});
				});
				return { ...entry, tags: tags || [] };
			}));
			res.json(entriesWithTags);
		} catch (tagFetchError) {
			console.error("Error fetching tags for story entries list:", tagFetchError.message);
			return res.status(500).json({ error: 'Failed to retrieve tags for story entries.' });
		}
	});
});

// GET /api/story/:id - Fetch a single story entry
// MODIFIED: Includes tags for the entry.
router.get('/:id', protect, (req, res) => {
	const entryId = req.params.id;
	let sql;
	const params = [entryId];

	if (req.user.role === 'DM') {
		sql = `SELECT * FROM story_entries WHERE id = ?`;
	} else {
		sql = `SELECT id, title, content, parent_id, sort_order, created_at, updated_at, is_visible_to_players
               FROM story_entries
               WHERE id = ? AND is_visible_to_players = TRUE`;
	}

	db.get(sql, params, (err, entry) => {
		if (err) {
			console.error("DB Error fetching story entry:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve story entry.' });
		}
		if (!entry) {
			return res.status(404).json({ error: 'Story entry not found or not visible.' });
		}

		// Fetch tags for this entry
		const tagsSql = `SELECT t.id, t.name FROM tags t
                         JOIN story_entry_tags setj ON t.id = setj.tag_id
                         WHERE setj.story_entry_id = ? ORDER BY t.name`;
		db.all(tagsSql, [entryId], (tagErr, tags) => {
			if (tagErr) {
				console.error("Error fetching tags for story entry:", tagErr.message);
				// Still return entry, but with an error indicator for tags or empty tags
				return res.json({ ...entry, tags: [], _tagError: "Failed to fetch tags: " + tagErr.message });
			}
			res.json({ ...entry, tags: tags || [] });
		});
	});
});

// POST /api/story - Create a new story entry (DM only)
// MODIFIED: Accepts and processes a 'tags' array (of tag names).
router.post('/', protect, authorize('DM'), async (req, res) => {
	// Added 'tags' to destructuring
	const { title, content, parent_id = null, sort_order = 0, is_visible_to_players = true, tags } = req.body;
	const dmId = req.user.id;

	if (!title) {
		return res.status(400).json({ error: 'Title is required.' });
	}
	const isVisible = typeof is_visible_to_players === 'boolean' ? is_visible_to_players : true;

	const sql = `INSERT INTO story_entries (title, content, parent_id, sort_order, dm_id, is_visible_to_players) VALUES (?, ?, ?, ?, ?, ?)`;

	db.run(sql, [title, content, parent_id, sort_order, dmId, isVisible], async function (err) {
		if (err) {
			console.error("DB Error creating story entry:", err.message);
			return res.status(500).json({ error: 'Failed to create story entry.' });
		}
		const newEntryId = this.lastID;
		let assignedTags = [];

		if (tags && Array.isArray(tags) && tags.length > 0) {
			try {
				const tagIds = await getOrCreateTagIds(tags); // Get/create tag IDs
				if (tagIds.length > 0) {
					const assignTagPromises = tagIds.map(tagId => {
						return new Promise((resolve, reject) => {
							db.run("INSERT INTO story_entry_tags (story_entry_id, tag_id) VALUES (?, ?)", [newEntryId, tagId], (assignErr) => {
								if (assignErr) reject(assignErr); else resolve();
							});
						});
					});
					await Promise.all(assignTagPromises);
					// Fetch the names of assigned tags to return them
					assignedTags = await new Promise((resolve, reject) => {
						db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name`, tagIds, (fetchErr, rows) => {
							if (fetchErr) reject(fetchErr); else resolve(rows);
						});
					});
				}
			} catch (tagError) {
				console.error("Error assigning tags to new story entry:", tagError.message);
				// Entry was created, but tags failed. Return success with a warning for tags.
				return res.status(201).json({
					id: newEntryId, title, content, parent_id, sort_order, dm_id: dmId, is_visible_to_players: isVisible,
					tags: [], // No tags assigned due to error
					message: 'Story entry created, but failed to assign tags.',
					tagError: tagError.message
				});
			}
		}

		res.status(201).json({
			id: newEntryId, title, content, parent_id, sort_order, dm_id: dmId, is_visible_to_players: isVisible,
			tags: assignedTags, // Return the actual tag objects
			message: 'Story entry created successfully.'
		});
	});
});

// PUT /api/story/:id - Update a story entry (DM only)
// MODIFIED: Accepts and processes a 'tags' array to update tag associations.
router.put('/:id', protect, authorize('DM'), async (req, res) => {
	const entryId = req.params.id;
	// Added 'tags' to destructuring
	const { title, content, parent_id, sort_order, is_visible_to_players, tags } = req.body;

	// Begin transaction
	db.serialize(async () => {
		try {
			await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', [], err => err ? reject(err) : resolve()));

			// Update core fields if provided
			let setClauses = [];
			let coreParams = [];
			if (title !== undefined) { setClauses.push("title = ?"); coreParams.push(title); }
			if (content !== undefined) { setClauses.push("content = ?"); coreParams.push(content); }
			if (parent_id !== undefined) { setClauses.push("parent_id = ?"); coreParams.push(parent_id === '' || parent_id === 0 ? null : parent_id); }
			if (sort_order !== undefined) { setClauses.push("sort_order = ?"); coreParams.push(sort_order); }
			if (is_visible_to_players !== undefined && typeof is_visible_to_players === 'boolean') {
				setClauses.push("is_visible_to_players = ?"); coreParams.push(is_visible_to_players);
			}

			if (setClauses.length > 0) {
				coreParams.push(entryId);
				const updateSql = `UPDATE story_entries SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
				await new Promise((resolve, reject) => {
					db.run(updateSql, coreParams, function (err) {
						if (err) return reject(err);
						// It's okay if only tags are updated and this.changes is 0 for core fields
						resolve();
					});
				});
			}

			// Handle tags: if 'tags' array is provided in the body
			if (tags !== undefined && Array.isArray(tags)) {
				// 1. Delete existing tags for this story entry
				await new Promise((resolve, reject) => {
					db.run("DELETE FROM story_entry_tags WHERE story_entry_id = ?", [entryId], (delErr) => {
						if (delErr) reject(delErr); else resolve();
					});
				});

				// 2. If new tags are provided, get/create them and assign
				if (tags.length > 0) {
					const tagIds = await getOrCreateTagIds(tags);
					if (tagIds.length > 0) {
						const assignTagPromises = tagIds.map(tagId => {
							return new Promise((resolve, reject) => {
								db.run("INSERT INTO story_entry_tags (story_entry_id, tag_id) VALUES (?, ?)", [entryId, tagId], (assignErr) => {
									if (assignErr) reject(assignErr); else resolve();
								});
							});
						});
						await Promise.all(assignTagPromises);
					}
				}
			}
			// If only tags were updated, and no core fields, we need to ensure the entry exists.
			// Do a quick check to make sure the entry id is valid.
			if (setClauses.length === 0 && tags === undefined) {
				await new Promise((resolve, reject) => db.run('ROLLBACK', [], () => reject(new Error('No valid fields or tags to update provided.'))));
				return res.status(400).json({ error: 'No valid fields or tags to update provided.' });
			}

			const entryExists = await new Promise((resolve, reject) => {
				db.get("SELECT 1 FROM story_entries WHERE id = ?", [entryId], (err, row) => err ? reject(err) : resolve(!!row));
			});
			if (!entryExists) {
				await new Promise((resolve, reject) => db.run('ROLLBACK', [], () => reject(new Error('Story entry not found.'))));
				return res.status(404).json({ error: 'Story entry not found.' });
			}


			await new Promise((resolve, reject) => db.run('COMMIT', [], err => err ? reject(err) : resolve()));
			res.json({ message: 'Story entry updated successfully.' });

		} catch (error) {
			await new Promise((resolve, reject) => db.run('ROLLBACK', [], () => resolve())); // Ensure rollback on any error
			console.error("DB Error updating story entry with tags:", error.message);
			if (error.message.includes('No valid fields or tags')) return res.status(400).json({ error: error.message });
			if (error.message.includes('Story entry not found')) return res.status(404).json({ error: error.message });
			return res.status(500).json({ error: 'Failed to update story entry.', details: error.message });
		}
	});
});

// DELETE /api/story/:id - Delete a story entry (DM only)
// No changes needed here as ON DELETE CASCADE on story_entry_tags handles tag associations.
router.delete('/:id', protect, authorize('DM'), (req, res) => {
	const entryId = req.params.id;
	// Foreign key constraint with ON DELETE CASCADE on story_entry_tags
	// will automatically delete related tags from the junction table.
	const sql = `DELETE FROM story_entries WHERE id = ?`;
	db.run(sql, [entryId], function (err) {
		if (err) {
			console.error("DB Error deleting story entry:", err.message);
			return res.status(500).json({ error: 'Failed to delete story entry.' });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: 'Story entry not found.' });
		}
		res.json({ message: 'Story entry deleted successfully.' });
	});
});

module.exports = router;

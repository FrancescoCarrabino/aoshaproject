// backend/routes/sessionLogRoutes.js
const express = require('express');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getOrCreateTagIds } = require('../utils/dbHelpers'); // Import the helper

const router = express.Router();

router.use(protect); // Protect all session log routes

// GET /api/sessions - Fetch all session logs
router.get('/', async (req, res) => {
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];
	let baseSql = `
        SELECT sl.id, sl.session_date, sl.title, sl.summary, sl.author_user_id, u.username as author_username, sl.created_at, sl.updated_at
        FROM session_logs sl
        JOIN users u ON sl.author_user_id = u.id
    `;
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
                    SELECT slt.session_log_id
                    FROM session_log_tags slt
                    WHERE slt.tag_id IN (${filterTagIds.map(() => '?').join(',')})
                    GROUP BY slt.session_log_id
                    HAVING COUNT(DISTINCT slt.tag_id) = ?
                `;
				conditions.push(`sl.id IN (${subQuery})`);
				queryParams.push(...filterTagIds, filterTagIds.length);
			} else {
				return res.json([]);
			}
		} catch (error) {
			console.error("Error processing Session Log tag filters:", error);
			return res.status(500).json({ error: "Failed to process tag filters." });
		}
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY sl.session_date DESC, sl.created_at DESC";

	db.all(baseSql, queryParams, async (err, logs) => {
		if (err) {
			console.error("DB Error fetching session logs:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve session logs.' });
		}
		if (logs.length === 0) return res.json([]);

		try {
			const logsWithTags = await Promise.all(logs.map(async (log) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t
                                 JOIN session_log_tags slt ON t.id = slt.tag_id
                                 WHERE slt.session_log_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => {
					db.all(tagsSql, [log.id], (tagErr, tagRows) => tagErr ? reject(tagErr) : resolve(tagRows));
				});
				return { ...log, tags: tags || [] };
			}));
			res.json(logsWithTags);
		} catch (tagFetchError) {
			console.error("Error fetching tags for session logs list:", tagFetchError.message);
			return res.status(500).json({ error: 'Failed to retrieve tags for session logs.' });
		}
	});
});

// GET /api/sessions/:id - Fetch a single session log
router.get('/:id', (req, res) => {
	const logId = req.params.id;
	const sql = `
        SELECT sl.id, sl.session_date, sl.title, sl.summary, sl.author_user_id, u.username as author_username, sl.created_at, sl.updated_at
        FROM session_logs sl
        JOIN users u ON sl.author_user_id = u.id
        WHERE sl.id = ?
    `;
	db.get(sql, [logId], (err, log) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Failed to retrieve session log.' }); }
		if (!log) return res.status(404).json({ error: 'Session log not found.' });

		const tagsSql = `SELECT t.id, t.name FROM tags t
                         JOIN session_log_tags slt ON t.id = slt.tag_id
                         WHERE slt.session_log_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [logId], (tagErr, tags) => {
			if (tagErr) { /* ... */ return res.json({ ...log, tags: [], _tagError: "Failed to fetch tags." }); }
			res.json({ ...log, tags: tags || [] });
		});
	});
});

// POST /api/sessions - Create a new session log
router.post('/', async (req, res) => {
	const { session_date, title = null, summary, tags } = req.body; // Added 'tags'
	const authorUserId = req.user.id;

	if (!session_date || !summary) return res.status(400).json({ error: 'Session date and summary are required.' });
	if (isNaN(new Date(session_date).getTime())) return res.status(400).json({ error: 'Invalid session date format.' });

	const insertSql = `INSERT INTO session_logs (session_date, title, summary, author_user_id) VALUES (?, ?, ?, ?)`;
	db.run(insertSql, [session_date, title, summary, authorUserId], async function (err) {
		if (err) { /* ... */ return res.status(500).json({ error: 'Failed to create session log.' }); }
		const newLogId = this.lastID;
		let assignedTagsData = [];

		if (tags && Array.isArray(tags) && tags.length > 0) {
			try {
				const tagIds = await getOrCreateTagIds(db, tags);
				if (tagIds.length > 0) {
					const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
						db.run("INSERT INTO session_log_tags (session_log_id, tag_id) VALUES (?, ?)", [newLogId, tagId], e => e ? reject(e) : resolve());
					}));
					await Promise.all(assignPromises);
					assignedTagsData = await new Promise((resolve, reject) => {
						db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name ASC`, tagIds, (e, r) => e ? reject(e) : resolve(r));
					});
				}
			} catch (tagError) { /* ... */ console.error("SessionLog Tag Assign Error:", tagError); }
		}

		const fetchSql = `SELECT sl.*, u.username as author_username FROM session_logs sl JOIN users u ON sl.author_user_id = u.id WHERE sl.id = ?`;
		db.get(fetchSql, [newLogId], (fetchErr, newLogRow) => {
			if (fetchErr || !newLogRow) { /* ... */ return res.status(201).json({ id: newLogId, tags: assignedTagsData, message: 'Log created, failed to fetch details.' }); }
			res.status(201).json({ ...newLogRow, tags: assignedTagsData });
		});
	});
});

// PUT /api/sessions/:id - Update a session log
router.put('/:id', async (req, res) => {
	const logId = req.params.id;
	const currentUserId = req.user.id;
	const currentUserRole = req.user.role;
	const { session_date, title, summary, tags } = req.body; // Added 'tags'

	db.serialize(async () => {
		try {
			await new Promise((resolve, reject) => db.run("BEGIN TRANSACTION", [], e => e ? reject(e) : resolve()));

			const log = await new Promise((resolve, reject) => {
				db.get(`SELECT author_user_id FROM session_logs WHERE id = ?`, [logId], (err, row) => err ? reject(err) : resolve(row));
			});
			if (!log) {
				await new Promise((resolve) => db.run("ROLLBACK", () => resolve()));
				return res.status(404).json({ error: 'Session log not found.' });
			}
			if (log.author_user_id !== currentUserId && currentUserRole !== 'DM') {
				await new Promise((resolve) => db.run("ROLLBACK", () => resolve()));
				return res.status(403).json({ error: 'You are not authorized to edit this session log.' });
			}

			let setClauses = []; let coreParams = [];
			if (session_date !== undefined) { /* ... */ setClauses.push("session_date = ?"); coreParams.push(session_date); }
			if (title !== undefined) { /* ... */ setClauses.push("title = ?"); coreParams.push(title); }
			if (summary !== undefined) { /* ... */ setClauses.push("summary = ?"); coreParams.push(summary); }
			// Update author if DM edits? Or keep original author and add last_edited_by?
			// For now, let's not change author_user_id on edit unless explicitly desired by design.

			let coreFieldsUpdated = false;
			if (setClauses.length > 0) {
				coreParams.push(logId);
				const updateSql = `UPDATE session_logs SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
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
				await new Promise((resolve, reject) => db.run("DELETE FROM session_log_tags WHERE session_log_id = ?", [logId], e => e ? reject(e) : resolve()));
				if (tags.length > 0) {
					const tagIds = await getOrCreateTagIds(db, tags);
					if (tagIds.length > 0) {
						const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
							db.run("INSERT INTO session_log_tags (session_log_id, tag_id) VALUES (?, ?)", [logId, tagId], e => e ? reject(e) : resolve());
						}));
						await Promise.all(assignPromises);
					}
				}
			}

			if (!coreFieldsUpdated && !tagsUpdated) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("No fields or tags to update provided."))));
				return res.status(400).json({ error: 'No fields or tags to update provided.' });
			}

			await new Promise((resolve, reject) => db.run("COMMIT", [], e => e ? reject(e) : resolve()));

			const fetchSql = `SELECT sl.*, u.username as author_username FROM session_logs sl JOIN users u ON sl.author_user_id = u.id WHERE sl.id = ?`;
			db.get(fetchSql, [logId], (fetchErr, updatedLog) => {
				if (fetchErr || !updatedLog) return res.json({ message: 'Log updated, failed to fetch details.' });
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN session_log_tags slt ON t.id = slt.tag_id WHERE slt.session_log_id = ? ORDER BY t.name ASC`;
				db.all(tagsSql, [logId], (tagErr, finalTags) => {
					if (tagErr) return res.json({ ...updatedLog, tags: [], _tagError: "Failed to fetch tags." });
					res.json({ ...updatedLog, tags: finalTags || [] });
				});
			});

		} catch (error) {
			await new Promise((resolve) => db.run("ROLLBACK", [], () => resolve()));
			console.error("DB Error updating session log with tags:", error);
			res.status(500).json({ error: 'Failed to update session log.', details: error.message });
		}
	});
});

// DELETE /api/sessions/:id - Delete a session log (DM only)
// (ON DELETE CASCADE on session_log_tags handles tag associations)
router.delete('/:id', authorize('DM'), /* ... your existing code ... */(req, res) => {
	const logId = req.params.id;
	const sql = `DELETE FROM session_logs WHERE id = ?`;
	db.run(sql, [logId], function (err) {
		if (err) { return res.status(500).json({ error: 'Failed to delete session log.' }); }
		if (this.changes === 0) { return res.status(404).json({ error: 'Session log not found.' }); }
		res.json({ message: 'Session log deleted successfully.' });
	});
});

module.exports = router;

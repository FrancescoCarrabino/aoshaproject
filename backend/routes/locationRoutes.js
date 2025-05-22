// backend/routes/locationRoutes.js
const express = require('express');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getOrCreateTagIds } = require('../utils/dbHelpers'); // Ensure this path is correct

const router = express.Router();

// Helper to select fields based on user role
const selectLocationFieldsForRole = (role, alias = 'wl') => {
	const prefix = alias ? `${alias}.` : '';
	let fields = `${prefix}id, ${prefix}name, ${prefix}type, ${prefix}description_public, ${prefix}map_asset_id, ${prefix}is_visible_to_players, ${prefix}created_at, ${prefix}updated_at`;
	if (role === 'DM') {
		fields += `, ${prefix}description_dm, ${prefix}dm_id`;
	}
	return fields;
};

// POST /api/locations - Create a new location (DM Only)
router.post('/', protect, authorize('DM'), async (req, res) => {
	const { name, type, description_public, description_dm, map_asset_id, is_visible_to_players = true, tags } = req.body;
	const dm_id = req.user.id;

	if (!name || name.trim() === '') {
		return res.status(400).json({ error: 'Location name is required.' });
	}

	const sql = `INSERT INTO world_locations (name, type, description_public, description_dm, map_asset_id, dm_id, is_visible_to_players)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
	const params = [
		name.trim(), type || null, description_public || null, description_dm || null,
		map_asset_id || null, dm_id, is_visible_to_players === undefined ? true : Boolean(is_visible_to_players)
	];

	db.run(sql, params, async function (err) {
		if (err) {
			console.error("DB Error creating location:", err.message);
			return res.status(500).json({ error: 'Failed to create location.' });
		}
		const newLocationId = this.lastID;
		let assignedTagsData = [];

		if (tags && Array.isArray(tags) && tags.length > 0) {
			try {
				const tagIds = await getOrCreateTagIds(db, tags);
				if (tagIds.length > 0) {
					const assignTagPromises = tagIds.map(tagId => {
						return new Promise((resolve, reject) => {
							db.run("INSERT INTO location_tags (location_id, tag_id) VALUES (?, ?)", [newLocationId, tagId], assignErr => assignErr ? reject(assignErr) : resolve());
						});
					});
					await Promise.all(assignTagPromises);
					assignedTagsData = await new Promise((resolve, reject) => { // Fetch created/assigned tags
						db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name ASC`, tagIds, (e, r) => e ? reject(e) : resolve(r));
					});
				}
			} catch (tagError) {
				console.error("Error assigning tags to new location:", tagError.message);
				// Location created, but tag assignment failed. Log and continue.
			}
		}

		// Fetch the newly created location to return it fully populated
		const selectedFields = selectLocationFieldsForRole('DM', ''); // DM sees all fields of their creation
		db.get(`SELECT ${selectedFields} FROM world_locations WHERE id = ?`, [newLocationId], (fetchErr, newLocation) => {
			if (fetchErr || !newLocation) {
				return res.status(201).json({
					id: newLocationId, message: 'Location created successfully, but failed to fetch full details.',
					name: name.trim(), tags: assignedTagsData
				});
			}
			res.status(201).json({ ...newLocation, tags: assignedTagsData });
		});
	});
});

// GET /api/locations - List all locations
router.get('/', protect, async (req, res) => {
	const selectedFields = selectLocationFieldsForRole(req.user.role, 'wl');
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];

	let baseSql = `SELECT ${selectedFields} FROM world_locations wl`;
	let queryParams = [];
	let conditions = [];

	if (req.user.role !== 'DM') {
		conditions.push("wl.is_visible_to_players = TRUE");
	}

	if (filterTagNames.length > 0) {
		try {
			const tagIdPlaceholders = filterTagNames.map(() => '?').join(',');
			const tagRows = await new Promise((resolve, reject) => {
				db.all(`SELECT id FROM tags WHERE name IN (${tagIdPlaceholders}) COLLATE NOCASE`, filterTagNames, (e, r) => e ? reject(e) : resolve(r));
			});
			const filterTagIds = tagRows.map(r => r.id);

			if (filterTagIds.length > 0) {
				const subQuery = `SELECT lt.location_id FROM location_tags lt WHERE lt.tag_id IN (${filterTagIds.map(() => '?').join(',')}) GROUP BY lt.location_id HAVING COUNT(DISTINCT lt.tag_id) = ?`;
				conditions.push(`wl.id IN (${subQuery})`);
				queryParams.push(...filterTagIds, filterTagIds.length);
			} else {
				return res.json([]); // No locations if specified tags don't exist
			}
		} catch (error) {
			console.error("Error processing location tag filters:", error);
			return res.status(500).json({ error: "Failed to process tag filters." });
		}
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY wl.name ASC";

	db.all(baseSql, queryParams, async (err, locations) => {
		if (err) {
			console.error("DB Error fetching locations:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve locations.' });
		}
		if (locations.length === 0) return res.json([]);

		try {
			const locationsWithTags = await Promise.all(locations.map(async (loc) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN location_tags lt ON t.id = lt.tag_id WHERE lt.location_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => {
					db.all(tagsSql, [loc.id], (tagErr, tagRows) => tagErr ? reject(tagErr) : resolve(tagRows));
				});
				return { ...loc, tags: tags || [] };
			}));
			res.json(locationsWithTags);
		} catch (tagFetchError) {
			console.error("Error fetching tags for locations list:", tagFetchError.message);
			return res.status(500).json({ error: 'Failed to retrieve tags for locations.' });
		}
	});
});

// GET /api/locations/:id - Get a specific location
router.get('/:id', protect, (req, res) => {
	const locationId = req.params.id;
	const selectedFields = selectLocationFieldsForRole(req.user.role, '');
	const sql = `SELECT ${selectedFields} FROM world_locations WHERE id = ?`;

	db.get(sql, [locationId], (err, location) => {
		if (err) {
			console.error("DB Error fetching location:", err.message);
			return res.status(500).json({ error: 'Failed to retrieve location.' });
		}
		if (!location) {
			return res.status(404).json({ error: 'Location not found.' });
		}
		if (req.user.role !== 'DM' && !location.is_visible_to_players) {
			return res.status(403).json({ error: 'Access denied to this location.' });
		}

		const tagsSql = `SELECT t.id, t.name FROM tags t JOIN location_tags lt ON t.id = lt.tag_id WHERE lt.location_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [locationId], (tagErr, tags) => {
			if (tagErr) {
				console.error("Error fetching tags for location:", tagErr.message);
				return res.json({ ...location, tags: [], _tagError: "Failed to fetch tags." });
			}
			res.json({ ...location, tags: tags || [] });
		});
	});
});

// PUT /api/locations/:id - Update a location (DM Only)
router.put('/:id', protect, authorize('DM'), async (req, res) => {
	const locationId = req.params.id;
	const { name, type, description_public, description_dm, map_asset_id, is_visible_to_players, tags } = req.body;

	db.serialize(async () => {
		try {
			await new Promise((resolve, reject) => db.run("BEGIN TRANSACTION", [], e => e ? reject(e) : resolve()));

			let setClauses = [];
			let coreParams = [];
			if (name !== undefined) { setClauses.push("name = ?"); coreParams.push(name.trim()); }
			if (type !== undefined) { setClauses.push("type = ?"); coreParams.push(type); }
			if (description_public !== undefined) { setClauses.push("description_public = ?"); coreParams.push(description_public); }
			if (description_dm !== undefined) { setClauses.push("description_dm = ?"); coreParams.push(description_dm); }
			if (map_asset_id !== undefined) { setClauses.push("map_asset_id = ?"); coreParams.push(map_asset_id === '' ? null : map_asset_id); }
			if (is_visible_to_players !== undefined) { setClauses.push("is_visible_to_players = ?"); coreParams.push(Boolean(is_visible_to_players)); }

			let coreFieldsUpdated = false;
			if (setClauses.length > 0) {
				coreParams.push(locationId);
				const updateSql = `UPDATE world_locations SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
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
				await new Promise((resolve, reject) => db.run("DELETE FROM location_tags WHERE location_id = ?", [locationId], e => e ? reject(e) : resolve()));
				if (tags.length > 0) {
					const tagIds = await getOrCreateTagIds(db, tags);
					if (tagIds.length > 0) {
						const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
							db.run("INSERT INTO location_tags (location_id, tag_id) VALUES (?,?)", [locationId, tagId], e => e ? reject(e) : resolve());
						}));
						await Promise.all(assignPromises);
					}
				}
			}

			if (!coreFieldsUpdated && !tagsUpdated) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("No fields or tags to update provided."))));
				return res.status(400).json({ error: 'No fields or tags to update provided.' });
			}

			const locationExists = await new Promise((resolve, reject) => {
				db.get("SELECT 1 FROM world_locations WHERE id = ?", [locationId], (err, row) => err ? reject(err) : resolve(!!row));
			});
			if (!locationExists) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("Location not found."))));
				return res.status(404).json({ error: 'Location not found.' });
			}

			await new Promise((resolve, reject) => db.run("COMMIT", [], e => e ? reject(e) : resolve()));

			// Fetch and return the updated location
			const finalSelectedFields = selectLocationFieldsForRole(req.user.role, '');
			db.get(`SELECT ${finalSelectedFields} FROM world_locations WHERE id = ?`, [locationId], (fetchErr, updatedLocation) => {
				if (fetchErr || !updatedLocation) {
					return res.json({ message: 'Location updated successfully, but failed to fetch full details.' });
				}
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN location_tags lt ON t.id = lt.tag_id WHERE lt.location_id = ? ORDER BY t.name ASC`;
				db.all(tagsSql, [locationId], (tagErr, finalTags) => {
					if (tagErr) return res.json({ ...updatedLocation, tags: [], _tagError: "Failed to fetch tags after update." });
					res.json({ ...updatedLocation, tags: finalTags || [] });
				});
			});

		} catch (error) {
			await new Promise((resolve) => db.run("ROLLBACK", [], () => resolve()));
			console.error("DB Error updating location with tags:", error.message);
			if (error.message.includes("No fields or tags")) return res.status(400).json({ error: error.message });
			if (error.message.includes("Location not found")) return res.status(404).json({ error: error.message });
			return res.status(500).json({ error: 'Failed to update location.', details: error.message });
		}
	});
});

// DELETE /api/locations/:id - Delete a location (DM Only)
router.delete('/:id', protect, authorize('DM'), (req, res) => {
	const locationId = req.params.id;
	// ON DELETE CASCADE on location_tags table will handle removing tag associations.
	// If map_asset_id is used, consider if the asset itself should be deleted or just unlinked.
	// For now, we only delete the location record. Asset cleanup is separate.
	db.run("DELETE FROM world_locations WHERE id = ?", [locationId], function (err) {
		if (err) {
			console.error("DB Error deleting location:", err.message);
			return res.status(500).json({ error: 'Failed to delete location.' });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: 'Location not found.' });
		}
		res.json({ message: 'Location deleted successfully.' });
	});
});

module.exports = router;

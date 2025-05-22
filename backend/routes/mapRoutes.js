// backend/routes/mapRoutes.js
const express = require('express');
const { db } = require('../database/db'); // Adjust path if your db export is different
const { protect, authorize } = require('../middleware/authMiddleware');
const { getOrCreateTagIds } = require('../utils/dbHelpers'); // Ensure this path is correct

const router = express.Router();

// --- Helper Functions for DB Operations with Promises ---
const dbRun = (sql, params = []) => {
	return new Promise((resolve, reject) => {
		db.run(sql, params, function (err) { // Use 'function' for 'this' context
			if (err) {
				console.error('DB Run Error:', err.message, 'SQL:', sql, 'Params:', params);
				reject(err);
			} else {
				resolve(this); // 'this' contains lastID, changes
			}
		});
	});
};

const dbGet = (sql, params = []) => {
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			if (err) {
				console.error('DB Get Error:', err.message, 'SQL:', sql, 'Params:', params);
				reject(err);
			} else {
				resolve(row);
			}
		});
	});
};

const dbAll = (sql, params = []) => {
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			if (err) {
				console.error('DB All Error:', err.message, 'SQL:', sql, 'Params:', params);
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
};

// --- MAP CRUD ---

// POST /api/maps - Create a new map
router.post('/', protect, authorize('DM'), async (req, res) => {
	const {
		name, map_asset_id,
		grid_enabled = false, grid_size_pixels = 50,
		// Assuming you add these to your schema if desired based on previous discussion
		// grid_offset_x = 0, grid_offset_y = 0, grid_color = 'rgba(0,0,0,0.5)',
		tags = [] // Expects an array of tag names
	} = req.body;
	const dm_id = req.user.id;

	if (!name || typeof name !== 'string' || name.trim() === '') {
		return res.status(400).json({ error: 'Map name is required and must be a non-empty string.' });
	}
	if (!map_asset_id || typeof map_asset_id !== 'number') {
		return res.status(400).json({ error: 'map_asset_id is required and must be a number.' });
	}

	try {
		console.log(`[POST /api/maps] User ${dm_id} creating map. Name: ${name}, Asset ID: ${map_asset_id}`);

		// 1. Verify asset exists and get its filepath
		const asset = await dbGet("SELECT id, filepath FROM assets WHERE id = ?", [map_asset_id]);
		if (!asset) {
			console.log(`[POST /api/maps] Asset ID ${map_asset_id} not found.`);
			return res.status(404).json({ error: `Asset with ID ${map_asset_id} not found.` });
		}
		console.log(`[POST /api/maps] Asset ${map_asset_id} verified. Filepath: ${asset.filepath}`);

		// 2. Insert into game_maps
		// Adapt SQL if you added grid_offset_x, grid_offset_y, grid_color
		const gameMapSql = `
            INSERT INTO game_maps (name, map_asset_id, grid_enabled, grid_size_pixels, dm_id)
            VALUES (?, ?, ?, ?, ?)
        `;
		const result = await dbRun(gameMapSql, [
			name.trim(), map_asset_id, Number(grid_enabled), // Ensure grid_enabled is 0 or 1
			grid_size_pixels, // Add other grid params if schema was updated
			dm_id
		]);
		const newMapId = result.lastID;
		console.log(`[POST /api/maps] Map record created with ID: ${newMapId}`);

		// 3. Create initial fog data (empty array for revealed areas)
		await dbRun("INSERT INTO map_fog_data (map_id, fog_data_json) VALUES (?, ?)", [newMapId, JSON.stringify([])]);
		console.log(`[POST /api/maps] Initial fog data created for map ID: ${newMapId}`);

		// 4. Handle Tags
		let assignedTags = [];
		if (Array.isArray(tags) && tags.length > 0) {
			const tagIds = await getOrCreateTagIds(db, tags); // getOrCreateTagIds should return an array of IDs
			if (tagIds.length > 0) {
				const tagPromises = tagIds.map(tagId =>
					dbRun("INSERT INTO map_tags (map_id, tag_id) VALUES (?, ?)", [newMapId, tagId])
				);
				await Promise.all(tagPromises);
				// Fetch the tag objects to return names
				assignedTags = await dbAll(`SELECT t.id, t.name FROM tags t JOIN map_tags mt ON t.id = mt.tag_id WHERE mt.map_id = ? ORDER BY t.name ASC`, [newMapId]);
				console.log(`[POST /api/maps] Tags assigned to map ${newMapId}:`, assignedTags.map(t => t.name));
			}
		}

		// 5. Fetch and return the fully created map object
		const newMapData = await dbGet(
			`SELECT gm.*, a.filepath as asset_filepath 
             FROM game_maps gm 
             JOIN assets a ON gm.map_asset_id = a.id 
             WHERE gm.id = ?`, [newMapId]
		);

		if (!newMapData) { // Should not happen if insert succeeded
			console.error(`[POST /api/maps] CRITICAL: Map ${newMapId} created but could not be fetched.`);
			return res.status(500).json({ error: 'Map created but failed to retrieve details.' });
		}

		// Construct the final response object
		const responsePayload = {
			...newMapData,
			mapAssetUrl: `/uploads/${newMapData.asset_filepath}`, // Construct URL
			fog_data_json: JSON.stringify([]), // Initial state
			pins: [], // No pins initially
			tags: assignedTags
		};
		delete responsePayload.asset_filepath; // Clean up internal field

		console.log(`[POST /api/maps] Map ${newMapId} creation successful. Payload:`, responsePayload);
		res.status(201).json(responsePayload);

	} catch (error) {
		console.error(`[POST /api/maps] Error:`, error.message, error.stack);
		res.status(500).json({ error: error.message || 'Server error creating map.' });
	}
});

// GET /api/maps - List all maps for the authenticated DM
router.get('/', protect, authorize('DM'), async (req, res) => {
	const dm_id = req.user.id;
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];
	console.log(`[GET /api/maps] User ${dm_id} listing maps. Tag filters: ${filterTagNames.join(', ') || 'None'}`);

	try {
		let mapsSql = `
            SELECT gm.id, gm.name, gm.map_asset_id, gm.grid_enabled, gm.grid_size_pixels, 
                   gm.dm_id, gm.created_at, gm.updated_at, 
                   a.filepath as asset_filepath
            FROM game_maps gm
            JOIN assets a ON gm.map_asset_id = a.id
            WHERE gm.dm_id = ?
        `;
		let queryParams = [dm_id];

		if (filterTagNames.length > 0) {
			const tagPlaceholders = filterTagNames.map(() => '?').join(',');
			const subQuery = `
                SELECT mt.map_id FROM map_tags mt
                JOIN tags t ON mt.tag_id = t.id
                WHERE t.name IN (${tagPlaceholders}) COLLATE NOCASE
                GROUP BY mt.map_id
                HAVING COUNT(DISTINCT t.id) = ?
            `;
			mapsSql += ` AND gm.id IN (${subQuery})`;
			queryParams.push(...filterTagNames, filterTagNames.length);
		}
		mapsSql += " ORDER BY gm.name ASC";

		const maps = await dbAll(mapsSql, queryParams);
		console.log(`[GET /api/maps] Found ${maps.length} maps for user ${dm_id} with current filters.`);

		if (maps.length === 0) {
			return res.json([]);
		}

		// Enhance maps with their tags
		const mapsWithDetails = await Promise.all(maps.map(async (map) => {
			const tags = await dbAll(
				`SELECT t.id, t.name FROM tags t JOIN map_tags mt ON t.id = mt.tag_id WHERE mt.map_id = ? ORDER BY t.name ASC`,
				[map.id]
			);
			return {
				...map,
				mapAssetUrl: `/uploads/${map.asset_filepath}`,
				tags: tags || [],
				// fog_data_json and pins are not typically needed for list view, but could be added if desired
			};
		}));

		// Clean up asset_filepath from final response objects
		mapsWithDetails.forEach(map => delete map.asset_filepath);

		console.log(`[GET /api/maps] Sending ${mapsWithDetails.length} maps with details.`);
		res.json(mapsWithDetails);

	} catch (error) {
		console.error(`[GET /api/maps] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to retrieve maps.' });
	}
});

// GET /api/maps/:mapId - Get a specific map by ID
router.get('/:mapId', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	console.log(`[GET /api/maps/${mapId}] User ${dm_id} requesting map.`);

	try {
		const mapSql = `
            SELECT gm.id, gm.name, gm.map_asset_id, gm.grid_enabled, gm.grid_size_pixels, 
                   gm.dm_id, gm.created_at, gm.updated_at, 
                   a.filepath as asset_filepath
            FROM game_maps gm
            JOIN assets a ON gm.map_asset_id = a.id
            WHERE gm.id = ? AND gm.dm_id = ?
        `;
		const mapData = await dbGet(mapSql, [mapId, dm_id]);

		if (!mapData) {
			console.log(`[GET /api/maps/${mapId}] Map not found or access denied for user ${dm_id}.`);
			return res.status(404).json({ error: 'Map not found or access denied.' });
		}
		console.log(`[GET /api/maps/${mapId}] Base map data found.`);

		const fogData = await dbGet("SELECT fog_data_json FROM map_fog_data WHERE map_id = ?", [mapId]);
		const pins = await dbAll("SELECT * FROM map_pins WHERE map_id = ? ORDER BY created_at ASC", [mapId]);
		const tags = await dbAll(
			`SELECT t.id, t.name FROM tags t JOIN map_tags mt ON t.id = mt.tag_id WHERE mt.map_id = ? ORDER BY t.name ASC`,
			[mapId]
		);
		console.log(`[GET /api/maps/${mapId}] Fog, pins (${pins.length}), and tags (${tags.length}) fetched.`);

		const responsePayload = {
			...mapData,
			mapAssetUrl: `/uploads/${mapData.asset_filepath}`,
			fog_data_json: fogData ? fogData.fog_data_json : JSON.stringify([]), // Default if no fog record
			pins: pins || [],
			tags: tags || []
		};
		delete responsePayload.asset_filepath;

		console.log(`[GET /api/maps/${mapId}] Sending detailed map data.`);
		res.json(responsePayload);

	} catch (error) {
		console.error(`[GET /api/maps/${mapId}] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to retrieve map details.' });
	}
});

// PUT /api/maps/:mapId - Update map basic details
router.put('/:mapId', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	const {
		name, map_asset_id,
		grid_enabled, grid_size_pixels,
		// grid_offset_x, grid_offset_y, grid_color, // if you add them
		tags
	} = req.body;
	console.log(`[PUT /api/maps/${mapId}] User ${dm_id} updating map. Body:`, req.body);

	// Basic validation: ensure at least one updatable field is present (or tags)
	if (Object.keys(req.body).length === 0) {
		return res.status(400).json({ error: "No update data provided." });
	}

	try {
		// Verify map exists and DM owns it
		const existingMap = await dbGet("SELECT * FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!existingMap) {
			console.log(`[PUT /api/maps/${mapId}] Map not found or access denied for user ${dm_id}.`);
			return res.status(404).json({ error: "Map not found or user unauthorized." });
		}

		// Begin transaction
		await dbRun("BEGIN TRANSACTION");
		console.log(`[PUT /api/maps/${mapId}] Transaction started.`);

		// Update core game_maps fields
		const updateFields = {};
		if (name !== undefined) updateFields.name = name.trim();
		if (map_asset_id !== undefined) {
			// Verify new asset if changed
			const asset = await dbGet("SELECT id FROM assets WHERE id = ?", [map_asset_id]);
			if (!asset) {
				await dbRun("ROLLBACK");
				console.log(`[PUT /api/maps/${mapId}] New asset ID ${map_asset_id} not found. Rolled back.`);
				return res.status(404).json({ error: `Asset with ID ${map_asset_id} not found.` });
			}
			updateFields.map_asset_id = map_asset_id;
		}
		if (grid_enabled !== undefined) updateFields.grid_enabled = Number(grid_enabled);
		if (grid_size_pixels !== undefined) updateFields.grid_size_pixels = grid_size_pixels;
		// Add other grid fields if they are in your schema

		if (Object.keys(updateFields).length > 0) {
			const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
			const updateParams = [...Object.values(updateFields), mapId];
			await dbRun(`UPDATE game_maps SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateParams);
			console.log(`[PUT /api/maps/${mapId}] Core map fields updated.`);
		}

		// Update tags if 'tags' array is provided
		if (tags !== undefined && Array.isArray(tags)) {
			console.log(`[PUT /api/maps/${mapId}] Updating tags. New tags:`, tags);
			await dbRun("DELETE FROM map_tags WHERE map_id = ?", [mapId]); // Clear existing tags
			if (tags.length > 0) {
				const tagIds = await getOrCreateTagIds(db, tags);
				if (tagIds.length > 0) {
					const assignPromises = tagIds.map(tagId =>
						dbRun("INSERT INTO map_tags (map_id, tag_id) VALUES (?, ?)", [mapId, tagId])
					);
					await Promise.all(assignPromises);
					console.log(`[PUT /api/maps/${mapId}] New tags assigned.`);
				}
			}
		}

		await dbRun("COMMIT");
		console.log(`[PUT /api/maps/${mapId}] Transaction committed.`);

		// Fetch the updated map data to return to client
		// This also serves as verification that the update was successful
		const updatedMapFullData = await dbGet( // Using the same query as GET /:mapId for consistency
			`SELECT gm.*, a.filepath as asset_filepath 
             FROM game_maps gm 
             JOIN assets a ON gm.map_asset_id = a.id 
             WHERE gm.id = ? AND gm.dm_id = ?`, [mapId, dm_id]
		);

		if (!updatedMapFullData) {
			// This case should ideally not be reached if transaction was successful and map existed
			console.error(`[PUT /api/maps/${mapId}] CRITICAL: Map updated but could not be re-fetched.`);
			return res.status(500).json({ error: 'Map updated but failed to retrieve new details.' });
		}

		const finalTags = await dbAll(
			`SELECT t.id, t.name FROM tags t JOIN map_tags mt ON t.id = mt.tag_id WHERE mt.map_id = ? ORDER BY t.name ASC`,
			[mapId]
		);
		// Fog and pins are not modified by this endpoint, so we don't need to re-fetch them unless specifically requested.
		// For simplicity, we'll return the core updated map + tags.
		// The client might need to re-fetch full details if it relies on fog/pins being current after this PUT.

		const responsePayload = {
			...updatedMapFullData,
			mapAssetUrl: `/uploads/${updatedMapFullData.asset_filepath}`,
			tags: finalTags || []
			// If you want to include fog and pins, fetch them here too.
		};
		delete responsePayload.asset_filepath;

		console.log(`[PUT /api/maps/${mapId}] Update successful. Sending updated map data.`);
		res.json(responsePayload);

	} catch (error) {
		await dbRun("ROLLBACK").catch(rbErr => console.error(`[PUT /api/maps/${mapId}] Error during rollback:`, rbErr.message));
		console.error(`[PUT /api/maps/${mapId}] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to update map.', details: error.message });
	}
});

// DELETE /api/maps/:mapId - Delete a map
router.delete('/:mapId', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	console.log(`[DELETE /api/maps/${mapId}] User ${dm_id} requesting deletion of map.`);

	try {
		// Verify map exists and DM owns it before attempting delete
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			console.log(`[DELETE /api/maps/${mapId}] Map not found or access denied for user ${dm_id}.`);
			return res.status(404).json({ error: 'Map not found or not authorized to delete.' });
		}

		const result = await dbRun("DELETE FROM game_maps WHERE id = ?", [mapId]);
		// ON DELETE CASCADE in schema should handle related map_fog_data, map_pins, map_tags

		if (result.changes === 0) {
			// This shouldn't happen if the above check passed, but as a safeguard
			console.log(`[DELETE /api/maps/${mapId}] Map not found during delete operation (after initial check).`);
			return res.status(404).json({ error: 'Map not found.' });
		}
		console.log(`[DELETE /api/maps/${mapId}] Map successfully deleted. Changes: ${result.changes}`);
		res.status(200).json({ message: 'Map deleted successfully.' }); // Or 204 No Content

	} catch (error) {
		console.error(`[DELETE /api/maps/${mapId}] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to delete map.' });
	}
});


// --- FOG OF WAR ---
// PUT /api/maps/:mapId/fog - Update fog data (DM Only)
router.put('/:mapId/fog', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	const { fog_data_json } = req.body; // Expects a JSON string of the array of revealed rectangles

	console.log(`[PUT /api/maps/${mapId}/fog] User ${dm_id} updating fog. Data length: ${fog_data_json ? fog_data_json.length : 'N/A'}`);

	if (fog_data_json === undefined || typeof fog_data_json !== 'string') {
		return res.status(400).json({ error: 'fog_data_json is required and must be a JSON string.' });
	}

	try {
		// Validate if it's valid JSON (specifically an array, though the DB stores it as TEXT)
		const parsedFog = JSON.parse(fog_data_json);
		if (!Array.isArray(parsedFog)) {
			return res.status(400).json({ error: 'fog_data_json must represent a valid JSON array.' });
		}
	} catch (e) {
		console.log(`[PUT /api/maps/${mapId}/fog] Invalid JSON format for fog_data_json:`, e.message);
		return res.status(400).json({ error: 'Invalid JSON format for fog_data_json.' });
	}

	try {
		// Verify map exists and DM owns it
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			console.log(`[PUT /api/maps/${mapId}/fog] Map not found or access denied for user ${dm_id}.`);
			return res.status(404).json({ error: 'Map not found or unauthorized to update fog.' });
		}

		// Update or Insert fog data. map_fog_data has map_id as PK.
		const sql = `
            INSERT INTO map_fog_data (map_id, fog_data_json, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(map_id) DO UPDATE SET 
                fog_data_json = excluded.fog_data_json,
                updated_at = CURRENT_TIMESTAMP
        `;
		await dbRun(sql, [mapId, fog_data_json]);

		console.log(`[PUT /api/maps/${mapId}/fog] Fog data updated successfully.`);
		res.json({ message: 'Map fog data updated successfully.' });

	} catch (error) {
		console.error(`[PUT /api/maps/${mapId}/fog] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to update map fog data.' });
	}
});

// --- MAP ELEMENTS (Replaces PINS routes) ---

// POST /api/maps/:mapId/elements - Create a new map element
router.post('/:mapId/elements', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	const {
		element_type,
		x_coord_percent, y_coord_percent,
		width_percent, height_percent, // Optional
		label = '',
		description = '',
		is_visible_to_players = false,
		element_data = {} // Expects a JSON object specific to the element_type
	} = req.body;

	console.log(`[POST /api/maps/${mapId}/elements] User ${dm_id} creating element. Type: ${element_type}, Coords: (${x_coord_percent}, ${y_coord_percent}) Label: ${label}`);

	// --- Validations ---
	if (!element_type || !['pin', 'text', 'area'].includes(element_type)) { // Extend with more types
		return res.status(400).json({ error: 'Valid element_type is required.' });
	}
	if (x_coord_percent === undefined || typeof x_coord_percent !== 'number' || x_coord_percent < 0 || x_coord_percent > 1 ||
		y_coord_percent === undefined || typeof y_coord_percent !== 'number' || y_coord_percent < 0 || y_coord_percent > 1) {
		return res.status(400).json({ error: 'Coordinates (x_coord_percent, y_coord_percent) must be numbers between 0.0 and 1.0.' });
	}
	// Add validation for element_data based on element_type
	if (element_type === 'pin') {
		if (!element_data.icon || typeof element_data.icon !== 'string') {
			return res.status(400).json({ error: 'Pin element_data requires an "icon" string.' });
		}
		// element_data.color could be optional with a default
	} else if (element_type === 'text') {
		if (!element_data.content || typeof element_data.content !== 'string') {
			// For Tiptap, content is often HTML. You might allow empty initially.
			// return res.status(400).json({ error: 'Text element_data requires "content" string.' });
		}
	}
	// --- End Validations ---

	try {
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			return res.status(404).json({ error: 'Map not found or unauthorized.' });
		}

		const elementSql = `
            INSERT INTO map_elements (map_id, element_type, x_coord_percent, y_coord_percent, width_percent, height_percent, label, description, is_visible_to_players, element_data, dm_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
		const result = await dbRun(elementSql, [
			mapId, element_type, x_coord_percent, y_coord_percent, width_percent, height_percent,
			label, description, Number(is_visible_to_players), JSON.stringify(element_data), dm_id
		]);
		const newElementId = result.lastID;

		const newElementData = await dbGet("SELECT * FROM map_elements WHERE id = ?", [newElementId]);
		if (!newElementData) {
			return res.status(500).json({ error: 'Element created but failed to retrieve details.' });
		}
		// Parse element_data back to JSON for the response
		if (newElementData.element_data) {
			newElementData.element_data = JSON.parse(newElementData.element_data);
		}


		res.status(201).json(newElementData);
	} catch (error) {
		console.error(`[POST /api/maps/${mapId}/elements] Error:`, error.message, error.stack);
		res.status(500).json({ error: error.message || 'Server error creating element.' });
	}
});

// GET /api/maps/:mapId/elements - Get all elements for a specific map (DM access)
router.get('/:mapId/elements', protect, authorize('DM'), async (req, res) => {
	const { mapId } = req.params;
	const dm_id = req.user.id;
	const { type } = req.query; // Optional filter by element_type

	console.log(`[GET /api/maps/${mapId}/elements] User ${dm_id} requesting elements. Type filter: ${type || 'All'}`);

	try {
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			return res.status(404).json({ error: 'Map not found or unauthorized.' });
		}

		let elementsSql = "SELECT * FROM map_elements WHERE map_id = ?";
		const queryParams = [mapId];

		if (type) {
			elementsSql += " AND element_type = ?";
			queryParams.push(type);
		}
		elementsSql += " ORDER BY created_at ASC";

		const elements = await dbAll(elementsSql, queryParams);
		// Parse element_data for each element
		const processedElements = elements.map(el => ({
			...el,
			element_data: el.element_data ? JSON.parse(el.element_data) : {}
		}));

		console.log(`[GET /api/maps/${mapId}/elements] Found ${processedElements.length} elements.`);
		res.json(processedElements || []);
	} catch (error) {
		console.error(`[GET /api/maps/${mapId}/elements] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to retrieve elements.' });
	}
});

// PUT /api/maps/:mapId/elements/:elementId - Update a specific element
router.put('/:mapId/elements/:elementId', protect, authorize('DM'), async (req, res) => {
	const { mapId, elementId } = req.params;
	const dm_id = req.user.id;
	const {
		x_coord_percent, y_coord_percent,
		width_percent, height_percent,
		label, description,
		is_visible_to_players,
		element_data // Full new element_data object
	} = req.body;

	console.log(`[PUT /api/maps/${mapId}/elements/${elementId}] User ${dm_id} updating element. Body:`, req.body);

	if (Object.keys(req.body).length === 0) {
		return res.status(400).json({ error: "No update data provided." });
	}
	// Add specific validations as needed (e.g., coordinate ranges)

	try {
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			return res.status(404).json({ error: 'Map not found or unauthorized.' });
		}

		const existingElement = await dbGet("SELECT * FROM map_elements WHERE id = ? AND map_id = ?", [elementId, mapId]);
		if (!existingElement) {
			return res.status(404).json({ error: 'Element not found on this map.' });
		}

		const updateFields = {};
		if (x_coord_percent !== undefined) updateFields.x_coord_percent = x_coord_percent;
		if (y_coord_percent !== undefined) updateFields.y_coord_percent = y_coord_percent;
		if (width_percent !== undefined) updateFields.width_percent = width_percent; else if (req.body.hasOwnProperty('width_percent') && width_percent === null) updateFields.width_percent = null; // Allow setting to null
		if (height_percent !== undefined) updateFields.height_percent = height_percent; else if (req.body.hasOwnProperty('height_percent') && height_percent === null) updateFields.height_percent = null; // Allow setting to null
		if (label !== undefined) updateFields.label = label;
		if (description !== undefined) updateFields.description = description;
		if (is_visible_to_players !== undefined) updateFields.is_visible_to_players = Number(is_visible_to_players);
		if (element_data !== undefined) updateFields.element_data = JSON.stringify(element_data);
		// Note: element_type is generally not updatable once created.

		if (Object.keys(updateFields).length === 0) {
			return res.status(400).json({ error: 'No valid fields provided for update.' });
		}

		const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
		const updateParams = [...Object.values(updateFields), elementId];

		await dbRun(`UPDATE map_elements SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateParams);

		const updatedElementData = await dbGet("SELECT * FROM map_elements WHERE id = ?", [elementId]);
		if (updatedElementData && updatedElementData.element_data) {
			updatedElementData.element_data = JSON.parse(updatedElementData.element_data);
		}
		console.log(`[PUT /api/maps/${mapId}/elements/${elementId}] Element update successful.`);
		res.json(updatedElementData);

	} catch (error) {
		console.error(`[PUT /api/maps/${mapId}/elements/${elementId}] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to update element.', details: error.message });
	}
});

// DELETE /api/maps/:mapId/elements/:elementId - Delete an element
router.delete('/:mapId/elements/:elementId', protect, authorize('DM'), async (req, res) => {
	const { mapId, elementId } = req.params;
	const dm_id = req.user.id;
	console.log(`[DELETE /api/maps/${mapId}/elements/${elementId}] User ${dm_id} requesting deletion.`);

	try {
		const map = await dbGet("SELECT id FROM game_maps WHERE id = ? AND dm_id = ?", [mapId, dm_id]);
		if (!map) {
			return res.status(404).json({ error: 'Map not found or unauthorized.' });
		}
		const existingElement = await dbGet("SELECT id FROM map_elements WHERE id = ? AND map_id = ?", [elementId, mapId]);
		if (!existingElement) {
			return res.status(404).json({ error: 'Element not found on this map.' });
		}

		const result = await dbRun("DELETE FROM map_elements WHERE id = ?", [elementId]);
		if (result.changes === 0) {
			return res.status(404).json({ error: 'Element not found during delete (after check).' });
		}
		console.log(`[DELETE /api/maps/${mapId}/elements/${elementId}] Element successfully deleted.`);
		res.status(200).json({ message: 'Element deleted successfully.' });
	} catch (error) {
		console.error(`[DELETE /api/maps/${mapId}/elements/${elementId}] Error:`, error.message, error.stack);
		res.status(500).json({ error: 'Failed to delete element.' });
	}
});

module.exports = router;

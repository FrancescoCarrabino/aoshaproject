// backend/routes/assetRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getOrCreateTagIds } = require('../utils/dbHelpers');

// --- Multer Configuration for File Uploads ---

// Define the base path for all uploads on the Render Disk (use an environment variable)
// This should be the same RENDER_UPLOADS_BASE_PATH used in uploadMiddleware.js
const RENDER_UPLOADS_BASE_PATH = process.env.RENDER_UPLOADS_BASE_PATH || path.join(__dirname, '..', 'public', 'uploads'); // Fallback for local dev

// Specific directory for general assets within the base uploads path
const ASSET_UPLOAD_PATH = path.join(RENDER_UPLOADS_BASE_PATH, 'assets');

// Ensure the general asset upload directory exists on the persistent disk
if (!fs.existsSync(ASSET_UPLOAD_PATH)) {
    try {
	    fs.mkdirSync(ASSET_UPLOAD_PATH, { recursive: true });
        console.log(`Persistent general asset upload directory created at: ${ASSET_UPLOAD_PATH}`);
    } catch (dirErr) {
        console.error(`CRITICAL: Error creating persistent general asset upload directory ${ASSET_UPLOAD_PATH}:`, dirErr);
        // Handle error appropriately
    }
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
        // Check again if directory exists
        if (!fs.existsSync(ASSET_UPLOAD_PATH)) {
            try {
                fs.mkdirSync(ASSET_UPLOAD_PATH, { recursive: true });
                console.log(`Ensured general asset upload directory exists at: ${ASSET_UPLOAD_PATH}`);
            } catch (dirErr) {
                console.error(`Error ensuring general asset upload directory ${ASSET_UPLOAD_PATH} in multer destination:`, dirErr);
                return cb(dirErr);
            }
        }
		cb(null, ASSET_UPLOAD_PATH); // Files saved to the (potentially mounted) ASSET_UPLOAD_PATH
	},
	filename: function (req, file, cb) {
		const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + safeOriginalName);
	}
});

const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
		cb(null, true);
	} else {
		cb(new Error('File type not allowed! Only images, PDFs, and plain text files are currently accepted.'), false);
	}
};

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 1024 * 1024 * 10 // 10MB limit per file
	},
	fileFilter: fileFilter
});


// --- API Endpoints for Assets ---

// POST /api/assets/upload - Upload a new asset
router.post('/upload', protect, authorize('DM'), upload.single('assetfile'), async (req, res) => {
	if (!req.file) {
        // This error might also come from the fileFilter
        return res.status(400).json({ error: req.multerError || 'No file uploaded or file type not allowed.' });
    }

	const { description, visibility_scope = 'dm_only', tags } = req.body;
	const uploader_user_id = req.user.id;

    // 'filepath' in the DB should be relative to RENDER_UPLOADS_BASE_PATH.
    // Since files are saved into the 'assets' subdirectory of RENDER_UPLOADS_BASE_PATH,
    // the filepath stored should be 'assets/filename.ext'.
	const newAssetData = {
		filename_original: req.file.originalname,
		filename_stored: req.file.filename, // Just the unique filename multer created
		filepath: path.join('assets', req.file.filename), // Path relative to RENDER_UPLOADS_BASE_PATH
		mimetype: req.file.mimetype,
		filesize: req.file.size,
		description: description || null,
		uploader_user_id: uploader_user_id,
		visibility_scope: visibility_scope === 'party_wide' ? 'party_wide' : 'dm_only',
	};

	const sql = `INSERT INTO assets (filename_original, filename_stored, filepath, mimetype, filesize, description, uploader_user_id, visibility_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	const params = [
		newAssetData.filename_original, newAssetData.filename_stored, newAssetData.filepath,
		newAssetData.mimetype, newAssetData.filesize, newAssetData.description,
		newAssetData.uploader_user_id, newAssetData.visibility_scope
	];

	db.run(sql, params, async function (err) {
		if (err) {
            console.error("DB Error saving asset:", err.message);
			fs.unlink(req.file.path, (unlinkErr) => { // req.file.path is the absolute path where multer saved it
                if (unlinkErr) console.error("Error deleting orphaned uploaded asset file after DB error:", unlinkErr.message, req.file.path);
            });
			return res.status(500).json({ error: 'Failed to save asset information to database.' });
		}
		const newAssetId = this.lastID;
		let assignedTagsData = [];

		if (tags) {
            let parsedTagsArray = [];
            if (typeof tags === 'string') {
                try {
                    parsedTagsArray = JSON.parse(tags); // If tags are sent as a JSON string array
                } catch (e) {
                    // If not JSON, assume comma-separated, or handle as single tag if no comma
                    parsedTagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
                    if (parsedTagsArray.length === 0 && tags.trim() !== '') parsedTagsArray = [tags.trim()];
                    console.warn("Asset upload: Tags were a string, parsed as comma-separated or single. Original:", tags, "Parsed:", parsedTagsArray);
                }
            } else if (Array.isArray(tags)) {
                parsedTagsArray = tags;
            }

			if (Array.isArray(parsedTagsArray) && parsedTagsArray.length > 0) {
                try {
                    const tagIds = await getOrCreateTagIds(db, parsedTagsArray);
                    if (tagIds.length > 0) {
                        const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
                            db.run("INSERT INTO asset_tags (asset_id, tag_id) VALUES (?, ?)", [newAssetId, tagId], e => e ? reject(e) : resolve());
                        }));
                        await Promise.all(assignPromises);
                        assignedTagsData = await new Promise((resolve, reject) => {
                            db.all(`SELECT t.id, t.name FROM tags t WHERE t.id IN (${tagIds.map(() => '?').join(',')}) ORDER BY t.name ASC`, tagIds, (e, r) => e ? reject(e) : resolve(r || []));
                        });
                    }
                } catch (tagError) { console.error("Asset Tag Assignment Error:", tagError.message); }
            }
		}
		res.status(201).json({
			message: 'Asset uploaded successfully',
			asset: { ...newAssetData, id: newAssetId, tags: assignedTagsData }
		});
	});
}, (error, req, res, next) => { // Multer error handler, and fileFilter error handler
    if (error) {
        console.error("Upload Error (Multer or FileFilter):", error.message);
        if (error.name === 'MulterError') {
             return res.status(400).json({ error: `File upload error: ${error.message}. Max size: 10MB.` });
        }
        // For fileFilter errors (new Error('...'))
        return res.status(400).json({ error: error.message });
    }
    next();
});


// GET /api/assets - List assets
router.get('/', protect, async (req, res) => {
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];
	let baseSql = `SELECT a.id, a.filename_original, a.filepath, a.mimetype, a.filesize, a.description, a.visibility_scope, a.created_at, a.updated_at, u.username as uploader_username
                   FROM assets a
                   LEFT JOIN users u ON a.uploader_user_id = u.id`;
	let queryParams = [];
	let conditions = [];

	if (req.user.role === 'Player') {
		conditions.push("a.visibility_scope = 'party_wide'");
	}

	if (filterTagNames.length > 0) {
		try {
			const tagIdPlaceholders = filterTagNames.map(() => '?').join(',');
			const tagRows = await new Promise((resolve, reject) => db.all(`SELECT id FROM tags WHERE name IN (${tagIdPlaceholders}) COLLATE NOCASE`, filterTagNames, (e, r) => e ? reject(e) : resolve(r)));
			const filterTagIds = tagRows.map(r => r.id);
			if (filterTagIds.length > 0) {
				const subQuery = `SELECT at.asset_id FROM asset_tags at WHERE at.tag_id IN (${filterTagIds.map(() => '?').join(',')}) GROUP BY at.asset_id HAVING COUNT(DISTINCT at.tag_id) = ?`;
				conditions.push(`a.id IN (${subQuery})`);
				queryParams.push(...filterTagIds, filterTagIds.length);
			} else { 
                console.log("No matching tags found for filter, returning empty assets list.");
                return res.json([]); 
            }
		} catch (error) { 
            console.error("Error processing asset tag filters:", error);
            return res.status(500).json({ error: "Failed to process tag filters." }); 
        }
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY a.created_at DESC";

	db.all(baseSql, queryParams, async (err, assets) => {
		if (err) { 
            console.error("DB error fetching assets:", err.message);
            return res.status(500).json({ error: 'Failed to retrieve assets.' }); 
        }
		if (!assets || assets.length === 0) return res.json([]);
		try {
			const assetsWithMeta = await Promise.all(assets.map(async (asset) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => db.all(tagsSql, [asset.id], (e, r) => e ? reject(e) : resolve(r || [])));
				// asset.filepath is like "assets/filename.ext"
				// The full URL accessible to client will be "/uploads/" + asset.filepath
				return { ...asset, url: `/uploads/${asset.filepath}`, tags: tags };
			}));
			res.json(assetsWithMeta);
		} catch (tagFetchError) { 
            console.error("Error fetching tags for assets list:", tagFetchError.message);
            return res.status(500).json({ error: 'Failed to fetch tags for assets.' }); 
        }
	});
});

// GET /api/assets/:id/info - Get info for a specific asset
router.get('/:id/info', protect, (req, res) => {
	const assetId = req.params.id;
	let sql = `SELECT a.id, a.filename_original, a.filepath, a.mimetype, a.filesize, a.description, a.visibility_scope, a.created_at, a.updated_at, u.username as uploader_username FROM assets a LEFT JOIN users u ON a.uploader_user_id = u.id WHERE a.id = ?`;
	db.get(sql, [assetId], (err, asset) => {
		if (err) { 
            console.error("DB error fetching asset info:", err.message);
            return res.status(500).json({ error: 'Failed to retrieve asset info.' }); 
        }
		if (!asset) return res.status(404).json({ error: 'Asset not found.' });
		if (req.user.role === 'Player' && asset.visibility_scope !== 'party_wide') return res.status(403).json({ error: 'Access denied.' });

		const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [assetId], (tagErr, tags) => {
			if (tagErr) { 
                console.error("Error fetching tags for asset info:", tagErr.message);
                return res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: [], _tagError: "Failed to fetch tags." }); 
            }
			res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: tags || [] });
		});
	});
});

// PUT /api/assets/:id - Update asset metadata
router.put('/:id', protect, authorize('DM'), async (req, res) => {
    // ... (Your existing PUT logic - no changes needed for disk path) ...
	const assetId = req.params.id;
	const { description, visibility_scope, tags } = req.body;

	db.serialize(async () => {
		try {
			await new Promise((resolve, reject) => db.run("BEGIN TRANSACTION", [], e => e ? reject(e) : resolve()));

			let setClauses = []; let coreParams = [];
			if (description !== undefined) { setClauses.push("description = ?"); coreParams.push(description === '' ? null : description); } // Allow clearing description
			if (visibility_scope !== undefined && ['dm_only', 'party_wide'].includes(visibility_scope)) { 
                setClauses.push("visibility_scope = ?"); coreParams.push(visibility_scope); 
            }

			let coreFieldsUpdated = false;
			if (setClauses.length > 0) {
				coreParams.push(assetId);
				const updateSql = `UPDATE assets SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
				await new Promise((resolve, reject) => {
					db.run(updateSql, coreParams, function (err) {
						if (err) return reject(err);
						if (this.changes > 0) coreFieldsUpdated = true;
						resolve();
					});
				});
			}

			let tagsUpdated = false;
			if (tags !== undefined && Array.isArray(tags)) { // Tags can be an empty array to clear them
				tagsUpdated = true;
				await new Promise((resolve, reject) => db.run("DELETE FROM asset_tags WHERE asset_id = ?", [assetId], e => e ? reject(e) : resolve()));
				if (tags.length > 0) {
					const tagIds = await getOrCreateTagIds(db, tags);
					if (tagIds.length > 0) {
						const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
							db.run("INSERT INTO asset_tags (asset_id, tag_id) VALUES (?,?)", [assetId, tagId], e => e ? reject(e) : resolve());
						}));
						await Promise.all(assignPromises);
					}
				}
			}

			if (!coreFieldsUpdated && !tagsUpdated) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("No valid fields or tags provided for update."))));
				return res.status(400).json({ error: 'No valid fields or tags provided for update.' });
			}

			const assetExists = await new Promise((resolve, reject) => db.get("SELECT 1 FROM assets WHERE id = ?", [assetId], (e, r) => e ? reject(e) : resolve(!!r)));
			if (!assetExists) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("Asset not found."))));
				return res.status(404).json({ error: "Asset not found." });
			}

			await new Promise((resolve, reject) => db.run("COMMIT", [], e => e ? reject(e) : resolve()));
            
            // Fetch and return the updated asset
            const fetchSql = `SELECT a.*, u.username as uploader_username FROM assets a LEFT JOIN users u ON a.uploader_user_id = u.id WHERE a.id = ?`;
            const updatedAsset = await new Promise((resolve, reject) => db.get(fetchSql, [assetId], (e,r) => e ? reject(e) : resolve(r)));
            const finalTags = await new Promise((resolve, reject) => db.all(`SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`, [assetId], (e,r) => e ? reject(e) : resolve(r || [])));

			res.json({ message: 'Asset updated successfully.', asset: {...updatedAsset, tags: finalTags, url: `/uploads/${updatedAsset.filepath}`} });

		} catch (error) {
			await new Promise((resolve) => db.run("ROLLBACK", [], () => resolve()));
			console.error("DB Error updating asset:", error);
			res.status(500).json({ error: 'Failed to update asset.', details: error.message });
		}
	});
});

// GET /api/assets/:id/download - Download a specific asset
router.get('/:id/download', protect, (req, res) => {
	const assetId = req.params.id;
	const sql = `SELECT filepath, filename_original, mimetype, visibility_scope, uploader_user_id FROM assets WHERE id = ?`;

	db.get(sql, [assetId], (err, row) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Database error.' }); }
		if (!row) return res.status(404).json({ error: 'Asset not found.' });
		if (req.user.role === 'Player' && row.visibility_scope !== 'party_wide') { /* ... */ return res.status(403).json({ error: 'Access denied.' }); }

        // Construct absolute file path using the RENDER_UPLOADS_BASE_PATH
        // row.filepath is 'assets/filename.ext'
		const absoluteFilePath = path.join(RENDER_UPLOADS_BASE_PATH, row.filepath);

		if (fs.existsSync(absoluteFilePath)) {
			res.download(absoluteFilePath, row.filename_original, (dlError) => { // Using res.download for proper headers
                if (dlError) {
                    console.error("Error during asset download:", dlError.message);
                    if (!res.headersSent) {
                         res.status(500).json({ error: "Error initiating file download."});
                    }
                }
            });
		} else { 
            console.error("Asset file not found on system for download:", absoluteFilePath);
            res.status(404).json({ error: 'File not found on server system.' }); 
        }
	});
});


// DELETE /api/assets/:id - Delete an asset
router.delete('/:id', protect, authorize('DM'), (req, res) => {
	const assetId = req.params.id;
	db.get("SELECT filepath FROM assets WHERE id = ?", [assetId], (err, row) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Database error finding asset.' }); }
		if (!row) return res.status(404).json({ error: 'Asset not found.' });

		const assetFilepath = row.filepath; 
        // Construct absolute file path using RENDER_UPLOADS_BASE_PATH
		const absoluteFilePath = path.join(RENDER_UPLOADS_BASE_PATH, assetFilepath);

		db.run("DELETE FROM assets WHERE id = ?", [assetId], function (err) { 
            if (err) { /* ... */ return res.status(500).json({ error: 'Failed to delete asset from database.' }); }
			if (this.changes === 0) { /* ... */ return res.status(404).json({ error: 'Asset not found in database for deletion.' }); }
			
            if (fs.existsSync(absoluteFilePath)) { // Check before unlinking
    			fs.unlink(absoluteFilePath, (unlinkErr) => {
	    			if (unlinkErr) {
		    			console.error(`Failed to delete asset file: ${absoluteFilePath}. DB record was deleted.`, unlinkErr.message);
			    		return res.json({ message: 'Asset record deleted, but file deletion failed. Please check server logs.' });
				    }
    				res.json({ message: 'Asset and file deleted successfully.' });
	    		});
            } else {
                console.warn(`Asset file not found for deletion, but DB record removed: ${absoluteFilePath}`);
                res.json({ message: 'Asset record deleted. File was not found on server.' });
            }
        });
	});
});

// Multer error handler (if needed at router level, though individual routes can have it too)
// This might be redundant if each route's upload.single() already has an error handler callback.
// router.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     return res.status(400).json({ error: `Multer error: ${error.message}` });
//   } else if (error) {
//     return res.status(400).json({ error: error.message });
//   }
//   next();
// });


module.exports = router;

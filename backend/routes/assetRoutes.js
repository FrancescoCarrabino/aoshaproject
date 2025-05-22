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
const ASSET_UPLOAD_PATH = path.join(__dirname, '..', 'public', 'uploads', 'assets');

// Ensure the upload directory exists
if (!fs.existsSync(ASSET_UPLOAD_PATH)) {
	fs.mkdirSync(ASSET_UPLOAD_PATH, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, ASSET_UPLOAD_PATH);
	},
	filename: function (req, file, cb) {
		// Create a unique filename: timestamp + originalname
		// Sanitize originalname to prevent path traversal or other issues
		const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + safeOriginalName);
	}
});

// File filter (optional, good for security)
const fileFilter = (req, file, cb) => {
	// Accept common image types, PDFs, and basic text files for now
	// You can expand this list as needed
	if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
		cb(null, true);
	} else {
		cb(new Error('File type not allowed!'), false);
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
	if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed.' });

	const { description, visibility_scope = 'dm_only', tags } = req.body; // Added 'tags'
	const uploader_user_id = req.user.id;

	const newAssetData = { /* ... from req.file ... */
		filename_original: req.file.originalname,
		filename_stored: req.file.filename,
		filepath: path.join('assets', req.file.filename),
		mimetype: req.file.mimetype,
		filesize: req.file.size,
		description: description || null,
		uploader_user_id: uploader_user_id,
		visibility_scope: visibility_scope === 'party_wide' ? 'party_wide' : 'dm_only',
	};

	const sql = `INSERT INTO assets (filename_original, filename_stored, filepath, mimetype, filesize, description, uploader_user_id, visibility_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	const params = [ /* ... from newAssetData ... */
		newAssetData.filename_original, newAssetData.filename_stored, newAssetData.filepath,
		newAssetData.mimetype, newAssetData.filesize, newAssetData.description,
		newAssetData.uploader_user_id, newAssetData.visibility_scope
	];

	db.run(sql, params, async function (err) {
		if (err) { /* ... handle DB error, unlink file ... */
			fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting orphaned uploaded file:", unlinkErr.message); });
			return res.status(500).json({ error: 'Failed to save asset information to database.' });
		}
		const newAssetId = this.lastID;
		let assignedTagsData = [];

		if (tags && Array.isArray(tags) && tags.length > 0) {
			try {
				const tagIds = await getOrCreateTagIds(db, JSON.parse(tags)); // FormData might send tags as stringified JSON
				if (tagIds.length > 0) {
					const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
						db.run("INSERT INTO asset_tags (asset_id, tag_id) VALUES (?, ?)", [newAssetId, tagId], e => e ? reject(e) : resolve());
					}));
					await Promise.all(assignPromises);
					assignedTagsData = await new Promise((resolve, reject) => {
						db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name ASC`, tagIds, (e, r) => e ? reject(e) : resolve(r));
					});
				}
			} catch (tagError) { console.error("Asset Tag Assign Error:", tagError); /* Handle gracefully */ }
		}
		res.status(201).json({
			message: 'Asset uploaded successfully',
			asset: { ...newAssetData, id: newAssetId, tags: assignedTagsData }
		});
	});
});

// GET /api/assets - List assets
router.get('/', protect, async (req, res) => {
	const filterTagNames = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(t => t) : [];
	let baseSql = `SELECT a.id, a.filename_original, a.filepath, a.mimetype, a.filesize, a.description, a.visibility_scope, a.created_at, a.updated_at, u.username as uploader_username
                   FROM assets a
                   LEFT JOIN users u ON a.uploader_user_id = u.id`; // Use LEFT JOIN if uploader_user_id can be null
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
			} else { return res.json([]); }
		} catch (error) { /* ... */ return res.status(500).json({ error: "Failed to process tag filters." }); }
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY a.created_at DESC";

	db.all(baseSql, queryParams, async (err, assets) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Failed to retrieve assets.' }); }
		if (assets.length === 0) return res.json([]);
		try {
			const assetsWithMeta = await Promise.all(assets.map(async (asset) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => db.all(tagsSql, [asset.id], (e, r) => e ? reject(e) : resolve(r)));
				return { ...asset, url: `/uploads/${asset.filepath}`, tags: tags || [] };
			}));
			res.json(assetsWithMeta);
		} catch (tagFetchError) { /* ... */ return res.status(500).json({ error: 'Failed to fetch tags for assets.' }); }
	});
});

// GET /api/assets/:id/info - Get info for a specific asset
router.get('/:id/info', protect, (req, res) => {
	const assetId = req.params.id;
	let sql = `SELECT a.*, u.username as uploader_username FROM assets a LEFT JOIN users u ON a.uploader_user_id = u.id WHERE a.id = ?`;
	db.get(sql, [assetId], (err, asset) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Failed to retrieve asset info.' }); }
		if (!asset) return res.status(404).json({ error: 'Asset not found.' });
		if (req.user.role === 'Player' && asset.visibility_scope !== 'party_wide') return res.status(403).json({ error: 'Access denied.' });

		const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [assetId], (tagErr, tags) => {
			if (tagErr) { /* ... */ return res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: [], _tagError: "Failed to fetch tags." }); }
			res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: tags || [] });
		});
	});
});

// PUT /api/assets/:id - Update asset metadata (description, visibility, tags)
router.put('/:id', protect, authorize('DM'), async (req, res) => {
	const assetId = req.params.id;
	const { description, visibility_scope, tags } = req.body; // Added 'tags'

	db.serialize(async () => {
		try {
			await new Promise((resolve, reject) => db.run("BEGIN TRANSACTION", [], e => e ? reject(e) : resolve()));

			let setClauses = []; let coreParams = [];
			if (description !== undefined) { setClauses.push("description = ?"); coreParams.push(description); }
			if (visibility_scope !== undefined) { /* ... validation ... */ setClauses.push("visibility_scope = ?"); coreParams.push(visibility_scope); }

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
			if (tags !== undefined && Array.isArray(tags)) {
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
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("No fields or tags to update."))));
				return res.status(400).json({ error: 'No fields or tags to update.' });
			}

			const assetExists = await new Promise((resolve, reject) => db.get("SELECT 1 FROM assets WHERE id = ?", [assetId], (e, r) => e ? reject(e) : resolve(!!r)));
			if (!assetExists) {
				await new Promise((resolve, reject) => db.run("ROLLBACK", [], () => reject(new Error("Asset not found."))));
				return res.status(404).json({ error: "Asset not found." });
			}

			await new Promise((resolve, reject) => db.run("COMMIT", [], e => e ? reject(e) : resolve()));
			res.json({ message: 'Asset updated successfully.' });

		} catch (error) {
			await new Promise((resolve) => db.run("ROLLBACK", [], () => resolve()));
			console.error("DB Error updating asset with tags:", error);
			res.status(500).json({ error: 'Failed to update asset.', details: error.message });
		}
	});
});

// GET /api/assets/:id/download - Download a specific asset (Serves the file)
// DM sees all, Players see 'party_wide' assets or if they uploaded
// Note: This is one way. For large files or more control, you might stream.
// For images and PDFs that browsers can display, the client can just use the URL from GET / or GET /:id/info
// This endpoint is more for forcing a download or accessing files browsers don't render inline.
router.get('/:id/download', protect, (req, res) => {
	const assetId = req.params.id;
	const sql = `SELECT filepath, filename_original, mimetype, visibility_scope, uploader_user_id FROM assets WHERE id = ?`;

	db.get(sql, [assetId], (err, row) => {
		if (err) {
			console.error("Error fetching asset for download:", err.message);
			return res.status(500).json({ error: 'Database error.' });
		}
		if (!row) {
			return res.status(404).json({ error: 'Asset not found.' });
		}

		// Authorization check
		if (req.user.role === 'Player' && row.visibility_scope !== 'party_wide') {
			// And not uploader (future: && row.uploader_user_id !== req.user.id)
			return res.status(403).json({ error: 'Access denied to download this asset.' });
		}

		const absoluteFilePath = path.join(__dirname, '..', 'public', 'uploads', row.filepath);

		if (fs.existsSync(absoluteFilePath)) {
			// Set headers to suggest download, using original filename
			// res.setHeader('Content-Disposition', `attachment; filename="${row.filename_original}"`);
			// res.setHeader('Content-Type', row.mimetype);
			// res.download(absoluteFilePath, row.filename_original); // This sets headers automatically

			// For browser display (images, pdfs), it's often better to just serve it.
			// The 'static' middleware already handles this if the URL is known.
			// This route is useful if you want to enforce download or hide the direct /uploads/ path.
			res.sendFile(absoluteFilePath, (err) => {
				if (err) {
					console.error("Error sending file:", err);
					if (!res.headersSent) {
						res.status(500).json({ error: "Error sending file" });
					}
				}
			});
		} else {
			console.error("File not found on system:", absoluteFilePath);
			res.status(404).json({ error: 'File not found on server.' });
		}
	});
});


// DELETE /api/assets/:id - Delete an asset (record and file)
// Protected: DM only for now.
router.delete('/:id', protect, authorize('DM'), (req, res) => {
	const assetId = req.params.id;

	// First, get the filepath to delete the file
	db.get("SELECT filepath FROM assets WHERE id = ?", [assetId], (err, row) => {
		if (err) {
			console.error("Error finding asset for deletion:", err.message);
			return res.status(500).json({ error: 'Database error finding asset.' });
		}
		if (!row) {
			return res.status(404).json({ error: 'Asset not found.' });
		}

		const assetFilepath = row.filepath; // This is the relative path like 'assets/filename.jpg'
		const absoluteFilePath = path.join(__dirname, '..', 'public', 'uploads', assetFilepath);

		// Then, delete the database record
		db.run("DELETE FROM assets WHERE id = ?", [assetId], function (err) {
			if (err) {
				console.error("Error deleting asset from DB:", err.message);
				return res.status(500).json({ error: 'Failed to delete asset from database.' });
			}
			if (this.changes === 0) {
				// Should not happen if previous find was successful, but good for robustness
				return res.status(404).json({ error: 'Asset not found in database for deletion.' });
			}

			// If DB deletion was successful, delete the file
			fs.unlink(absoluteFilePath, (unlinkErr) => {
				if (unlinkErr) {
					// Log error but still return success as DB record is gone
					console.error(`Failed to delete asset file: ${absoluteFilePath}. DB record was deleted.`, unlinkErr.message);
					return res.json({ message: 'Asset record deleted, but file deletion failed. Please check server logs.' });
				}
				res.json({ message: 'Asset and file deleted successfully.' });
			});
		});
	});
});

module.exports = router;

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
// Define the mount path for Render Disk uploads (use an environment variable)
const RENDER_UPLOADS_BASE_PATH = process.env.RENDER_UPLOADS_BASE_PATH || path.join(__dirname, '..', 'public', 'uploads'); // Fallback for local dev

const ASSET_UPLOAD_PATH = path.join(RENDER_UPLOADS_BASE_PATH, 'assets');

// Ensure the upload directory exists on the persistent disk
if (!fs.existsSync(ASSET_UPLOAD_PATH)) {
    try {
	    fs.mkdirSync(ASSET_UPLOAD_PATH, { recursive: true });
        console.log(`General asset upload directory created at: ${ASSET_UPLOAD_PATH}`);
    } catch (dirErr) {
        console.error(`Error creating general asset upload directory ${ASSET_UPLOAD_PATH}:`, dirErr);
        // Handle error appropriately
    }
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, ASSET_UPLOAD_PATH); // Files saved to the (potentially mounted) ASSET_UPLOAD_PATH
	},
	filename: function (req, file, cb) {
		// ... (filename logic remains the same) ...
		const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + safeOriginalName);
	}
});

// File filter (remains the same)
const fileFilter = (req, file, cb) => {
	// ... (fileFilter logic remains the same) ...
	if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
		cb(null, true);
	} else {
		cb(new Error('File type not allowed!'), false);
	}
};

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 1024 * 1024 * 10 
	},
	fileFilter: fileFilter
});


// --- API Endpoints for Assets ---

// POST /api/assets/upload - Upload a new asset
router.post('/upload', protect, authorize('DM'), upload.single('assetfile'), async (req, res) => {
	if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed.' });

	const { description, visibility_scope = 'dm_only', tags } = req.body; 
	const uploader_user_id = req.user.id;

    // The 'filepath' stored in DB should be relative to the RENDER_UPLOADS_BASE_PATH
    // If RENDER_UPLOADS_BASE_PATH is /mnt/aosha_data/uploads
    // And file is in /mnt/aosha_data/uploads/assets/file.png
    // Then filepath should be 'assets/file.png'
	const newAssetData = {
		filename_original: req.file.originalname,
		filename_stored: req.file.filename, // Just the filename part
		filepath: path.join('assets', req.file.filename), // Relative path from RENDER_UPLOADS_BASE_PATH
		mimetype: req.file.mimetype,
		filesize: req.file.size,
		description: description || null,
		uploader_user_id: uploader_user_id,
		visibility_scope: visibility_scope === 'party_wide' ? 'party_wide' : 'dm_only',
	};
    // The rest of this route handler (DB insertion, tag handling) remains the same
    // ... (your existing DB logic for POST /upload) ...
	const sql = `INSERT INTO assets (filename_original, filename_stored, filepath, mimetype, filesize, description, uploader_user_id, visibility_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	const params = [ 
		newAssetData.filename_original, newAssetData.filename_stored, newAssetData.filepath,
		newAssetData.mimetype, newAssetData.filesize, newAssetData.description,
		newAssetData.uploader_user_id, newAssetData.visibility_scope
	];

	db.run(sql, params, async function (err) {
		if (err) { 
			fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting orphaned uploaded file:", unlinkErr.message); });
			return res.status(500).json({ error: 'Failed to save asset information to database.' });
		}
		const newAssetId = this.lastID;
		let assignedTagsData = [];

		if (tags) { // Check if tags exist
            let parsedTags = [];
            try {
                // FormData might send tags as a stringified JSON array, or just comma-separated string
                if (typeof tags === 'string') {
                    parsedTags = JSON.parse(tags);
                } else if (Array.isArray(tags)) {
                    parsedTags = tags;
                }
            } catch (e) {
                console.warn("Could not parse tags from request body for new asset, assuming comma-separated if it's a string:", tags);
                if (typeof tags === 'string') parsedTags = tags.split(',').map(t => t.trim()).filter(t => t);
            }

			if (Array.isArray(parsedTags) && parsedTags.length > 0) {
                try {
                    const tagIds = await getOrCreateTagIds(db, parsedTags); 
                    if (tagIds.length > 0) {
                        const assignPromises = tagIds.map(tagId => new Promise((resolve, reject) => {
                            db.run("INSERT INTO asset_tags (asset_id, tag_id) VALUES (?, ?)", [newAssetId, tagId], e => e ? reject(e) : resolve());
                        }));
                        await Promise.all(assignPromises);
                        assignedTagsData = await new Promise((resolve, reject) => {
                            db.all(`SELECT id, name FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')}) ORDER BY name ASC`, tagIds, (e, r) => e ? reject(e) : resolve(r || []));
                        });
                    }
                } catch (tagError) { console.error("Asset Tag Assign Error:", tagError); }
            }
		}
		res.status(201).json({
			message: 'Asset uploaded successfully',
			asset: { ...newAssetData, id: newAssetId, tags: assignedTagsData }
		});
	});
});

// GET /api/assets - List assets
router.get('/', protect, async (req, res) => {
    // ... (This route's logic for constructing 'url' property might need review if it relies on a fixed 'public' path)
    // The 'url' should be '/uploads/' + asset.filepath where asset.filepath is 'assets/filename.ext'
    // The existing code `url: /uploads/${asset.filepath}` seems correct.
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
			} else { return res.json([]); }
		} catch (error) { return res.status(500).json({ error: "Failed to process tag filters." }); }
	}

	if (conditions.length > 0) {
		baseSql += " WHERE " + conditions.join(" AND ");
	}
	baseSql += " ORDER BY a.created_at DESC";

	db.all(baseSql, queryParams, async (err, assets) => {
		if (err) { return res.status(500).json({ error: 'Failed to retrieve assets.' }); }
		if (assets.length === 0) return res.json([]);
		try {
			const assetsWithMeta = await Promise.all(assets.map(async (asset) => {
				const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
				const tags = await new Promise((resolve, reject) => db.all(tagsSql, [asset.id], (e, r) => e ? reject(e) : resolve(r || [])));
				return { ...asset, url: `/uploads/${asset.filepath}`, tags: tags }; // This should be correct
			}));
			res.json(assetsWithMeta);
		} catch (tagFetchError) { return res.status(500).json({ error: 'Failed to fetch tags for assets.' }); }
	});
});

// GET /api/assets/:id/info - Get info for a specific asset
router.get('/:id/info', protect, (req, res) => {
    // ... (This route also returns 'url', ensure it's consistent: `/uploads/${asset.filepath}`)
    // The existing code `url: /uploads/${asset.filepath}` seems correct.
	const assetId = req.params.id;
	let sql = `SELECT a.*, u.username as uploader_username FROM assets a LEFT JOIN users u ON a.uploader_user_id = u.id WHERE a.id = ?`;
	db.get(sql, [assetId], (err, asset) => {
		if (err) { return res.status(500).json({ error: 'Failed to retrieve asset info.' }); }
		if (!asset) return res.status(404).json({ error: 'Asset not found.' });
		if (req.user.role === 'Player' && asset.visibility_scope !== 'party_wide') return res.status(403).json({ error: 'Access denied.' });

		const tagsSql = `SELECT t.id, t.name FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC`;
		db.all(tagsSql, [assetId], (tagErr, tags) => {
			if (tagErr) { return res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: [], _tagError: "Failed to fetch tags." }); }
			res.json({ ...asset, url: `/uploads/${asset.filepath}`, tags: tags || [] });
		});
	});
});

// PUT /api/assets/:id - Update asset metadata (remains the same internally)
router.put('/:id', protect, authorize('DM'), async (req, res) => { /* ... your existing PUT logic ... */ });

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
			res.sendFile(absoluteFilePath, (err) => { /* ... */ });
		} else { /* ... */ res.status(404).json({ error: 'File not found on server.' }); }
	});
});

// DELETE /api/assets/:id - Delete an asset
router.delete('/:id', protect, authorize('DM'), (req, res) => {
	const assetId = req.params.id;
	db.get("SELECT filepath FROM assets WHERE id = ?", [assetId], (err, row) => {
		if (err) { /* ... */ return res.status(500).json({ error: 'Database error finding asset.' }); }
		if (!row) return res.status(404).json({ error: 'Asset not found.' });

		const assetFilepath = row.filepath; // e.g., 'assets/filename.jpg'
        // Construct absolute file path using RENDER_UPLOADS_BASE_PATH
		const absoluteFilePath = path.join(RENDER_UPLOADS_BASE_PATH, assetFilepath);

		db.run("DELETE FROM assets WHERE id = ?", [assetId], function (err) { /* ... */ });
	});
});

module.exports = router;

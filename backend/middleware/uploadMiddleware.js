// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the base path for all uploads on the Render Disk (use an environment variable)
// This should point to a directory *on the mounted disk* where all uploads will live.
// Example: if disk is mounted at /mnt/aosha_data, this could be /mnt/aosha_data/uploads
// For local development, if this env var is not set, it will use a path relative to this file's project structure.
const RENDER_UPLOADS_BASE_PATH = process.env.RENDER_UPLOADS_BASE_PATH || path.join(__dirname, '..', 'public', 'uploads');

// Specific directory for NPC images within the base uploads path
const npcImageDir = path.join(RENDER_UPLOADS_BASE_PATH, 'npc_images');

// Ensure the NPC image directory exists on the persistent disk
if (!fs.existsSync(npcImageDir)) {
    try {
	    fs.mkdirSync(npcImageDir, { recursive: true });
        console.log(`Persistent NPC image upload directory created at: ${npcImageDir}`);
    } catch (dirErr) {
        console.error(`CRITICAL: Error creating persistent NPC image upload directory ${npcImageDir}:`, dirErr);
        // Handle error appropriately, perhaps prevent multer from initializing if path is critical
    }
}

// Set up storage engine for Multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
        // Check again if directory exists, in case it was deleted or had issues during startup
        if (!fs.existsSync(npcImageDir)) {
            try {
                fs.mkdirSync(npcImageDir, { recursive: true });
                console.log(`Ensured NPC image upload directory exists at: ${npcImageDir}`);
            } catch (dirErr) {
                console.error(`Error ensuring NPC image upload directory ${npcImageDir} in multer destination:`, dirErr);
                return cb(dirErr); // Pass error to multer
            }
        }
		cb(null, npcImageDir); // Files will be saved in the (potentially mounted) npcImageDir
	},
	filename: (req, file, cb) => {
		// Create a unique filename: npc-<npcId>-<timestamp>.<extension>
		// We'll get npcId from req.params if available, or use a placeholder/timestamp for new NPCs
		const npcId = req.params.id || 'temp'; // req.params.id will be available for updates
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const extension = path.extname(file.originalname);
		cb(null, `npc-${npcId}-${uniqueSuffix}${extension}`);
	}
});

// File filter to accept only images (remains the same)
const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith('image/')) { // Check for image MIME types
		cb(null, true);
	} else {
		cb(new Error('Not an image! Please upload an image file.'), false);
	}
};

const uploadNpcImage = multer({
	storage: storage,
	limits: {
		fileSize: 1024 * 1024 * 5 // 5MB file size limit
	},
	fileFilter: fileFilter
});

// Export npcImageDir in case other parts of the app need to know the physical path
// (e.g., for constructing paths if needed, though routes usually handle this)
module.exports = { uploadNpcImage, npcImageDir };

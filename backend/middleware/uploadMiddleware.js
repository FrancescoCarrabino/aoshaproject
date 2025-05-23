// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the mount path for Render Disk uploads (use an environment variable)
// This should point to a directory *on the mounted disk* where uploads will live.
// Example: if disk is mounted at /mnt/aosha_data, this could be /mnt/aosha_data/uploads
const RENDER_UPLOADS_BASE_PATH = process.env.RENDER_UPLOADS_BASE_PATH || path.join(__dirname, '..', 'public', 'uploads'); // Fallback for local dev

const npcImageDir = path.join(RENDER_UPLOADS_BASE_PATH, 'npc_images');

// Ensure directory exists on the persistent disk
if (!fs.existsSync(npcImageDir)) {
    try {
	    fs.mkdirSync(npcImageDir, { recursive: true });
        console.log(`NPC image upload directory created at: ${npcImageDir}`);
    } catch (dirErr) {
        console.error(`Error creating NPC image upload directory ${npcImageDir}:`, dirErr);
        // Handle error appropriately
    }
}

// Set up storage engine for Multer (remains the same internally)
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, npcImageDir); // Files will be saved in the (potentially mounted) npcImageDir
	},
	filename: (req, file, cb) => {
		// Create a unique filename: npc-<npcId>-<timestamp>.<extension>
		const npcId = req.params.id || 'temp'; 
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const extension = path.extname(file.originalname);
		cb(null, `npc-${npcId}-${uniqueSuffix}${extension}`);
	}
});

// File filter to accept only images (remains the same)
const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith('image/')) {
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
// (e.g., for deleting files, though routes usually handle this directly)
module.exports = { uploadNpcImage, npcImageDir };

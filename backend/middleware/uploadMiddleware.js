// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const npcImageDir = path.join(__dirname, '..', 'public', 'uploads', 'npc_images');

// Ensure directory exists
if (!fs.existsSync(npcImageDir)) {
	fs.mkdirSync(npcImageDir, { recursive: true });
}

// Set up storage engine for Multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, npcImageDir); // Files will be saved in 'public/uploads/npc_images'
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

// File filter to accept only images
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

module.exports = { uploadNpcImage, npcImageDir };

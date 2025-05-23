// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs'); // Import fs to ensure upload directory exists
const { Server } = require("socket.io");
const initializeSocketIO = require('./socket/socketHandler');
const db = require('./database/db'); // db.js now handles RENDER_DISK_MOUNT_PATH for the DB file

const app = express();
const server = http.createServer(app);

// --- Environment Variable Configuration ---
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"; // Default for local Vite dev
const PORT = process.env.PORT || 5001;
// Define the base path for all uploads on the Render Disk (from environment variable)
// This should point to the directory ON THE MOUNTED DISK that contains 'assets', 'npc_images', etc.
// Example: if disk is mounted at /mnt/aosha_data, and uploads go to /mnt/aosha_data/uploads, then this is /mnt/aosha_data/uploads
// For local dev, if not set, it defaults to 'public/uploads' relative to backend project root.
const RENDER_UPLOADS_SERVE_PATH = process.env.RENDER_UPLOADS_BASE_PATH || path.join(__dirname, 'public', 'uploads');

// --- CORS Configuration ---
const corsOptions = {
	origin: FRONTEND_URL, // Use the configured frontend URL
    credentials: true, // If you plan to use cookies or sessions with CORS
	optionsSuccessStatus: 200 
};
app.use(cors(corsOptions)); // Apply CORS for all API routes

// --- Socket.IO Configuration ---
const io = new Server(server, {
	cors: corsOptions // Use the same CORS options for Socket.IO
});

// --- Standard Middleware ---
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// --- Static File Serving ---

// Ensure the base uploads directory (on the persistent disk or local fallback) exists
// Subdirectories like 'assets' and 'npc_images' are expected to be created by their respective upload middlewares.
if (!fs.existsSync(RENDER_UPLOADS_SERVE_PATH)) {
    try {
        fs.mkdirSync(RENDER_UPLOADS_SERVE_PATH, { recursive: true });
        console.log(`Base uploads directory for static serving ensured at: ${RENDER_UPLOADS_SERVE_PATH}`);
    } catch (dirErr) {
        console.error(`CRITICAL: Error creating base uploads directory ${RENDER_UPLOADS_SERVE_PATH} for static serving:`, dirErr);
        // Handle error, perhaps by not starting the server or logging a critical failure
    }
}
// Serve static uploaded files FROM THE (potentially mounted) RENDER_UPLOADS_SERVE_PATH
// Example: A request to /uploads/assets/foo.png will serve the file from RENDER_UPLOADS_SERVE_PATH/assets/foo.png
app.use('/uploads', express.static(RENDER_UPLOADS_SERVE_PATH));
console.log(`Serving static files from '/uploads' mapped to physical path: ${RENDER_UPLOADS_SERVE_PATH}`);


// Serve static frontend application files (from the build process)
// This assumes your frontend build (e.g., from 'npm run build' in frontend) is copied to 'backend/public/react-app'
const frontendAppPath = path.join(__dirname, 'public', 'react-app');
app.use(express.static(frontendAppPath));
console.log(`Serving static frontend from: ${frontendAppPath}`);


// --- API Routes ---
app.get('/api/health', (req, res) => {
	res.json({ message: "AOSHA Backend API is healthy!", timestamp: new Date().toISOString() });
});

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const characterRoutes = require('./routes/characterRoutes');
app.use('/api/characters', characterRoutes);
const storyRoutes = require('./routes/storyRoutes');
app.use('/api/story', storyRoutes);
const sessionLogRoutes = require('./routes/sessionLogRoutes');
app.use('/api/sessions', sessionLogRoutes);
const npcRoutes = require('./routes/npcRoutes');
app.use('/api/npcs', npcRoutes);
const assetRoutes = require('./routes/assetRoutes');
app.use('/api/assets', assetRoutes);
const tagRoutes = require('./routes/tagRoutes');
app.use('/api/tags', tagRoutes);
const locationRoutes = require('./routes/locationRoutes');
app.use('/api/locations', locationRoutes);
const mapRoutes = require('./routes/mapRoutes');
app.use('/api/maps', mapRoutes);

// --- Socket.IO Initialization ---
initializeSocketIO(io);




// --- Centralized Error Handler ---
// This should be the last middleware
app.use((err, req, res, next) => {
	console.error("Unhandled application error:", err.stack || err);
	const statusCode = err.status || err.statusCode || 500; // Prefer err.status or err.statusCode if available
	const message = statusCode === 500 && process.env.NODE_ENV === 'production' 
                  ? 'An unexpected internal server error occurred.' 
                  : (err.message || 'Server Error');
	
    // Ensure response is sent as JSON if appropriate
    if (req.accepts('json')) {
        res.status(statusCode).json({ error: message });
    } else {
        res.status(statusCode).send(message);
    }
});

// Initialize Database and Start Server
db.initDb((err) => {
	if (err) {
		console.error("CRITICAL: Failed to initialize database. Server not starting.", err);
		process.exit(1);
	} else {
		console.log("Database initialized successfully.");
		server.listen(PORT, () => {
			console.log(`AOSHA Backend server (with WebSockets) running on port ${PORT}`);
			console.log(`Access it locally via http://localhost:${PORT}`);
			if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
				console.log(`Access it publicly via ${process.env.RENDER_EXTERNAL_URL}`);
			}
		});
	}
});

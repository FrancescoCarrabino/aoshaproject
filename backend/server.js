require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for socket.io
const path = require('path');
const { Server } = require("socket.io"); // Import Server class from socket.io
const initializeSocketIO = require('./socket/socketHandler');
const db = require('./database/db');

const app = express();
const server = http.createServer(app); // Create an HTTP server with the Express app

// Configure CORS options for Socket.IO
const socketIoCorsOptions = {
	origin: process.env.FRONTEND_URL || "*", // Use an env variable for frontend URL, fallback to '*' for dev
	methods: ["GET", "POST"]
};

// Configure Socket.IO
const io = new Server(server, {
	cors: socketIoCorsOptions
});

const PORT = process.env.PORT || 5001;

// Middleware
// Configure CORS options for Express API
const expressCorsOptions = {
	origin: process.env.FRONTEND_URL || "*", // Allow requests from your frontend
	optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(expressCorsOptions)); // Apply CORS for API routes

app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Serve static frontend application files (from the build process)
app.use(express.static(path.join(__dirname, 'public/react-app')));
//

// --- API Routes ---
// Simple Test Route (good for health checks)
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
initializeSocketIO(io); // Initialize your custom socket handling logic


// --- Basic Error Handler ---
// This should ideally be the last middleware, after routes and before server.listen
app.use((err, req, res, next) => {
	console.error("Unhandled error:", err.stack);
	// Avoid sending stack trace in production for security reasons
	const statusCode = err.status || 500;
	const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
	res.status(statusCode).send({ error: message });
});

// Initialize Database and Start Server
db.initDb((err) => {
	if (err) {
		console.error("Failed to initialize database:", err);
		process.exit(1); // Exit if DB fails to initialize
	} else {
		console.log("Database initialized successfully.");
		// Use 'server.listen' instead of 'app.listen' for socket.io
		server.listen(PORT, () => {
			console.log(`AOSHA Backend server (with WebSockets) running on port ${PORT}`);
			console.log(`Access it locally via http://localhost:${PORT}`);
			if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
				console.log(`Access it publicly via ${process.env.RENDER_EXTERNAL_URL}`);
			}
		});
	}
});

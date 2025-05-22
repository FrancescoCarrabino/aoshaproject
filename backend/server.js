// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for socket.io
const path = require('path');
const { Server } = require("socket.io"); // Import Server class from socket.io
const initializeSocketIO = require('./socket/socketHandler');
const db = require('./database/db');
// const { protect, authorize } = require('./middleware/authMiddleware'); // Not directly used by socket.io handlers, but JWT can be used for socket auth

const app = express();
const server = http.createServer(app); // Create an HTTP server with the Express app

// Configure Socket.IO
const io = new Server(server, {
	cors: {
		origin: "*", // Your React frontend URL
		methods: ["GET", "POST"]
	}
});
app.use(express.static(path.join(__dirname, 'public/react-app')));

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Simple Test Route
app.get('/api', (req, res) => {
	res.json({ message: "Welcome to the AOSHA Backend API!" });
});

// --- API Routes ---
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const characterRoutes = require('./routes/characterRoutes');
app.use('/api/characters', characterRoutes);

const storyRoutes = require('./routes/storyRoutes'); // Require the story routes
app.use('/api/story', storyRoutes);

const sessionLogRoutes = require('./routes/sessionLogRoutes'); // Require session log routes
app.use('/api/sessions', sessionLogRoutes);

const npcRoutes = require('./routes/npcRoutes'); // Require NPC routes
app.use('/api/npcs', npcRoutes);

const assetRoutes = require('./routes/assetRoutes');
app.use('/api/assets', assetRoutes);

const tagRoutes = require('./routes/tagRoutes');
app.use('/api/tags', tagRoutes);

const locationRoutes = require('./routes/locationRoutes');
app.use('/api/locations', locationRoutes);

const mapRoutes = require('./routes/mapRoutes');
app.use('/api/maps', mapRoutes);


initializeSocketIO(io);

// Basic Error Handler
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send({ error: 'Something broke!' });
});

// Initialize Database and Start Server
db.initDb((err) => {
	if (err) {
		console.error("Failed to initialize database:", err);
		process.exit(1);
	} else {
		// Use 'server.listen' instead of 'app.listen' for socket.io
		server.listen(PORT, () => {
			console.log(`AOSHA Backend server (with WebSockets) running on http://localhost:${PORT}`);
		});
	}
});

app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'public/react-app/index.html'));
});

// backend/socket/socketHandler.js
const jwt = require('jsonwebtoken');
const { db } = require('../database/db'); // Ensure this path is correct

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this';

// Map to store users in rooms: roomName -> Map<socketId, userData>
const rooms = new Map();
const partyRoomName = 'aosha-party'; // Define party room name

// Helper function to get users in a room and format them for the client
function getRoomUsers(roomName) {
	const room = rooms.get(roomName);
	if (!room) return [];
	return Array.from(room.values()).map(ud => ({ id: ud.id, username: ud.username, role: ud.role }));
}

function initializeSocketIO(io) {
	if (!rooms.has(partyRoomName)) {
		rooms.set(partyRoomName, new Map()); // Initialize the party room map
	}

	io.on('connection', (socket) => {
		console.log('A user connected via WebSocket:', socket.id);

		socket.on('authenticate', (token) => {
			try {
				const decoded = jwt.verify(token, JWT_SECRET);
				socket.userData = { id: decoded.userId, username: decoded.username, role: decoded.role };
				console.log(`Socket ${socket.id} authenticated as user: ${socket.userData.username} (Role: ${socket.userData.role})`);

				socket.join(partyRoomName);
				const partyRoom = rooms.get(partyRoomName);
				if (partyRoom) {
					partyRoom.set(socket.id, socket.userData); // Add user to room
				}

				console.log(`Socket ${socket.id} (User: ${socket.userData.username}) joined room ${partyRoomName}`);
				socket.emit('authenticated', { message: "Socket connection authenticated successfully." });

				// Broadcast updated user list to everyone in the room
				io.to(partyRoomName).emit('room_users_update', getRoomUsers(partyRoomName));

			} catch (err) {
				console.error(`Socket ${socket.id} authentication failed:`, err.message);
				socket.emit('unauthorized', { error: 'Authentication failed. Invalid token.' });
				socket.disconnect(true);
			}
		});

		// --- Chat & Dice Roll Handlers ---
		socket.on('chat_message_party', (msgData) => {
			if (!socket.userData) return socket.emit('unauthorized', { error: 'Please authenticate first.' });
			const messageToSend = { sender: socket.userData.username, role: socket.userData.role, text: msgData.text, timestamp: new Date().toISOString() };
			io.to(partyRoomName).emit('chat_message_party_new', messageToSend);
		});

		socket.on('dice_roll_public', (rollData) => {
			if (!socket.userData) return socket.emit('unauthorized', { error: 'Please authenticate first.' });
			const rollEventData = { roller: socket.userData.username, role: socket.userData.role, rollString: rollData.rollString, result: rollData.result, details: rollData.details, timestamp: new Date().toISOString() };
			io.to(partyRoomName).emit('dice_roll_public_new', rollEventData);
		});

		socket.on('dm_whisper', (whisperData) => {
			if (!socket.userData || socket.userData.role !== 'DM') {
				return socket.emit('unauthorized', { error: 'Only DMs can send whispers.' });
			}
			let targetSocketId = null;
			const partyRoomMap = rooms.get(partyRoomName);
			if (partyRoomMap) {
				for (const [sid, userData] of partyRoomMap.entries()) {
					if (userData.username === whisperData.toUsername) {
						targetSocketId = sid;
						break;
					}
				}
			}
			if (targetSocketId) {
				const messageToWhisper = { from: socket.userData.username, text: whisperData.text, isWhisper: true, timestamp: new Date().toISOString() };
				io.to(targetSocketId).emit('dm_whisper_new', messageToWhisper);
				socket.emit('dm_whisper_sent_confirmation', { to: whisperData.toUsername, text: whisperData.text });
			} else {
				socket.emit('dm_whisper_failed', { error: `User ${whisperData.toUsername} not found or not connected in this room.` });
			}
		});

		socket.on('dice_roll_secret_dm', (rollData) => {
			if (!socket.userData || socket.userData.role !== 'DM') return socket.emit('unauthorized', { error: 'DM only.' });
			const secretRollEventData = { roller: socket.userData.username, rollString: rollData.rollString, result: rollData.result, details: rollData.details, isSecret: true, timestamp: new Date().toISOString() };
			socket.emit('dice_roll_secret_dm_new', secretRollEventData);
		});

		// --- Disconnect Handler ---
		socket.on('disconnect', () => {
			console.log(`User ${socket.userData ? socket.userData.username : socket.id} disconnected`);
			const partyRoomMap = rooms.get(partyRoomName);
			if (partyRoomMap && socket.userData) { // Check if user was authenticated and in a room
				partyRoomMap.delete(socket.id); // Remove user from room
				// Broadcast updated user list
				io.to(partyRoomName).emit('room_users_update', getRoomUsers(partyRoomName));
			}
		});

		// ========================================================================
		// INTERACTIVE MAPS SOCKET EVENT HANDLERS
		// ========================================================================

		socket.on('dm_update_map_fog', (data) => {
			if (!socket.userData || socket.userData.role !== 'DM') {
				return socket.emit('map_error', { error: "Only DMs can update map fog." });
			}
			if (!data || data.mapId === undefined || data.newFogDataJson === undefined) {
				return socket.emit('map_error', { error: "Invalid data for fog update." });
			}
			console.log(`DM ${socket.userData.username} updating fog for map ${data.mapId}`);
			socket.to(partyRoomName).emit('map_fog_updated', {
				mapId: data.mapId,
				fogDataJson: data.newFogDataJson
			});
		});

		socket.on('dm_update_map_element', (data) => {
			if (!socket.userData || socket.userData.role !== 'DM') {
				return socket.emit('map_error', { error: "Only DMs can update map elements." });
			}
			if (!data || !data.mapId || !data.elementData || !data.elementData.id) {
				return socket.emit('map_error', { error: "Invalid data for element update." });
			}
			console.log(`DM ${socket.userData.username} adding/updating element ${data.elementData.id} (type: ${data.elementData.element_type}) for map ${data.mapId}`);
			socket.to(partyRoomName).emit('map_element_added_or_updated', {
				mapId: data.mapId,
				elementData: data.elementData
			});
		});

		socket.on('dm_delete_map_element', (data) => {
			if (!socket.userData || socket.userData.role !== 'DM') {
				return socket.emit('map_error', { error: "Only DMs can delete map elements." });
			}
			if (!data || !data.mapId || data.elementId === undefined) {
				return socket.emit('map_error', { error: "Invalid data for element deletion." });
			}
			console.log(`DM ${socket.userData.username} deleting element ${data.elementId} from map ${data.mapId}`);
			socket.to(partyRoomName).emit('map_element_deleted', {
				mapId: data.mapId,
				elementId: data.elementId
			});
		});

		socket.on('dm_set_active_map_for_party', async (data) => {
			if (!socket.userData || socket.userData.role !== 'DM') {
				return socket.emit('map_error', { error: "Only DMs can set the active party map." });
			}
			if (!data || data.mapId === undefined) {
				return socket.emit('map_error', { error: "Map ID is required to set active party map." });
			}

			const mapId = data.mapId;
			console.log(`[SocketHandler] DM ${socket.userData.username} setting active map for party to: ${mapId}`);

			try {
				// 1. Fetch base map details
				const mapSql = `SELECT gm.id, gm.name, gm.grid_enabled, gm.grid_size_pixels, 
                                       a.filepath as map_image_filepath 
												FROM game_maps gm
												JOIN assets a ON gm.map_asset_id = a.id
												WHERE gm.id = ? AND gm.dm_id = ?`;
				const mapDetails = await new Promise((resolve, reject) => {
					db.get(mapSql, [mapId, socket.userData.id], (err, row) => {
						if (err) return reject(err);
						resolve(row);
					});
				});

				if (!mapDetails) {
					console.warn(`[SocketHandler] dm_set_active_map_for_party: Map ${mapId} not found or DM ${socket.userData.username} does not own it.`);
					return socket.emit('map_error', { error: `Map ${mapId} not found or DM does not own it.` });
				}
				if (!mapDetails.map_image_filepath) {
					console.error(`[SocketHandler] dm_set_active_map_for_party: Map ${mapId} found, but its asset filepath (map_image_filepath) is missing or null.`);
					return socket.emit('map_error', { error: `Map ${mapId} asset information is missing.` });
				}


				// 2. Fetch fog data for the map
				const fogPromise = new Promise((resolve, reject) => {
					db.get("SELECT fog_data_json FROM map_fog_data WHERE map_id = ?", [mapId], (err, row) => {
						if (err) return reject(err);
						resolve(row);
					});
				});

				// 3. Fetch player-visible elements for the map
				const elementsPromise = new Promise((resolve, reject) => {
					db.all(
						`SELECT id, map_id, element_type, x_coord_percent, y_coord_percent, width_percent, height_percent, label, description, element_data, is_visible_to_players 
						 FROM map_elements 
						 WHERE map_id = ? AND is_visible_to_players = TRUE 
						 ORDER BY created_at ASC`,
						[mapId],
						(err, rows) => {
							if (err) return reject(err);
							const processedRows = (rows || []).map(row => ({
								...row,
								element_data: row.element_data ? JSON.parse(row.element_data) : {}
							}));
							resolve(processedRows);
						}
					);
				});

				// 4. Wait for fog and elements data
				const [fogDataResult, playerVisibleElements] = await Promise.all([fogPromise, elementsPromise]);

				// Construct the URL based on the assumption that map_image_filepath includes the 'assets/' prefix if needed.
				// Example: if map_image_filepath = "assets/map1.jpg", then url is "/uploads/assets/map1.jpg"
				// Example: if map_image_filepath = "map1.jpg" (and files are in public/uploads/assets), then url should be "/uploads/assets/map1.jpg"
				// THE FIX:
				const finalMapAssetUrl = `/uploads/${mapDetails.map_image_filepath}`;

				const payloadToParty = {
					mapId: mapDetails.id,
					mapName: mapDetails.name,
					mapAssetUrl: finalMapAssetUrl,
					gridEnabled: mapDetails.grid_enabled,
					gridSizePixels: mapDetails.grid_size_pixels,
					initialFogDataJson: fogDataResult ? fogDataResult.fog_data_json : JSON.stringify([]),
					initialElements: playerVisibleElements || []
				};

				console.log(`[SocketHandler] Broadcasting party_active_map_changed. Image URL: ${payloadToParty.mapAssetUrl}`);
				io.to(partyRoomName).emit('party_active_map_changed', payloadToParty);

			} catch (dbError) {
				console.error(`[SocketHandler] dm_set_active_map_for_party: Error fetching map details/elements for map ${mapId}:`, dbError.message, dbError.stack);
				socket.emit('map_error', { error: "Failed to fetch map details for party." });
			}
		});
	});
}

module.exports = initializeSocketIO;

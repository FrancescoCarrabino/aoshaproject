// backend/database/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs'); // Import fs module

// Define the mount path for Render Disk (use an environment variable for flexibility)
// This should match the "Mount Path" you set in Render's disk settings.
const RENDER_DISK_MOUNT_PATH = process.env.RENDER_DISK_MOUNT_PATH || '/mnt/aosha_data'; // Default for local dev if not set

// Define the path for the database file on the persistent disk
const DB_FILE_NAME = 'aoshaproject.sqlite';
const DB_FILE_PATH = path.join(RENDER_DISK_MOUNT_PATH, DB_FILE_NAME);

// Ensure the directory for the database file exists on the disk
// This is important because the disk might be empty initially.
if (!fs.existsSync(RENDER_DISK_MOUNT_PATH)) {
    try {
        fs.mkdirSync(RENDER_DISK_MOUNT_PATH, { recursive: true });
        console.log(`Persistent storage directory created at: ${RENDER_DISK_MOUNT_PATH}`);
    } catch (dirErr) {
        console.error(`Error creating persistent storage directory ${RENDER_DISK_MOUNT_PATH}:`, dirErr);
        // Depending on your error handling strategy, you might want to exit or throw
        process.exit(1); // Exit if we can't create the essential directory
    }
}

// Create a new database instance (or open it if it exists)
let db = new sqlite3.Database(DB_FILE_PATH, (err) => {
	if (err) {
		console.error("Error opening database on persistent disk:", err.message, "Path:", DB_FILE_PATH);
	} else {
		console.log("Successfully connected to the SQLite database on persistent disk:", DB_FILE_PATH);
	}
});

// Define the predefined users (remains the same)
const predefinedUsers = [
	{ username: 'DungeonMaster', email: 'dm@aosha.com', password: 'aosha2025!', role: 'DM' },
	{ username: 'Liferos', email: 'liferos@aosha.com', password: 'aosha2025!', role: 'Player' },
	{ username: 'Elka', email: 'elka@aosha.com', password: 'aosha2025!', role: 'Player' },
	{ username: 'Slick', email: 'slick@aosha.com', password: 'aosha2025!', role: 'Player' },
	{ username: 'Khalid', email: 'khalid@aosha.com', password: 'aosha2025!', role: 'Player' },
	{ username: 'Mormoz', email: 'mormoz@aosha.com', password: 'aosha2025!', role: 'Player' },
	{ username: 'Iulius', email: 'iulius@aosha.com', password: 'aosha2025!', role: 'Player' },
];

// Function to create tables if they don't exist (remains the same internally)
const createTables = (callback) => {
	// ... (your existing createTables logic - no changes needed inside this function) ...
	db.serialize(() => {
		// 1. Users Table
		db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('Player', 'DM')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (errUsers) => {
			if (errUsers) return callback(errUsers);
			console.log("Users table ensured.");

			// 2. Character Sheets Table
			db.run(`
        CREATE TABLE IF NOT EXISTS character_sheets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          sheet_name TEXT DEFAULT 'Unnamed Character',
          character_data JSON NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `, (errCharSheets) => {
				if (errCharSheets) return callback(errCharSheets);
				console.log("Character sheets table ensured.");

				db.run(`CREATE TRIGGER IF NOT EXISTS update_character_sheet_timestamp AFTER UPDATE ON character_sheets FOR EACH ROW BEGIN UPDATE character_sheets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errCharTrig) => {
					if (errCharTrig) { console.warn("Warning: Char sheets trigger issue:", errCharTrig.message); return callback(errCharTrig); }
					console.log("Character_sheets update trigger ensured.");

					// 3. Story Entries Table
					db.run(` CREATE TABLE IF NOT EXISTS story_entries ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT, parent_id INTEGER, sort_order INTEGER DEFAULT 0, dm_id INTEGER NOT NULL, is_visible_to_players BOOLEAN DEFAULT TRUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (parent_id) REFERENCES story_entries (id) ON DELETE SET NULL, FOREIGN KEY (dm_id) REFERENCES users (id) ON DELETE CASCADE ) `, (errStory) => {
						if (errStory) return callback(errStory);
						console.log("Story entries table ensured.");

						db.run(`CREATE TRIGGER IF NOT EXISTS update_story_entry_timestamp AFTER UPDATE ON story_entries FOR EACH ROW BEGIN UPDATE story_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errStoryTrig) => {
							if (errStoryTrig) { console.warn("Warning: Story entries trigger issue:", errStoryTrig.message); return callback(errStoryTrig); }
							console.log("Story_entries update trigger ensured.");

							// 4. Session Logs Table
							db.run(` CREATE TABLE IF NOT EXISTS session_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, session_date DATETIME NOT NULL, title TEXT, summary TEXT NOT NULL, author_user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE SET NULL ) `, (errSession) => {
								if (errSession) return callback(errSession);
								console.log("Session logs table ensured.");

								db.run(`CREATE TRIGGER IF NOT EXISTS update_session_log_timestamp AFTER UPDATE ON session_logs FOR EACH ROW BEGIN UPDATE session_logs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errSessionTrig) => {
									if (errSessionTrig) { console.warn("Warning: Session logs trigger issue:", errSessionTrig.message); return callback(errSessionTrig); }
									console.log("Session_logs update trigger ensured.");

									// 5. NPCs Table
									db.run(` CREATE TABLE IF NOT EXISTS npcs ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, title TEXT, image_url TEXT, description TEXT, notes_dm_only TEXT, character_sheet_id INTEGER UNIQUE, dm_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (character_sheet_id) REFERENCES character_sheets (id) ON DELETE SET NULL, FOREIGN KEY (dm_id) REFERENCES users (id) ON DELETE CASCADE ) `, (errNpc) => {
										if (errNpc) return callback(errNpc);
										console.log("NPCs table ensured.");

										db.run(`CREATE TRIGGER IF NOT EXISTS update_npc_timestamp AFTER UPDATE ON npcs FOR EACH ROW BEGIN UPDATE npcs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errNpcTrig) => {
											if (errNpcTrig) { console.warn("Warning: NPCs trigger issue:", errNpcTrig.message); return callback(errNpcTrig); }
											console.log("NPCs update trigger ensured.");

											// 6. Assets Table
											db.run(` CREATE TABLE IF NOT EXISTS assets ( id INTEGER PRIMARY KEY AUTOINCREMENT, filename_original TEXT NOT NULL, filename_stored TEXT UNIQUE NOT NULL, filepath TEXT NOT NULL, mimetype TEXT NOT NULL, filesize INTEGER NOT NULL, description TEXT, uploader_user_id INTEGER, visibility_scope TEXT DEFAULT 'dm_only' CHECK(visibility_scope IN ('dm_only', 'party_wide')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (uploader_user_id) REFERENCES users (id) ON DELETE SET NULL ) `, (errAssets) => {
												if (errAssets) return callback(errAssets);
												console.log("Assets table ensured.");

												db.run(`CREATE TRIGGER IF NOT EXISTS update_asset_timestamp AFTER UPDATE ON assets FOR EACH ROW BEGIN UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errAssetsTrig) => {
													if (errAssetsTrig) { console.warn("Warning: Assets trigger issue:", errAssetsTrig.message); return callback(errAssetsTrig); }
													console.log("Assets update trigger ensured.");

													// 7. Tags Table
													db.run(`CREATE TABLE IF NOT EXISTS tags ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL COLLATE NOCASE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP )`, (errTags) => {
														if (errTags) return callback(errTags);
														console.log("Tags table ensured.");

														// 8. Story Entry Tags
														db.run(`CREATE TABLE IF NOT EXISTS story_entry_tags ( story_entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (story_entry_id, tag_id), FOREIGN KEY (story_entry_id) REFERENCES story_entries (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE )`, (errStoryTags) => {
															if (errStoryTags) return callback(errStoryTags);
															console.log("Story_entry_tags junction table ensured.");

															// 9. NPC Tags
															db.run(`CREATE TABLE IF NOT EXISTS npc_tags ( npc_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (npc_id, tag_id), FOREIGN KEY (npc_id) REFERENCES npcs (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE )`, (errNpcTags) => {
																if (errNpcTags) return callback(errNpcTags);
																console.log("Npc_tags junction table ensured.");

																// 10. Session Log Tags
																db.run(`CREATE TABLE IF NOT EXISTS session_log_tags ( session_log_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (session_log_id, tag_id), FOREIGN KEY (session_log_id) REFERENCES session_logs (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE )`, (errSessionLogTags) => {
																	if (errSessionLogTags) return callback(errSessionLogTags);
																	console.log("Session_log_tags junction table ensured.");

																	// 11. Asset Tags
																	db.run(`CREATE TABLE IF NOT EXISTS asset_tags ( asset_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (asset_id, tag_id), FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE )`, (errAssetTags) => {
																		if (errAssetTags) return callback(errAssetTags);
																		console.log("Asset_tags junction table ensured.");

																		// 12. World Locations Table
																		db.run(`CREATE TABLE IF NOT EXISTS world_locations ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT, description_public TEXT, description_dm TEXT, map_asset_id INTEGER, dm_id INTEGER NOT NULL, is_visible_to_players BOOLEAN DEFAULT TRUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (map_asset_id) REFERENCES assets (id) ON DELETE SET NULL, FOREIGN KEY (dm_id) REFERENCES users (id) ON DELETE CASCADE )`, (errWorldLocations) => {
																			if (errWorldLocations) return callback(errWorldLocations);
																			console.log("World_locations table ensured.");

																			db.run(`CREATE TRIGGER IF NOT EXISTS update_world_location_timestamp AFTER UPDATE ON world_locations FOR EACH ROW BEGIN UPDATE world_locations SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errWorldLocationsTrig) => {
																				if (errWorldLocationsTrig) { console.warn("Warning: World_locations trigger issue:", errWorldLocationsTrig.message); return callback(errWorldLocationsTrig); }
																				console.log("World_locations update trigger ensured.");

																				// 13. Location Tags (Gazetteer)
																				db.run(`CREATE TABLE IF NOT EXISTS location_tags ( location_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (location_id, tag_id), FOREIGN KEY (location_id) REFERENCES world_locations (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE )`, (errLocationTags) => {
																					if (errLocationTags) return callback(errLocationTags);
																					console.log("Location_tags (Gazetteer) junction table ensured.");

																					// --- START: INTERACTIVE MAPS TABLES ---
																					// 14. Game Maps Table
																					db.run(`
                                                            CREATE TABLE IF NOT EXISTS game_maps (
                                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                name TEXT NOT NULL,
                                                                map_asset_id INTEGER NOT NULL,
                                                                grid_enabled BOOLEAN DEFAULT FALSE,
                                                                grid_size_pixels INTEGER,
                                                                dm_id INTEGER NOT NULL,
                                                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                FOREIGN KEY (map_asset_id) REFERENCES assets (id) ON DELETE RESTRICT,
                                                                FOREIGN KEY (dm_id) REFERENCES users (id) ON DELETE CASCADE
                                                            )
                                                          `, (errGameMaps) => {
																						if (errGameMaps) return callback(errGameMaps);
																						console.log("Game_maps table ensured.");

																						db.run(`CREATE TRIGGER IF NOT EXISTS update_game_map_timestamp AFTER UPDATE ON game_maps FOR EACH ROW BEGIN UPDATE game_maps SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errGameMapTrig) => {
																							if (errGameMapTrig) { console.warn("Warning: Game_maps trigger issue:", errGameMapTrig.message); return callback(errGameMapTrig); }
																							console.log("Game_maps update trigger ensured.");

																							// 15. Map Fog Data Table
																							db.run(`
                                                              CREATE TABLE IF NOT EXISTS map_fog_data (
                                                                  map_id INTEGER PRIMARY KEY,
                                                                  fog_data_json TEXT,
                                                                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                  FOREIGN KEY (map_id) REFERENCES game_maps (id) ON DELETE CASCADE
                                                              )
                                                            `, (errMapFog) => {
																								if (errMapFog) return callback(errMapFog);
																								console.log("Map_fog_data table ensured.");

																								// 16. Map Elements Table
																								db.run(`
                                                                  CREATE TABLE IF NOT EXISTS map_elements (
                                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                      map_id INTEGER NOT NULL,
                                                                      element_type TEXT NOT NULL CHECK(element_type IN ('pin', 'text', 'area')),
                                                                      x_coord_percent REAL NOT NULL,
                                                                      y_coord_percent REAL NOT NULL,
                                                                      width_percent REAL,
                                                                      height_percent REAL,
                                                                      label TEXT,
                                                                      description TEXT,
                                                                      is_visible_to_players BOOLEAN DEFAULT FALSE,
                                                                      element_data JSON,
                                                                      dm_id INTEGER NOT NULL,
                                                                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                      FOREIGN KEY (map_id) REFERENCES game_maps (id) ON DELETE CASCADE,
                                                                      FOREIGN KEY (dm_id) REFERENCES users (id) ON DELETE SET NULL
                                                                  )
                                                                `, (errMapElements) => {
																									if (errMapElements) return callback(errMapElements);
																									console.log("Map_elements table ensured.");

																									db.run(`CREATE TRIGGER IF NOT EXISTS update_map_element_timestamp AFTER UPDATE ON map_elements FOR EACH ROW BEGIN UPDATE map_elements SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`, (errMapElementTrig) => {
																										if (errMapElementTrig) { console.warn("Warning: Map_elements trigger issue:", errMapElementTrig.message); return callback(errMapElementTrig); }
																										console.log("Map_elements update trigger ensured.");

																										// 17. Map Tags (Junction Table for Game Maps)
																										db.run(`
                                                                      CREATE TABLE IF NOT EXISTS map_tags (
                                                                          map_id INTEGER NOT NULL,
                                                                          tag_id INTEGER NOT NULL,
                                                                          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                          PRIMARY KEY (map_id, tag_id),
                                                                          FOREIGN KEY (map_id) REFERENCES game_maps (id) ON DELETE CASCADE,
                                                                          FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
                                                                      )
                                                                    `, (errMapTags) => {
																											if (errMapTags) return callback(errMapTags);
																											console.log("Map_tags (Game Maps) junction table ensured.");

																											// All tables defined and ensured
																											if (callback) callback(null); // Final success callback
																										}); // End Map Tags
																									}); // End Map Elements Trigger
																								}); // End Map Elements Table
																							}); // End Map Fog Data Table
																						}); // End Game Maps Trigger
																					}); // End Game Maps Table
																					// --- END: INTERACTIVE MAPS TABLES ---
																				}); // End Location Tags
																			}); // End World Locations Trigger
																		}); // End World Locations Table
																	}); // End Asset Tags
																}); // End Session Log Tags
															}); // End NPC Tags
														}); // End Story Entry Tags
													}); // End Tags Table
												}); // End Asset Trigger
											}); // End Assets Table
										}); // End NPC Trigger
									}); // End NPCs Table
								}); // End Session Log Trigger
							}); // End Session Logs Table
						}); // End Story Entry Trigger
					}); // End Story Entries Table
				}); // End Character Sheet Trigger
			}); // End Character Sheets Table
		}); // End Users Table
	}); // End db.serialize()
};

// Function to seed predefined users (remains the same)
const seedPredefinedUsers = (callback) => {
	// ... (your existing seedPredefinedUsers logic - no changes needed) ...
	const insertPromises = predefinedUsers.map(user => {
		return new Promise((resolve, reject) => {
			db.get("SELECT id FROM users WHERE email = ?", [user.email], async (err, row) => {
				if (err) return reject(err);
				if (row) {
					return resolve({ email: user.email, status: 'exists' });
				}
				try {
					const hashedPassword = await bcrypt.hash(user.password, 10);
					db.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
						[user.username, user.email, hashedPassword, user.role], function (err) {
							if (err) return reject(err);
							console.log(`Seeded user: ${user.email} (ID: ${this.lastID}, Role: ${user.role})`);
							resolve({ email: user.email, status: 'seeded' });
						});
				} catch (hashError) {
					reject(hashError);
				}
			});
		});
	});

	Promise.all(insertPromises)
		.then(results => {
			const seededCount = results.filter(r => r.status === 'seeded').length;
			if (seededCount > 0) {
				console.log(`${seededCount} predefined users seeded.`);
			} else {
				console.log("All predefined users already exist or no new users to seed.");
			}
			if (callback) callback(null);
		})
		.catch(err => {
			console.error("Error seeding predefined users:", err);
			if (callback) callback(err);
		});
};

// Combined initialization function (remains the same)
const initDb = (callback) => {
	// ... (your existing initDb logic - no changes needed) ...
	createTables((err) => {
		if (err) {
			console.error("Database table creation failed:", err);
			return callback(err);
		}
		console.log("All tables ensured. Starting user seeding...");
		seedPredefinedUsers(callback);
	});
};

module.exports = { db, initDb };

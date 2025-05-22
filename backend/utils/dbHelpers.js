// backend/utils/dbHelpers.js
// Note: We don't require 'db' here directly.
// The 'db' instance will be passed as an argument to the functions.

/**
 * Gets existing tag IDs or creates new tags and returns their IDs.
 * @param {Object} dbInstance - The SQLite database instance.
 * @param {string[]} tagNamesArray - An array of tag name strings.
 * @returns {Promise<number[]>} A promise that resolves with an array of tag IDs.
 */
const getOrCreateTagIds = (dbInstance, tagNamesArray) => {
	return new Promise((resolve, reject) => {
		if (!tagNamesArray || !Array.isArray(tagNamesArray) || tagNamesArray.length === 0) {
			return resolve([]);
		}

		const uniqueTagNames = [...new Set(tagNamesArray.map(name => String(name).trim()).filter(name => name !== ''))];
		if (uniqueTagNames.length === 0) {
			return resolve([]);
		}

		const tagPromises = uniqueTagNames.map(name => {
			return new Promise((tagResolve, tagReject) => {
				dbInstance.get("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [name], (err, row) => {
					if (err) return tagReject(err);
					if (row) {
						tagResolve(row.id);
					} else {
						// Tag doesn't exist, create it
						dbInstance.run("INSERT INTO tags (name) VALUES (?)", [name], function (insertErr) {
							if (insertErr) {
								// Handle potential race condition if another request created the tag
								// between the SELECT and INSERT (less likely with SQLite's default serialization but good practice)
								if (insertErr.message && insertErr.message.includes('UNIQUE constraint failed: tags.name')) {
									dbInstance.get("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [name], (retryErr, retryRow) => {
										if (retryErr) return tagReject(retryErr);
										if (retryRow) return tagResolve(retryRow.id);
										// This state should ideally not be reached if constraint failed
										return tagReject(new Error(`Tag '${name}' UNIQUE constraint failed but tag not found on retry.`));
									});
								} else {
									return tagReject(insertErr); // Other insert error
								}
							} else {
								tagResolve(this.lastID); // ID of the newly inserted tag
							}
						});
					}
				});
			});
		});

		Promise.all(tagPromises)
			.then(ids => resolve(ids.filter(id => id !== null && id !== undefined))) // Ensure all resolved IDs are valid numbers
			.catch(reject);
	});
};

module.exports = {
	getOrCreateTagIds,
};

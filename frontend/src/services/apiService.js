// src/services/apiService.js
import axios from 'axios';

// Get API URL from environment variable (Vite uses import.meta.env)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const apiClient = axios.create({
	baseURL: API_URL,
});

export const setAuthToken = (token) => {
	if (token) {
		apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
	} else {
		delete apiClient.defaults.headers.common['Authorization'];
	}
};

// --- Helper for consistent error handling ---
const handleApiError = (error, defaultMessage = 'An API error occurred.') => {
	// Axios specific error structure for network/server errors
	if (error.response) {
		// The request was made and the server responded with a status code
		// that falls out of the range of 2xx
		console.error("API Error Response:", error.response.data);
		console.error("API Error Status:", error.response.status);
		// console.error("API Error Headers:", error.response.headers); // Usually not needed for FE log
		throw {
			message: error.response.data?.error || error.response.data?.message || defaultMessage,
			status: error.response.status,
			details: error.response.data // Full server response data
		};
	} else if (error.request) {
		// The request was made but no response was received
		console.error("API No Response (Network Error):", error.request);
		throw { message: 'No response from server. Check network connection.', details: error.request };
	} else if (error.name === 'CanceledError' || error.name === 'AbortError') {
		// This is an Axios cancellation or a native AbortController signal
		console.log('API request was canceled/aborted:', error.message);
		// Re-throw the cancellation/abort error as is, so calling code can identify it
		throw error;
	} else {
		// Something happened in setting up the request that triggered an Error
		console.error('API Request Setup Error:', error.message, error);
		throw { message: error.message || defaultMessage, details: error };
	}
};


// --- Auth Service Methods ---
export const loginUser = async (credentials) => {
	try {
		const response = await apiClient.post('/auth/login', credentials);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Login failed.');
	}
};

export const getCurrentUser = async (options = {}) => {
	try {
		const response = await apiClient.get('/auth/me', { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch current user details.');
	}
};


// --- Character Sheet Service Methods ---
export const getCharacterSheets = async (options = {}) => {
	try {
		const response = await apiClient.get('/characters', { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch character sheets.');
	}
};

export const getCharacterSheetById = async (sheetId, options = {}) => {
	try {
		const response = await apiClient.get(`/characters/${sheetId}`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch character sheet ${sheetId}.`);
	}
};

export const createCharacterSheet = async (sheetData) => {
	try {
		const response = await apiClient.post('/characters', sheetData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to create character sheet.');
	}
};

export const updateCharacterSheet = async (sheetId, sheetData) => {
	try {
		const response = await apiClient.put(`/characters/${sheetId}`, sheetData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update character sheet ${sheetId}.`);
	}
};

export const deleteCharacterSheet = async (sheetId) => {
	try {
		const response = await apiClient.delete(`/characters/${sheetId}`);
		return response.data; // Or just return true/success message
	} catch (error) {
		return handleApiError(error, `Failed to delete character sheet ${sheetId}.`);
	}
};

// --- Tag Service Functions ---
export const getAllTags = async (options = {}) => {
	try {
		const response = await apiClient.get('/tags', { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch tags.');
	}
};

// --- Story Service Methods ---
export const getStoryEntries = async (filterTagNames = [], options = {}) => {
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get('/story', { params, signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch story entries.');
	}
};

export const getStoryEntryById = async (entryId, options = {}) => {
	try {
		const response = await apiClient.get(`/story/${entryId}`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch story entry ${entryId}.`);
	}
};

export const createStoryEntry = async (entryData) => {
	try {
		const response = await apiClient.post('/story', entryData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to create story entry.');
	}
};

export const updateStoryEntry = async (entryId, entryData) => {
	try {
		const response = await apiClient.put(`/story/${entryId}`, entryData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update story entry ${entryId}.`);
	}
};

export const deleteStoryEntry = async (entryId) => {
	try {
		const response = await apiClient.delete(`/story/${entryId}`);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to delete story entry ${entryId}.`);
	}
};

// --- Session Log Service Methods ---
export const getSessionLogs = async (filterTagNames = [], options = {}) => {
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get('/sessions', { params, signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch session logs.');
	}
};

export const getSessionLogById = async (logId, options = {}) => {
	try {
		const response = await apiClient.get(`/sessions/${logId}`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch session log ${logId}.`);
	}
};

export const createSessionLog = async (logData) => {
	try {
		const response = await apiClient.post('/sessions', logData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to create session log.');
	}
};

export const updateSessionLog = async (logId, logData) => {
	try {
		const response = await apiClient.put(`/sessions/${logId}`, logData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update session log ${logId}.`);
	}
};

export const deleteSessionLog = async (logId) => {
	try {
		const response = await apiClient.delete(`/sessions/${logId}`);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to delete session log ${logId}.`);
	}
};

// --- NPC Service Methods ---
export const getNpcs = async (filterTagNames = [], options = {}) => {
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get('/npcs', { params, signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch NPCs.');
	}
};

export const getNpcById = async (npcId, options = {}) => {
	try {
		const response = await apiClient.get(`/npcs/${npcId}`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch NPC ${npcId}.`);
	}
};

export const createNpc = async (npcData) => {
	try {
		const response = await apiClient.post('/npcs', npcData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to create NPC.');
	}
};

export const updateNpc = async (npcId, npcData) => {
	try {
		const response = await apiClient.put(`/npcs/${npcId}`, npcData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update NPC ${npcId}.`);
	}
};

export const deleteNpc = async (npcId) => {
	try {
		const response = await apiClient.delete(`/npcs/${npcId}`);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to delete NPC ${npcId}.`);
	}
};

export const uploadNpcImage = async (npcId, formData) => {
	try {
		const response = await apiClient.post(`/npcs/${npcId}/upload-image`, formData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to upload image for NPC ${npcId}.`);
	}
};

// --- Asset Service Functions ---
export const uploadAsset = async (formData) => {
	try {
		const response = await apiClient.post(`/assets/upload`, formData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to upload asset.');
	}
};

export const getAssets = async (filterTagNames = [], options = {}) => {
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get(`/assets`, { params, signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch assets.');
	}
};

export const getAssetInfo = async (assetId, options = {}) => {
	try {
		const response = await apiClient.get(`/assets/${assetId}/info`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch asset info for ${assetId}.`);
	}
};

export const updateAsset = async (assetId, assetData) => {
	try {
		const response = await apiClient.put(`/assets/${assetId}`, assetData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Error updating asset ${assetId}.`);
	}
};

export const downloadAssetFile = async (assetId, options = {}) => {
	try {
		const response = await apiClient.get(`/assets/${assetId}/download`, {
			responseType: 'blob',
			signal: options.signal,
		});
		return response.data;
	} catch (error) {
		return handleApiError(error, `Error downloading asset file ${assetId}.`);
	}
};

export const deleteAsset = async (assetId) => {
	try {
		const response = await apiClient.delete(`/assets/${assetId}`);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Error deleting asset ${assetId}.`);
	}
};

// --- Location Service Functions ---
export const getLocations = async (filterTagNames = [], options = {}) => {
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get('/locations', { params, signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch locations.');
	}
};

export const getLocationById = async (locationId, options = {}) => {
	try {
		const response = await apiClient.get(`/locations/${locationId}`, { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to fetch location ${locationId}.`);
	}
};

export const createLocation = async (locationData) => {
	try {
		const response = await apiClient.post('/locations', locationData);
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to create location.');
	}
};

export const updateLocation = async (locationId, locationData) => {
	try {
		const response = await apiClient.put(`/locations/${locationId}`, locationData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update location ${locationId}.`);
	}
};

export const deleteLocation = async (locationId) => {
	try {
		const response = await apiClient.delete(`/locations/${locationId}`);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to delete location ${locationId}.`);
	}
};

// Users - For DM whisper target list, etc.
export const getUsers = async (options = {}) => {
	try {
		const response = await apiClient.get('/users', { signal: options.signal });
		return response.data;
	} catch (error) {
		return handleApiError(error, 'Failed to fetch users.');
	}
};

// --- Interactive Maps - Map Service Functions ---
export const createGameMap = async (mapData) => {
	try {
		const response = await apiClient.post('/maps', mapData);
		return response.data; // { id, name, mapAssetUrl, grid_enabled, ..., fog_data_json, pins, tags }
	} catch (error) {
		return handleApiError(error, 'Failed to create map.');
	}
};

export const getGameMaps = async (filterTagNames = [], options = {}) => { // For DM listing their maps
	try {
		const params = {};
		if (filterTagNames && filterTagNames.length > 0) {
			params.tags = filterTagNames.join(',');
		}
		const response = await apiClient.get('/maps', { params, signal: options.signal });
		return response.data; // Array of map objects
	} catch (error) {
		return handleApiError(error, 'Failed to fetch maps.');
	}
};

export const getGameMapById = async (mapId, options = {}) => { // For fetching full details of one map
	try {
		const response = await apiClient.get(`/maps/${mapId}`, { signal: options.signal });
		return response.data; // Full map object with fog, pins, tags
	} catch (error) {
		return handleApiError(error, `Failed to fetch map ${mapId}.`);
	}
};

export const updateGameMap = async (mapId, mapData) => {
	try {
		const response = await apiClient.put(`/maps/${mapId}`, mapData);
		return response.data;
	} catch (error) {
		return handleApiError(error, `Failed to update map ${mapId}.`);
	}
};

export const deleteGameMap = async (mapId) => {
	try {
		const response = await apiClient.delete(`/maps/${mapId}`);
		return response.data; // { message: '...' }
	} catch (error) {
		return handleApiError(error, `Failed to delete map ${mapId}.`);
	}
};

export const updateGameMapFog = async (mapId, fogDataJsonString) => {
	try {
		// The backend expects fog_data_json to be a string
		const response = await apiClient.put(`/maps/${mapId}/fog`, { fog_data_json: fogDataJsonString });
		return response.data; // { message: '...' }
	} catch (error) {
		return handleApiError(error, `Failed to update fog for map ${mapId}.`);
	}
};

// --- Interactive Maps - Map Element Service Functions ---
export const createMapElement = async (mapId, elementData) => {
	try {
		const response = await apiClient.post(`/maps/${mapId}/elements`, elementData);
		return response.data; // Returns the newly created element object
	} catch (error) {
		return handleApiError(error, `Failed to create element for map ${mapId}.`);
	}
};

export const getMapElements = async (mapId, filterParams = {}, options = {}) => {
	// filterParams could be { type: 'pin' } which becomes query string ?type=pin
	try {
		const response = await apiClient.get(`/maps/${mapId}/elements`, { params: filterParams, signal: options.signal });
		return response.data; // Returns an array of element objects
	} catch (error) {
		return handleApiError(error, `Failed to fetch elements for map ${mapId}.`);
	}
};

export const updateMapElement = async (mapId, elementId, elementUpdateData) => {
	try {
		const response = await apiClient.put(`/maps/${mapId}/elements/${elementId}`, elementUpdateData);
		return response.data; // Returns the updated element object
	} catch (error) {
		return handleApiError(error, `Failed to update element ${elementId} for map ${mapId}.`);
	}
};

export const deleteMapElement = async (mapId, elementId) => {
	try {
		const response = await apiClient.delete(`/maps/${mapId}/elements/${elementId}`);
		return response.data; // Usually { message: '...' }
	} catch (error) {
		return handleApiError(error, `Failed to delete element ${elementId} from map ${mapId}.`);
	}
};

export default apiClient; // Export the configured axios instance if needed

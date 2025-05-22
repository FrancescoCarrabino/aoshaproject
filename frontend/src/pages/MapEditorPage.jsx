// src/pages/MapEditorPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, CircularProgress, Alert, Paper, IconButton,
  Button, ButtonGroup, Tooltip, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControlLabel, Checkbox, Select, MenuItem, InputLabel, FormControl, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility'; // Fog
import SaveIcon from '@mui/icons-material/Save';
import PanToolIcon from '@mui/icons-material/PanTool';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'; // Generic Add
import LocationOnIcon from '@mui/icons-material/LocationOn'; // Pin Icon
import TextFieldIcon from '@mui/icons-material/TextFields'; // Text Icon
import EditIcon from '@mui/icons-material/Edit'; // Select/Edit Element
import DeleteIcon from '@mui/icons-material/Delete';
import PublicIcon from '@mui/icons-material/Public'; // Set for Party

import * as apiService from '../services/apiService';
import MapDisplay from '../components/maps/MapDisplay';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ELEMENT_TYPES = {
  PIN: 'pin',
  TEXT: 'text',
  // AREA: 'area', 
};

const TOOLS = {
  PAN: 'pan',
  REVEAL_FOG: 'reveal_fog',
  ADD_ELEMENT: 'add_element',
  SELECT_ELEMENT: 'select_element',
};

const getDefaultElementData = (type) => {
  switch (type) {
    case ELEMENT_TYPES.PIN:
      return { icon: 'default_icon_name', color: '#FF0000', size: 5, label: '', labelFont: '10px sans-serif', labelColor: '#000000' };
    case ELEMENT_TYPES.TEXT:
      return { content: 'New Text', fontSize: '16px', fontFamily: 'sans-serif', textColor: '#000000', backgroundColor: null, textAlign: 'left', textBaseline: 'top', fontStyle: 'normal', fontWeight: 'normal' /*, width_percent: 0.1, height_percent: 0.05 */ }; // Consider adding default width/height for text boxes
    default:
      return {};
  }
};

const MapEditorPage = () => {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    emitDmSetPartyMap,
    emitDmUpdateMapFog,
    emitDmUpdateMapElement,
    emitDmDeleteMapElement
  } = useSocket();

  const [mapData, setMapData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [imageNaturalDimensions, setImageNaturalDimensions] = useState({ width: 0, height: 0 });
  const imageForDimensionsRef = useRef(new Image());

  const [currentRevealedAreas, setCurrentRevealedAreas] = useState([]);
  const [currentElements, setCurrentElements] = useState([]);

  const [activeTool, setActiveTool] = useState(TOOLS.PAN);
  const [elementTypeToAdd, setElementTypeToAdd] = useState(null);

  const [isDrawingFog, setIsDrawingFog] = useState(false);
  const [drawFogStartCoords, setDrawFogStartCoords] = useState(null);

  const drawingAreaRef = useRef(null);
  const transformWrapperRef = useRef(null);

  const [elementDialogOpen, setElementDialogOpen] = useState(false);
  const [currentEditingElement, setCurrentEditingElement] = useState(null);

  const [selectedElement, setSelectedElement] = useState(null);

  const tempCanvasRef = useRef(null); // For text measurement

  useEffect(() => {
    tempCanvasRef.current = document.createElement('canvas'); // Create a temporary canvas for text measuring
  }, []);


  useEffect(() => {
    if (!mapId || (user && user.role !== 'DM')) {
      setIsLoading(false); // Set loading false before navigating or showing error
      setError(user && user.role !== 'DM' ? "You are not authorized to edit maps." : "Map ID is missing.");
      if (user && user.role !== 'DM') navigate('/dashboard', { replace: true });
      else if (!mapId) navigate('/maps-management', { replace: true });
      return;
    }

    const controller = new AbortController(); // For cleanup
    const signal = controller.signal;

    const fetchData = async () => {
      console.log('[MapEditorPage] Starting to fetch map data for ID:', mapId);
      setIsLoading(true);
      setError(null);
      setSuccessMessage(''); // Clear previous messages
      setCurrentRevealedAreas([]); // Reset state
      setCurrentElements([]);     // Reset state
      setMapData(null);           // Reset map data

      try {
        const data = await apiService.getGameMapById(mapId, { signal });
        console.log('[MapEditorPage] Map data fetched:', data);

        if (signal.aborted) return; // Check if aborted after API call

        setMapData(data);
        setCurrentRevealedAreas(data.fog_data_json ? JSON.parse(data.fog_data_json) : []);
        setCurrentElements(data.elements || []);

        if (data.mapAssetUrl) {
          const img = imageForDimensionsRef.current;
          // Important: Reset onload/onerror for this specific image instance
          img.onload = () => {
            if (signal.aborted) return;
            console.log('[MapEditorPage] Map image loaded:', data.mapAssetUrl, 'Dims:', img.naturalWidth, img.naturalHeight);
            setImageNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setIsLoading(false); // Loading finishes after image dimensions are known
          };
          img.onerror = () => {
            if (signal.aborted) return;
            console.error('[MapEditorPage] Failed to load map image asset:', data.mapAssetUrl);
            setError("Failed to load map image asset. It might be missing or corrupted.");
            setImageNaturalDimensions({ width: 0, height: 0 });
            setIsLoading(false); // Still finish loading, but with an error state for image
          };
          img.src = data.mapAssetUrl;
        } else {
          console.warn('[MapEditorPage] Map data received, but mapAssetUrl is missing.');
          setError("Map data is missing the image URL.");
          setIsLoading(false); // Finish loading as there's no image to wait for
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[MapEditorPage] Fetch aborted.');
          return; // Don't set error or loading state if aborted
        }
        console.error("[MapEditorPage] Error in fetchMapData:", err);
        setError(err.message || `Failed to fetch map details for ID ${mapId}.`);
        setIsLoading(false); // Finish loading even on API error
      }
    };

    fetchData();

    return () => {
      console.log('[MapEditorPage] Cleanup: Aborting fetch and image load for map ID:', mapId);
      controller.abort(); // Abort API call if in progress
      const img = imageForDimensionsRef.current;
      if (img) { // Nullify handlers to prevent them firing after unmount
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [mapId, user, navigate]);

  const getCoordsOnMap = useCallback((event) => {
    if (!drawingAreaRef.current || !imageNaturalDimensions.width || !transformWrapperRef.current?.instance?.transformState) {
      return null;
    }
    const { scale, positionX, positionY } = transformWrapperRef.current.instance.transformState;
    const contentWrapperRect = drawingAreaRef.current.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;
    const containerX = clientX - contentWrapperRect.left;
    const containerY = clientY - contentWrapperRect.top;
    const mapX = (containerX - positionX) / scale;
    const mapY = (containerY - positionY) / scale;
    return {
      x: Math.max(0, Math.min(mapX, imageNaturalDimensions.width)),
      y: Math.max(0, Math.min(mapY, imageNaturalDimensions.height))
    };
  }, [imageNaturalDimensions.width, imageNaturalDimensions.height]);

  const handleFogMouseDown = (event) => { /* ... same as before ... */ if (activeTool !== TOOLS.REVEAL_FOG) return; event.stopPropagation(); const pos = getCoordsOnMap(event); if (!pos) return; setIsDrawingFog(true); setDrawFogStartCoords(pos); };
  const handleFogMouseMove = (event) => { /* ... same as before ... */ if (!isDrawingFog || activeTool !== TOOLS.REVEAL_FOG) return; event.stopPropagation(); };
  const handleFogMouseUp = (event) => { /* ... same as before ... */ if (!isDrawingFog || activeTool !== TOOLS.REVEAL_FOG || !drawFogStartCoords) return; event.stopPropagation(); const pos = getCoordsOnMap(event); if (!pos) { setIsDrawingFog(false); setDrawFogStartCoords(null); return; } const x1 = Math.min(drawFogStartCoords.x, pos.x); const y1 = Math.min(drawFogStartCoords.y, pos.y); const w = Math.abs(drawFogStartCoords.x - pos.x); const h = Math.abs(drawFogStartCoords.y - pos.y); if (w > 5 && h > 5 && imageNaturalDimensions.width > 0 && imageNaturalDimensions.height > 0) { const newRectPercent = { x: x1 / imageNaturalDimensions.width, y: y1 / imageNaturalDimensions.height, width: w / imageNaturalDimensions.width, height: h / imageNaturalDimensions.height, }; setCurrentRevealedAreas(prev => [...prev, newRectPercent]); } setIsDrawingFog(false); setDrawFogStartCoords(null); };
  const handleFogMouseLeave = () => { /* ... same as before ... */ if (isDrawingFog) { setIsDrawingFog(false); setDrawFogStartCoords(null); } };

  const handleSaveFog = async () => {
    if (!mapData) return;
    setIsSaving(true); setError(null); setSuccessMessage('');
    try {
      const fogJson = JSON.stringify(currentRevealedAreas);
      await apiService.updateGameMapFog(mapData.id, fogJson);
      setMapData(prev => ({ ...prev, fog_data_json: fogJson }));
      emitDmUpdateMapFog(mapData.id, fogJson);
      setSuccessMessage('Fog saved successfully!');
    } catch (err) {
      setError(err.message || "Failed to save fog.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapClick = (event) => {
    if (!imageNaturalDimensions.width || !drawingAreaRef.current) return;
    const mapCoords = getCoordsOnMap(event);
    if (!mapCoords) return;

    const clickXPercent = mapCoords.x / imageNaturalDimensions.width;
    const clickYPercent = mapCoords.y / imageNaturalDimensions.height;

    if (activeTool === TOOLS.ADD_ELEMENT && elementTypeToAdd) {
      setCurrentEditingElement({
        element_type: elementTypeToAdd,
        x_coord_percent: clickXPercent,
        y_coord_percent: clickYPercent,
        label: '', description: '', is_visible_to_players: false,
        element_data: getDefaultElementData(elementTypeToAdd),
        // Explicitly set width/height for text elements if they should have a defined box from start
        ...(elementTypeToAdd === ELEMENT_TYPES.TEXT && {
          width_percent: 0.15, // Default width for new text box (15% of map width)
          height_percent: 0.05 // Default height (5% of map height)
        })
      });
      setElementDialogOpen(true);
    } else if (activeTool === TOOLS.SELECT_ELEMENT) {
      let foundElement = null;
      for (let i = currentElements.length - 1; i >= 0; i--) {
        const el = currentElements[i];
        const elXStart = el.x_coord_percent;
        const elYStart = el.y_coord_percent;
        let isHit = false;

        if (el.element_type === ELEMENT_TYPES.PIN) {
          const pinRenderSize = el.element_data.size || 5; // Size in pixels on original map
          const pinClickRadiusPercent = (pinRenderSize * 2.5) / Math.min(imageNaturalDimensions.width, imageNaturalDimensions.height); // Make click radius a bit larger
          const dist = Math.sqrt(Math.pow(clickXPercent - elXStart, 2) + Math.pow(clickYPercent - elYStart, 2));
          if (dist < pinClickRadiusPercent) {
            isHit = true;
          }
        } else if (el.element_type === ELEMENT_TYPES.TEXT) {
          let textBoundX = elXStart;
          let textBoundY = elYStart;
          let textBoundW_percent = el.width_percent;
          let textBoundH_percent = el.height_percent;

          if (!textBoundW_percent || !textBoundH_percent) { // Estimate if no explicit bounds
            const tempCtx = tempCanvasRef.current.getContext('2d');
            const ed = el.element_data;
            tempCtx.font = `${ed.fontStyle || ''} ${ed.fontWeight || ''} ${ed.fontSize || '16px'} ${ed.fontFamily || 'sans-serif'}`.trim();

            // Basic estimation (assumes single line if no explicit newlines, doesn't account for MapDisplay's wrapText)
            const lines = (ed.content || '').split('\n');
            let maxMeasuredWidth = 0;
            lines.forEach(line => {
              maxMeasuredWidth = Math.max(maxMeasuredWidth, tempCtx.measureText(line).width);
            });

            textBoundW_percent = maxMeasuredWidth / imageNaturalDimensions.width;
            textBoundH_percent = (lines.length * (parseFloat(ed.fontSize || '16px') * 1.2)) / imageNaturalDimensions.height;

            if (ed.textAlign === 'center') textBoundX -= textBoundW_percent / 2;
            else if (ed.textAlign === 'right') textBoundX -= textBoundW_percent;
            if (ed.textBaseline === 'middle') textBoundY -= textBoundH_percent / 2;
            else if (ed.textBaseline === 'bottom') textBoundY -= textBoundH_percent;
            // For 'top' and 'left', no adjustment needed for start point
          }

          if (clickXPercent >= textBoundX && clickXPercent <= textBoundX + textBoundW_percent &&
            clickYPercent >= textBoundY && clickYPercent <= textBoundY + textBoundH_percent) {
            isHit = true;
          }
        }
        // Add AREA element hit detection here if implemented

        if (isHit) {
          foundElement = el;
          break;
        }
      }
      setSelectedElement(foundElement);
    }
  };

  const handleElementDialogClose = () => { /* ... same as before ... */ setElementDialogOpen(false); setCurrentEditingElement(null); if (activeTool === TOOLS.ADD_ELEMENT) setActiveTool(TOOLS.SELECT_ELEMENT); setElementTypeToAdd(null); };
  const handleElementDataChange = (e) => { /* ... same as before ... */ const { name, value, type, checked } = e.target; setCurrentEditingElement(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value, })); };
  const handleElementSpecificDataChange = (e) => { /* ... same as before ... */ const { name, value, type, checked } = e.target; setCurrentEditingElement(prev => ({ ...prev, element_data: { ...prev.element_data, [name]: type === 'checkbox' ? checked : value }, })); };
  // Add handler for top-level width_percent, height_percent if you add them to text dialog
  const handleElementDimensionChange = (e) => {
    const { name, value } = e.target;
    setCurrentEditingElement(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0 // Store as number
    }));
  };

  const handleSaveElement = async () => {
    if (!currentEditingElement || !mapData) return;
    setIsSaving(true); setError(null); setSuccessMessage('');
    let payload = { ...currentEditingElement };

    // Ensure numeric types
    if (payload.element_type === ELEMENT_TYPES.PIN && payload.element_data.size) {
      payload.element_data.size = parseFloat(payload.element_data.size);
    }
    if (payload.width_percent) payload.width_percent = parseFloat(payload.width_percent);
    if (payload.height_percent) payload.height_percent = parseFloat(payload.height_percent);


    try {
      let savedElement;
      if (payload.id) {
        savedElement = await apiService.updateMapElement(mapData.id, payload.id, payload);
        setCurrentElements(prev => prev.map(el => el.id === savedElement.id ? savedElement : el));
        setSelectedElement(savedElement);
      } else {
        savedElement = await apiService.createMapElement(mapData.id, payload);
        setCurrentElements(prev => [...prev, savedElement]);
      }
      emitDmUpdateMapElement(mapData.id, savedElement);
      setSuccessMessage(`Element ${payload.id ? 'updated' : 'created'} successfully!`);
      handleElementDialogClose();
    } catch (err) {
      setError(err.message || `Failed to save element.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSelectedElement = () => { /* ... same as before ... */ if (!selectedElement) return; setCurrentEditingElement({ ...selectedElement }); setElementDialogOpen(true); };
  const handleDeleteSelectedElement = async () => { /* ... same as before ... */ if (!selectedElement || !mapData) return; if (!window.confirm(`Are you sure you want to delete element "${selectedElement.label || selectedElement.element_data?.content?.substring(0, 20) || `ID: ${selectedElement.id}`}"?`)) return; setIsSaving(true); setError(null); setSuccessMessage(''); try { await apiService.deleteMapElement(mapData.id, selectedElement.id); emitDmDeleteMapElement(mapData.id, selectedElement.id); setCurrentElements(prev => prev.filter(el => el.id !== selectedElement.id)); setSelectedElement(null); setSuccessMessage('Element deleted successfully!'); } catch (err) { setError(err.message || 'Failed to delete element.'); } finally { setIsSaving(false); } };
  const handleSetForParty = () => { /* ... same as before ... */ if (!mapData) return; emitDmSetPartyMap(mapData.id); setSuccessMessage(`Map "${mapData.name}" set as active for the party.`); };
  const handleCloseSnackbar = () => { /* ... same as before ... */ setSuccessMessage(''); setError(''); };
  const selectTool = (tool, type = null) => { /* ... same as before ... */ setActiveTool(tool); setElementTypeToAdd(type); setSelectedElement(null); if (tool !== TOOLS.REVEAL_FOG) { setIsDrawingFog(false); setDrawFogStartCoords(null); } };

  if (isLoading) return <Container sx={{ py: 3 }}><Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box></Container>;
  if (error && !mapData && !elementDialogOpen) return <Container sx={{ py: 3 }}><Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/maps-management')} sx={{ mb: 2 }}>Back</Button><Alert severity="error" onClose={() => setError(null)}>{error}</Alert></Container>;
  if (!mapData && !isLoading) return <Container sx={{ py: 3 }}><Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/maps-management')} sx={{ mb: 2 }}>Back</Button><Alert severity="warning">Map data not found.</Alert></Container>;

  return (
    <Container maxWidth={false} sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', p: '0 !important', m: 0 }}>
      {/* Header Bar */}
      <Paper elevation={2} sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <IconButton onClick={() => navigate('/maps-management')} aria-label="back to maps list"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mapData?.name || 'Edit Map'}</Typography>
        <Tooltip title="Set this map for the party"><IconButton onClick={handleSetForParty} color="primary" aria-label="set for party"><PublicIcon /></IconButton></Tooltip>
      </Paper>

      {/* Toolbar */}
      <Paper elevation={1} sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
        <ButtonGroup variant="outlined">
          <Tooltip title="Pan & Zoom"><Button onClick={() => selectTool(TOOLS.PAN)} variant={activeTool === TOOLS.PAN ? "contained" : "outlined"}><PanToolIcon /></Button></Tooltip>
          <Tooltip title="Reveal Fog Area"><Button onClick={() => selectTool(TOOLS.REVEAL_FOG)} variant={activeTool === TOOLS.REVEAL_FOG ? "contained" : "outlined"}><VisibilityIcon /></Button></Tooltip>
          <Tooltip title="Select/Edit Element"><Button onClick={() => selectTool(TOOLS.SELECT_ELEMENT)} variant={activeTool === TOOLS.SELECT_ELEMENT ? "contained" : "outlined"}><EditIcon /></Button></Tooltip>
        </ButtonGroup>
        <ButtonGroup variant="outlined">
          <Tooltip title="Add Pin"><Button onClick={() => selectTool(TOOLS.ADD_ELEMENT, ELEMENT_TYPES.PIN)} variant={activeTool === TOOLS.ADD_ELEMENT && elementTypeToAdd === ELEMENT_TYPES.PIN ? "contained" : "outlined"}><LocationOnIcon /></Button></Tooltip>
          <Tooltip title="Add Text"><Button onClick={() => selectTool(TOOLS.ADD_ELEMENT, ELEMENT_TYPES.TEXT)} variant={activeTool === TOOLS.ADD_ELEMENT && elementTypeToAdd === ELEMENT_TYPES.TEXT ? "contained" : "outlined"}><TextFieldIcon /></Button></Tooltip>
        </ButtonGroup>
        <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={handleSaveFog} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Fog'}</Button>
      </Paper>

      {activeTool === TOOLS.SELECT_ELEMENT && selectedElement && (
        <Paper elevation={1} sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, backgroundColor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={{ ml: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Selected: {selectedElement.label || selectedElement.element_data?.content?.substring(0, 30) || `Element ID ${selectedElement.id}`} ({selectedElement.element_type})
          </Typography>
          <Box>
            <Button size="small" onClick={handleEditSelectedElement} startIcon={<EditIcon />} sx={{ mr: 1 }}>Edit</Button>
            <Button size="small" color="error" onClick={handleDeleteSelectedElement} startIcon={<DeleteIcon />} disabled={isSaving}>Delete</Button>
          </Box>
        </Paper>
      )}

      {/* Drawing Area / Map Display */}
      <Box
        ref={drawingAreaRef}
        sx={{ flexGrow: 1, position: 'relative', cursor: (activeTool === TOOLS.REVEAL_FOG || activeTool === TOOLS.ADD_ELEMENT) ? 'crosshair' : (activeTool === TOOLS.SELECT_ELEMENT ? 'help' : 'default'), overflow: 'hidden' }} // 'help' cursor for select
        onMouseDown={activeTool === TOOLS.REVEAL_FOG ? handleFogMouseDown : undefined}
        onMouseMove={activeTool === TOOLS.REVEAL_FOG && isDrawingFog ? handleFogMouseMove : undefined}
        onMouseUp={activeTool === TOOLS.REVEAL_FOG && isDrawingFog ? handleFogMouseUp : undefined}
        onMouseLeave={activeTool === TOOLS.REVEAL_FOG && isDrawingFog ? handleFogMouseLeave : undefined}
        onClick={(activeTool === TOOLS.ADD_ELEMENT || activeTool === TOOLS.SELECT_ELEMENT) ? handleMapClick : undefined}
      >
        {(imageNaturalDimensions.width > 0 && mapData) ? (
          <MapDisplay
            mapImageUrl={mapData.mapAssetUrl}
            isDMView={true}
            naturalWidth={imageNaturalDimensions.width}
            naturalHeight={imageNaturalDimensions.height}
            gridEnabled={mapData.grid_enabled}
            gridSizePixels={mapData.grid_size_pixels}
            fogDataJsonString={JSON.stringify(currentRevealedAreas)}
            elements={currentElements.map(el => el.id === selectedElement?.id ? { ...el, _isSelectedHack: true } : el)} // Pass elements, mark selected
            transformWrapperRef={transformWrapperRef}
            isPanDisabled={activeTool !== TOOLS.PAN}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            {(isLoading || (mapData?.mapAssetUrl && imageNaturalDimensions.width === 0)) ? <CircularProgress /> : <Typography color="error" onClose={() => setError(null)}>{error || "Map image could not be loaded."}</Typography>}
          </Box>
        )}
      </Box>

      {/* Element Creation/Editing Dialog */}
      {currentEditingElement && (
        <Dialog open={elementDialogOpen} onClose={handleElementDialogClose} maxWidth="md" fullWidth> {/* Changed to md for more space */}
          <DialogTitle>{currentEditingElement.id ? 'Edit' : 'Create'} {currentEditingElement.element_type}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            <TextField label="Label (DM Only, e.g. 'Trap Trigger')" name="label" value={currentEditingElement.label || ''} onChange={handleElementDataChange} fullWidth margin="dense" />

            {currentEditingElement.element_type === ELEMENT_TYPES.PIN && (
              <>
                <TextField label="Pin Title (Player Visible if Pin Label is shown)" name="label" helperText="This label can be shown on map via MapDisplay" value={currentEditingElement.element_data.label || ''} onChange={handleElementSpecificDataChange} fullWidth margin="dense" />
                <TextField label="Color (hex, e.g. #FF0000)" name="color" value={currentEditingElement.element_data.color || '#FF0000'} onChange={handleElementSpecificDataChange} fullWidth margin="dense" type="color" InputLabelProps={{ shrink: true }} sx={{ my: 1 }} />
                <TextField label="Size (px radius on original map)" name="size" type="number" inputProps={{ min: 1, max: 50, step: 1 }} value={currentEditingElement.element_data.size || 5} onChange={handleElementSpecificDataChange} fullWidth margin="dense" />
              </>
            )}
            {currentEditingElement.element_type === ELEMENT_TYPES.TEXT && (
              <>
                <TextField label="Text Content (Player Visible)" name="content" value={currentEditingElement.element_data.content || ''} onChange={handleElementSpecificDataChange} fullWidth margin="dense" multiline rows={3} />
                <Grid container spacing={2} alignItems="flex-end" sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6} md={3}><TextField label="Font Size (e.g., 16px)" name="fontSize" value={currentEditingElement.element_data.fontSize || '16px'} onChange={handleElementSpecificDataChange} fullWidth margin="dense" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><TextField label="Font Family" name="fontFamily" value={currentEditingElement.element_data.fontFamily || 'sans-serif'} onChange={handleElementSpecificDataChange} fullWidth margin="dense" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><TextField label="Text Color" name="textColor" type="color" InputLabelProps={{ shrink: true }} value={currentEditingElement.element_data.textColor || '#000000'} onChange={handleElementSpecificDataChange} fullWidth margin="dense" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><TextField label="Background Color" name="backgroundColor" value={currentEditingElement.element_data.backgroundColor || ''} onChange={handleElementSpecificDataChange} fullWidth margin="dense" helperText="e.g., #FFFFFF80 or empty" /></Grid>

                  <Grid item xs={6} sm={4}><FormControl fullWidth margin="dense"><InputLabel>Align</InputLabel><Select name="textAlign" value={currentEditingElement.element_data.textAlign || 'left'} onChange={handleElementSpecificDataChange} label="Align"><MenuItem value="left">Left</MenuItem><MenuItem value="center">Center</MenuItem><MenuItem value="right">Right</MenuItem></Select></FormControl></Grid>
                  <Grid item xs={6} sm={4}><FormControl fullWidth margin="dense"><InputLabel>Baseline</InputLabel><Select name="textBaseline" value={currentEditingElement.element_data.textBaseline || 'top'} onChange={handleElementSpecificDataChange} label="Baseline"><MenuItem value="top">Top</MenuItem><MenuItem value="middle">Middle</MenuItem><MenuItem value="bottom">Bottom</MenuItem></Select></FormControl></Grid>
                  <Grid item xs={6} sm={4}><TextField label="Font Weight (normal, bold)" name="fontWeight" value={currentEditingElement.element_data.fontWeight || 'normal'} onChange={handleElementSpecificDataChange} fullWidth margin="dense" /></Grid>

                  <Grid item xs={6}><TextField label="Text Box Width (% of map)" name="width_percent" type="number" inputProps={{ min: 0.01, max: 1, step: 0.01 }} value={currentEditingElement.width_percent || 0.15} onChange={handleElementDimensionChange} fullWidth margin="dense" helperText="0.01 to 1.0" /></Grid>
                  <Grid item xs={6}><TextField label="Text Box Height (% of map)" name="height_percent" type="number" inputProps={{ min: 0.01, max: 1, step: 0.01 }} value={currentEditingElement.height_percent || 0.05} onChange={handleElementDimensionChange} fullWidth margin="dense" helperText="0.01 to 1.0" /></Grid>
                </Grid>
              </>
            )}
            <TextField label="Description (DM Notes)" name="description" value={currentEditingElement.description || ''} onChange={handleElementDataChange} fullWidth margin="dense" multiline rows={2} sx={{ mt: 2 }} />
            <FormControlLabel control={<Checkbox checked={!!currentEditingElement.is_visible_to_players} onChange={handleElementDataChange} name="is_visible_to_players" />} label="Visible to Players" sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleElementDialogClose}>Cancel</Button>
            <Button onClick={handleSaveElement} variant="contained" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Element'}</Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={!!successMessage || !!error} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={successMessage ? "success" : (error ? "error" : "info")} sx={{ width: '100%' }} variant="filled">
          {successMessage || error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MapEditorPage;

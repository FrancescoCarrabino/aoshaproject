// src/components/character/sections/InventorySection.jsx
import React from 'react';
import {
  TextField, Button, Grid, Typography, Paper, Box, IconButton,
  Checkbox, FormControlLabel, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import WeightIcon from '@mui/icons-material/FitnessCenter'; // Example icon for weight
import BackpackIcon from '@mui/icons-material/Backpack'; // Example icon for location

function InventorySection({
  inventoryItems,     // character.inventoryItems
  carryingCapacity,   // character.carryingCapacity (which includes derived totalWeight)
  handlers,           // All inventory-related handlers
  // derivedValues,   // Only if you pass totalWeightCarried separately, otherwise it's in carryingCapacity.currentWeight
}) {
  const {
    handleInventoryItemChange,
    addInventoryItem,
    removeInventoryItem,
    handleCarryingCapacityChange // For manually setting max capacities if desired
  } = handlers;

  const totalWeight = carryingCapacity.currentWeight || 0; // Already calculated in parent
  const maxCap = parseFloat(carryingCapacity.maxRegular) || 0;
  const encumbered = parseFloat(carryingCapacity.encumberedThreshold) || (maxCap / 3); // Example fallback
  const heavilyEncumbered = parseFloat(carryingCapacity.heavilyEncumberedThreshold) || (maxCap * 2 / 3); // Example fallback

  let weightStatus = "Normal";
  let weightColor = "text.primary";
  if (totalWeight > heavilyEncumbered && heavilyEncumbered > 0) {
    weightStatus = "Heavily Encumbered";
    weightColor = "error.main";
  } else if (totalWeight > encumbered && encumbered > 0) {
    weightStatus = "Encumbered";
    weightColor = "warning.main";
  }

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Inventory & Carrying Capacity
      </Typography>

      {/* Carrying Capacity Display */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, textAlign: 'center' }}>
        <Typography variant="h5" component="p" sx={{ color: weightColor, fontWeight: 'bold' }}>
          Total Weight: {totalWeight.toFixed(2)} lbs ({weightStatus})
        </Typography>
        <Grid container spacing={1} justifyContent="center" sx={{ mt: 1 }}>
          <Grid item xs={6} sm={3}>
            <TextField label="Max Capacity" size="small" type="number" value={carryingCapacity.maxRegular || ""} onChange={(e) => handleCarryingCapacityChange('maxRegular', e.target.value)} helperText="(STR x 15)" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Encumbered At" size="small" type="number" value={carryingCapacity.encumberedThreshold || ""} onChange={(e) => handleCarryingCapacityChange('encumberedThreshold', e.target.value)} helperText="(STR x 5)" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Heavily Enc. At" size="small" type="number" value={carryingCapacity.heavilyEncumberedThreshold || ""} onChange={(e) => handleCarryingCapacityChange('heavilyEncumberedThreshold', e.target.value)} helperText="(STR x 10)" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Push/Drag/Lift" size="small" type="number" value={carryingCapacity.pushDragLift || ""} onChange={(e) => handleCarryingCapacityChange('pushDragLift', e.target.value)} helperText="(STR x 30)" />
          </Grid>
        </Grid>
      </Paper>

      {/* Inventory Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="inventory table">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Item Name</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', width: '10%' }}>Qty</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', width: '10%' }}>Wt (ea)</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', width: '10%' }}>Total Wt</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Location</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', width: '5%' }}>Equip</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', width: '10%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(inventoryItems || []).map((item, index) => (
              <TableRow key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell component="th" scope="row">
                  <TextField
                    variant="standard"
                    fullWidth
                    size="small"
                    placeholder="Item Name"
                    value={item.name || ''}
                    onChange={(e) => handleInventoryItemChange(index, 'name', e.target.value)}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    variant="standard"
                    type="number"
                    size="small"
                    inputProps={{ style: { textAlign: 'center' }, min: 0 }}
                    sx={{ width: '50px' }}
                    value={item.quantity || ''}
                    onChange={(e) => handleInventoryItemChange(index, 'quantity', e.target.value)}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    variant="standard"
                    type="number"
                    size="small"
                    inputProps={{ style: { textAlign: 'center' }, step: 0.1, min: 0 }}
                    sx={{ width: '60px' }}
                    value={item.weight || ''}
                    onChange={(e) => handleInventoryItemChange(index, 'weight', e.target.value)}
                  />
                </TableCell>
                <TableCell align="center">
                  {((parseFloat(item.quantity) || 0) * (parseFloat(item.weight) || 0)).toFixed(2)}
                </TableCell>
                <TableCell>
                  <TextField
                    variant="standard"
                    fullWidth
                    size="small"
                    placeholder="e.g. Backpack"
                    value={item.location || ''}
                    onChange={(e) => handleInventoryItemChange(index, 'location', e.target.value)}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Equipped">
                    <Checkbox
                      size="small"
                      checked={item.equipped || false}
                      onChange={(e) => handleInventoryItemChange(index, 'equipped', e.target.checked)}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <IconButton onClick={() => removeInventoryItem(index)} color="error" size="small" title="Remove item">
                    <RemoveCircleOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={addInventoryItem}
        >
          Add Item
        </Button>
      </Box>
      {/* Optional: Description field for a selected item could go here */}
    </Paper>
  );
}

export default InventorySection;

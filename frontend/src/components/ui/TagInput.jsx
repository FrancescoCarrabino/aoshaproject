// src/components/ui/TagInput.jsx
import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Chip, CircularProgress } from '@mui/material';
import * as apiService from '../../services/apiService'; // Adjust path as needed

const TagInput = ({ value = [], onChange, label = "Tags", placeholder = "Add tags..." }) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]); // For suggestions from API
  const [loading, setLoading] = useState(false);

  // Fetch all existing tags for suggestions (optional, could be debounced)
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const allTags = await apiService.getAllTags(); // Fetches [{id, name}, ...]
        if (active && allTags) {
          setOptions(allTags.map(tag => tag.name)); // We only need names for options
        }
      } catch (error) {
        console.error("Failed to load tag suggestions", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, []); // Fetch once on mount

  const handleTagChange = (event, newValue) => {
    // newValue can be an array of strings (selected/created tags)
    // Ensure no empty strings or duplicates before calling onChange
    const processedTags = newValue
      .map(tag => (typeof tag === 'string' ? tag.trim() : tag)) // Handle if an object was somehow passed
      .filter(tag => tag && tag.length > 0); // Remove empty strings

    onChange([...new Set(processedTags)]); // Pass unique, non-empty tags
  };

  return (
    <Autocomplete
      multiple
      freeSolo // Allows creating new tags not in options
      value={value} // Array of strings: current tags for the entity
      onChange={handleTagChange}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={options} // Suggestions from API
      loading={loading}
      getOptionLabel={(option) => option} // Handles if options were objects
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            variant="outlined"
            label={option}
            size="small"
            {...getTagProps({ index })}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      sx={{ width: '100%' }}
    />
  );
};

export default TagInput;

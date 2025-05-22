
// src/theme.js
import { createTheme } from '@mui/material/styles';

// Your color palette
const primaryOrange = '#E58323';
const secondaryGold = '#E9A319';
const errorRed = '#B83E3E';
const darkBackground = '#121212'; // A very dark gray, often better than pure black for UI
const paperBackground = '#1E1E1E'; // For elements like cards or form backgrounds
const textPrimary = '#FFFFFF';
const textSecondary = 'rgba(255, 255, 255, 0.7)';

const theme = createTheme({
  palette: {
    mode: 'dark', // Enable MUI's dark mode baseline
    primary: {
      main: primaryOrange, // Your main action color
      contrastText: '#000000', // Text on primary color buttons
    },
    secondary: {
      main: secondaryGold, // Your secondary action/highlight color
      contrastText: '#000000',
    },
    error: {
      main: errorRed,
    },
    background: {
      default: darkBackground, // Main page background
      paper: paperBackground,  // Background for Paper components, cards, etc.
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
    },
  },
  typography: {
    fontFamily: '"Cinzel", "Roboto", "Helvetica", "Arial", sans-serif', // Example: Cinzel for a fantasy feel
    h1: { fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700 }, // More stylized for main titles
    h4: { fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 600 },
    button: {
      textTransform: 'none', // Personal preference, MUI defaults to uppercase
      fontWeight: 'bold',
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Slightly more rounded buttons
        },
        containedPrimary: {
          // Specific styles for primary contained buttons if needed
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          // Default styles for all TextFields if using outlined variant mostly
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)', // Lighter default border for dark theme
            },
            '&:hover fieldset': {
              borderColor: secondaryGold, // Gold border on hover
            },
            '&.Mui-focused fieldset': {
              borderColor: primaryOrange, // Orange border on focus
            },
          },
          '& .MuiInputLabel-root': { // Label color
            color: textSecondary,
          },
          '& .MuiInputLabel-root.Mui-focused': { // Focused label color
            color: primaryOrange,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: paperBackground, // Make AppBar slightly different from page bg
          backgroundImage: 'none', // Remove MUI default gradient if any
          boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)'
        }
      }
    }
    // You can customize other components here (MuiCard, MuiPaper, etc.)
  },
});

export default theme;

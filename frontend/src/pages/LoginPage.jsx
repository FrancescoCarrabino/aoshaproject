// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Button,
  TextField,
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Link as MuiLink,
} from '@mui/material';

// Path to your background image in the public folder
const backgroundImageUrl = '../../public/aoshaproject-landing.png'; // ADJUST THIS PATH

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box // Use Box for full-page styling capabilities
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        p: { xs: 2, sm: 3 }, // Responsive padding for the page
      }}
    >
      <Container
        component="div" // Changed from "main" as Box is now the main container
        maxWidth="xs" // Controls max-width of the form container
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker overlay for better text contrast
          backdropFilter: 'blur(4px)', // Subtle blur
          p: { xs: 3, sm: 4 },
          borderRadius: '12px',
          boxShadow: '0 8px 32px 0 rgba(229, 131, 35, 0.2)', // Orange-ish shadow
          border: '1px solid rgba(229, 131, 35, 0.3)', // Subtle orange border
        }}
      >

        <Typography
          variant="subtitle1"
          align="center"
          sx={{ color: 'text.secondary', mb: 3, fontStyle: 'italic' }}
        >
          benvenuti ad
        </Typography>
        <Typography
          variant="h1" // Using stylized h1 from theme
          align="center"
          gutterBottom // Adds bottom margin
          sx={{
            color: 'primary.main', // Use theme's primary orange
            mb: 1, // Margin bottom
            fontSize: { xs: '3rem', sm: '4rem' } // Responsive font size for "AOSHA"
          }}
        >
          AOSHA
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            variant="outlined" // Will pick up default styles from theme
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          // sx prop for TextField is now mostly handled by the theme
          />
          <TextField
            variant="outlined" // Will pick up default styles from theme
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && (
            <Alert severity="error" variant="filled" sx={{ width: '100%', mt: 2, mb: 1 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary" // Uses primary.main (orange) from theme
            disabled={loading}
            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1.1rem' }} // py for padding-top/bottom
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <MuiLink
              component={RouterLink}
              to="/forgot-password" // Placeholder route
              variant="body2"
              sx={{ color: 'secondary.main', '&:hover': { color: 'primary.light' } }}
            >
              Forgot password?
            </MuiLink>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default LoginPage;

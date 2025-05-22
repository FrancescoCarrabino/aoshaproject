import React from 'react';
import { Link } from 'react-router-dom';
import { Typography, Button } from '@mui/material';

function HomePage() {
  return (
    <div>
      <Typography variant="h4" gutterBottom>Home - AOSHA</Typography>
      <Typography paragraph>
        Welcome, adventurer! This is your base of operations.
      </Typography>
      <Button component={Link} to="/dashboard" variant="contained">
        Go to Dashboard
      </Button>
    </div>
  );
}
export default HomePage;

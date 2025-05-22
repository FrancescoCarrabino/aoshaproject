import React from 'react';
import { Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h3" gutterBottom>404 - Page Not Found</Typography>
      <Typography paragraph>Oops! The page you are looking for does not exist.</Typography>
      <Button component={Link} to="/" variant="contained">
        Go Home
      </Button>
    </div>
  );
}
export default NotFoundPage;

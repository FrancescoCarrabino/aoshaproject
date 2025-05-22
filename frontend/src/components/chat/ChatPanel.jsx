// src/components/chat/ChatPanel.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext';   // Adjust path if needed
import {
  Box, TextField, Button, List, ListItem, ListItemText,
  Paper, Typography, Divider, IconButton, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Tooltip, CircularProgress, Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';

// Reusable DiceRollButton component
function DiceRollButton({ onRoll, diceType, title, disabled, isSecretRoll = false }) {
  return (
    <Tooltip title={title || `Roll ${diceType}`}>
      <span> {/* Span is needed for Tooltip when button is disabled */}
        <Button
          variant="outlined"
          color={isSecretRoll ? "warning" : "secondary"}
          size="small"
          startIcon={isSecretRoll ? <LockIcon fontSize="small" /> : <CasinoIcon fontSize="small" />}
          onClick={() => onRoll(diceType)}
          disabled={disabled}
          sx={{ mr: 0.5, mb: 0.5, minWidth: '60px', p: '4px 8px', flexShrink: 0 }}
        >
          {diceType}
        </Button>
      </span>
    </Tooltip>
  );
}

function ChatPanel() {
  const { socket, isConnected, isAuthenticatedOnSocket } = useSocket(); // Corrected variable name
  const { user } = useAuth(); // Token is not directly used here, user object has role and username
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [whisperTargetUsername, setWhisperTargetUsername] = useState('');
  const [allUsersForWhisper, setAllUsersForWhisper] = useState([]);

  // For image avatars, if you decide to use them and they are served from backend
  // const API_URL_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5001';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); // "auto" for instant scroll after new message
  }, []);

  useEffect(scrollToBottom, [messages]); // Scroll whenever messages array changes

  useEffect(() => {
    if (socket && isAuthenticatedOnSocket) { // Use corrected variable
      console.log('[ChatPanel] Socket is connected and authenticated. Setting up listeners.');

      const handleNewPartyMessage = (msgData) => {
        console.log('[ChatPanel] Received chat_message_party_new:', msgData);
        setMessages(prev => [...prev, { ...msgData, type: 'chat' }]);
      };
      const handleNewPublicRoll = (rollData) => {
        console.log('[ChatPanel] Received dice_roll_public_new:', rollData);
        setMessages(prev => [...prev, { ...rollData, type: 'roll' }]);
      };
      const handleNewWhisper = (whisperData) => {
        console.log('[ChatPanel] Received dm_whisper_new:', whisperData);
        setMessages(prev => [...prev, { ...whisperData, type: 'whisper' }]);
      };
      const handleSecretDmRoll = (rollData) => {
        console.log('[ChatPanel] Received dice_roll_secret_dm_new:', rollData);
        setMessages(prev => [...prev, { ...rollData, type: 'secret_roll' }]);
      };
      const handleWhisperConfirmation = (data) => {
        console.log("[ChatPanel] Whisper sent confirmation:", data);
        // Optionally add a system message or subtle feedback
      };
      const handleWhisperFailed = (data) => {
        console.warn("[ChatPanel] Whisper failed:", data);
        setMessages(prev => [...prev, { type: 'system_error', text: `Whisper failed: ${data.error}`, timestamp: new Date().toISOString() }]);
      };
      const handleRoomUsersUpdate = (usersInRoom) => {
        console.log("[ChatPanel] Received room_users_update:", usersInRoom);
        if (user && user.role === 'DM') {
          setAllUsersForWhisper(usersInRoom.filter(u => u.id !== user.id)); // Exclude self from whisper targets
        } else {
          setAllUsersForWhisper([]); // Players don't see whisper targets
        }
      };

      socket.on('chat_message_party_new', handleNewPartyMessage);
      socket.on('dice_roll_public_new', handleNewPublicRoll);
      socket.on('dm_whisper_new', handleNewWhisper);
      socket.on('dm_whisper_sent_confirmation', handleWhisperConfirmation);
      socket.on('dm_whisper_failed', handleWhisperFailed);
      socket.on('dice_roll_secret_dm_new', handleSecretDmRoll);
      socket.on('room_users_update', handleRoomUsersUpdate);

      // Request initial user list if DM
      if (user?.role === 'DM') {
        // The backend sends 'room_users_update' on join, so this might be redundant
        // unless explicitly needed for late joiners before first update.
        // socket.emit('request_room_users'); // If you implement such an event on backend
      }


      return () => {
        console.log('[ChatPanel] Cleaning up socket listeners.');
        socket.off('chat_message_party_new', handleNewPartyMessage);
        socket.off('dice_roll_public_new', handleNewPublicRoll);
        socket.off('dm_whisper_new', handleNewWhisper);
        socket.off('dm_whisper_sent_confirmation', handleWhisperConfirmation);
        socket.off('dm_whisper_failed', handleWhisperFailed);
        socket.off('dice_roll_secret_dm_new', handleSecretDmRoll);
        socket.off('room_users_update', handleRoomUsersUpdate);
      };
    } else {
      console.log('[ChatPanel] Socket not ready or not authenticated. Listeners not set up.');
      setAllUsersForWhisper([]); // Clear whisper targets if not authenticated
    }
  }, [socket, isAuthenticatedOnSocket, user]); // Dependencies for setting up/tearing down listeners

  const parseAndRollDice = (rollInput) => {
    const originalInput = rollInput; // Keep original for displayString if needed
    rollInput = rollInput.toLowerCase().replace(/\s+/g, '');
    let numDice = 1, numSides, modifier = 0, isSecret = false;

    if (rollInput.startsWith('/rollsecret ') || rollInput.startsWith('/rs ')) {
      if (user?.role !== 'DM') {
        setMessages(prev => [...prev, { type: 'system_error', text: "Only DMs can make secret rolls.", timestamp: new Date().toISOString() }]);
        return null;
      }
      isSecret = true;
      rollInput = rollInput.replace(/^\/(rollsecret|rs)\s*/, '');
    } else if (rollInput.startsWith('/roll ') || rollInput.startsWith('/r ')) {
      rollInput = rollInput.replace(/^\/(roll|r)\s*/, '');
    }
    // Match patterns like "2d6+3", "d20-1", "3d8"
    const parts = rollInput.match(/(\d*)d(\d+)([+-]\d+)?/);
    if (!parts) return null; // Invalid format

    if (parts[1]) numDice = parseInt(parts[1]);
    numSides = parseInt(parts[2]);
    if (parts[3]) modifier = parseInt(parts[3]);

    if (isNaN(numDice) || isNaN(numSides) || numDice <= 0 || numSides <= 0 || numDice > 100) return null; // Basic validation

    let rollsArray = [];
    let sumOfRolls = 0;
    for (let i = 0; i < numDice; i++) {
      const roll = Math.floor(Math.random() * numSides) + 1;
      rollsArray.push(roll);
      sumOfRolls += roll;
    }
    const totalResult = sumOfRolls + modifier;
    const detailsString = `[${rollsArray.join(', ')}] ${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`;
    const displayString = `${numDice}d${numSides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`;

    return {
      roller: user.username,
      role: user.role,
      rollString: originalInput, // The full command as typed
      displayString: displayString, // e.g., "2d6+3"
      result: totalResult,
      details: detailsString, // e.g., "[5, 3] +3"
      isSecret: isSecret,
      timestamp: new Date().toISOString()
    };
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !isAuthenticatedOnSocket || !user) return; // Use corrected variable

    const messageText = newMessage.trim();

    if (messageText.toLowerCase().startsWith('/r')) {
      const rollData = parseAndRollDice(messageText);
      if (rollData) {
        if (rollData.isSecret) {
          socket.emit('dice_roll_secret_dm', rollData);
          // DM sees their own secret roll immediately
          setMessages(prev => [...prev, { ...rollData, type: 'secret_roll' }]);
        } else {
          socket.emit('dice_roll_public', rollData);
          // Public rolls will come back via 'dice_roll_public_new' for everyone including sender
        }
      } else {
        setMessages(prev => [...prev, { type: 'system_error', text: "Invalid dice format. Use /r XdY[+/-Z] or /rs XdY[+/-Z]", timestamp: new Date().toISOString() }]);
      }
    } else if (whisperTargetUsername && user?.role === 'DM') {
      socket.emit('dm_whisper', { toUsername: whisperTargetUsername, text: messageText });
      // DM sees their own whisper immediately
      setMessages(prev => [...prev, {
        sender: `You (to ${whisperTargetUsername})`,
        text: messageText, type: 'whisper', isWhisper: true, // isWhisper indicates it's an outgoing whisper for styling
        timestamp: new Date().toISOString()
      }]);
    } else {
      socket.emit('chat_message_party', { text: messageText });
      // Party messages will come back via 'chat_message_party_new' for everyone including sender
    }
    setNewMessage('');
    if (user?.role === 'DM' && !whisperTargetUsername && messageText.toLowerCase().startsWith('/r')) {
      // If DM made a public roll, don't keep them in whisper mode unless they explicitly choose a target
    } else if (user?.role !== 'DM') {
      setWhisperTargetUsername(''); // Players always party chat
    }
  };

  const handleQuickRoll = (diceNotation, isSecretRoll = false) => {
    if (!socket || !isAuthenticatedOnSocket || !user) return; // Use corrected variable

    const rollCommand = isSecretRoll && user?.role === 'DM' ? `/rs ${diceNotation}` : `/r ${diceNotation}`;
    const rollData = parseAndRollDice(rollCommand);
    if (rollData) {
      if (rollData.isSecret) {
        socket.emit('dice_roll_secret_dm', rollData);
        setMessages(prev => [...prev, { ...rollData, type: 'secret_roll' }]);
      } else {
        socket.emit('dice_roll_public', rollData);
      }
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'invalid date';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'background.paper' }}>
      <Typography variant="h6" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', fontFamily: '"Cinzel", serif', textAlign: 'center', flexShrink: 0 }}>
        Party Chat & Rolls
      </Typography>

      {!isConnected && <Alert severity="warning" sx={{ m: 1, borderRadius: 0, flexShrink: 0 }}>Connecting to chat...</Alert>}
      {isConnected && !isAuthenticatedOnSocket && <Alert severity="info" sx={{ m: 1, borderRadius: 0, flexShrink: 0 }}>Authenticating chat...</Alert>}

      <List sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }}>
        {messages.map((msg, index) => (
          <ListItem key={`${msg.timestamp}-${index}`} disablePadding sx={{ mb: 1, alignItems: 'flex-start' }}>
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography
                  variant="caption"
                  component="span"
                  sx={{
                    fontWeight: 'bold',
                    color: msg.role === 'DM' ? 'secondary.main' : (msg.type === 'system_error' ? 'error.main' : 'primary.main'),
                    mr: 0.5
                  }}
                >
                  {msg.sender || msg.roller || msg.from || "System"}
                </Typography>
                <Typography variant="caption" color="text.secondary">{formatTimestamp(msg.timestamp)}</Typography>
              </Box>

              {msg.type === 'chat' && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</Typography>}

              {msg.type === 'whisper' && (
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontStyle: 'italic',
                    color: (msg.isWhisper && (msg.sender?.startsWith("You (to") || msg.from === user?.username))
                      ? 'info.dark' // Outgoing whisper, or DM receiving their own echo if implemented
                      : 'text.secondary' // Incoming whisper
                  }}
                >
                  {msg.text}
                </Typography>
              )}

              {msg.type === 'roll' && (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'success.light' }}>
                  Rolled {msg.displayString || msg.rollString}:
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 'normal' }}>{msg.details}</Box> =
                  <Box component="strong" sx={{ fontSize: '1.1em', color: 'text.primary' }}>{msg.result}</Box>
                </Typography>
              )}

              {msg.type === 'secret_roll' && user?.role === 'DM' && ( // Only DM sees content of their secret rolls
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'warning.light' }}>
                  (Secret) Rolled {msg.displayString || msg.rollString}:
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 'normal' }}>{msg.details}</Box> =
                  <Box component="strong" sx={{ fontSize: '1.1em', color: 'text.primary' }}>{msg.result}</Box>
                </Typography>
              )}
              {msg.type === 'system_error' && <Typography variant="body2" color="error.light" sx={{ fontStyle: 'italic' }}>{msg.text}</Typography>}
            </Box>
          </ListItem>
        ))}
        <div ref={messagesEndRef} />
      </List>
      <Divider sx={{ flexShrink: 0 }} />
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 }}>
        <DiceRollButton diceType="d4" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d6" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d8" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d10" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d12" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d20" onRoll={handleQuickRoll} disabled={!isAuthenticatedOnSocket} />
        <DiceRollButton diceType="d%" onRoll={() => handleQuickRoll('d100')} disabled={!isAuthenticatedOnSocket} title="Roll d100" />
        {user?.role === 'DM' && <DiceRollButton diceType="d20" onRoll={(dice) => handleQuickRoll(dice, true)} isSecretRoll disabled={!isAuthenticatedOnSocket} title="Secret d20" />}
      </Box>
      <Box component="form" onSubmit={handleSendMessage} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {user?.role === 'DM' && (
          <FormControl sx={{ mr: 1, minWidth: 150 }} size="small" variant="outlined">
            <InputLabel>To</InputLabel>
            <Select
              label="To"
              value={whisperTargetUsername}
              onChange={(e) => setWhisperTargetUsername(e.target.value)}
              disabled={!isAuthenticatedOnSocket || !isConnected}
            >
              <MenuItem value=""><em>Party Chat</em></MenuItem>
              {allUsersForWhisper.map(u => (
                <MenuItem key={u.id || u.username} value={u.username}>{u.username}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder={isAuthenticatedOnSocket ? "Type message or /r XdY" : (isConnected ? "Authenticating chat..." : "Connecting...")}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!isAuthenticatedOnSocket || !isConnected}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton type="submit" color="primary" disabled={!isAuthenticatedOnSocket || !isConnected || !newMessage.trim()}>
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Box>
  );
}

export default ChatPanel;

// server.js - Node.js Server für PC-Audio-Streaming
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const { AudioRecorder } = require('node-audio-recorder');

// Express-App und HTTP-Server erstellen
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statische Dateien aus dem 'public' Verzeichnis bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Audio-Recorder Konfiguration
const options = {
  program: process.platform === 'win32' ? 'sox' : 'rec',  // sox für Windows, rec für Linux/macOS
  silence: 0,
  device: null, // Standard-Audio-Gerät
  thresholdStart: 0.5,
  thresholdStop: 0.5,
  keepSilence: true,
  audioType: 'wav'
};

// Audio-Recorder initialisieren
let audioRecorder = new AudioRecorder(options);
let isRecording = false;
let activeConnections = 0;

// Socket.IO Verbindungshandling
io.on('connection', (socket) => {
  console.log('Neue Client-Verbindung:', socket.id);
  activeConnections++;

  // Starte Audio-Aufnahme, wenn die erste Verbindung hergestellt wird
  if (activeConnections === 1) {
    startRecording();
  }

  // Auf Verbindungsabbruch reagieren
  socket.on('disconnect', () => {
    console.log('Client getrennt:', socket.id);
    activeConnections--;

    // Beende Audio-Aufnahme, wenn keine Verbindungen mehr bestehen
    if (activeConnections === 0) {
      stopRecording();
    }
  });
});

// Audio-Aufnahme starten
function startRecording() {
  if (isRecording) return;
  
  console.log('Starte Audio-Aufnahme...');
  isRecording = true;

  // Event-Handler für Audio-Daten
  audioRecorder.on('data', (data) => {
    // Audio-Daten an alle verbundenen Clients senden
    io.emit('audioData', {
      buffer: data,
      timestamp: Date.now()
    });
  });

  // Fehlerbehandlung
  audioRecorder.on('error', (error) => {
    console.error('Fehler bei der Audio-Aufnahme:', error);
  });

  // Audio-Aufnahme starten
  audioRecorder.start();
}

// Audio-Aufnahme beenden
function stopRecording() {
  if (!isRecording) return;
  
  console.log('Beende Audio-Aufnahme...');
  audioRecorder.stop();
  isRecording = false;
}

// HTML für die Client-Seite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  
  // Netzwerk-Schnittstellen anzeigen
  const networkInterfaces = os.networkInterfaces();
  console.log('\nZugriff im lokalen Netzwerk über:');
  
  Object.keys(networkInterfaces).forEach((ifname) => {
    networkInterfaces[ifname].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`http://${iface.address}:${PORT}`);
      }
    });
  });
});

// Ordnungsgemäßes Beenden bei Ctrl+C
process.on('SIGINT', () => {
  stopRecording();
  console.log('Server wird beendet...');
  process.exit(0);
});

// server.js - Node.js Server für Audio Streaming (Render-Version)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

// Express-App und HTTP-Server erstellen
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statische Dateien aus dem 'public' Verzeichnis bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Für Render: Dummy-Audio statt echter Aufnahme
// Dies simuliert Audiostreaming mit einem Sinuston
let activeConnections = 0;
let intervalId = null;

// Socket.IO Verbindungshandling
io.on('connection', (socket) => {
  console.log('Neue Client-Verbindung:', socket.id);
  activeConnections++;

  // Starte Audio-Simulation, wenn die erste Verbindung hergestellt wird
  if (activeConnections === 1) {
    startAudioSimulation();
  }

  // Auf Verbindungsabbruch reagieren
  socket.on('disconnect', () => {
    console.log('Client getrennt:', socket.id);
    activeConnections--;

    // Beende Audio-Simulation, wenn keine Verbindungen mehr bestehen
    if (activeConnections === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('Audio-Simulation gestoppt');
    }
  });
});

// Simuliere Audio-Daten für Render (da keine echte Audio-Aufnahme möglich ist)
function startAudioSimulation() {
  console.log('Starte Audio-Simulation für Render...');
  
  if (intervalId) return;
  
  // Sende alle 100ms Audio-Daten
  intervalId = setInterval(() => {
    // Erzeuge Testton (440 Hz Sinuswelle)
    const audioData = generateSineWave(440, 0.1);
    
    // Sende an alle Clients
    io.emit('audioData', {
      buffer: audioData,
      timestamp: Date.now()
    });
  }, 100);
}

// Generiert eine Sinuswelle als Beispielton
function generateSineWave(frequency = 440, duration = 0.1) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(numSamples * 2); // 16-bit
  const view = new DataView(buffer);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const amplitude = 0.5; // Lautstärke (0-1)
    const value = Math.sin(frequency * 2 * Math.PI * t) * amplitude;
    
    // Konvertieren zu 16-bit PCM
    const sample = Math.floor(value * 32767);
    view.setInt16(i * 2, sample, true); // true für little-endian
  }
  
  return buffer;
}

// HTML für die Client-Seite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

// Ordnungsgemäßes Beenden
process.on('SIGINT', () => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  console.log('Server wird beendet...');
  process.exit(0);
});

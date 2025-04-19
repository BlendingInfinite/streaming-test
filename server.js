// All-in-One Server mit eingebetteter HTML
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Express-App und HTTP-Server erstellen
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// HTML-Datei direkt im Code definieren
const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PC Audio Streaming</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            text-align: center;
            color: #2c3e50;
            margin-bottom: 30px;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status-box {
            margin: 20px 0;
            padding: 15px;
            border-radius: 4px;
            background-color: #f0f0f0;
            transition: background-color 0.3s;
        }
        .connected {
            background-color: #d5f5e3;
        }
        .disconnected {
            background-color: #fadbd8;
        }
        #status {
            font-weight: bold;
        }
        button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #2980b9;
        }
        button:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
        .controls {
            margin: 20px 0;
            display: flex;
            justify-content: center;
        }
        .volume-control {
            margin: 30px 0;
        }
        .volume-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        #volumeSlider {
            width: 100%;
            -webkit-appearance: none;
            height: 8px;
            border-radius: 4px;
            background: #ddd;
            outline: none;
        }
        #volumeSlider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3498db;
            cursor: pointer;
        }
        #volumeSlider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3498db;
            cursor: pointer;
            border: none;
        }
        .info {
            margin-top: 30px;
            padding: 15px;
            background-color: #eaf2f8;
            border-radius: 4px;
            font-size: 14px;
        }
        .loading {
            text-align: center;
            display: none;
        }
        .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #3498db;
            animation: spin 1s linear infinite;
            margin: 10px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .latency-info {
            text-align: center;
            margin-top: 10px;
            font-size: 14px;
            color: #7f8c8d;
        }

        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 15px;
            }
            h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <h1>PC Audio Streaming</h1>
    
    <div class="container">
        <div class="status-box" id="statusBox">
            <p>Status: <span id="status">Nicht verbunden</span></p>
        </div>
        
        <div class="controls">
            <button id="connectBtn">Verbinden</button>
            <button id="disconnectBtn" disabled>Trennen</button>
        </div>
        
        <div class="loading" id="loadingIndicator">
            <div class="spinner"></div>
            <p>Verbinde zum Server...</p>
        </div>
        
        <div class="volume-control" id="volumeControl" style="display: none;">
            <div class="volume-label">
                <span>Lautstärke:</span>
                <span id="volumeValue">100%</span>
            </div>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1">
        </div>
        
        <div class="latency-info" id="latencyInfo" style="display: none;">
            Latenz: <span id="latencyValue">-</span> ms
        </div>
        
        <div class="info">
            <h3>Hinweise:</h3>
            <ul>
                <li>Diese Demo erzeugt einen Testton (440 Hz).</li>
                <li>In der lokalen Version streamt sie den PC-Audio.</li>
                <li>Diese Anwendung funktioniert am besten in Chrome und Firefox.</li>
                <li>Für bessere Audioqualität verwenden Sie Kopfhörer.</li>
            </ul>
        </div>
    </div>
    
    <!-- Audio-Element für die Wiedergabe -->
    <audio id="audioElement" autoplay></audio>
    
    <script src="/socket.io/socket.io.js"></script>
    
    <script>
        // DOM-Elemente
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const statusElement = document.getElementById('status');
        const statusBox = document.getElementById('statusBox');
        const volumeControl = document.getElementById('volumeControl');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const audioElement = document.getElementById('audioElement');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const latencyInfo = document.getElementById('latencyInfo');
        const latencyValue = document.getElementById('latencyValue');
        
        // Globale Variablen
        let socket = null;
        let audioContext = null;
        let mediaSource = null;
        let audioQueue = [];
        let isPlaying = false;
        let lastTimestamp = 0;
        let latencyMeasurements = [];
        
        // Audio-Kontext erstellen
        function createAudioContext() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Auf iOS/Safari das Audio-Element mit dem Audio-Kontext verbinden
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                const source = audioContext.createMediaElementSource(audioElement);
                source.connect(audioContext.destination);
            }
        }
        
        // Mit dem Server verbinden
        connectBtn.addEventListener('click', () => {
            statusElement.textContent = 'Verbinde...';
            loadingIndicator.style.display = 'block';
            connectBtn.disabled = true;
            
            try {
                // Audio-Kontext erstellen
                if (!audioContext) {
                    createAudioContext();
                } else if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                
                // Mit Socket.IO verbinden
                socket = io();
                
                // Verbindung hergestellt
                socket.on('connect', () => {
                    statusElement.textContent = 'Verbunden - Warte auf Audio';
                    statusBox.className = 'status-box connected';
                    disconnectBtn.disabled = false;
                    volumeControl.style.display = 'block';
                    latencyInfo.style.display = 'block';
                    loadingIndicator.style.display = 'none';
                });
                
                // Audio-Daten empfangen
                socket.on('audioData', handleAudioData);
                
                // Verbindungsfehler
                socket.on('connect_error', (error) => {
                    console.error('Verbindungsfehler:', error);
                    statusElement.textContent = 'Verbindungsfehler: Server nicht erreichbar';
                    statusBox.className = 'status-box disconnected';
                    loadingIndicator.style.display = 'none';
                    connectBtn.disabled = false;
                });
                
                // Verbindung getrennt
                socket.on('disconnect', () => {
                    disconnect();
                });
                
            } catch (error) {
                console.error('Fehler beim Verbinden:', error);
                statusElement.textContent = 'Fehler: ' + error.message;
                statusBox.className = 'status-box disconnected';
                loadingIndicator.style.display = 'none';
                connectBtn.disabled = false;
            }
        });
        
        // Verbindung trennen
        disconnectBtn.addEventListener('click', disconnect);
        
        // Verbindung beenden
        function disconnect() {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.suspend();
            }
            
            audioQueue = [];
            isPlaying = false;
            
            statusElement.textContent = 'Getrennt';
            statusBox.className = 'status-box disconnected';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            volumeControl.style.display = 'none';
            latencyInfo.style.display = 'none';
        }
        
        // Audio-Daten verarbeiten
        function handleAudioData(data) {
            if (!audioContext) return;
            
            // Latenz berechnen
            const now = Date.now();
            const latency = now - data.timestamp;
            updateLatency(latency);
            
            // Audio-Daten in Array-Buffer konvertieren
            const arrayBuffer = new Uint8Array(data.buffer).buffer;
            
            // Audio decodieren
            audioContext.decodeAudioData(arrayBuffer)
                .then(audioBuffer => {
                    if (socket && socket.connected) {
                        playAudio(audioBuffer);
                        statusElement.textContent = 'Verbunden - Audio wird abgespielt';
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Decodieren der Audio-Daten:', error);
                });
        }
        
        // Audio abspielen
        function playAudio(audioBuffer) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Lautstärkeregler
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volumeSlider.value;
            
            // Verbindungen herstellen
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Abspielen
            source.start(0);
            isPlaying = true;
        }
        
        // Lautstärke einstellen
        volumeSlider.addEventListener('input', () => {
            const volume = volumeSlider.value;
            volumeValue.textContent = Math.round(volume * 100) + '%';
            
            // Wenn ein Audio-Element verwendet wird
            audioElement.volume = volume;
        });
        
        // Latenz aktualisieren
        function updateLatency(latency) {
            // Gleitender Durchschnitt für stabilere Anzeige
            latencyMeasurements.push(latency);
            if (latencyMeasurements.length > 10) {
                latencyMeasurements.shift();
            }
            
            const avgLatency = Math.round(
                latencyMeasurements.reduce((sum, value) => sum + value, 0) / latencyMeasurements.length
            );
            
            latencyValue.textContent = avgLatency;
            
            // Farbliche Markierung je nach Latenz
            if (avgLatency < 100) {
                latencyValue.style.color = 'green';
            } else if (avgLatency < 300) {
                latencyValue.style.color = 'orange';
            } else {
                latencyValue.style.color = 'red';
            }
        }
        
        // Seite geladen
        window.addEventListener('load', () => {
            // Prüfen, ob Audio-API unterstützt wird
            if (!window.AudioContext && !window.webkitAudioContext) {
                statusElement.textContent = 'Fehler: Audio API wird nicht unterstützt';
                statusBox.className = 'status-box disconnected';
                connectBtn.disabled = true;
                
                // Warnung anzeigen
                const warning = document.createElement('p');
                warning.textContent = 'Ihr Browser unterstützt die benötigten Audio-Funktionen nicht. Bitte verwenden Sie Chrome oder Firefox.';
                warning.style.color = 'red';
                statusBox.appendChild(warning);
            }
        });
    </script>
</body>
</html>`;

// Stelle sicher, dass das public-Verzeichnis existiert
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Speichere die HTML-Datei
fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);

// Statische Dateien aus dem 'public' Verzeichnis bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Für Render: Dummy-Audio statt echter Aufnahme
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

// Simuliere Audio-Daten für Render
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

// Route für die Hauptseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Die Anwendung ist unter http://localhost:${PORT} erreichbar`);
});

// Ordnungsgemäßes Beenden
process.on('SIGINT', () => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  console.log('Server wird beendet...');
  process.exit(0);
});

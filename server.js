// server.js - Audio-Streaming-Server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

// Express-App und HTTP-Server erstellen
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statische Dateien aus dem public-Verzeichnis
app.use(express.static(path.join(__dirname, 'public')));

// Aktive Verbindungen verwalten
const senders = new Map(); // Audio-Sender
const receivers = new Map(); // Audio-Empfänger
const rooms = new Map(); // Raum-Zuordnungen

// Socket.IO Verbindungshandling
io.on('connection', (socket) => {
 console.log('Neue Verbindung:', socket.id);

 // Client meldet sich als Audio-Sender an
 socket.on('register-sender', () => {
   console.log('Sender registriert:', socket.id);
   senders.set(socket.id, { socket, receivers: new Set() });
   
   // Erstelle einen Raumcode für den Sender
   const roomCode = generateRoomCode();
   rooms.set(roomCode, socket.id);
   
   // Sende Raumcode zurück an den Sender
   socket.emit('sender-ready', {
     roomCode: roomCode,
     serverUrl: getServerUrl(),
     senderId: socket.id
   });
 });

 // Client meldet sich als Audio-Empfänger an
 socket.on('join-room', (data) => {
   const { roomCode } = data;
   const senderId = rooms.get(roomCode);
   
   if (senderId && senders.has(senderId)) {
     console.log(`Empfänger ${socket.id} verbindet sich mit Sender ${senderId}`);
     
     // Registriere den Empfänger
     receivers.set(socket.id, { socket, senderId });
     
     // Füge den Empfänger zum Sender hinzu
     senders.get(senderId).receivers.add(socket.id);
     
     // Benachrichtige den Sender über den neuen Empfänger
     senders.get(senderId).socket.emit('receiver-joined', { receiverId: socket.id });
     
     // Benachrichtige den Empfänger über erfolgreiche Verbindung
     socket.emit('join-success', { senderId });
   } else {
     socket.emit('join-error', { error: 'Ungültiger Raumcode' });
   }
 });

 // Audio-Daten vom Sender zu allen Empfängern weiterleiten
 socket.on('audio-data', (data) => {
   if (senders.has(socket.id)) {
     const sender = senders.get(socket.id);
     
     // An alle verbundenen Empfänger senden
     sender.receivers.forEach(receiverId => {
       if (receivers.has(receiverId)) {
         receivers.get(receiverId).socket.emit('audio-data', data);
       }
     });
   }
 });

 // Debug-Event
 socket.on('debug-info', (data) => {
   console.log('Debug-Info von Client', socket.id, ':', data);
 });

 // Verbindungstrennung behandeln
 socket.on('disconnect', () => {
   console.log('Verbindung getrennt:', socket.id);
   
   // Falls ein Sender getrennt wurde
   if (senders.has(socket.id)) {
     const sender = senders.get(socket.id);
     
     // Alle Raumcodes dieses Senders entfernen
     for (const [code, id] of rooms.entries()) {
       if (id === socket.id) {
         rooms.delete(code);
       }
     }
     
     // Alle Empfänger benachrichtigen
     sender.receivers.forEach(receiverId => {
       if (receivers.has(receiverId)) {
         receivers.get(receiverId).socket.emit('sender-disconnected');
       }
     });
     
     senders.delete(socket.id);
   }
   
   // Falls ein Empfänger getrennt wurde
   if (receivers.has(socket.id)) {
     const receiver = receivers.get(socket.id);
     
     // Sender benachrichtigen, wenn vorhanden
     if (senders.has(receiver.senderId)) {
       senders.get(receiver.senderId).receivers.delete(socket.id);
       senders.get(receiver.senderId).socket.emit('receiver-disconnected', { receiverId: socket.id });
     }
     
     receivers.delete(socket.id);
   }
 });
});

// Hilfsfunktion für zufälligen 6-stelligen Raum-Code
function generateRoomCode() {
 let code;
 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Keine leicht zu verwechselnden Zeichen (0,O,1,I)
 
 // Stelle sicher, dass der Code einzigartig ist
 do {
   code = '';
   for (let i = 0; i < 6; i++) {
     code += chars.charAt(Math.floor(Math.random() * chars.length));
   }
 } while (rooms.has(code));
 
 return code;
}

// Server-URL ermitteln
function getServerUrl() {
 const PORT = process.env.PORT || 3000;
 
 // Bei Render oder ähnlichen Cloud-Diensten die Umgebungsvariable verwenden
 if (process.env.RENDER_EXTERNAL_URL) {
   return process.env.RENDER_EXTERNAL_URL;
 }
 
 // Lokale IP-Adresse finden
 const networkInterfaces = os.networkInterfaces();
 for (const ifaces of Object.values(networkInterfaces)) {
   for (const iface of ifaces) {
     if (iface.family === 'IPv4' && !iface.internal) {
       return `http://${iface.address}:${PORT}`;
     }
   }
 }
 
 return `http://localhost:${PORT}`;
}

// Hauptroute
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
 console.log(`Server läuft auf Port ${PORT}`);
 
 // Netzwerk-Schnittstellen anzeigen
 const networkInterfaces = os.networkInterfaces();
 console.log('\nZugriff im lokalen Netzwerk über:');
 
 Object.values(networkInterfaces).forEach((ifaces) => {
   ifaces.forEach((iface) => {
     if (iface.family === 'IPv4' && !iface.internal) {
       console.log(`http://${iface.address}:${PORT}`);
     }
   });
 });
});

// Fehlerbehandlung
process.on('uncaughtException', (error) => {
 console.error('Unbehandelte Ausnahme:', error);
});

process.on('unhandledRejection', (reason, promise) => {
 console.error('Unbehandelte Promise-Ablehnung:', reason);
});

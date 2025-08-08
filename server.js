const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const workRoutes = require('./routes/work');
const setupRoutes = require('./routes/setup');
const whatsappService = require('./services/whatsapp');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/work-dashboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/work', workRoutes);
app.use('/setup', setupRoutes);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Initialize WhatsApp service with error handling
try {
  console.log('Attempting to initialize WhatsApp service...');
  whatsappService.initialize(io);
} catch (error) {
  console.error('WhatsApp service initialization failed:', error);
  console.log('Application will continue without WhatsApp integration');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
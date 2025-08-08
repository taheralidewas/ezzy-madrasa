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

// Quick setup endpoint for creating users
app.post('/api/setup-users', async (req, res) => {
  try {
    const User = require('./models/User');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@ezzymadrasa.com' });
    if (existingAdmin) {
      return res.json({ 
        success: false,
        message: 'Users already exist. You can login with admin@ezzymadrasa.com / admin123'
      });
    }

    // Clear existing users
    await User.deleteMany({});
    
    // Create Admin User
    const adminUser = new User({
      name: 'Ezzy Madrasa Admin',
      email: 'admin@ezzymadrasa.com',
      password: 'admin123',
      role: 'admin',
      phone: '919876543210',
      department: 'Administration'
    });

    // Create members
    const members = [
      {
        name: 'Ali Akbar Bhai',
        email: 'ali.akbar@ezzymadrasa.com',
        password: 'member123',
        role: 'member',
        phone: '917888177802',
        department: 'Education'
      },
      {
        name: 'Juzer Bhai',
        email: 'juzer@ezzymadrasa.com',
        password: 'member123',
        role: 'member',
        phone: '919920929383',
        department: 'Education'
      },
      {
        name: 'Taher Bhai Umrethwala',
        email: 'taher.umrethwala@ezzymadrasa.com',
        password: 'member123',
        role: 'member',
        phone: '919702973900',
        department: 'Education'
      },
      {
        name: 'Kausa Bhai',
        email: 'kausa@ezzymadrasa.com',
        password: 'member123',
        role: 'member',
        phone: '919224604059',
        department: 'Education'
      },
      {
        name: 'Taher Bhai Shajapurwala',
        email: 'taher.shajapurwala@ezzymadrasa.com',
        password: 'member123',
        role: 'member',
        phone: '918770576053',
        department: 'Education'
      }
    ];

    // Save admin user
    await adminUser.save();
    
    // Save all members
    for (const memberData of members) {
      const member = new User(memberData);
      await member.save();
    }
    
    res.json({
      success: true,
      message: 'All users created successfully!',
      admin: { email: 'admin@ezzymadrasa.com', password: 'admin123' },
      membersCount: members.length,
      memberPassword: 'member123'
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create users: ' + error.message 
    });
  }
});

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
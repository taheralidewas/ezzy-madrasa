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

// Database connection with better configuration
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/work-dashboard';
    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in logs
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000
    });
    
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Full error:', error);
    // Don't exit the process, let the app continue without DB for now
  }
};

// Connect to database
connectDB();

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🚨 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/work', workRoutes);
app.use('/setup', setupRoutes);

// Database status endpoint for debugging
app.get('/api/db-status', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: states[dbState] || 'unknown',
    readyState: dbState,
    mongoURI: process.env.MONGODB_URI ? 'configured' : 'not configured',
    host: mongoose.connection.host,
    name: mongoose.connection.name
  });
});

// WhatsApp status and control endpoints
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappService.getStatus());
});

app.post('/api/whatsapp/restart', (req, res) => {
  try {
    whatsappService.forceRestart();
    res.json({ success: true, message: 'WhatsApp client restart initiated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoint to manually trigger WhatsApp initialization
app.post('/api/whatsapp/init', (req, res) => {
  try {
    console.log('Manual WhatsApp initialization triggered');
    whatsappService.initialize(io);
    res.json({ success: true, message: 'WhatsApp initialization triggered' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to reset WhatsApp service completely (get out of fallback mode)
app.post('/api/whatsapp/reset', (req, res) => {
  try {
    console.log('Complete WhatsApp service reset triggered');
    whatsappService.resetService();
    // Initialize after reset
    setTimeout(() => {
      whatsappService.initialize(io);
    }, 1000);
    res.json({ success: true, message: 'WhatsApp service reset and reinitialized' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Diagnostic endpoint for WhatsApp troubleshooting
app.get('/api/whatsapp/diagnostics', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        nodeEnv: process.env.NODE_ENV,
        disableWhatsApp: process.env.DISABLE_WHATSAPP,
        puppeteerPath: process.env.PUPPETEER_EXECUTABLE_PATH
      },
      whatsappService: whatsappService.getDetailedStatus(),
      directories: {
        authExists: fs.existsSync('.wwebjs_auth'),
        cacheExists: fs.existsSync('.wwebjs_cache'),
        nodeModulesExists: fs.existsSync('node_modules'),
        puppeteerExists: fs.existsSync('node_modules/puppeteer')
      },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    // Check for common issues
    diagnostics.issues = [];
    
    if (!diagnostics.directories.nodeModulesExists) {
      diagnostics.issues.push('node_modules directory missing - run npm install');
    }
    
    if (!diagnostics.directories.puppeteerExists) {
      diagnostics.issues.push('Puppeteer not installed - run npm install puppeteer');
    }
    
    if (diagnostics.memory.heapUsed > 500 * 1024 * 1024) {
      diagnostics.issues.push('High memory usage detected');
    }
    
    console.log('WhatsApp Diagnostics:', JSON.stringify(diagnostics, null, 2));
    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate diagnostics: ' + error.message,
      error: error.stack
    });
  }
});

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
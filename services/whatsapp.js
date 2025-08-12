const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.io = null;
    this.initializationAttempts = 0;
    this.maxRetries = 3;
    this.isInitializing = false;
    this.fallbackMode = false;
    this.qrGenerationStartTime = null;
  }

  // Method to clear old session data for faster QR generation
  clearSessionData() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const sessionPath = path.join(process.cwd(), '.wwebjs_auth');
      const cachePath = path.join(process.cwd(), '.wwebjs_cache');
      
      // Clear session data
      if (fs.existsSync(sessionPath)) {
        console.log('Clearing old WhatsApp session data...');
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('Session data cleared successfully');
        } catch (error) {
          console.log('Could not clear session data completely:', error.message);
          // Try to clear individual files
          try {
            const files = fs.readdirSync(sessionPath, { recursive: true });
            files.forEach(file => {
              try {
                const filePath = path.join(sessionPath, file);
                if (fs.statSync(filePath).isFile()) {
                  fs.unlinkSync(filePath);
                }
              } catch (e) {
                // Ignore individual file errors
              }
            });
          } catch (e) {
            console.log('Could not clear individual files');
          }
        }
      }
      
      // Clear cache data
      if (fs.existsSync(cachePath)) {
        console.log('Clearing WhatsApp cache...');
        try {
          fs.rmSync(cachePath, { recursive: true, force: true });
          console.log('Cache cleared successfully');
        } catch (error) {
          console.log('Could not clear cache:', error.message);
        }
      }
    } catch (error) {
      console.log('Error in clearSessionData:', error.message);
    }
  }

  initialize(io) {
    // Skip WhatsApp initialization in production if environment variable is set or if in containerized environment
    if (process.env.DISABLE_WHATSAPP === 'true' || process.env.NODE_ENV === 'production') {
      console.log('WhatsApp integration disabled in production environment');
      this.fallbackMode = true;
      if (io) {
        io.emit('whatsapp-disabled', 'WhatsApp integration is disabled in production for stability');
      }
      return;
    }

    if (this.isInitializing) {
      console.log('WhatsApp initialization already in progress...');
      return;
    }

    this.io = io;
    this.initializationAttempts++;
    this.isInitializing = true;
    
    console.log(`Initializing WhatsApp client (attempt ${this.initializationAttempts}/${this.maxRetries})...`);
    
    // Notify frontend that initialization started
    if (this.io) {
      this.io.emit('whatsapp-initializing', 'Starting WhatsApp service... This may take a moment.');
    }
    
    // Set a timeout to prevent hanging initialization
    const initTimeout = setTimeout(() => {
      console.log('WhatsApp initialization timeout - enabling fallback mode');
      this.fallbackMode = true;
      this.isInitializing = false;
      if (this.io) {
        this.io.emit('whatsapp-timeout', 'WhatsApp initialization timed out. Please try restarting the service.');
      }
    }, 45000); // Reduced timeout for faster feedback

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: '.wwebjs_auth'
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          timeout: 25000, // Faster timeout
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-preconnect',
            '--disable-sync',
            '--no-default-browser-check',
            '--no-pings',
            '--media-cache-size=1',
            '--disk-cache-size=1'
          ]
        },
        qrMaxRetries: 2, // Reduced retries for faster feedback
        takeoverOnConflict: true,
        takeoverTimeoutMs: 8000 // Faster takeover
      });

      // Clear timeout on successful initialization
      this.client.on('ready', () => {
        clearTimeout(initTimeout);
        this.isInitializing = false;
      });

    this.client.on('qr', (qr) => {
      console.log('✅ WhatsApp QR Code generated successfully');
      console.log('QR Code length:', qr.length);
      console.log('QR Code preview:', qr.substring(0, 50) + '...');
      
      // Generate QR in terminal for debugging
      try {
        qrcode.generate(qr, { small: true });
      } catch (terminalError) {
        console.log('Terminal QR generation failed:', terminalError.message);
      }
      
      // Send QR to frontend immediately
      if (this.io) {
        this.io.emit('whatsapp-qr', qr);
        console.log('✅ QR code sent to frontend via socket');
        
        // Also send a status update
        this.io.emit('whatsapp-status-update', {
          status: 'qr-ready',
          message: 'QR Code generated successfully. Please scan with your phone.',
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ Socket.io not available - cannot send QR to frontend');
      }
    });

    this.client.on('ready', async () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      
      // Set business profile name
      try {
        const info = this.client.info;
        console.log('WhatsApp connected as:', info.pushname || info.wid.user);
        console.log('Setting up business profile...');
      } catch (error) {
        console.log('Could not get WhatsApp info:', error.message);
      }
      
      if (this.io) {
        this.io.emit('whatsapp-ready');
      }
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp authentication failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason);
      this.isReady = false;
      
      if (this.io) {
        this.io.emit('whatsapp-disconnected', reason);
      }
      
      // Auto-retry connection if disconnected unexpectedly
      if (this.initializationAttempts < this.maxRetries) {
        console.log('Attempting to reconnect WhatsApp...');
        setTimeout(() => {
          this.initialize(this.io);
        }, 5000);
      }
    });

    // Handle incoming messages for task completion
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error handling incoming message:', error);
      }
    });

    // Add error handling for initialization
    this.client.on('loading_screen', (percent, message) => {
      console.log('WhatsApp loading:', percent, message);
    });

    // Add more detailed error event handlers
    this.client.on('change_state', (state) => {
      console.log('WhatsApp state changed:', state);
      if (this.io) {
        this.io.emit('whatsapp-state-change', state);
      }
    });

    this.client.on('change_battery', (batteryInfo) => {
      console.log('WhatsApp battery info:', batteryInfo);
    });

    // Handle initialization errors with detailed logging
    this.client.initialize().catch((error) => {
      clearTimeout(initTimeout);
      this.isInitializing = false;
      
      console.error('❌ WhatsApp initialization error:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Check for specific error types
      let errorType = 'unknown';
      let userMessage = 'Failed to initialize WhatsApp';
      
      if (error.message.includes('Chromium revision is not downloaded')) {
        errorType = 'chromium-missing';
        userMessage = 'Chromium browser not found. Please install dependencies.';
        console.error('🔧 Solution: Run "npm install" or install Chromium manually');
      } else if (error.message.includes('Navigation timeout')) {
        errorType = 'navigation-timeout';
        userMessage = 'WhatsApp Web took too long to load. Please try again.';
        console.error('🔧 Solution: Check internet connection and try restarting');
      } else if (error.message.includes('Protocol error')) {
        errorType = 'protocol-error';
        userMessage = 'Browser protocol error. Try clearing session data.';
        console.error('🔧 Solution: Clear .wwebjs_auth folder and restart');
      } else if (error.message.includes('ECONNREFUSED')) {
        errorType = 'connection-refused';
        userMessage = 'Cannot connect to WhatsApp servers. Check internet connection.';
        console.error('🔧 Solution: Check internet connection and firewall settings');
      }
      
      // Send detailed error to frontend
      if (this.io) {
        this.io.emit('whatsapp-detailed-error', {
          type: errorType,
          message: userMessage,
          originalError: error.message,
          attempt: this.initializationAttempts,
          maxRetries: this.maxRetries,
          timestamp: new Date().toISOString()
        });
      }
      
      if (this.initializationAttempts < this.maxRetries) {
        console.log(`🔄 Retrying WhatsApp initialization in 10 seconds... (${this.initializationAttempts}/${this.maxRetries})`);
        if (this.io) {
          this.io.emit('whatsapp-retry', {
            attempt: this.initializationAttempts,
            maxRetries: this.maxRetries,
            nextRetryIn: 10
          });
        }
        setTimeout(() => {
          this.initialize(this.io);
        }, 10000);
      } else {
        console.error('❌ Max WhatsApp initialization attempts reached. Enabling fallback mode.');
        this.fallbackMode = true;
        if (this.io) {
          this.io.emit('whatsapp-error', `Failed to initialize after ${this.maxRetries} attempts: ${userMessage}`);
        }
      }
    });

    } catch (error) {
      clearTimeout(initTimeout);
      this.isInitializing = false;
      console.error('WhatsApp client creation error:', error);
      this.fallbackMode = true;
      if (this.io) {
        this.io.emit('whatsapp-error', 'WhatsApp client creation failed');
      }
    }
  }

  async sendMessage(phoneNumber, message) {
    if (this.fallbackMode) {
      console.log(`WhatsApp in fallback mode - would send to ${phoneNumber}: ${message.substring(0, 50)}...`);
      return true; // Return true to not break the workflow
    }

    if (!this.isReady) {
      console.log('WhatsApp client not ready, message queued');
      return false;
    }

    try {
      // Format phone number (remove any non-digits and add country code if needed)
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Add country code if not present (assuming India +91, modify as needed)
      if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
        formattedNumber = '91' + formattedNumber;
      }
      
      const chatId = formattedNumber + '@c.us';
      
      await this.client.sendMessage(chatId, message);
      console.log(`Message sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  async handleIncomingMessage(message) {
    // Only process text messages from users (not groups or status)
    if (message.type !== 'chat' || message.from.includes('@g.us')) {
      return;
    }

    const messageText = message.body.toLowerCase().trim();
    const senderPhone = message.from.replace('@c.us', '');
    
    // Check if message contains completion keywords
    const completionKeywords = ['completed', 'complete', 'done', 'finished', 'finish', 'khatam', 'mukammal'];
    const isCompletionMessage = completionKeywords.some(keyword => messageText.includes(keyword));
    
    if (isCompletionMessage) {
      console.log(`Completion message received from ${senderPhone}: ${message.body}`);
      
      // Import here to avoid circular dependency
      const User = require('../models/User');
      const Work = require('../models/Work');
      
      try {
        // Find user by phone number
        const user = await User.findOne({ phone: { $regex: senderPhone } });
        if (!user) {
          console.log(`User not found for phone: ${senderPhone}`);
          return;
        }
        
        // Find pending work assigned to this user
        const pendingWork = await Work.findOne({
          assignedTo: user._id,
          status: { $in: ['pending', 'in-progress'] }
        }).populate(['assignedBy', 'assignedTo']).sort({ createdAt: -1 });
        
        if (pendingWork) {
          // Mark work as completed
          pendingWork.status = 'completed';
          pendingWork.completedAt = new Date();
          await pendingWork.save();
          
          console.log(`Work "${pendingWork.title}" marked as completed by ${user.name}`);
          
          // Send confirmation to member
          const confirmationMessage = `*Ezzy Madrasa Task* 📚\n` +
                                    `✅ Task Completed Successfully!\n\n` +
                                    `📋 Task: ${pendingWork.title}\n` +
                                    `🎉 Thank you for completing the task!\n\n` +
                                    `_- Ezzy Madrasa Management System_`;
          
          await this.sendMessage(user.phone, confirmationMessage);
          
          // Notify the assigner
          const assignerUser = await User.findById(pendingWork.assignedBy);
          if (assignerUser) {
            const assignerMessage = `*Ezzy Madrasa Task* 📚\n` +
                                  `📊 Work Status Update\n\n` +
                                  `📋 Task: ${pendingWork.title}\n` +
                                  `👤 Completed by: ${user.name}\n` +
                                  `🔄 Status: COMPLETED\n` +
                                  `📅 Completed: ${new Date().toLocaleString()}\n\n` +
                                  `_- Ezzy Madrasa Management System_`;
            
            await this.sendMessage(assignerUser.phone, assignerMessage);
          }
          
          // Emit socket event for real-time dashboard update
          if (this.io) {
            this.io.emit('work-completed', {
              workId: pendingWork._id,
              completedBy: user.name,
              title: pendingWork.title
            });
          }
          
        } else {
          // No pending work found
          const noWorkMessage = `*Ezzy Madrasa Task* 📚\n` +
                               `ℹ️ No pending tasks found for completion.\n\n` +
                               `Please check your dashboard for current assignments.\n\n` +
                               `_- Ezzy Madrasa Management System_`;
          
          await this.sendMessage(user.phone, noWorkMessage);
        }
        
      } catch (error) {
        console.error('Error processing completion message:', error);
      }
    }
  }

  // Method to force restart WhatsApp client for faster QR generation
  async forceRestart() {
    console.log('Force restarting WhatsApp client...');
    
    // Clear session data first
    this.clearSessionData();
    
    // Reset ALL state variables
    this.isReady = false;
    this.isInitializing = false;
    this.initializationAttempts = 0;
    this.fallbackMode = false; // This is crucial!
    this.qrGenerationStartTime = null;
    
    // Destroy existing client
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.log('Error destroying client:', error.message);
      }
      this.client = null;
    }
    
    // Notify frontend that we're restarting
    if (this.io) {
      this.io.emit('whatsapp-initializing', 'Restarting WhatsApp service...');
    }
    
    // Reinitialize after a short delay
    setTimeout(() => {
      console.log('Starting fresh WhatsApp initialization...');
      this.initialize(this.io);
    }, 2000);
  }

  // Method to completely reset WhatsApp service
  resetService() {
    console.log('Resetting WhatsApp service completely...');
    
    // Reset all state
    this.isReady = false;
    this.isInitializing = false;
    this.initializationAttempts = 0;
    this.fallbackMode = false;
    this.qrGenerationStartTime = null;
    this.client = null;
    
    // Clear session data
    this.clearSessionData();
    
    console.log('WhatsApp service reset complete');
  }

  getStatus() {
    return {
      isReady: this.isReady,
      clientState: this.client ? this.client.info : null,
      isInitializing: this.isInitializing,
      fallbackMode: this.fallbackMode
    };
  }

  getDetailedStatus() {
    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      fallbackMode: this.fallbackMode,
      initializationAttempts: this.initializationAttempts,
      maxRetries: this.maxRetries,
      qrGenerationStartTime: this.qrGenerationStartTime,
      clientExists: !!this.client,
      clientState: this.client ? {
        info: this.client.info || null,
        pupPage: !!this.client.pupPage,
        pupBrowser: !!this.client.pupBrowser
      } : null,
      lastError: this.lastError || null,
      serviceStartTime: this.serviceStartTime || new Date().toISOString()
    };
  }
}

module.exports = new WhatsAppService();
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
    // Check if we're in Railway production environment
    const isRailwayProduction = process.env.RAILWAY_ENVIRONMENT === 'production' || 
                               process.env.NODE_ENV === 'production' ||
                               process.env.RAILWAY_PROJECT_ID;
    
    // Allow WhatsApp in production if explicitly enabled
    const enableInProduction = process.env.ENABLE_WHATSAPP_PRODUCTION === 'true';
    
    // Disable WhatsApp in Railway production for stability
    if (isRailwayProduction) {
      console.log('📱 WhatsApp disabled in Railway production for stability');
      this.fallbackMode = true;
      if (io) {
        io.emit('whatsapp-disabled', `
          <div class="alert alert-info">
            <h5><i class="fab fa-whatsapp text-success"></i> WhatsApp Integration Status</h5>
            <hr>
            <p><strong>✅ Production Mode:</strong> Your task management system is fully operational!</p>
            <div class="row">
              <div class="col-md-6">
                <p><strong>🚀 Working Features:</strong></p>
                <ul class="mb-2">
                  <li>✅ Task assignment and management</li>
                  <li>✅ User dashboard and progress tracking</li>
                  <li>✅ Real-time updates via web interface</li>
                  <li>✅ Reports and analytics</li>
                  <li>✅ Member performance tracking</li>
                </ul>
              </div>
              <div class="col-md-6">
                <p><strong>📱 For WhatsApp QR Code:</strong></p>
                <div class="alert alert-success">
                  <strong>Local Development Setup:</strong><br>
                  <code>git clone [your-repo]</code><br>
                  <code>npm install</code><br>
                  <code>npm start</code><br>
                  <small>Visit http://localhost:3000 - WhatsApp works perfectly!</small>
                </div>
              </div>
            </div>
            <div class="mt-3">
              <small class="text-muted">
                <i class="fas fa-info-circle"></i> 
                <strong>Why local for WhatsApp?</strong> Browser automation (Puppeteer) works best in local environments. 
                All core business features work perfectly in production!
              </small>
            </div>
          </div>
        `);
      }
      return;
    }
    
    // Skip WhatsApp initialization only if explicitly disabled
    if (process.env.DISABLE_WHATSAPP === 'true' || isRailwayProduction) {

      console.log('WhatsApp integration disabled by environment variable');
      this.fallbackMode = true;
      if (io) {
        io.emit('whatsapp-disabled', 'WhatsApp integration is disabled');
      }
      return;
    }
    
    // Log if we're enabling WhatsApp in production
    if (isRailwayProduction && enableInProduction) {
      console.log('🚀 WhatsApp enabled in Railway production environment');
    }

    if (this.isInitializing) {
      console.log('WhatsApp initialization already in progress...');
      return;
    }

    this.io = io;
    this.initializationAttempts++;
    this.isInitializing = true;
    
    console.log(`🚀 Starting WhatsApp client (attempt ${this.initializationAttempts}/${this.maxRetries})...`);
    
    // Clear old session data first for fresh start
    this.clearSessionData();
    
    // Notify frontend that initialization started
    if (this.io) {
      this.io.emit('whatsapp-initializing', 'Starting WhatsApp service...');
    }

    try {
      // Railway/Production optimized Puppeteer configuration
      const puppeteerConfig = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Important for Railway
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ]
      };

      // Try to find Chromium executable in Railway/Nixpacks environment
      const fs = require('fs');
      const { execSync } = require('child_process');
      
      // First try environment variable
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log(`🚀 Using Chromium from env: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      } else {
        // For Nixpacks/Railway, try to find Chromium using which command first
        try {
          const chromiumPath = execSync('which chromium', { encoding: 'utf8' }).trim();
          if (chromiumPath && fs.existsSync(chromiumPath)) {
            puppeteerConfig.executablePath = chromiumPath;
            console.log(`🚀 Found Chromium via which: ${chromiumPath}`);
          }
        } catch (error) {
          console.log('Could not find Chromium via which command, trying standard paths...');
          
          // Fallback to common locations
          const possiblePaths = [
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser', 
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome'
          ];

          for (const path of possiblePaths) {
            try {
              if (fs.existsSync(path)) {
                puppeteerConfig.executablePath = path;
                console.log(`🚀 Found Chromium at: ${path}`);
                break;
              }
            } catch (error) {
              // Continue to next path
            }
          }
        }
        
        // If still not found, log available browsers for debugging
        if (!puppeteerConfig.executablePath) {
          try {
            console.log('🔍 Debugging: Available browsers in system:');
            const browsers = execSync('ls -la /usr/bin/*chrom* /usr/bin/*firefox* 2>/dev/null || echo "No browsers found"', { encoding: 'utf8' });
            console.log(browsers);
            
            // Try to find any Nix store chromium
            const nixChromium = execSync('find /nix/store -name "chromium" -type f 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
            if (nixChromium && fs.existsSync(nixChromium)) {
              puppeteerConfig.executablePath = nixChromium;
              console.log(`🚀 Found Nix Chromium: ${nixChromium}`);
            }
          } catch (error) {
            console.log('Could not debug browser locations');
          }
        }
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: '.wwebjs_auth'
        }),
        puppeteer: puppeteerConfig,
        qrMaxRetries: 3
      });

    this.client.on('qr', (qr) => {
      console.log('✅ WhatsApp QR Code generated successfully');
      console.log('QR Code length:', qr.length);
      console.log('QR Code preview:', qr.substring(0, 50) + '...');
      console.log('🚀 Railway Production - QR Code ready for frontend');
      
      // Generate QR in terminal for debugging (skip in production to save resources)
      if (process.env.NODE_ENV !== 'production') {
        try {
          qrcode.generate(qr, { small: true });
        } catch (terminalError) {
          console.log('Terminal QR generation failed:', terminalError.message);
        }
      }
      
      // Send QR to frontend immediately
      if (this.io) {
        this.io.emit('whatsapp-qr', qr);
        console.log('✅ QR code sent to frontend via socket (Railway Production)');
        
        // Also send a status update
        this.io.emit('whatsapp-status-update', {
          status: 'qr-ready',
          message: 'QR Code generated successfully. Please scan with your phone.',
          timestamp: new Date().toISOString(),
          environment: 'Railway Production'
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

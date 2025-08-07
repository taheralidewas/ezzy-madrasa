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
  }

  initialize(io) {
    // Skip WhatsApp initialization in production if environment variable is set
    if (process.env.DISABLE_WHATSAPP === 'true') {
      console.log('WhatsApp integration disabled via environment variable');
      this.fallbackMode = true;
      if (io) {
        io.emit('whatsapp-disabled', 'WhatsApp integration is disabled');
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
    
    // Set a timeout to prevent hanging initialization
    const initTimeout = setTimeout(() => {
      console.log('WhatsApp initialization timeout - enabling fallback mode');
      this.fallbackMode = true;
      this.isInitializing = false;
      if (this.io) {
        this.io.emit('whatsapp-timeout', 'WhatsApp initialization timed out');
      }
    }, 120000); // 2 minutes timeout

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: '.wwebjs_auth'
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          timeout: 60000,
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
            '--disable-plugins'
          ]
        }
      });

      // Clear timeout on successful initialization
      this.client.on('ready', () => {
        clearTimeout(initTimeout);
        this.isInitializing = false;
      });

    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code:');
      qrcode.generate(qr, { small: true });
      
      // Send QR to frontend
      if (this.io) {
        this.io.emit('whatsapp-qr', qr);
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

    // Handle initialization errors
    this.client.initialize().catch((error) => {
      clearTimeout(initTimeout);
      this.isInitializing = false;
      console.error('WhatsApp initialization error:', error);
      
      if (this.initializationAttempts < this.maxRetries) {
        console.log(`Retrying WhatsApp initialization in 10 seconds... (${this.initializationAttempts}/${this.maxRetries})`);
        setTimeout(() => {
          this.initialize(this.io);
        }, 10000);
      } else {
        console.error('Max WhatsApp initialization attempts reached. Enabling fallback mode.');
        this.fallbackMode = true;
        if (this.io) {
          this.io.emit('whatsapp-error', 'Failed to initialize after multiple attempts');
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

  getStatus() {
    return {
      isReady: this.isReady,
      clientState: this.client ? this.client.info : null
    };
  }
}

module.exports = new WhatsAppService();
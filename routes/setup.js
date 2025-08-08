const express = require('express');
const User = require('../models/User');

const router = express.Router();

// One-time setup route to create all users
router.post('/create-users', async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@ezzymadrasa.com' });
    if (existingAdmin) {
      return res.status(400).json({ 
        message: 'Users already exist. Setup has already been completed.',
        loginUrl: '/login'
      });
    }

    // Clear existing users (just in case)
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

    // Create all the members with their actual WhatsApp numbers
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
    const savedMembers = [];
    for (const memberData of members) {
      const member = new User(memberData);
      await member.save();
      savedMembers.push({
        name: member.name,
        email: member.email,
        phone: member.phone
      });
    }
    
    res.json({
      success: true,
      message: 'All users created successfully!',
      admin: {
        email: 'admin@ezzymadrasa.com',
        password: 'admin123'
      },
      members: savedMembers,
      memberPassword: 'member123',
      nextSteps: [
        'Users have been created successfully',
        'You can now login with the admin credentials',
        'Admin can assign tasks to team members',
        'Connect WhatsApp for notifications'
      ]
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create users: ' + error.message 
    });
  }
});

// Setup page
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ezzy Madrasa Setup</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h3 class="mb-0">🕌 Ezzy Madrasa Setup</h3>
                        </div>
                        <div class="card-body">
                            <p>Click the button below to create all default users for the Ezzy Madrasa Task Management System.</p>
                            
                            <div class="alert alert-info">
                                <h5>👤 Admin Credentials (after setup):</h5>
                                <ul>
                                    <li><strong>Email:</strong> admin@ezzymadrasa.com</li>
                                    <li><strong>Password:</strong> admin123</li>
                                </ul>
                            </div>
                            
                            <div class="alert alert-warning">
                                <h5>👥 Member Credentials (after setup):</h5>
                                <p>All members use password: <strong>member123</strong></p>
                            </div>
                            
                            <button id="setupBtn" class="btn btn-success btn-lg" onclick="createUsers()">
                                🚀 Create All Users
                            </button>
                            
                            <div id="result" class="mt-4"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
        async function createUsers() {
            const btn = document.getElementById('setupBtn');
            const result = document.getElementById('result');
            
            btn.disabled = true;
            btn.innerHTML = '⏳ Creating users...';
            
            try {
                const response = await fetch('/setup/create-users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = \`
                        <div class="alert alert-success">
                            <h4>✅ Setup Complete!</h4>
                            <p>\${data.message}</p>
                            <hr>
                            <h5>👤 Admin Login:</h5>
                            <ul>
                                <li>Email: \${data.admin.email}</li>
                                <li>Password: \${data.admin.password}</li>
                            </ul>
                            <h5>👥 Members:</h5>
                            <ul>
                                \${data.members.map(member => \`<li>\${member.name}: \${member.email}</li>\`).join('')}
                            </ul>
                            <p><strong>All members password:</strong> \${data.memberPassword}</p>
                            <hr>
                            <a href="/" class="btn btn-primary">🏠 Go to Login Page</a>
                        </div>
                    \`;
                } else {
                    result.innerHTML = \`
                        <div class="alert alert-warning">
                            <h4>⚠️ Setup Status</h4>
                            <p>\${data.message}</p>
                            <a href="/" class="btn btn-primary">🏠 Go to Login Page</a>
                        </div>
                    \`;
                }
            } catch (error) {
                result.innerHTML = \`
                    <div class="alert alert-danger">
                        <h4>❌ Setup Failed</h4>
                        <p>Error: \${error.message}</p>
                        <p>Please check your database connection and try again.</p>
                    </div>
                \`;
            }
            
            btn.disabled = false;
            btn.innerHTML = '🚀 Create All Users';
        }
        </script>
    </body>
    </html>
  `);
});

module.exports = router;
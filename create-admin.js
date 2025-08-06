const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/work-dashboard');
    
    // Clear existing users
    await User.deleteMany({});
    
    // Create Admin User
    const adminUser = new User({
      name: 'Ezzy Madrasa Admin',
      email: 'admin@ezzymadrasa.com',
      password: 'admin123',
      role: 'admin',
      phone: '919876543210', // Admin's WhatsApp number
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
    for (const memberData of members) {
      const member = new User(memberData);
      await member.save();
    }
    
    console.log('✅ Ezzy Madrasa users created successfully!\n');
    console.log('👤 Admin Login:');
    console.log('   Email: admin@ezzymadrasa.com');
    console.log('   Password: admin123\n');
    
    console.log('👥 Members created:');
    members.forEach(member => {
      console.log(`   📱 ${member.name}: ${member.email} (${member.phone})`);
    });
    
    console.log('\n🎯 All members can login with password: member123');
    console.log('📱 WhatsApp notifications will be sent to their actual numbers');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating users:', error.message);
    process.exit(1);
  }
}

createUsers();
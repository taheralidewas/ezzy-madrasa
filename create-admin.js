const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

/**
 * Ezzy Madrasa User Creation Script
 * 
 * This script creates default users for the Ezzy Madrasa Task Management System.
 * It includes one admin user and all team members with their actual WhatsApp numbers.
 * 
 * Usage: node create-admin.js
 */

async function createUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/work-dashboard');
    
    console.log('🗑️  Clearing existing users...');
    await User.deleteMany({});
    
    console.log('👤 Creating Admin User...');
    // Create Admin User
    const adminUser = new User({
      name: 'Ezzy Madrasa Admin',
      email: 'admin@ezzymadrasa.com',
      password: 'admin123',
      role: 'admin',
      phone: '919876543210', // Admin's WhatsApp number
      department: 'Administration'
    });

    console.log('👥 Creating Team Members...');
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
    console.log('✅ Admin user created successfully');
    
    // Save all members
    console.log('💾 Saving team members...');
    for (const memberData of members) {
      const member = new User(memberData);
      await member.save();
      console.log(`   ✅ ${memberData.name} created`);
    }
    
    console.log('\n🎉 Ezzy Madrasa users created successfully!\n');
    console.log('=' .repeat(60));
    console.log('👤 ADMIN LOGIN CREDENTIALS:');
    console.log('=' .repeat(60));
    console.log('   📧 Email: admin@ezzymadrasa.com');
    console.log('   🔑 Password: admin123');
    console.log('   🌐 Live URL: https://ezzy-madrasa-production-up.railway.app\n');
    
    console.log('=' .repeat(60));
    console.log('👥 TEAM MEMBERS CREATED:');
    console.log('=' .repeat(60));
    members.forEach(member => {
      console.log(`   📱 ${member.name}`);
      console.log(`      📧 Email: ${member.email}`);
      console.log(`      📞 Phone: ${member.phone}`);
      console.log('');
    });
    
    console.log('🎯 All members can login with password: member123');
    console.log('📱 WhatsApp notifications will be sent to their actual numbers');
    console.log('\n💡 Next Steps:');
    console.log('   1. Visit: https://ezzy-madrasa-production-up.railway.app');
    console.log('   2. Login as admin to assign tasks');
    console.log('   3. Connect WhatsApp for notifications');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating users:', error.message);
    process.exit(1);
  }
}

createUsers();
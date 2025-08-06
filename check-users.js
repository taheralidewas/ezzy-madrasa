const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/work-dashboard');
    
    const users = await User.find({});
    console.log(`Found ${users.length} users in database:`);
    
    users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role} - Phone: ${user.phone}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
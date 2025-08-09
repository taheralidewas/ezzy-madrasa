#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Railway Deployment Script (Easier Alternative)');
console.log('=================================================\n');

async function deployRailway() {
  console.log('🎯 Railway is easier than Google Cloud - no billing required!');
  console.log('\n📋 Quick Railway Setup:');
  console.log('1. Go to: https://railway.app');
  console.log('2. Sign up with GitHub');
  console.log('3. Click "New Project" → "Deploy from GitHub repo"');
  console.log('4. Select this repository');
  console.log('5. Railway will auto-deploy!');
  
  console.log('\n🗄️ For database, add MongoDB:');
  console.log('- In Railway dashboard: New → Database → Add MongoDB');
  console.log('- Copy connection string to environment variables');
  
  console.log('\n🔧 Set these environment variables in Railway:');
  console.log('- MONGODB_URI=your-railway-mongodb-connection');
  console.log('- JWT_SECRET=ezzy-madrasa-super-secret-jwt-key-2024');
  console.log('- NODE_ENV=production');
  console.log('- DISABLE_WHATSAPP=true (for production stability)');
  console.log('- PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true');
  
  console.log('\n✅ Your app will be live at: https://your-app.railway.app');
  console.log('🌍 Accessible globally from any device!');
  
  const openBrowser = await new Promise((resolve) => {
    rl.question('\nOpen Railway.app in browser? (Y/n): ', resolve);
  });
  
  if (openBrowser.toLowerCase() !== 'n') {
    console.log('🌐 Opening Railway.app...');
    execSync('start https://railway.app', { stdio: 'inherit' });
  }
  
  rl.close();
}

deployRailway();
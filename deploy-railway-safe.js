#!/usr/bin/env node

/**
 * Safe Railway Deployment Script
 * Deploys the app with WhatsApp disabled to avoid containerization issues
 */

const { execSync } = require('child_process');

console.log('🚀 Starting safe Railway deployment...');

try {
  // Check if Railway CLI is installed
  try {
    execSync('railway --version', { stdio: 'ignore' });
  } catch (error) {
    console.log('❌ Railway CLI not found. Installing...');
    console.log('Please install Railway CLI first:');
    console.log('npm install -g @railway/cli');
    console.log('Then run: railway login');
    process.exit(1);
  }

  // Set environment variables for safe deployment
  console.log('⚙️  Setting environment variables...');
  
  const envVars = [
    'DISABLE_WHATSAPP=true',
    'NODE_ENV=production',
    'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true',
    'PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable'
  ];

  envVars.forEach(envVar => {
    try {
      execSync(`railway variables set ${envVar}`, { stdio: 'inherit' });
      console.log(`✅ Set: ${envVar}`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set ${envVar}`);
    }
  });

  // Deploy the application
  console.log('🚀 Deploying to Railway...');
  execSync('railway up', { stdio: 'inherit' });

  console.log('\n✅ Deployment completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Check your Railway dashboard for the deployment URL');
  console.log('2. Set up your MongoDB connection string in Railway variables');
  console.log('3. Set a strong JWT_SECRET in Railway variables');
  console.log('4. Once the app is stable, you can enable WhatsApp by setting DISABLE_WHATSAPP=false');
  console.log('\n🔗 Railway Dashboard: https://railway.app/dashboard');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Make sure you are logged in: railway login');
  console.log('2. Make sure you are in a Railway project: railway link');
  console.log('3. Check your internet connection');
  process.exit(1);
}
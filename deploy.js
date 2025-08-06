#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Ezzy Madrasa Task Management - Deployment Helper\n');

// Check if git is initialized
if (!fs.existsSync('.git')) {
    console.log('📁 Initializing Git repository...');
    execSync('git init', { stdio: 'inherit' });
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Initial commit - Ezzy Madrasa Task System"', { stdio: 'inherit' });
    execSync('git branch -M main', { stdio: 'inherit' });
    console.log('✅ Git repository initialized\n');
}

console.log('📋 Deployment Options:');
console.log('1. Railway (Recommended) - https://railway.app');
console.log('2. Render (Free tier) - https://render.com');
console.log('3. Heroku - https://heroku.com');
console.log('4. Manual GitHub push\n');

console.log('📝 Next Steps:');
console.log('1. Push your code to GitHub');
console.log('2. Connect your GitHub repo to your chosen platform');
console.log('3. Set environment variables (see DEPLOYMENT.md)');
console.log('4. Deploy and test!\n');

console.log('🔗 Useful Links:');
console.log('- MongoDB Atlas: https://mongodb.com/atlas');
console.log('- Deployment Guide: See DEPLOYMENT.md');
console.log('- GitHub: Push your code first\n');

console.log('✨ Your Ezzy Madrasa Task Management system is ready for deployment!');
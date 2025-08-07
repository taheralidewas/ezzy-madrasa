#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Google Cloud Run Deployment Script');
console.log('=====================================\n');

// Check if gcloud is installed
function checkGcloud() {
  try {
    execSync('gcloud --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

async function deploy() {
  try {
    // Check if gcloud is installed
    if (!checkGcloud()) {
      console.log('❌ Google Cloud CLI not found!');
      console.log('\n📥 Please install Google Cloud CLI first:');
      console.log('🔗 https://cloud.google.com/sdk/docs/install-sdk');
      console.log('\n📋 After installation:');
      console.log('1. Restart your terminal');
      console.log('2. Run: gcloud auth login');
      console.log('3. Run this script again: node deploy-gcp.js');
      rl.close();
      return;
    }

    console.log('✅ Google Cloud CLI found!\n');

    // Get project ID
    console.log('💡 Tip: Project IDs must be globally unique. Try: ezzy-madrasa-' + Math.floor(Math.random() * 10000));
    const projectId = await new Promise((resolve) => {
      rl.question('Enter your Google Cloud Project ID (or create new): ', resolve);
    });

    // Get MongoDB URI
    const mongoUri = await new Promise((resolve) => {
      rl.question('Enter your MongoDB Atlas connection string: ', resolve);
    });

    // Get JWT Secret
    const jwtSecret = await new Promise((resolve) => {
      rl.question('Enter a secure JWT secret: ', resolve);
    });

    rl.close();

    console.log('\n📦 Building and deploying...\n');

    // Login check
    console.log('🔐 Checking authentication...');
    try {
      execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { stdio: 'pipe' });
    } catch (error) {
      console.log('Please login first: gcloud auth login');
      return;
    }

    // Set project
    execSync(`gcloud config set project ${projectId}`, { stdio: 'inherit' });

    // Enable APIs
    console.log('🔧 Enabling required APIs...');
    execSync('gcloud services enable cloudbuild.googleapis.com run.googleapis.com', { stdio: 'inherit' });

    // Build and deploy
    console.log('🏗️ Building container...');
    execSync('gcloud builds submit --tag gcr.io/' + projectId + '/ezzy-madrasa-task', { stdio: 'inherit' });

    // Deploy to Cloud Run
    console.log('🚀 Deploying to Cloud Run...');
    execSync(`gcloud run deploy ezzy-madrasa-task --image gcr.io/${projectId}/ezzy-madrasa-task --platform managed --region us-central1 --allow-unauthenticated --set-env-vars="MONGODB_URI=${mongoUri},JWT_SECRET=${jwtSecret},NODE_ENV=production"`, { stdio: 'inherit' });

    // Get URL
    const url = execSync(`gcloud run services describe ezzy-madrasa-task --region=us-central1 --format="value(status.url)"`, 
      { encoding: 'utf8' }).trim();

    console.log('\n✅ Deployment successful!');
    console.log(`🌍 Your app is now live globally at: ${url}`);
    console.log('\n📱 Accessible from any device worldwide!');
    console.log('\n🔑 Default login credentials:');
    console.log('Email: admin@ezzymadrasa.com');
    console.log('Password: admin123');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

deploy();
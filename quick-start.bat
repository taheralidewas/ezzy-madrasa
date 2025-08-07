@echo off
echo 🚀 Ezzy Madrasa Task - Quick Start Guide
echo ========================================
echo.
echo Step 1: Install Google Cloud CLI
echo Download from: https://cloud.google.com/sdk/docs/install-sdk
echo.
echo Step 2: Login to Google Cloud
echo gcloud auth login
echo.
echo Step 3: Run deployment script
echo node deploy-gcp.js
echo.
echo Step 4: Setup MongoDB Atlas
echo Go to: https://mongodb.com/atlas
echo.
echo Press any key to open Google Cloud CLI download page...
pause >nul
start https://cloud.google.com/sdk/docs/install-sdk
echo.
echo Press any key to open MongoDB Atlas...
pause >nul
start https://mongodb.com/atlas
echo.
echo After installation, run: node deploy-gcp.js
pause
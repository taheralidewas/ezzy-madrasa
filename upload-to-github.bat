@echo off
echo 🚀 Ezzy Madrasa Task Management - GitHub Upload Helper
echo.

REM Set Git path
set GIT="C:\Program Files\Git\bin\git.exe"

echo 📁 Initializing Git repository...
%GIT% init
%GIT% add .
%GIT% commit -m "Initial commit - Ezzy Madrasa Task Management System"
%GIT% branch -M main

echo.
echo 📋 Next Steps:
echo 1. Create a new repository on GitHub.com
echo 2. Copy the repository URL (e.g., https://github.com/yourusername/ezzy-madrasa-task.git)
echo 3. Run this command with your repository URL:
echo.
echo    %GIT% remote add origin YOUR_GITHUB_REPO_URL
echo    %GIT% push -u origin main
echo.
echo 🎉 Your project will then be uploaded to GitHub!

pause
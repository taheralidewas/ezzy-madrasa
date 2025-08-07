@echo off
echo 🚀 Railway Deployment - Simple Steps
echo ====================================
echo.
echo Your app is ready for Railway deployment!
echo.
echo Step 1: Open Railway
start https://railway.app
echo ✅ Railway opened in browser
echo.
echo Step 2: Sign up with GitHub
echo Step 3: New Project → Deploy from GitHub repo
echo Step 4: Select your repository
echo Step 5: Add MongoDB database
echo Step 6: Set environment variables:
echo   - MONGODB_URI (from Railway MongoDB)
echo   - JWT_SECRET=ezzy-madrasa-super-secret-jwt-key-2024
echo   - NODE_ENV=production
echo   - DISABLE_WHATSAPP=true (for initial deployment)
echo.
echo Note: WhatsApp is disabled initially to ensure successful deployment.
echo You can enable it later by setting DISABLE_WHATSAPP=false
echo.
echo 🌍 Your app will be live globally!
echo 📱 Accessible from any device worldwide!
echo.
echo Press any key to continue...
pause >nul
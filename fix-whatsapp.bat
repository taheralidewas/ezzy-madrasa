@echo off
echo ========================================
echo   WhatsApp QR Code Fix Script
echo ========================================
echo.

echo Step 1: Clearing old WhatsApp session data...
if exist ".wwebjs_auth" (
    rmdir /s /q ".wwebjs_auth"
    echo ✅ Cleared .wwebjs_auth folder
) else (
    echo ℹ️  No .wwebjs_auth folder found
)

if exist ".wwebjs_cache" (
    rmdir /s /q ".wwebjs_cache"
    echo ✅ Cleared .wwebjs_cache folder
) else (
    echo ℹ️  No .wwebjs_cache folder found
)

echo.
echo Step 2: Reinstalling WhatsApp dependencies...
npm uninstall whatsapp-web.js
npm install whatsapp-web.js@latest

echo.
echo Step 3: Installing/updating Puppeteer...
npm install puppeteer@latest

echo.
echo Step 4: Starting the server...
echo ========================================
echo   Setup Complete! Starting server...
echo ========================================
echo.
echo 🚀 Your WhatsApp QR code should now generate properly!
echo 📱 Open your browser and go to http://localhost:3000
echo 🔗 Click the WhatsApp button to get your QR code
echo.

npm start
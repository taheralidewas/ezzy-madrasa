# 🚀 Deployment Guide - Ezzy Madrasa Task Management

## 📋 Pre-Deployment Checklist

- ✅ All files are ready for deployment
- ✅ Environment variables configured
- ✅ Database setup (MongoDB Atlas recommended)
- ✅ WhatsApp integration tested locally

## 🌐 Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Why Railway?**
- Free tier available
- Automatic deployments from GitHub
- Built-in MongoDB addon
- Easy environment variable management

**Steps:**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Ezzy Madrasa Task System"
   git branch -M main
   git remote add origin https://github.com/yourusername/ezzy-madrasa-task.git
   git push -u origin main
   ```

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will automatically detect Node.js and deploy

3. **Add MongoDB:**
   - In Railway dashboard, click "New" → "Database" → "Add MongoDB"
   - Copy the connection string
   - Add to environment variables

4. **Set Environment Variables:**
   ```
   MONGODB_URI=mongodb://[your-railway-mongodb-connection]
   JWT_SECRET=your-super-secure-jwt-secret-key-here
   NODE_ENV=production
   ```

5. **Create Admin User:**
   - After deployment, run the user creation script via Railway console

### Option 2: Render (Free Tier)

**Steps:**

1. **Push to GitHub** (same as above)

2. **Deploy on Render:**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Use these settings:
     - Build Command: `npm install`
     - Start Command: `npm start`

3. **Add MongoDB Atlas:**
   - Go to [mongodb.com/atlas](https://mongodb.com/atlas)
   - Create free cluster
   - Get connection string
   - Add to Render environment variables

### Option 3: Heroku

**Steps:**

1. **Install Heroku CLI:**
   ```bash
   # Download from heroku.com/cli
   ```

2. **Deploy:**
   ```bash
   heroku create ezzy-madrasa-task
   heroku addons:create mongolab:sandbox
   git push heroku main
   ```

## 🗄️ Database Setup (MongoDB Atlas)

1. **Create Account:** Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. **Create Cluster:** Choose free tier (M0)
3. **Setup Access:**
   - Create database user
   - Add IP address (0.0.0.0/0 for all IPs)
4. **Get Connection String:**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/work-dashboard
   ```

## 🔐 Environment Variables for Production

Set these in your deployment platform:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/work-dashboard
JWT_SECRET=your-super-secure-random-jwt-secret-key
NODE_ENV=production
PORT=3000
```

## 👥 Creating Initial Users

After deployment, create admin and users:

1. **Access your deployed app console**
2. **Run user creation:**
   ```bash
   node create-admin.js
   ```

Or create via API:
```bash
curl -X POST https://your-app.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ezzy Madrasa Admin",
    "email": "admin@ezzymadrasa.com",
    "password": "admin123",
    "role": "admin",
    "phone": "919876543210",
    "department": "Administration"
  }'
```

## 📱 WhatsApp Setup for Production

1. **QR Code Generation:** Works automatically
2. **Phone Numbers:** Update with actual WhatsApp numbers
3. **Connection:** Admin scans QR code once deployed

## 🔧 Post-Deployment

1. **Test Login:** Use admin credentials
2. **Create Users:** Add all team members
3. **Test WhatsApp:** Connect and send test assignment
4. **Update Phone Numbers:** Replace with actual numbers

## 🌍 Custom Domain (Optional)

### Railway:
- Go to Settings → Domains
- Add custom domain
- Update DNS records

### Render:
- Go to Settings → Custom Domains
- Add domain and verify

## 📊 Monitoring

- **Railway:** Built-in logs and metrics
- **Render:** Application logs available
- **Heroku:** Use `heroku logs --tail`

## 🔒 Security Checklist

- ✅ Strong JWT secret
- ✅ MongoDB connection secured
- ✅ Environment variables set
- ✅ HTTPS enabled (automatic on platforms)
- ✅ Phone numbers validated

## 🆘 Troubleshooting

**Common Issues:**

1. **App won't start:**
   - Check environment variables
   - Verify MongoDB connection

2. **WhatsApp not connecting:**
   - Check server logs
   - Ensure QR code generation works

3. **Database connection failed:**
   - Verify MongoDB Atlas IP whitelist
   - Check connection string format

## 📞 Support

After deployment, your app will be available at:
- Railway: `https://your-app-name.railway.app`
- Render: `https://your-app-name.onrender.com`
- Heroku: `https://your-app-name.herokuapp.com`

**Login Credentials:**
- Email: `admin@ezzymadrasa.com`
- Password: `admin123`
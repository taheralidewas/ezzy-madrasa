# Ezzy Madrasa Task Management System

A role-based work assignment system specifically designed for Ezzy Madrasa that sends WhatsApp notifications when work is assigned or updated.

## Features

- **Role-based Access Control**: Admin, Manager, and Member roles with different permissions
- **Work Assignment**: Managers and Admins can assign work to team members
- **WhatsApp Notifications**: Automatic notifications when work is assigned or status changes
- **Real-time Updates**: Socket.io for real-time dashboard updates
- **Priority Management**: Set work priorities (Low, Medium, High, Urgent)
- **Status Tracking**: Track work progress (Pending, In Progress, Completed, Cancelled)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

### 3. Database Setup
Make sure MongoDB is running on your system or update the `MONGODB_URI` in `.env`

### 4. Create Users
Before starting the application, create the default users:
```bash
node create-admin.js
```

### 5. Start the Application
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 6. WhatsApp Setup
1. Open the application in your browser (http://localhost:3000)
2. Check the console for WhatsApp QR code
3. Scan the QR code with your WhatsApp mobile app
4. Once connected, the system will send notifications automatically

## User Roles

### Admin
- Can assign work to anyone
- Can view all work assignments
- Can update any work status

### Manager
- Can assign work to members in their department
- Can view work assigned by them or to their department members
- Can update work status

### Member
- Can view work assigned to them
- Can update status of their assigned work
- Receives WhatsApp notifications for new assignments

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Work Management
- `POST /api/work` - Create work assignment
- `GET /api/work` - Get work assignments (filtered by role)
- `PATCH /api/work/:id/status` - Update work status
- `POST /api/work/:id/notes` - Add notes to work
- `GET /api/work/users` - Get users for assignment

## Default Login Credentials

After running `node create-admin.js`, you can log in with these credentials:

### Admin Login
- **Email**: `admin@ezzymadrasa.com`
- **Password**: `admin123`

### Member Logins (All use password: `member123`)
- **Ali Akbar Bhai**: `ali.akbar@ezzymadrasa.com`
- **Juzer Bhai**: `juzer@ezzymadrasa.com`
- **Taher Bhai Umrethwala**: `taher.umrethwala@ezzymadrasa.com`
- **Kausa Bhai**: `kausa@ezzymadrasa.com`
- **Taher Bhai Shajapurwala**: `taher.shajapurwala@ezzymadrasa.com`

## Live Application

The application is deployed at: **https://ezzy-madrasa-production-up.railway.app**

## Creating Additional Users

You can create additional users by making POST requests to `/api/auth/register`:

```json
{
  "name": "New Member",
  "email": "newmember@ezzymadrasa.com",
  "password": "password123",
  "role": "member",
  "phone": "919876543210",
  "department": "Education"
}
```

## Phone Number Format

Phone numbers should be in international format without the '+' sign:
- For India: 919876543210
- For US: 15551234567

The system will automatically format numbers for WhatsApp.

## Technologies Used

- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: HTML, CSS, Bootstrap, JavaScript
- **Real-time**: Socket.io
- **WhatsApp**: whatsapp-web.js
- **Authentication**: JWT

## Troubleshooting

1. **WhatsApp not connecting**: Make sure you have a stable internet connection and the QR code is scanned properly
2. **Messages not sending**: Check if the phone numbers are in the correct format
3. **Database connection issues**: Ensure MongoDB is running and the connection string is correct
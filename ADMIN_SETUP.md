# Admin Setup Guide

## Overview
This document provides instructions for setting up and using the admin functionality for the Perseverantia Event Management system.

## Features Added
1. **Admin Login Page** (`/admin-login`) - Secure authentication for administrators
2. **Admin Dashboard** (`/admin-dashboard`) - View all event registrations in a table format
3. **JWT Authentication** - Secure token-based authentication
4. **Database Models** - Support for Sports & Gaming, Classroom, and Stage event registrations
5. **REST API Endpoints** - Backend API for admin operations

## Setup Instructions

### 1. Install Dependencies
```bash
npm install jsonwebtoken
```

### 2. Environment Configuration
The `.env` file already contains the necessary admin configuration:
- `ADMIN_PASSWORD`: Password for admin login (currently: `youshallnotpass`)
- `JWT_SECRET`: Secret key for JWT token signing (currently: `abcdefghijklmnop`)

**⚠️ IMPORTANT**: Change these default values to secure ones in production!

### 3. Start the Server
```bash
npm start
```

## Usage

### Accessing the Admin Panel
1. Navigate to `http://localhost:3000/admin-login`
2. Enter the admin password (currently: `youshallnotpass`)
3. Click "Access Admin Panel"
4. You'll be redirected to the admin dashboard

### Admin Dashboard Features
- **Statistics Cards**: Overview of total registrations by category
- **Filtering**: Filter by event type (Sports & Gaming, Classroom, Stage) and school
- **Registration Table**: Detailed view of all submissions with:
  - Event type and name
  - School information
  - Participant details
  - Submission timestamp
  - Submitter information

### API Endpoints

#### Admin Authentication
- **POST** `/api/admin/login`
  - Body: `{ "password": "admin_password" }`
  - Returns JWT token for authentication

#### Data Retrieval
- **GET** `/api/admin/registrations` (Requires JWT)
  - Returns all registrations with summary statistics

- **GET** `/api/admin/registrations/school/:contingentCode` (Requires JWT)
  - Returns registrations for a specific school

- **GET** `/api/admin/registrations/type/:eventType` (Requires JWT)
  - Returns registrations for a specific event type

## Database Models
The system supports three types of event registrations:
1. **SportsGamingRegistration** - Sports and gaming events
2. **ClassroomRegistration** - Classroom-based events
3. **StageRegistration** - Stage performance events

Each registration includes:
- School information (name, contingent code)
- Event details
- Participant information (name, standard, division)
- Submission metadata (timestamp, submitter)

## Security Features
- JWT-based authentication with configurable expiration (24 hours)
- Password-protected admin access
- Secure token verification for all admin endpoints
- Automatic logout on token expiration

## File Structure
```
/routes/admin.js          # Admin API routes
/models/Registration.js   # Database models
/views/admin-login.html   # Admin login page
/views/admin-dashboard.html # Admin dashboard
/.env                     # Environment configuration
```

## Troubleshooting

### Common Issues
1. **Invalid Admin Password**: Check the `ADMIN_PASSWORD` in `.env`
2. **JWT Errors**: Verify `JWT_SECRET` is set in `.env`
3. **Database Connection**: Ensure MongoDB is running and connection string is correct
4. **Missing Dependencies**: Run `npm install` to install all required packages

### Logs
Check the server console for detailed error messages and authentication logs.

## Production Deployment

### Security Checklist
- [ ] Change default `ADMIN_PASSWORD` to a strong password
- [ ] Use a secure, random `JWT_SECRET` (32+ characters)
- [ ] Enable HTTPS in production
- [ ] Restrict admin access by IP if needed
- [ ] Regularly rotate admin credentials
- [ ] Monitor admin access logs

### Environment Variables
Ensure all environment variables are properly set in your production environment:
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `MONGODB_URI`
- Other existing variables (`UNAMES`, `PASSWORDS`, etc.)

## Support
For technical support or questions, contact the development team.

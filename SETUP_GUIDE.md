# Backend Setup Guide

Complete guide to set up and run the Hyipro backend.

## Prerequisites

- Node.js v14+ ([Download](https://nodejs.org/))
- MySQL 5.7+ ([Download](https://www.mysql.com/downloads/))
- Git
- Code editor (VS Code recommended)

## Step 1: Clone & Install

```bash
# Navigate to projects directory
cd f:/Projects/Hyipro

# Install dependencies
npm install
```

## Step 2: Database Setup

### Option A: Local MySQL

1. **Start MySQL service**
   - Windows: Use MySQL Workbench or command line
   - Mac: `brew services start mysql`
   - Linux: `sudo systemctl start mysql`

2. **Create database**
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE hyipro_db;
   EXIT;
   ```

3. **Run migrations**
   ```bash
   npm run migrate
   ```

### Option B: Railway MySQL (Recommended for Production)

1. Create Railway account at [railway.app](https://railway.app)
2. Create new MySQL plugin
3. Copy connection details to `.env`

## Step 3: Environment Configuration

1. **Create .env file**
   ```bash
   cp .env .env.local
   ```

2. **Update .env with your settings**
   ```
   PORT=5000
   NODE_ENV=development

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=hyipro_db

   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_EXPIRE=7d

   BITCOIN_RPC_URL=https://api.blockcypher.com/v1/btc/main
   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
   BLOCKCHAIN_API_KEY=your_api_key

   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password

   FRONTEND_URL=http://localhost:3000
   WEBHOOK_SECRET=your_webhook_secret_key
   ```

## Step 4: Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

You should see:
```
🚀 Server running on port 5000
Environment: development
✅ Database connection established
📅 Daily earnings job scheduled (runs at 00:00 UTC)
```

## Step 5: Test API

### Health Check
```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2026-05-29T13:00:00.000Z"
}
```

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "country": "US"
  }'
```

Response:
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user"
  }
}
```

## Project Structure

```
hyipro-backend/
├── src/
│   ├── config/
│   │   └── database.js          # MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── userController.js    # User management
│   │   ├── planController.js    # Plan operations
│   │   ├── transactionController.js  # Crypto transactions
│   │   └── adminController.js   # Admin operations
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   └── errorHandler.js      # Error handling
│   ├── routes/
│   │   ├── auth.js              # Auth endpoints
│   │   ├── user.js              # User endpoints
│   │   ├── plans.js             # Plan endpoints
│   │   ├── transactions.js      # Transaction endpoints
│   │   └── admin.js             # Admin endpoints
│   ├── jobs/
│   │   └── dailyEarningsJob.js  # Background job for earnings
│   └── app.js                   # Express app setup
├── scripts/
│   └── migrate.js               # Database migration script
├── .env                         # Environment variables
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies
├── server.js                    # Server entry point
└── README.md                    # Documentation
```

## Common Issues & Solutions

### Issue: "Cannot find module 'mysql2'"
**Solution**: Run `npm install`

### Issue: "ECONNREFUSED - Connection refused"
**Solution**: 
- Check MySQL is running
- Verify DB_HOST, DB_USER, DB_PASSWORD in .env

### Issue: "ER_ACCESS_DENIED_FOR_USER"
**Solution**: 
- Check MySQL credentials in .env
- Reset MySQL password if needed

### Issue: "Port 5000 already in use"
**Solution**: 
- Change PORT in .env
- Or kill process: `lsof -ti:5000 | xargs kill -9`

## Database Management

### View Tables
```bash
mysql -u root -p hyipro_db
SHOW TABLES;
DESC users;
```

### Reset Database
```bash
mysql -u root -p
DROP DATABASE hyipro_db;
CREATE DATABASE hyipro_db;
EXIT;
npm run migrate
```

## API Testing Tools

### Postman
1. Download [Postman](https://www.postman.com/downloads/)
2. Import API collection (create from endpoints)
3. Set base URL: `http://localhost:5000`
4. Add Authorization header with JWT token

### cURL
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}'

# Get Profile (with token)
curl http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Production Deployment

### Railway Deployment

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Choose repository
   - Add MySQL plugin

3. **Set Environment Variables**
   - Go to Variables tab
   - Add all variables from .env
   - Set `NODE_ENV=production`

4. **Deploy**
   - Railway auto-deploys on push
   - Check deployment logs

### Environment Variables for Production
```
NODE_ENV=production
PORT=5000
DB_HOST=<railway-mysql-host>
DB_PORT=3306
DB_USER=<railway-mysql-user>
DB_PASSWORD=<railway-mysql-password>
DB_NAME=hyipro_db
JWT_SECRET=<generate-strong-random-key>
JWT_EXPIRE=7d
FRONTEND_URL=https://your-frontend-domain.com
```

## Monitoring & Logs

### View Logs
```bash
# Development
npm run dev

# Production (Railway)
# View in Railway dashboard
```

### Database Backups
```bash
# Backup
mysqldump -u root -p hyipro_db > backup.sql

# Restore
mysql -u root -p hyipro_db < backup.sql
```

## Next Steps

1. ✅ Backend setup complete
2. 📱 Next: Frontend setup
3. 🔗 Integrate frontend with backend
4. 🚀 Deploy to production

## Support

- Check README.md for API documentation
- Review error messages in console
- Check database for data integrity
- Test endpoints with Postman

## Security Checklist

- [ ] Change JWT_SECRET to strong random key
- [ ] Set NODE_ENV=production in production
- [ ] Use HTTPS in production
- [ ] Enable CORS only for your frontend domain
- [ ] Regularly update dependencies: `npm audit fix`
- [ ] Use environment variables for sensitive data
- [ ] Enable database backups
- [ ] Monitor error logs regularly

---

Backend setup complete! Ready to start building the frontend.

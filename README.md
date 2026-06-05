# Hyipro Backend API

Investment platform backend built with Node.js, Express, and MySQL.

## Features

- User authentication with JWT
- Investment plan management
- Cryptocurrency payments (Bitcoin & Ethereum)
- Real-time earnings calculation
- Withdrawal management
- Admin dashboard
- User profile management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Task Scheduling**: node-cron
- **Security**: Helmet, CORS

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd hyipro-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hyipro_db

JWT_SECRET=your_super_secret_key
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:3000
```

4. **Create database and tables**
```bash
npm run migrate
```

5. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh JWT token

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/password` - Change password
- `GET /api/user/wallet` - Get wallet addresses
- `PUT /api/user/wallet` - Update wallet addresses
- `GET /api/user/subscriptions` - Get user subscriptions
- `GET /api/user/earnings` - Get user earnings
- `GET /api/user/transactions` - Get user transactions

### Plans
- `GET /api/plans` - Get all active plans
- `GET /api/plans/:id` - Get plan details
- `POST /api/plans/:id/subscribe` - Subscribe to plan

### Transactions
- `POST /api/transactions/initiate-deposit` - Initiate crypto deposit
- `GET /api/transactions/order/:orderId` - Check order status
- `POST /api/transactions/webhook/confirm` - Confirm deposit (webhook)
- `POST /api/transactions/withdraw` - Request withdrawal
- `GET /api/transactions/withdrawal-requests` - Get withdrawal requests

### Admin
- `GET /api/admin/plans` - Get all plans
- `POST /api/admin/plans` - Create plan
- `PUT /api/admin/plans/:id` - Update plan
- `PATCH /api/admin/plans/:id/status` - Update plan status
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `GET /api/admin/withdrawals` - Get all withdrawals
- `PATCH /api/admin/withdrawals/:id/approve` - Approve withdrawal
- `PATCH /api/admin/withdrawals/:id/reject` - Reject withdrawal
- `GET /api/admin/stats` - Get dashboard statistics

## Database Schema

### Users
- id, email, password_hash, first_name, last_name, phone, country, kyc_verified, role

### Plans
- id, name, description, min_deposit, max_deposit, daily_profit_percentage, duration_days, status

### Subscriptions
- id, user_id, plan_id, amount, start_date, end_date, status

### Wallets
- id, user_id, btc_address, eth_address

### Transactions
- id, user_id, subscription_id, type, crypto_type, amount, status, tx_hash

### Earnings
- id, subscription_id, amount, earned_date

### Withdrawal Requests
- id, user_id, subscription_id, amount, crypto_type, wallet_address, status

## Background Jobs

### Daily Earnings Calculation
- Runs every day at 00:00 UTC
- Calculates daily earnings for all active subscriptions
- Marks completed subscriptions as finished

## Authentication

All protected endpoints require JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Error Handling

The API returns standardized error responses:
```json
{
  "error": {
    "status": 400,
    "message": "Error description"
  }
}
```

## Development

### Running in Development Mode
```bash
npm run dev
```

Uses nodemon for auto-restart on file changes.

### Database Migration
```bash
npm run migrate
```

Creates all necessary tables in the database.

## Deployment

### Railway Deployment

1. Push code to GitHub
2. Connect repository to Railway
3. Set environment variables in Railway dashboard
4. Railway will automatically deploy

### Environment Variables for Production
- `NODE_ENV=production`
- `DB_HOST=<railway-mysql-host>`
- `DB_USER=<railway-mysql-user>`
- `DB_PASSWORD=<railway-mysql-password>`
- `DB_NAME=hyipro_db`
- `JWT_SECRET=<strong-random-key>`
- `FRONTEND_URL=<your-frontend-url>`

## Security Considerations

- All passwords are hashed with bcryptjs
- JWT tokens expire after 7 days
- CORS is configured for frontend domain
- Helmet.js provides security headers
- Input validation on all endpoints
- SQL injection prevention with parameterized queries

## Future Enhancements

- [ ] Email notifications
- [ ] Two-factor authentication
- [ ] Blockchain integration for real-time payment confirmation
- [ ] Advanced analytics
- [ ] API rate limiting
- [ ] Audit logging
- [ ] KYC/AML verification

## Support

For issues or questions, please create an issue in the repository.

## License

ISC

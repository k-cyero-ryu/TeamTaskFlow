# Installation Guide

## Quick Start

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database (local or hosted)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/your-username/task-management-platform.git
cd task-management-platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```env
# Database Configuration (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Session Security (Required)
SESSION_SECRET=your-long-random-secret-key-here

# Email Configuration (Optional)
COMPANY_EMAIL_FROM=your-company@domain.com
GODADDY_SMTP_USER=your-smtp-username
GODADDY_SMTP_PASSWORD=your-smtp-password

# Alternative Email Service (Optional)
SENDGRID_API_KEY=your-sendgrid-api-key

# Development Settings
NODE_ENV=development
```

### 4. Database Setup
```bash
# Push database schema
npm run db:push
```

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Production Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/database
SESSION_SECRET=your-secure-session-secret
PORT=5000
```

## Database Configuration

### Local PostgreSQL
1. Install PostgreSQL
2. Create database: `createdb task_management`
3. Update DATABASE_URL with your credentials

### Hosted Database (Recommended)
- **Neon**: Serverless PostgreSQL
- **Heroku Postgres**: Managed PostgreSQL
- **AWS RDS**: Amazon PostgreSQL service

## Email Configuration

### Using GoDaddy SMTP
```env
COMPANY_EMAIL_FROM=noreply@yourdomain.com
GODADDY_SMTP_USER=your-email@yourdomain.com
GODADDY_SMTP_PASSWORD=your-smtp-password
```

### Using SendGrid
```env
SENDGRID_API_KEY=SG.your-sendgrid-api-key
COMPANY_EMAIL_FROM=noreply@yourdomain.com
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Verify DATABASE_URL format
- Check database server is running
- Confirm network connectivity

#### Port Already in Use
```bash
# Find process using port 5000
lsof -ti:5000

# Kill the process
kill -9 <process_id>
```

#### Build Errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Permission Errors
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Getting Help
- Check console logs for error details
- Verify all environment variables are set
- Ensure database schema is up to date: `npm run db:push`
- Review the user manual for feature guidance

## Development Tips

### Hot Reload
The development server includes hot reload for both frontend and backend changes.

### Database Migrations
Use `npm run db:push` to apply schema changes during development.

### Testing
```bash
# Run type checking
npm run check

# View application logs
npm run dev
```

### File Structure
```
├── client/          # React frontend
├── server/          # Express backend  
├── shared/          # Shared types
├── docs/            # Documentation
├── uploads/         # File storage
└── package.json     # Dependencies
```
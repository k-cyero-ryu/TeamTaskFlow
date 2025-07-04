# Task Management & Collaboration Platform

A comprehensive full-stack task management and collaboration platform built with modern web technologies. This application provides seamless team coordination through integrated communication systems, real-time updates, and advanced project management features.

## 🚀 Features

### Core Functionality
- **Task Management**: Create, assign, and track tasks with custom workflows
- **Real-time Communication**: WebSocket-powered live updates and messaging
- **Team Collaboration**: Group channels and private messaging
- **File Sharing**: Upload and share files with drag-and-drop support
- **Email Notifications**: Configurable email alerts for task updates

### Business Management
- **Stock Management**: Track inventory with movement history and user permissions
- **Estimation System**: Create detailed project estimates with cost calculations
- **Proforma Generation**: Professional quote generation with multi-company support
- **Expense Tracking**: Monitor recurring business expenses with receipt management
- **Company Profiles**: Manage multiple company profiles with logo integration

### Advanced Features
- **Multilingual Support**: Complete internationalization (English, French, Spanish)
- **User Permissions**: Role-based access control with granular permissions
- **Workflow Management**: Custom workflow stages and automation
- **Calendar Integration**: iCalendar export for tasks and events
- **Print Templates**: Professional PDF generation for documents

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** with shadcn/ui components
- **TanStack React Query** for server state management
- **Wouter** for client-side routing
- **React Hook Form** with Zod validation
- **Framer Motion** for animations

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **WebSocket** for real-time communication
- **Passport.js** for authentication
- **Multer** for file uploads
- **Nodemailer** for email services

### Database & Infrastructure
- **PostgreSQL** with connection pooling
- **Drizzle ORM** for type-safe database operations
- **Session-based authentication**
- **SMTP email integration**
- **File system storage**

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- SMTP email service (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-management-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   SESSION_SECRET=your-secret-key-here
   
   # Email Configuration (Optional)
   COMPANY_EMAIL_FROM=your-email@company.com
   GODADDY_SMTP_USER=your-smtp-username
   GODADDY_SMTP_PASSWORD=your-smtp-password
   
   # SendGrid (Alternative Email Service)
   SENDGRID_API_KEY=your-sendgrid-api-key
   ```

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🏗️ Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── i18n/          # Internationalization
├── server/                # Express backend
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── database/         # Database utilities
│   └── utils/            # Helper functions
├── shared/               # Shared types and schemas
├── uploads/              # File storage
└── docs/                 # Documentation
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes

## 📊 Database Schema

### Core Tables
- **users** - User accounts and preferences
- **tasks** - Task management with workflow integration
- **comments** - Task discussion system
- **workflows** - Custom workflow definitions
- **group_channels** - Team communication channels
- **private_messages** - Direct messaging

### Business Tables
- **stock_items** - Inventory management
- **estimations** - Project estimates
- **proformas** - Professional quotes
- **expenses** - Business expense tracking
- **companies** - Multi-company profiles

## 🌍 Internationalization

The application supports multiple languages:
- **English** (default)
- **French** (Français)
- **Spanish** (Español)

Language switching is available throughout the interface with persistent user preferences.

## 🔐 Authentication & Security

- **Session-based authentication** with Passport.js
- **Password hashing** using Node.js crypto (scrypt)
- **Role-based permissions** with admin privileges
- **CSRF protection** via session management
- **Input validation** with Zod schemas

## 📱 Real-time Features

- **WebSocket connections** for instant updates
- **Live task status changes**
- **Real-time messaging**
- **Notification system**
- **Connection status monitoring**

## 🎨 UI/UX Features

- **Modern, responsive design**
- **Dark/light theme support**
- **Drag-and-drop file uploads**
- **Professional print templates**
- **Mobile-optimized interface**
- **Accessibility compliance**

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment Variables
Ensure all required environment variables are set in production:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secure session secret
- `NODE_ENV=production`

### Recommendations
- Use a reverse proxy (nginx) for static file serving
- Enable SSL/TLS for secure connections
- Set up database backups
- Monitor application logs
- Configure rate limiting

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Task Management
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Communication
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message
- `GET /api/messages/unread` - Get unread count

### Business Features
- `GET /api/stock` - Stock management
- `GET /api/estimations` - Project estimates
- `GET /api/proformas` - Professional quotes
- `GET /api/expenses` - Expense tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [documentation](docs/)
- Review existing [issues](../../issues)
- Create a new [issue](../../issues/new)

## 📋 Roadmap

- [ ] Mobile application
- [ ] Advanced reporting and analytics
- [ ] Integration with external services
- [ ] Advanced workflow automation
- [ ] Enhanced security features
- [ ] Performance optimizations

---

Built with ❤️ using modern web technologies for efficient team collaboration and project management.
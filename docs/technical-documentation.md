# Technical Documentation

## Architecture Overview

### System Architecture
The application follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (React)                     │
├─────────────────────────────────────────────────────────────┤
│                    API Layer (Express)                      │
├─────────────────────────────────────────────────────────────┤
│                  Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│                 Data Access Layer (Drizzle)                 │
├─────────────────────────────────────────────────────────────┤
│                   Database (PostgreSQL)                     │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe JavaScript for better developer experience
- **Vite**: Fast build tool and development server
- **TanStack Query**: Server state management and caching
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality component library
- **Wouter**: Lightweight client-side routing
- **React Hook Form**: Performant form handling
- **Zod**: Schema validation and type inference
- **Framer Motion**: Animation library

#### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **TypeScript**: Type-safe server-side development
- **Drizzle ORM**: Type-safe database operations
- **Passport.js**: Authentication middleware
- **WebSocket (ws)**: Real-time communication
- **Multer**: File upload handling
- **Nodemailer**: Email service integration

#### Database & Infrastructure
- **PostgreSQL**: Relational database
- **Neon**: Serverless PostgreSQL hosting
- **Connection Pooling**: Efficient database connections
- **Session Storage**: PostgreSQL-backed sessions

## Database Schema

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  notification_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

#### Tasks
```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_user_id INTEGER REFERENCES users(id),
  workflow_id INTEGER REFERENCES workflows(id),
  stage_id INTEGER REFERENCES stages(id),
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

#### Comments
```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Business Tables

#### Stock Items
```sql
CREATE TABLE stock_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cost DECIMAL(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  assigned_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

#### Estimations
```sql
CREATE TABLE estimations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  technique_id INTEGER REFERENCES users(id),
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

#### Proformas
```sql
CREATE TABLE proformas (
  id SERIAL PRIMARY KEY,
  proforma_number VARCHAR(50) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  company_id INTEGER REFERENCES companies(id),
  total_cost DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  valid_until DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User authentication
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Task Management
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Comments
- `GET /api/tasks/:id/comments` - Get task comments
- `POST /api/tasks/:id/comments` - Add comment
- `POST /api/comments/:id/upload` - Upload comment attachment

### Stock Management
- `GET /api/stock` - List stock items
- `POST /api/stock` - Create stock item
- `PUT /api/stock/:id` - Update stock item
- `DELETE /api/stock/:id` - Delete stock item
- `GET /api/stock/movements` - Get stock movements
- `POST /api/stock/movements` - Record stock movement

### Estimations
- `GET /api/estimations` - List estimations
- `POST /api/estimations` - Create estimation
- `PUT /api/estimations/:id` - Update estimation
- `DELETE /api/estimations/:id` - Delete estimation

### Proformas
- `GET /api/proformas` - List proformas
- `POST /api/proformas` - Create proforma
- `PUT /api/proformas/:id` - Update proforma
- `DELETE /api/proformas/:id` - Delete proforma
- `GET /api/proformas/:id/print` - Print proforma

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/:id/receipts` - Upload receipt

## Real-time Communication

### WebSocket Implementation
```javascript
// Server-side WebSocket setup
const wss = new WebSocketServer({ 
  server: httpServer, 
  path: '/ws' 
});

wss.on('connection', (ws, req) => {
  // Authentication check
  const sessionId = getSessionId(req);
  const user = authenticateUser(sessionId);
  
  if (!user) {
    ws.close(1008, 'Authentication required');
    return;
  }
  
  // Store connection with user ID
  connections.set(ws, { userId: user.id });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    handleMessage(ws, message);
  });
});
```

### Message Types
- `task_update`: Task status changes
- `new_comment`: New task comments
- `user_online`: User presence updates
- `notification`: System notifications

## Authentication & Security

### Password Security
```javascript
// Password hashing with scrypt
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
```

### Session Management
```javascript
// Session configuration
const sessionSettings = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PostgresSessionStore({
    pool: db,
    createTableIfMissing: true
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

## File Upload System

### Multer Configuration
```javascript
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const extension = path.extname(file.originalname);
      cb(null, `${uniqueId}${extension}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

## Internationalization

### Translation System
```javascript
// Translation structure
const translations = {
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete"
    },
    tasks: {
      title: "Tasks",
      create: "Create Task",
      assign: "Assign to"
    }
  },
  fr: {
    common: {
      save: "Sauvegarder",
      cancel: "Annuler",
      delete: "Supprimer"
    },
    tasks: {
      title: "Tâches",
      create: "Créer une Tâche",
      assign: "Assigner à"
    }
  }
};
```

### Usage in Components
```javascript
// Using translations in React components
const TaskPage = () => {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('tasks.title')}</h1>
      <button>{t('tasks.create')}</button>
    </div>
  );
};
```

## Performance Optimization

### Database Optimization
- **Connection Pooling**: Reuse database connections
- **Query Optimization**: Use indexes and efficient queries
- **Prepared Statements**: Prevent SQL injection and improve performance
- **Pagination**: Limit result sets for large datasets

### Frontend Optimization
- **Code Splitting**: Dynamic imports for route-based splitting
- **Lazy Loading**: Load components on demand
- **Memoization**: React.memo and useMemo for expensive computations
- **Virtual Scrolling**: For large lists (react-virtualized)

### Caching Strategy
```javascript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});
```

## Error Handling

### Global Error Handling
```javascript
// Express error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error'
  });
});
```

### Frontend Error Boundaries
```javascript
// React Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    
    return this.props.children;
  }
}
```

## Testing Strategy

### Unit Testing
```javascript
// Jest test example
describe('Task Service', () => {
  it('should create a task', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      assignedUserId: 1
    };
    
    const task = await taskService.createTask(taskData);
    
    expect(task).toBeDefined();
    expect(task.title).toBe('Test Task');
  });
});
```

### Integration Testing
```javascript
// API endpoint testing
describe('POST /api/tasks', () => {
  it('should create a new task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Test Task',
        description: 'Test Description'
      })
      .expect(201);
    
    expect(response.body.title).toBe('Test Task');
  });
});
```

## Deployment

### Production Build
```bash
# Build frontend
npm run build

# Build backend
npm run build

# Start production server
npm start
```

### Environment Variables
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=your-secret-key
PORT=5000
```

### Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

## Monitoring & Logging

### Application Logging
```javascript
// Structured logging
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...meta
    }));
  },
  error: (message, error = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error.message,
      stack: error.stack
    }));
  }
};
```

### Health Checks
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.raw('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
```

## Contributing Guidelines

### Code Style
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Include tests for new features

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit pull request
5. Code review and approval
6. Merge to `main`

### Development Workflow
```bash
# Setup development environment
npm install
npm run dev

# Run tests
npm test

# Type checking
npm run check

# Database migrations
npm run db:push
```
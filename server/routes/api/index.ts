import { Router } from 'express';
import tasksRouter from './tasks';
import commentsRouter from './comments';
import usersRouter from './users';
import messagesRouter from './messages';
import workflowsRouter from './workflows';
import channelsRouter from './channels';
import uploadsRouter from './uploads';
import emailRouter from './email';
import calendarRouter from './calendar';

const router = Router();

// Register all API routes
router.use('/tasks', tasksRouter);
router.use('/comments', commentsRouter);
router.use('/users', usersRouter);
router.use('/messages', messagesRouter);
router.use('/workflows', workflowsRouter);
router.use('/channels', channelsRouter);
router.use('/uploads', uploadsRouter);
router.use('/email', emailRouter);
router.use('/calendar', calendarRouter);

export default router;
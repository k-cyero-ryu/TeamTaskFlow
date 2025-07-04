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
import stagesRouter from './stages';
import stockRouter from './stock';
import estimationsRouter from './estimations';
import proformasRouter from './proformas';
import companiesRouter from './companies';

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
router.use('/stages', stagesRouter);
router.use('/stock', stockRouter);
router.use('/estimations', estimationsRouter);
router.use('/companies', companiesRouter);
router.use('/proformas', proformasRouter);

export default router;
import { Router } from 'express';
import authRoutes from './auth';
import taskRoutes from './tasks';
import messageRoutes from './messages';
import workflowRoutes from './workflows';
import userRoutes from './users';
import stagesRoutes from './stages';
import channelRoutes from './channels';
import { errorHandler, requestLogger } from '../../middleware';

const router = Router();

// Apply common middleware
router.use(requestLogger);

// Mount API routes
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/messages', messageRoutes);
router.use('/workflows', workflowRoutes);
router.use('/users', userRoutes);
router.use('/stages', stagesRoutes);
router.use('/channels', channelRoutes);

// Apply error handling middleware last
router.use(errorHandler);

export default router;
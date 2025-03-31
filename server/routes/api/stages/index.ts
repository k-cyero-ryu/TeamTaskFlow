import { Router } from 'express';
import { storage } from '../../../storage';
import { handleApiError } from '../../../utils/errors';
import { requireAuth } from '../../../middleware';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('StagesRoutes');

/**
 * @route GET /api/stages
 * @desc Get all workflow stages across all workflows
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const stages = await storage.getAllStages();
    
    logger.info('All stages fetched successfully', { count: stages.length });
    res.json(stages);
  } catch (error) {
    logger.error('Error fetching all stages', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

export default router;
import { Router } from 'express';
import { storage } from '../../../storage';
import { 
  insertWorkflowSchema, 
  insertWorkflowStageSchema, 
  insertWorkflowTransitionSchema 
} from '@shared/schema';
import { 
  handleApiError, 
  ValidationError, 
  NotFoundError, 
  InternalServerError 
} from '../../../utils/errors';
import { validateRequest, requireAuth } from '../../../middleware';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('WorkflowRoutes');

/**
 * @route GET /api/workflows
 * @desc Get all workflows
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const workflows = await storage.getWorkflows();
    
    logger.info('Workflows fetched successfully', { count: workflows.length });
    res.json(workflows);
  } catch (error) {
    logger.error('Error fetching workflows', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/workflows
 * @desc Create a new workflow
 * @access Private
 */
router.post('/', requireAuth, validateRequest(insertWorkflowSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const workflow = await storage.createWorkflow({
      ...req.body,
      creatorId: userId,
    });
    
    logger.info('Workflow created successfully', { workflowId: workflow.id, userId });
    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Error creating workflow', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/:id
 * @desc Get a workflow by ID
 * @access Private
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    if (isNaN(workflowId)) {
      throw new ValidationError('Invalid workflow ID');
    }

    const workflow = await storage.getWorkflow(workflowId);
    
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }
    
    logger.info('Workflow fetched successfully', { workflowId });
    res.json(workflow);
  } catch (error) {
    logger.error('Error fetching workflow', { 
      workflowId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/:id/stages
 * @desc Get all stages for a workflow
 * @access Private
 */
router.get('/:id/stages', requireAuth, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    if (isNaN(workflowId)) {
      throw new ValidationError('Invalid workflow ID');
    }

    const stages = await storage.getWorkflowStages(workflowId);
    
    logger.info('Workflow stages fetched successfully', { 
      workflowId, 
      count: stages.length 
    });
    
    res.json(stages);
  } catch (error) {
    logger.error('Error fetching workflow stages', { 
      workflowId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/:workflowId/stages/:stageId
 * @desc Get a specific stage by ID for a workflow
 * @access Private
 */
router.get('/:workflowId/stages/:stageId', requireAuth, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.workflowId);
    const stageId = parseInt(req.params.stageId);
    
    if (isNaN(workflowId) || isNaN(stageId)) {
      throw new ValidationError('Invalid workflow or stage ID');
    }

    const stage = await storage.getWorkflowStage(workflowId, stageId);
    
    if (!stage) {
      throw new NotFoundError('Stage not found');
    }
    
    logger.info('Workflow stage fetched successfully', { workflowId, stageId });
    res.json(stage);
  } catch (error) {
    logger.error('Error fetching workflow stage', { 
      workflowId: req.params.workflowId, 
      stageId: req.params.stageId,
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/:workflowId/stages/:stageId/tasks
 * @desc Get all tasks for a specific stage in a workflow
 * @access Private
 */
router.get('/:workflowId/stages/:stageId/tasks', requireAuth, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.workflowId);
    const stageId = parseInt(req.params.stageId);
    
    if (isNaN(workflowId) || isNaN(stageId)) {
      throw new ValidationError('Invalid workflow or stage ID');
    }

    const tasks = await storage.getTasksByWorkflowStage(workflowId, stageId);
    
    logger.info('Tasks by workflow stage fetched successfully', { 
      workflowId, 
      stageId, 
      count: tasks.length 
    });
    
    res.json(tasks);
  } catch (error) {
    logger.error('Error fetching tasks by workflow stage', { 
      workflowId: req.params.workflowId, 
      stageId: req.params.stageId,
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/workflows/:id/stages
 * @desc Create a new stage for a workflow
 * @access Private
 */
router.post('/:id/stages', requireAuth, validateRequest(insertWorkflowStageSchema), async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    if (isNaN(workflowId)) {
      throw new ValidationError('Invalid workflow ID');
    }

    const stage = await storage.createWorkflowStage({
      ...req.body,
      workflowId,
    });
    
    logger.info('Workflow stage created successfully', { 
      workflowId, 
      stageId: stage.id, 
      userId: req.user?.id 
    });
    
    res.status(201).json(stage);
  } catch (error) {
    logger.error('Error creating workflow stage', { 
      workflowId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/:id/transitions
 * @desc Get all transitions for a workflow
 * @access Private
 */
router.get('/:id/transitions', requireAuth, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    if (isNaN(workflowId)) {
      throw new ValidationError('Invalid workflow ID');
    }

    const transitions = await storage.getWorkflowTransitions(workflowId);
    
    logger.info('Workflow transitions fetched successfully', { 
      workflowId, 
      count: transitions.length 
    });
    
    res.json(transitions);
  } catch (error) {
    logger.error('Error fetching workflow transitions', { 
      workflowId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/workflows/transitions
 * @desc Create a new workflow transition
 * @access Private
 */
router.post('/transitions', requireAuth, validateRequest(insertWorkflowTransitionSchema), async (req, res) => {
  try {
    const transition = await storage.createWorkflowTransition(req.body);
    
    logger.info('Workflow transition created successfully', { 
      transitionId: transition.id, 
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      userId: req.user?.id 
    });
    
    res.status(201).json(transition);
  } catch (error) {
    logger.error('Error creating workflow transition', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/workflows/stages
 * @desc Get all workflow stages
 * @access Private
 */
router.get('/stages/all', requireAuth, async (req, res) => {
  try {
    const stages = await storage.getAllStages();
    
    logger.info('All workflow stages fetched successfully', { count: stages.length });
    res.json(stages);
  } catch (error) {
    logger.error('Error fetching all workflow stages', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route PATCH /api/workflows/tasks/:taskId/stage
 * @desc Update a task's stage
 * @access Private
 */
router.patch('/tasks/:taskId/stage', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { stageId } = req.body;
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }
    
    if (!stageId || isNaN(parseInt(stageId))) {
      throw new ValidationError('Valid stage ID is required');
    }

    const task = await storage.updateTaskStage(taskId, parseInt(stageId));
    
    logger.info('Task stage updated successfully', { 
      taskId, 
      stageId, 
      userId: req.user?.id 
    });
    
    res.json(task);
  } catch (error) {
    logger.error('Error updating task stage', { 
      taskId: req.params.taskId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

export default router;
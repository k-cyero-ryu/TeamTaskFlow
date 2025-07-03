import { Router } from "express";
import { storage } from "../../storage";
import { Logger } from "../../utils/logger";
import { insertEstimationSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();
const logger = new Logger('EstimationRoutes');

/**
 * @route GET /api/estimations
 * @desc Get all estimations
 * @access Private
 */
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimations = await storage.getEstimations();

    logger.info('Estimations fetched successfully', {
      count: estimations.length,
      userId: req.user.id,
    });

    res.json(estimations);
  } catch (error) {
    logger.error('Failed to fetch estimations', { error, userId: req.user?.id });
    res.status(500).json({ error: "Failed to fetch estimations" });
  }
});

/**
 * @route GET /api/estimations/:id
 * @desc Get estimation by ID
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimationId = parseInt(req.params.id);

    if (isNaN(estimationId)) {
      return res.status(400).json({ error: "Invalid estimation ID" });
    }

    const estimation = await storage.getEstimation(estimationId);

    if (!estimation) {
      return res.status(404).json({ error: "Estimation not found" });
    }

    logger.info('Estimation fetched successfully', {
      estimationId,
      userId: req.user.id,
    });

    res.json(estimation);
  } catch (error) {
    logger.error('Failed to fetch estimation', { 
      error, 
      estimationId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to fetch estimation" });
  }
});

/**
 * @route POST /api/estimations
 * @desc Create new estimation
 * @access Private
 */
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log('Request body:', req.body);
    const validationResult = insertEstimationSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.log('Validation errors:', validationResult.error.errors);
      return res.status(400).json({ 
        error: "Invalid estimation data", 
        details: validationResult.error.errors 
      });
    }

    const estimation = await storage.createEstimation(validationResult.data, req.user.id);

    logger.info('Estimation created successfully', {
      estimationId: estimation.id,
      userId: req.user.id,
    });

    res.status(201).json(estimation);
  } catch (error) {
    logger.error('Failed to create estimation', { error, userId: req.user?.id });
    res.status(500).json({ error: "Failed to create estimation" });
  }
});

/**
 * @route PUT /api/estimations/:id
 * @desc Update estimation
 * @access Private
 */
router.put("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimationId = parseInt(req.params.id);

    if (isNaN(estimationId)) {
      return res.status(400).json({ error: "Invalid estimation ID" });
    }

    const validationResult = insertEstimationSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid estimation data", 
        details: validationResult.error.errors 
      });
    }

    const estimation = await storage.updateEstimation(estimationId, validationResult.data);

    logger.info('Estimation updated successfully', {
      estimationId,
      userId: req.user.id,
    });

    res.json(estimation);
  } catch (error) {
    logger.error('Failed to update estimation', { 
      error, 
      estimationId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to update estimation" });
  }
});

/**
 * @route DELETE /api/estimations/:id
 * @desc Delete estimation
 * @access Private
 */
router.delete("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimationId = parseInt(req.params.id);

    if (isNaN(estimationId)) {
      return res.status(400).json({ error: "Invalid estimation ID" });
    }

    await storage.deleteEstimation(estimationId);

    logger.info('Estimation deleted successfully', {
      estimationId,
      userId: req.user.id,
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete estimation', { 
      error, 
      estimationId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to delete estimation" });
  }
});

/**
 * @route POST /api/estimations/:id/items
 * @desc Add item to estimation
 * @access Private
 */
router.post("/:id/items", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimationId = parseInt(req.params.id);

    if (isNaN(estimationId)) {
      return res.status(400).json({ error: "Invalid estimation ID" });
    }

    const { stockItemId, quantity } = req.body;

    if (!stockItemId || !quantity) {
      return res.status(400).json({ error: "Stock item ID and quantity are required" });
    }

    if (typeof stockItemId !== 'number' || typeof quantity !== 'number') {
      return res.status(400).json({ error: "Stock item ID and quantity must be numbers" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    const estimationItem = await storage.addEstimationItem(estimationId, stockItemId, quantity);

    logger.info('Estimation item added successfully', {
      estimationId,
      stockItemId,
      quantity,
      userId: req.user.id,
    });

    res.status(201).json(estimationItem);
  } catch (error) {
    logger.error('Failed to add estimation item', { 
      error, 
      estimationId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to add estimation item" });
  }
});

/**
 * @route PUT /api/estimations/:estimationId/items/:itemId
 * @desc Update estimation item quantity
 * @access Private
 */
router.put("/:estimationId/items/:itemId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }

    const { quantity } = req.body;

    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({ error: "Quantity is required and must be a number" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    const estimationItem = await storage.updateEstimationItem(itemId, quantity);

    logger.info('Estimation item updated successfully', {
      itemId,
      quantity,
      userId: req.user.id,
    });

    res.json(estimationItem);
  } catch (error) {
    logger.error('Failed to update estimation item', { 
      error, 
      itemId: req.params.itemId, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to update estimation item" });
  }
});

/**
 * @route DELETE /api/estimations/:estimationId/items/:itemId
 * @desc Remove item from estimation
 * @access Private
 */
router.delete("/:estimationId/items/:itemId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }

    await storage.deleteEstimationItem(itemId);

    logger.info('Estimation item deleted successfully', {
      itemId,
      userId: req.user.id,
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete estimation item', { 
      error, 
      itemId: req.params.itemId, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to delete estimation item" });
  }
});

export default router;
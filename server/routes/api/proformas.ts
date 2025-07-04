import { Router } from "express";
import { storage } from "../../storage";
import { Logger } from "../../utils/logger";
import { insertProformaSchema } from "@shared/schema";

const router = Router();
const logger = new Logger('ProformaRoutes');

/**
 * @route GET /api/proformas
 * @desc Get all proformas
 * @access Private
 */
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const proformas = await storage.getProformas();

    logger.info('Proformas fetched successfully', {
      count: proformas.length,
      userId: req.user.id,
    });

    res.json(proformas);
  } catch (error) {
    logger.error('Failed to fetch proformas', { error, userId: req.user?.id });
    res.status(500).json({ error: "Failed to fetch proformas" });
  }
});

/**
 * @route GET /api/proformas/:id
 * @desc Get proforma by ID
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const proformaId = parseInt(req.params.id);

    if (isNaN(proformaId)) {
      return res.status(400).json({ error: "Invalid proforma ID" });
    }

    const proforma = await storage.getProforma(proformaId);

    if (!proforma) {
      return res.status(404).json({ error: "Proforma not found" });
    }

    logger.info('Proforma fetched successfully', {
      proformaId,
      userId: req.user.id,
    });

    res.json(proforma);
  } catch (error) {
    logger.error('Failed to fetch proforma', { 
      error, 
      proformaId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to fetch proforma" });
  }
});

/**
 * @route POST /api/proformas
 * @desc Create new proforma
 * @access Private
 */
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationResult = insertProformaSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid proforma data", 
        details: validationResult.error.errors 
      });
    }

    const proforma = await storage.createProforma(validationResult.data, req.user.id);

    logger.info('Proforma created successfully', {
      proformaId: proforma.id,
      estimationId: validationResult.data.estimationId,
      userId: req.user.id,
    });

    res.status(201).json(proforma);
  } catch (error) {
    logger.error('Failed to create proforma', { error, userId: req.user?.id });
    res.status(500).json({ error: "Failed to create proforma" });
  }
});

/**
 * @route PUT /api/proformas/:id
 * @desc Update proforma
 * @access Private
 */
router.put("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const proformaId = parseInt(req.params.id);

    if (isNaN(proformaId)) {
      return res.status(400).json({ error: "Invalid proforma ID" });
    }

    // Validate partial proforma data
    const validationResult = insertProformaSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid proforma data", 
        details: validationResult.error.errors 
      });
    }

    const proforma = await storage.updateProforma(proformaId, validationResult.data);

    logger.info('Proforma updated successfully', {
      proformaId,
      userId: req.user.id,
    });

    res.json(proforma);
  } catch (error) {
    logger.error('Failed to update proforma', { 
      error, 
      proformaId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to update proforma" });
  }
});

/**
 * @route DELETE /api/proformas/:id
 * @desc Delete proforma
 * @access Private
 */
router.delete("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const proformaId = parseInt(req.params.id);

    if (isNaN(proformaId)) {
      return res.status(400).json({ error: "Invalid proforma ID" });
    }

    await storage.deleteProforma(proformaId);

    logger.info('Proforma deleted successfully', {
      proformaId,
      userId: req.user.id,
    });

    res.json({ message: "Proforma deleted successfully" });
  } catch (error) {
    logger.error('Failed to delete proforma', { 
      error, 
      proformaId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to delete proforma" });
  }
});

export default router;
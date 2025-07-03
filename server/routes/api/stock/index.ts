import { Router } from "express";
import { storage } from "../../../storage";
import { Logger } from "../../../utils/logger";
import { insertStockItemSchema, insertUserStockPermissionSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();
const logger = new Logger('StockRoutes');

// Middleware to check stock permissions
const checkStockPermissions = (requiredPermission: 'view' | 'manage' | 'adjust') => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      
      // Admin (user ID 1) always has all permissions
      if (userId === 1) {
        return next();
      }

      const permissions = await storage.getUserStockPermissions(userId);
      
      if (!permissions) {
        return res.status(403).json({ error: "No stock access permissions" });
      }

      switch (requiredPermission) {
        case 'view':
          if (!permissions.canViewStock) {
            return res.status(403).json({ error: "No permission to view stock" });
          }
          break;
        case 'manage':
          if (!permissions.canManageStock) {
            return res.status(403).json({ error: "No permission to manage stock items" });
          }
          break;
        case 'adjust':
          if (!permissions.canAdjustQuantities) {
            return res.status(403).json({ error: "No permission to adjust quantities" });
          }
          break;
      }

      next();
    } catch (error) {
      logger.error('Error checking stock permissions', { error, userId: req.user?.id });
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

/**
 * @route GET /api/stock/items
 * @desc Get all stock items
 * @access Private (requires stock view permission)
 */
router.get("/items", checkStockPermissions('view'), async (req, res) => {
  try {
    const items = await storage.getStockItems();
    
    logger.info('Stock items fetched successfully', { 
      count: items.length,
      userId: req.user.id 
    });
    
    res.json(items);
  } catch (error) {
    logger.error('Failed to fetch stock items', { 
      error, 
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to fetch stock items" });
  }
});

/**
 * @route POST /api/stock/items
 * @desc Create a new stock item
 * @access Private (requires stock manage permission)
 */
router.post("/items", checkStockPermissions('manage'), async (req, res) => {
  try {
    const itemData = insertStockItemSchema.parse(req.body);
    
    const newItem = await storage.createStockItem(itemData);
    
    logger.info('Stock item created successfully', { 
      itemId: newItem.id,
      itemName: newItem.name,
      userId: req.user.id 
    });
    
    res.status(201).json(newItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid item data", 
        details: error.errors 
      });
    }
    
    logger.error('Failed to create stock item', { 
      error, 
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to create stock item" });
  }
});

/**
 * @route GET /api/stock/items/:id
 * @desc Get a specific stock item
 * @access Private (requires stock view permission)
 */
router.get("/items/:id", checkStockPermissions('view'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    const item = await storage.getStockItem(itemId);
    
    if (!item) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    
    logger.info('Stock item fetched successfully', { 
      itemId,
      userId: req.user.id 
    });
    
    res.json(item);
  } catch (error) {
    logger.error('Failed to fetch stock item', { 
      error, 
      itemId: req.params.id,
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to fetch stock item" });
  }
});

/**
 * @route PUT /api/stock/items/:id
 * @desc Update a stock item
 * @access Private (requires stock manage permission)
 */
router.put("/items/:id", checkStockPermissions('manage'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    const updateData = insertStockItemSchema.partial().parse(req.body);
    
    const updatedItem = await storage.updateStockItem(itemId, updateData);
    
    logger.info('Stock item updated successfully', { 
      itemId,
      userId: req.user.id 
    });
    
    res.json(updatedItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid update data", 
        details: error.errors 
      });
    }
    
    logger.error('Failed to update stock item', { 
      error, 
      itemId: req.params.id,
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to update stock item" });
  }
});

/**
 * @route DELETE /api/stock/items/:id
 * @desc Delete a stock item
 * @access Private (requires stock manage permission)
 */
router.delete("/items/:id", checkStockPermissions('manage'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    await storage.deleteStockItem(itemId);
    
    logger.info('Stock item deleted successfully', { 
      itemId,
      userId: req.user.id 
    });
    
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete stock item', { 
      error, 
      itemId: req.params.id,
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to delete stock item" });
  }
});

/**
 * @route POST /api/stock/items/:id/adjust
 * @desc Adjust stock item quantity
 * @access Private (requires stock adjust permission or assigned user)
 */
router.post("/items/:id/adjust", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const itemId = parseInt(req.params.id);
    const userId = req.user.id;
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    const { quantity, reason } = req.body;
    
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }
    
    // Check permissions - admin, user with adjust permission, or assigned user
    const permissions = await storage.getUserStockPermissions(userId);
    const item = await storage.getStockItem(itemId);
    
    if (!item) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    
    const canAdjust = userId === 1 || // Admin
                     permissions?.canAdjustQuantities || // Has adjust permission
                     item.assignedUserId === userId; // Assigned user
    
    if (!canAdjust) {
      return res.status(403).json({ error: "No permission to adjust this item's quantity" });
    }
    
    const updatedItem = await storage.adjustStockQuantity(itemId, userId, quantity, reason);
    
    logger.info('Stock quantity adjusted successfully', { 
      itemId,
      newQuantity: quantity,
      userId 
    });
    
    res.json(updatedItem);
  } catch (error) {
    logger.error('Failed to adjust stock quantity', { 
      error, 
      itemId: req.params.id,
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to adjust stock quantity" });
  }
});

/**
 * @route GET /api/stock/items/:id/movements
 * @desc Get stock movement history for an item
 * @access Private (requires stock view permission)
 */
router.get("/items/:id/movements", checkStockPermissions('view'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    const movements = await storage.getStockMovements(itemId);
    
    logger.info('Stock movements fetched successfully', { 
      itemId,
      movementCount: movements.length,
      userId: req.user.id 
    });
    
    res.json(movements);
  } catch (error) {
    logger.error('Failed to fetch stock movements', { 
      error, 
      itemId: req.params.id,
      userId: req.user.id 
    });
    res.status(500).json({ error: "Failed to fetch stock movements" });
  }
});

/**
 * @route GET /api/stock/permissions
 * @desc Get users with stock access permissions
 * @access Private (admin only)
 */
router.get("/permissions", async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.id !== 1) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const usersWithAccess = await storage.getUsersWithStockAccess();
    
    logger.info('Stock permissions fetched successfully', { 
      userCount: usersWithAccess.length,
      adminId: req.user.id 
    });
    
    res.json(usersWithAccess);
  } catch (error) {
    logger.error('Failed to fetch stock permissions', { 
      error, 
      adminId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to fetch stock permissions" });
  }
});

/**
 * @route POST /api/stock/permissions/:userId
 * @desc Set stock permissions for a user
 * @access Private (admin only)
 */
router.post("/permissions/:userId", async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.id !== 1) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    
    const permissionData = insertUserStockPermissionSchema.parse(req.body);
    
    const permissions = await storage.setUserStockPermissions(
      userId, 
      permissionData, 
      req.user.id
    );
    
    logger.info('Stock permissions set successfully', { 
      targetUserId: userId,
      permissions,
      adminId: req.user.id 
    });
    
    res.json(permissions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid permission data", 
        details: error.errors 
      });
    }
    
    logger.error('Failed to set stock permissions', { 
      error, 
      targetUserId: req.params.userId,
      adminId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to set stock permissions" });
  }
});

export default router;
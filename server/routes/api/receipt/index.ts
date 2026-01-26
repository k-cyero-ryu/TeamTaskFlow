import { Router } from "express";
import { storage } from "../../../storage";
import { Logger } from "../../../utils/logger";
import { insertReceiptSchema, insertUserStockPermissionSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();
const logger = new Logger('StockRoutes');


// Middleware to check stock permissions
const checkStockPermissions = (requiredPermission: 'view' | 'manage') => {
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
				return res.status(403).json({ error: "No receipt access permissions" });
			}

			switch (requiredPermission) {
				case 'view':
					if (!permissions.canViewStock) {
						return res.status(403).json({ error: "No permission to view the receipts" });
					}
					break;
				case 'manage':
					if (!permissions.canManageStock) {
						return res.status(403).json({ error: "No permission to manage receipts" });
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
	* @route GET /api/receipts/items
	* @desc Get all receipts
	* @access Private (requires receipt view permission)
	*/
router.get("/items", checkStockPermissions('view'), async (req, res) => {
		try {
				const items = await storage.getReceipts();

				logger.info('receipts fetched successfully', {
						count: items.length,
						userId: req.user?.id
				});

				res.json(items);
		} catch (error) {
				logger.error('Failed to fetch receipts', {
						error,
						userId: req.user?.id
				});
				res.status(500).json({ error: "Failed to fetch receipts" });
		}
});

/**
	* @route POST /api/receipt/receipt
	* @desc Create a new receipt
	* @access Private (requires receipt manage permission)
	*/
router.post(
  "/InsertItems",
  checkStockPermissions("manage"),
  async (req, res) => {
    try {
      const receiptData = insertReceiptSchema.parse(req.body);

      const newReceipt = await storage.createReceipt(
        receiptData,
        req.user!.id
      );

      res.status(201).json(newReceipt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid receipt data",
          details: error.errors,
        });
      }

      logger.error("Failed to create receipt", {
        error,
        userId: req.user?.id,
      });

      res.status(500).json({ error: "Failed to create receipt" });
    }
  }
);



export default router
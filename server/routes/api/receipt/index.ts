// import { Router } from "express";
// import { storage } from "../../../storage";
// import { Logger } from "../../../utils/logger";
// import { insertStockItemSchema, insertUserStockPermissionSchema } from "@shared/schema";
// import { z } from "zod";

// const router = Router();
// const logger = new Logger('ReceiptRoute');

// const checkReceiptPermissions = (requiredPermission: 'view' | 'manage' | 'adjust') => {
// 	return async (req: any, res: any, next: any) => {
// 		try {
// 			if (!req.isAuthenticated()) {
// 				return res.status(401).json({ error: "Authentication required" });
// 			}

// 			const userId = req.user.id;

// 			// Admin (user ID 1) always has all permissions
// 			if (userId === 1) {
// 				return next();
// 			}

// 			const permissions = await storage.getUserStockPermissions(userId);

// 			if (!permissions) {
// 				return res.status(403).json({ error: "No stock access permissions" });
// 			}

// 			switch (requiredPermission) {
// 				case 'view':
// 					if (!permissions.canViewStock) {
// 						return res.status(403).json({ error: "No permission to view stock" });
// 					}
// 					break;
// 				case 'manage':
// 					if (!permissions.canManageStock) {
// 						return res.status(403).json({ error: "No permission to manage stock items" });
// 					}
// 					break;
// 				case 'adjust':
// 					if (!permissions.canAdjustQuantities) {
// 						return res.status(403).json({ error: "No permission to adjust quantities" });
// 					}
// 					break;
// 			}

// 			next();
// 		} catch (error) {
// 			logger.error('Error checking stock permissions', { error, userId: req.user?.id });
// 			res.status(500).json({ error: "Internal server error" });
// 		}
// 	};
// };

// // fetching the receipts
// router.get("/receipts", checkReceiptPermissions('view'), async(req, res) {
// 	try{
// 		const items = await storage.getReceiptItems();
// 	}
// })

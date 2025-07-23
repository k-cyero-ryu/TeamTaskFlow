import { Router } from "express";
import { insertExpenseSchema, insertExpenseReceiptSchema } from "@shared/schema";
import { storage } from "../../storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import expensePermissionsRouter from "./expenses/permissions";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/expense-receipts/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  },
});

// Ensure upload directory exists
const uploadDir = 'uploads/expense-receipts';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Register permission routes BEFORE parameterized routes
router.use('/permissions', expensePermissionsRouter);

// Get all expenses
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const expenses = await storage.getExpenses();
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// Get a specific expense
router.get("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    const expense = await storage.getExpense(id);
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({ message: "Failed to fetch expense" });
  }
});

// Create a new expense
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const validatedData = insertExpenseSchema.parse(req.body);
    const expense = await storage.createExpense(validatedData, req.user.id);
    res.status(201).json(expense);
  } catch (error) {
    console.error("Error creating expense:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid expense data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create expense" });
  }
});

// Update an expense
router.put("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    const validatedData = insertExpenseSchema.partial().parse(req.body);
    const expense = await storage.updateExpense(id, validatedData);
    res.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid expense data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update expense" });
  }
});

// Mark an expense as paid
router.post("/:id/mark-paid", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    const expense = await storage.markExpenseAsPaid(id);
    res.json(expense);
  } catch (error) {
    console.error("Error marking expense as paid:", error);
    res.status(500).json({ message: "Failed to mark expense as paid" });
  }
});

// Delete an expense
router.delete("/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    await storage.deleteExpense(id);
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ message: "Failed to delete expense" });
  }
});

// Get receipts for an expense
router.get("/:id/receipts", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const expenseId = parseInt(req.params.id);
    const receipts = await storage.getExpenseReceipts(expenseId);
    res.json(receipts);
  } catch (error) {
    console.error("Error fetching expense receipts:", error);
    res.status(500).json({ message: "Failed to fetch expense receipts" });
  }
});

// Upload a receipt for an expense
router.post("/:id/receipts", upload.single('receipt'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const expenseId = parseInt(req.params.id);
    const { paymentDate, amount, notes } = req.body;

    if (!paymentDate || !amount) {
      return res.status(400).json({ message: "Payment date and amount are required" });
    }

    const receiptData = {
      expenseId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      paymentDate,
      amount: parseInt(amount), // Convert to cents
      notes: notes || null,
    };

    const validatedData = insertExpenseReceiptSchema.parse(receiptData);
    const receipt = await storage.uploadExpenseReceipt(validatedData, req.user.id);
    res.status(201).json(receipt);
  } catch (error) {
    console.error("Error uploading expense receipt:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid receipt data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to upload expense receipt" });
  }
});

// Delete a receipt
router.delete("/receipts/:receiptId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const receiptId = parseInt(req.params.receiptId);
    await storage.deleteExpenseReceipt(receiptId);
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting expense receipt:", error);
    res.status(500).json({ message: "Failed to delete expense receipt" });
  }
});

// Download/serve receipt files
router.get("/receipts/:receiptId/download", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const receiptId = parseInt(req.params.receiptId);
    
    // Find the receipt to get the file path
    // We need to query the database to get the receipt info
    // For now, let's implement a simple file serving mechanism
    
    res.status(501).json({ message: "File download not implemented yet" });
  } catch (error) {
    console.error("Error downloading receipt:", error);
    res.status(500).json({ message: "Failed to download receipt" });
  }
});

// Permission routes already registered above

export default router;
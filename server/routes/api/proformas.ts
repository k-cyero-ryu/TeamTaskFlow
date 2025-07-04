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

/**
 * @route GET /api/proformas/:id/print
 * @desc Get proforma print view
 * @access Private
 */
router.get("/:id/print", async (req, res) => {
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

    // Generate HTML for print view
    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Proforma ${proforma.proformaNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-info { margin-bottom: 20px; }
        .proforma-info { margin-bottom: 20px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; }
        .total { font-weight: bold; font-size: 1.2em; }
        .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QUOTATION</h1>
        <h2>${proforma.proformaNumber}</h2>
      </div>
      
      <div class="company-info">
        <h3>Bill To:</h3>
        <p><strong>${proforma.companyName}</strong></p>
        <p>${proforma.companyEmail}</p>
        <p>${proforma.companyAddress}</p>
        ${proforma.companyPhone ? `<p>${proforma.companyPhone}</p>` : ''}
      </div>
      
      <div class="proforma-info">
        <p><strong>Date:</strong> ${new Date(proforma.createdAt).toLocaleDateString()}</p>
        ${proforma.validUntil ? `<p><strong>Valid Until:</strong> ${new Date(proforma.validUntil).toLocaleDateString()}</p>` : ''}
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${proforma.items.map(item => `
            <tr>
              <td>${item.stockItemName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td>${formatCurrency(item.totalPrice)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total">
        <p><strong>Total Amount: ${formatCurrency(proforma.totalPrice)}</strong></p>
      </div>
      

      
      <div class="no-print" style="margin-top: 20px;">
        <button onclick="window.print()">Print</button>
        <button onclick="window.close()">Close</button>
      </div>
    </body>
    </html>
    `;

    logger.info('Proforma print view generated', {
      proformaId,
      userId: req.user.id,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(printHTML);
  } catch (error) {
    logger.error('Failed to generate proforma print view', { 
      error, 
      proformaId: req.params.id, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: "Failed to generate print view" });
  }
});

export default router;
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
        @page {
          size: A4;
          margin: 20mm;
        }
        
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          padding: 0;
          line-height: 1.4;
          font-size: 12px;
          color: #333;
        }
        
        .header { 
          text-align: center; 
          margin-bottom: 25px; 
          padding-bottom: 15px;
          border-bottom: 2px solid #333;
        }
        
        .header h1 {
          margin: 0 0 5px 0;
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        
        .header h2 {
          margin: 0;
          font-size: 18px;
          color: #666;
        }
        
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
        }
        
        .company-info, .proforma-info {
          width: 48%;
        }
        
        .company-info h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: bold;
          color: #333;
        }
        
        .company-info p, .proforma-info p {
          margin: 2px 0;
          font-size: 12px;
        }
        
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        
        .items-table th {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          padding: 10px 8px;
          text-align: left;
          font-weight: bold;
          font-size: 11px;
        }
        
        .items-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-size: 11px;
        }
        
        .items-table tbody tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        .items-table .text-right {
          text-align: right;
        }
        
        .total { 
          text-align: right;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 2px solid #333;
        }
        
        .total p {
          margin: 5px 0;
          font-size: 16px;
          font-weight: bold;
        }
        
        .footer { 
          margin-top: 30px; 
          font-size: 10px; 
          color: #666;
          text-align: center;
        }
        
        /* Pagination styles */
        .page-break {
          page-break-before: always;
        }
        
        .keep-together {
          page-break-inside: avoid;
        }
        
        @media print {
          body { 
            margin: 0;
            padding: 0;
          }
          .no-print { 
            display: none !important; 
          }
          .items-table {
            page-break-inside: auto;
          }
          .items-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .items-table thead {
            display: table-header-group;
          }
          .total {
            page-break-inside: avoid;
          }
        }
        
        @media screen {
          body {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QUOTATION</h1>
        <h2>${proforma.proformaNumber}</h2>
      </div>
      
      <div class="info-section">
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
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 45%;">Item</th>
            <th style="width: 15%;" class="text-right">Quantity</th>
            <th style="width: 20%;" class="text-right">Unit Price</th>
            <th style="width: 20%;" class="text-right">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${proforma.items.map(item => `
            <tr>
              <td>${item.stockItemName}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${formatCurrency(item.totalPrice)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total keep-together">
        <p><strong>Total Amount: ${formatCurrency(proforma.totalPrice)}</strong></p>
      </div>
      
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>This quotation is valid until ${proforma.validUntil ? new Date(proforma.validUntil).toLocaleDateString() : 'further notice'}</p>
      </div>
      
      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; margin: 0 10px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
        <button onclick="window.close()" style="padding: 10px 20px; margin: 0 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
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
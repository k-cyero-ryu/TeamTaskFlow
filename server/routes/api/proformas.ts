import { Router } from "express";
import { storage } from "../../storage";
import { Logger } from "../../utils/logger";
import { insertProformaSchema } from "@shared/schema";
import { requireAuth } from "../../middleware";

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
 * Helper function to convert image file to base64
 */
const getImageAsBase64 = async (logoPath: string): Promise<string> => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Handle both full paths and relative paths
    let filePath;
    if (logoPath.startsWith('/uploads/')) {
      filePath = path.join(process.cwd(), 'uploads', logoPath.substring('/uploads/'.length));
    } else if (logoPath.startsWith('uploads/')) {
      filePath = path.join(process.cwd(), logoPath);
    } else {
      filePath = path.join(process.cwd(), 'uploads', logoPath);
    }
    
    if (fs.existsSync(filePath)) {
      const imageBuffer = fs.readFileSync(filePath);
      return imageBuffer.toString('base64');
    }
    
    return '';
  } catch (error) {
    logger.error('Error reading image file for base64 conversion', { logoPath, error });
    return '';
  }
};

/**
 * @route GET /api/proformas/:id/print
 * @desc Get proforma print view
 * @access Private
 */
router.get("/:id/print", requireAuth, async (req, res) => {
  try {

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

    // Get company logo as base64 if available
    const logoBase64 = proforma.companyLogo ? await getImageAsBase64(proforma.companyLogo) : '';
    const logoHtml = logoBase64 
      ? `<img src="data:image/jpeg;base64,${logoBase64}" alt="Company Logo">`
      : proforma.companyName;

    const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Proforma ${proforma.proformaNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          padding: 0;
          line-height: 1.4;
          font-size: 12px;
          color: #333;
          background-color: #f5f5f5;
        }
        
        .header { 
          background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
          color: white;
          padding: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
        }
        
        .header-left {
          display: flex;
          align-items: center;
        }
        
        .logo {
          background: rgba(255, 255, 255, 0.2);
          padding: 10px 15px;
          border-radius: 8px;
          margin-right: 20px;
          font-weight: bold;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .logo img {
          max-height: 40px;
          max-width: 120px;
          object-fit: contain;
        }
        
        .company-info {
          margin-left: 20px;
        }
        
        .company-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .company-address {
          font-size: 13px;
          line-height: 1.4;
        }
        
        .header-right {
          text-align: right;
        }
        
        .quotation-title {
          font-size: 28px;
          font-weight: bold;
          margin: 0;
          letter-spacing: 1px;
        }
        
        .quotation-details {
          margin-top: 15px;
          font-size: 13px;
          line-height: 1.6;
        }
        
        .content {
          background: white;
          padding: 30px;
          margin: 0;
        }
        
        .project-section {
          margin-bottom: 30px;
        }
        
        .project-title {
          font-size: 14px;
          font-weight: bold;
          color: #333;
          margin: 0 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #ddd;
        }
        
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px;
          font-size: 11px;
        }
        
        .items-table th {
          background-color: #4a90e2;
          color: white;
          border: 1px solid #357abd;
          padding: 12px 8px;
          text-align: center;
          font-weight: bold;
          font-size: 11px;
        }
        
        .items-table td {
          border: 1px solid #ccc;
          padding: 10px 8px;
          text-align: left;
          background-color: white;
        }
        
        .items-table tbody tr:nth-child(even) td {
          background-color: #f9f9f9;
        }
        
        .items-table .text-center {
          text-align: center;
        }
        
        .items-table .text-right {
          text-align: right;
        }
        
        .total-row {
          background-color: #4a90e2 !important;
          color: white !important;
        }
        
        .total-row td {
          background-color: #4a90e2 !important;
          color: white !important;
          font-weight: bold;
          padding: 12px 8px;
        }
        
        .validity-note {
          margin-top: 20px;
          font-size: 11px;
          color: #666;
        }
        
        .signature-section {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
        }
        
        .signature-box {
          width: 45%;
          border-bottom: 2px solid #333;
          padding-bottom: 5px;
          text-align: center;
          font-size: 11px;
          font-weight: bold;
          color: #333;
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
            background-color: white;
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
          .total-row {
            page-break-inside: avoid;
          }
        }
        
        @media screen {
          body {
            max-width: 210mm;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <div class="logo">
            ${logoHtml}
          </div>
          <div class="company-info">
            <div class="company-name">${proforma.companyName}</div>
            <div class="company-address">
              ${proforma.companyAddress.replace(/\n/g, '<br>')}
            </div>
          </div>
        </div>
        <div class="header-right">
          <h1 class="quotation-title">COTIZACIÓN #${proforma.proformaNumber}</h1>
          <div class="quotation-details">
            <div>FECHA: ${new Date(proforma.createdAt).toLocaleDateString()}</div>
            ${proforma.validUntil ? `<div>VÁLIDO HASTA: ${new Date(proforma.validUntil).toLocaleDateString()}</div>` : ''}
            <div>VENDEDOR: ${proforma.createdBy.username.toUpperCase()}</div>
            <div>CLIENTE: ${proforma.estimation.clientName}</div>
          </div>
        </div>
      </div>
      
      <div class="content">
        <div class="project-section">
          <h3 class="project-title">DESCRIPCIÓN DEL PROYECTO:</h3>
          <div style="height: 80px; border-bottom: 1px solid #ddd; margin-bottom: 20px;"></div>
        </div>
      
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">PRODUCTO</th>
              <th style="width: 15%;" class="text-center">CANTIDAD</th>
              <th style="width: 17%;" class="text-center">PRECIO</th>
              <th style="width: 18%;" class="text-center">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${proforma.items.map(item => `
              <tr>
                <td>${item.stockItemName}</td>
                <td class="text-center">${item.quantity.toString().padStart(3, '0')}</td>
                <td class="text-center">${formatCurrency(item.unitPrice)}</td>
                <td class="text-center">${formatCurrency(item.totalPrice)}</td>
              </tr>
            `).join('')}
            <!-- Empty rows for spacing -->
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td></tr>
            <tr class="total-row">
              <td colspan="3" class="text-center"><strong>Total</strong></td>
              <td class="text-center"><strong>${formatCurrency(proforma.totalPrice)}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="validity-note">
          ${proforma.validUntil ? `<p><strong>Cotización válida hasta ${new Date(proforma.validUntil).toLocaleDateString()}*</strong></p>` : '<p><strong>Cotización válida por período a acordar*</strong></p>'}
        </div>
      
        <div class="signature-section">
          <div class="signature-box">
            Firma de Cliente
          </div>
          <div class="signature-box">
            Firma de Vendedor
          </div>
        </div>
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
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { storage } from '../../storage';
import { insertCompanySchema } from '@shared/schema';
import { Logger } from '../../utils/logger';

const router = Router();
const logger = new Logger('CompanyRoutes');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'company-logo-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Test endpoint to check multer (without authentication)
router.post('/test', (req, res) => {
  logger.info('Test endpoint called (no auth)', {
    body: req.body,
    contentType: req.get('content-type'),
    user: req.user
  });
  res.json({ 
    message: 'Test successful', 
    body: req.body,
    authenticated: !!req.user
  });
});

// Test endpoint to check multer (with auth)
router.post('/test-auth', upload.single('logo'), (req, res) => {
  logger.info('Test endpoint called (with auth)', {
    body: req.body,
    file: req.file,
    contentType: req.get('content-type'),
    user: req.user
  });
  res.json({ 
    message: 'Test successful', 
    body: req.body, 
    file: req.file ? 'File received' : 'No file'
  });
});

// Get all companies
router.get('/', async (req, res) => {
  try {
    const companies = await storage.getCompanies();
    logger.info('Companies fetched successfully', {
      count: companies.length,
      userId: req.user?.id
    });
    res.json(companies);
  } catch (error: any) {
    logger.error('Failed to fetch companies', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create a new company
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    // Debug logging
    logger.info('Create company request received', {
      body: req.body,
      file: req.file ? { filename: req.file.filename, mimetype: req.file.mimetype } : null,
      userId: req.user?.id,
      contentType: req.get('content-type'),
      headers: req.headers
    });

    // Validate that we have the required fields
    if (!req.body.name || !req.body.address) {
      logger.error('Missing required fields', {
        hasName: !!req.body.name,
        hasAddress: !!req.body.address,
        body: req.body
      });
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Name and address are required' 
      });
    }

    // Parse form data - ensure we handle string values properly
    const formData = {
      name: req.body.name.toString().trim(),
      address: req.body.address.toString().trim(),
      phone: req.body.phone ? req.body.phone.toString().trim() : null,
      email: req.body.email ? req.body.email.toString().trim() : null,
      isDefault: req.body.isDefault === 'true' || req.body.isDefault === true,
      logo: req.file ? req.file.filename : null
    };

    logger.info('Parsed form data', { formData });

    const validatedData = insertCompanySchema.parse(formData);
    const company = await storage.createCompany(validatedData);
    
    logger.info('Company created successfully', {
      companyId: company.id,
      companyName: company.name,
      userId: req.user?.id
    });
    
    res.status(201).json(company);
  } catch (error: any) {
    logger.error('Failed to create company', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId: req.user?.id,
      requestBody: req.body,
      parsedData: req.body ? {
        name: req.body.name,
        address: req.body.address,
        phone: req.body.phone,
        email: req.body.email,
        isDefault: req.body.isDefault
      } : null
    });
    
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid company data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create company' });
    }
  }
});

// Update a company
router.put('/:id', upload.single('logo'), async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    // Parse form data
    const formData: any = {
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone || null,
      email: req.body.email || null,
      isDefault: req.body.isDefault === 'true'
    };

    // Only add logo if a new file was uploaded
    if (req.file) {
      formData.logo = req.file.filename;
    }

    const validatedData = insertCompanySchema.partial().parse(formData);
    const company = await storage.updateCompany(companyId, validatedData);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    logger.info('Company updated successfully', {
      companyId: company.id,
      companyName: company.name,
      userId: req.user?.id
    });
    
    res.json(company);
  } catch (error: any) {
    logger.error('Failed to update company', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId: req.user?.id,
      companyId: req.params.id,
      requestBody: req.body
    });
    
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid company data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
});

// Delete a company
router.delete('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    const success = await storage.deleteCompany(companyId);
    
    if (!success) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    logger.info('Company deleted successfully', {
      companyId,
      userId: req.user?.id
    });
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete company', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId: req.user?.id,
      companyId: req.params.id
    });
    
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
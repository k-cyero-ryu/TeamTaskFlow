import { Router } from 'express';
import { storage } from '../../storage';
import { insertCompanySchema } from '@shared/schema';
import { Logger } from '../../utils/logger';

const router = Router();
const logger = new Logger('CompanyRoutes');

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
router.post('/', async (req, res) => {
  try {
    const validatedData = insertCompanySchema.parse(req.body);
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
      requestBody: req.body
    });
    
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid company data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create company' });
    }
  }
});

// Update a company
router.put('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    const validatedData = insertCompanySchema.parse(req.body);
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
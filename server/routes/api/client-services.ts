import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { clientServices, insertClientServiceSchema, services, clients } from '@shared/schema';
import { validateRequest } from '../../middleware/validate-request';
import { isAuthenticated } from '../../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all client services with related client and service data
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const allClientServices = await db
      .select()
      .from(clientServices)
      .leftJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(services, eq(clientServices.serviceId, services.id));
    
    res.json(allClientServices);
  } catch (error) {
    console.error('Error fetching client services:', error);
    res.status(500).json({ error: 'Failed to fetch client services' });
  }
});

// Get client services by client ID
router.get('/client/:clientId', isAuthenticated, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const clientServicesData = await db
      .select()
      .from(clientServices)
      .leftJoin(services, eq(clientServices.serviceId, services.id))
      .where(eq(clientServices.clientId, clientId));
    
    res.json(clientServicesData);
  } catch (error) {
    console.error('Error fetching client services:', error);
    res.status(500).json({ error: 'Failed to fetch client services' });
  }
});

// Create a new client service assignment
router.post('/', 
  isAuthenticated, 
  async (req, res) => {
    try {
      console.log('POST /api/client-services reached server');
      console.log('Raw request body:', req.body);
      
      // Validate the request body manually
      const validationResult = insertClientServiceSchema.safeParse({
        ...req.body,
        contractFile: req.body.contractFile || undefined
      });
      
      if (!validationResult.success) {
        console.log('Validation failed:', validationResult.error.errors);
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
      }
      
      console.log('Validated data:', validationResult.data);
      
      const dataToInsert = {
        ...validationResult.data,
        characteristics: validationResult.data.characteristics || [],
        contractFile: validationResult.data.contractFile || null
      };
      
      // If a contract file is being uploaded, set the upload date to now
      if (dataToInsert.contractFile) {
        dataToInsert.contractFileUploadDate = new Date();
      }
      
      const [clientService] = await db
        .insert(clientServices)
        .values(dataToInsert)
        .returning();
      
      console.log('Created client service:', clientService);
      res.status(201).json(clientService);
    } catch (error) {
      console.error('Error creating client service:', error);
      res.status(500).json({ error: 'Failed to create client service' });
    }
  }
);

// Update a client service
router.put('/:id', 
  isAuthenticated, 
  validateRequest(insertClientServiceSchema), 
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [clientService] = await db
        .update(clientServices)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(clientServices.id, id))
        .returning();
      
      if (!clientService) {
        return res.status(404).json({ error: 'Client service not found' });
      }
      
      res.json(clientService);
    } catch (error) {
      console.error('Error updating client service:', error);
      res.status(500).json({ error: 'Failed to update client service' });
    }
  }
);

// Delete a client service
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [clientService] = await db
      .delete(clientServices)
      .where(eq(clientServices.id, id))
      .returning();
    
    if (!clientService) {
      return res.status(404).json({ error: 'Client service not found' });
    }
    
    res.json({ message: 'Client service deleted successfully' });
  } catch (error) {
    console.error('Error deleting client service:', error);
    res.status(500).json({ error: 'Failed to delete client service' });
  }
});

export default router;
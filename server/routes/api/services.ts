import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { services, insertServiceSchema } from '@shared/schema';
import { validateRequest } from '../../middleware/validate-request';
import { isAuthenticated } from '../../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all services
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const allServices = await db.select().from(services);
    res.json(allServices);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Create a new service
router.post('/', 
  isAuthenticated, 
  validateRequest(insertServiceSchema), 
  async (req, res) => {
    try {
      const [service] = await db
        .insert(services)
        .values(req.body)
        .returning();
      res.status(201).json(service);
    } catch (error) {
      console.error('Error creating service:', error);
      res.status(500).json({ error: 'Failed to create service' });
    }
  }
);

// Update a service
router.put('/:id', 
  isAuthenticated, 
  validateRequest(insertServiceSchema), 
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [service] = await db
        .update(services)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(services.id, id))
        .returning();
      
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      res.json(service);
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  }
);

// Delete a service
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [service] = await db
      .delete(services)
      .where(eq(services.id, id))
      .returning();
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
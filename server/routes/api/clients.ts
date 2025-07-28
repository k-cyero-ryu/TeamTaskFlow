import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { clients, insertClientSchema } from '@shared/schema';
import { validateRequest } from '../../middleware/validate-request';
import { isAuthenticated } from '../../middleware/auth';
import { eq } from 'drizzle-orm';
import clientPermissionsRouter from './clients/permissions';
import { checkClientPermissions } from '../../middleware/client-permissions';

const router = Router();

// Register permission routes BEFORE parameterized routes
router.use('/permissions', clientPermissionsRouter);

// Get all clients
router.get('/', checkClientPermissions('view'), async (req, res) => {
  try {
    const allClients = await db.select().from(clients);
    res.json(allClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client by ID
router.get('/:id', checkClientPermissions('view'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create a new client
router.post('/', 
  checkClientPermissions('manage'), 
  validateRequest(insertClientSchema), 
  async (req, res) => {
    try {
      const [client] = await db
        .insert(clients)
        .values(req.body)
        .returning();
      res.status(201).json(client);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Failed to create client' });
    }
  }
);

// Update a client
router.put('/:id', 
  checkClientPermissions('manage'), 
  validateRequest(insertClientSchema), 
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [client] = await db
        .update(clients)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json(client);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client' });
    }
  }
);

// Delete a client
router.delete('/:id', checkClientPermissions('delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Permission routes already registered above

export default router;
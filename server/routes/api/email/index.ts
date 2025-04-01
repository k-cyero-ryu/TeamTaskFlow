import { Router } from 'express';
import { storage } from '../../../storage';
import { requireAuth, isAdmin, validateRequest } from '../../../middleware';
import { z } from 'zod';
import { emailService } from '../../../services/email';

const router = Router();

// Define schemas for validation
const createNotificationSchema = z.object({
  userId: z.number(),
  subject: z.string(),
  content: z.string(),
  recipientEmail: z.string().email(),
  type: z.string(),
  relatedEntityId: z.number().nullable().optional(),
  relatedEntityType: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  sendAt: z.string().or(z.date()).optional(),
});

const updateNotificationSchema = z.object({
  subject: z.string().optional(),
  content: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
  sendAt: z.string().or(z.date()).optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  error: z.string().optional(),
});

// Get all email notifications for the authenticated user
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const notifications = await storage.getUserEmailNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching email notifications:', error);
    res.status(500).json({ error: 'Failed to fetch email notifications' });
  }
});

// Create a new email notification
router.post('/notifications', requireAuth, validateRequest(createNotificationSchema), async (req, res) => {
  try {
    // Ensure the user can only create notifications for themselves
    if (req.user && req.body.userId !== req.user.id) {
      return res.status(403).json({ error: 'Cannot create notifications for other users' });
    }
    
    const notification = await storage.createEmailNotification(req.body);
    
    // Send the email immediately if no sendAt date is specified
    if (!req.body.sendAt) {
      try {
        await emailService.sendEmail({
          to: notification.recipientEmail,
          subject: notification.subject,
          html: notification.content,
          metadata: notification.metadata
        });
        
        // Update the notification status to sent
        await storage.updateEmailNotification(notification.id, { 
          status: 'sent',
          sentAt: new Date()
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        
        // Update the notification with the error
        await storage.updateEmailNotification(notification.id, { 
          status: 'failed',
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }
    }
    
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating email notification:', error);
    res.status(500).json({ error: 'Failed to create email notification' });
  }
});

// Get a specific email notification
router.get('/notifications/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    
    const notification = await storage.getEmailNotification(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Only allow users to access their own notifications
    if (req.user && notification.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error fetching email notification:', error);
    res.status(500).json({ error: 'Failed to fetch email notification' });
  }
});

// Update an email notification
router.put('/notifications/:id', requireAuth, validateRequest(updateNotificationSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    
    const notification = await storage.getEmailNotification(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Only allow users to update their own notifications
    if (req.user && notification.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Only allow updating pending notifications
    if (notification.status !== 'pending' && !req.user?.isAdmin) {
      return res.status(400).json({ error: 'Cannot update non-pending notifications' });
    }
    
    const updatedNotification = await storage.updateEmailNotification(id, req.body);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error updating email notification:', error);
    res.status(500).json({ error: 'Failed to update email notification' });
  }
});

// Delete an email notification
router.delete('/notifications/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    
    const notification = await storage.getEmailNotification(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Only allow users to delete their own notifications
    if (req.user && notification.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await storage.deleteEmailNotification(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting email notification:', error);
    res.status(500).json({ error: 'Failed to delete email notification' });
  }
});

// Admin route to manually send pending emails
router.post('/send-pending', isAdmin, async (req, res) => {
  try {
    const pendingNotifications = await storage.getPendingEmailNotifications();
    const results = await emailService.processPendingEmails(pendingNotifications);
    
    res.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      details: results.details
    });
  } catch (error) {
    console.error('Error sending pending emails:', error);
    res.status(500).json({ error: 'Failed to send pending emails' });
  }
});

// Update user's email settings
router.put('/settings', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { email, notificationPreferences } = req.body;
    let updatedUser = req.user;
    
    // Update email if provided
    if (email) {
      if (!z.string().email().safeParse(email).success) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      updatedUser = await storage.updateUserEmail(req.user.id, email);
    }
    
    // Update notification preferences if provided
    if (notificationPreferences) {
      if (typeof notificationPreferences !== 'object') {
        return res.status(400).json({ error: 'Notification preferences must be an object' });
      }
      
      updatedUser = await storage.updateUserNotificationPreferences(req.user.id, notificationPreferences);
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

export default router;
import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../middleware';
import { z } from 'zod';
import { storage } from '../../../storage';
import { emailService } from '../../../services/email';
import { Logger } from '../../../utils/logger';
import smtpRoutes from './smtp';

const router = Router();
const logger = new Logger('EmailRoutes');

// Mount the SMTP routes
router.use('/', smtpRoutes);

// User email preferences schema
const emailPreferencesSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  notificationPreferences: z.record(z.boolean()).optional(),
});

/**
 * @route GET /api/email/settings
 * @desc Get user's email settings
 * @access Private
 */
router.get('/settings', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    // Get the user from the database to ensure we have the latest data
    const user = await storage.getUser(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: {
          type: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Extract the relevant fields for the response
    const settings = {
      email: user.email || "",
      notificationPreferences: user.notificationPreferences || {
        taskAssigned: true,
        taskUpdated: true,
        taskCommented: true,
        mentionedInComment: true,
        privateMessage: true,
        groupMessage: false,
        taskDueReminder: true
      }
    };
    
    res.json(settings);
  } catch (error) {
    logger.error('Error fetching user email settings', { error, userId: req.user?.id });
    res.status(500).json({ 
      error: {
        type: 'SERVER_ERROR',
        message: 'Failed to fetch email settings'
      }
    });
  }
});

/**
 * @route PUT /api/email/settings
 * @desc Update user's email settings
 * @access Private
 */
router.put('/settings', requireAuth, validateRequest(emailPreferencesSchema), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    const { email, notificationPreferences } = req.body;
    let updatedUser = req.user;
    
    // Update email if provided
    if (email !== undefined) {
      updatedUser = await storage.updateUserEmail(req.user.id, email);
      logger.info('User email updated', { userId: req.user.id, email });
    }
    
    // Update notification preferences if provided
    if (notificationPreferences) {
      updatedUser = await storage.updateUserNotificationPreferences(req.user.id, notificationPreferences);
      logger.info('User notification preferences updated', { userId: req.user.id });
    }
    
    res.json({
      email: updatedUser.email || "",
      notificationPreferences: updatedUser.notificationPreferences || {
        taskAssigned: true,
        taskUpdated: true,
        taskCommented: true,
        mentionedInComment: true,
        privateMessage: true,
        groupMessage: false,
        taskDueReminder: true
      }
    });
  } catch (error) {
    logger.error('Error updating email settings', { error, userId: req.user?.id });
    res.status(500).json({ 
      error: {
        type: 'SERVER_ERROR',
        message: 'Failed to update email settings'
      }
    });
  }
});

/**
 * @route GET /api/email/notifications
 * @desc Get user's email notifications
 * @access Private
 */
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    const notifications = await storage.getUserEmailNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching email notifications', { error, userId: req.user?.id });
    res.status(500).json({ 
      error: {
        type: 'SERVER_ERROR',
        message: 'Failed to fetch email notifications'
      }
    });
  }
});

/**
 * @route POST /api/email/notifications/send-welcome
 * @desc Send a test welcome email for the current user
 * @access Private
 */
router.post('/notifications/send-welcome', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    // Get or set user email
    // Get user's current information from storage
    const userData = await storage.getUser(req.user.id);
    let userEmail = userData?.email || '';
    
    if (!userEmail) {
      // If still no email, return an error
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          message: 'User email not set. Please update your email in settings.'
        }
      });
    }
    
    // Generate welcome email content
    const html = emailService.generateEmailFromTemplate('welcome', {
      recipientName: req.user.username,
      dashboardUrl: `${req.protocol}://${req.get('host')}/dashboard`
    });
    
    // Create notification record
    const notification = await storage.createEmailNotification({
      userId: req.user.id,
      subject: "Welcome to Team Collaborator!",
      content: html,
      type: "welcome",
      status: "pending",
      recipientEmail: userEmail
    });
    
    // Send email
    await emailService.sendEmail({
      to: userEmail,
      subject: "Welcome to Team Collaborator!",
      html,
      metadata: { userId: req.user.id, notificationType: "welcome" }
    });
    
    // Update notification status
    await storage.updateEmailNotification(notification.id, { 
      status: 'sent',
      sentAt: new Date()
    });
    
    logger.info('Welcome email sent successfully', { userId: req.user.id });
    
    res.json({ 
      success: true, 
      message: "Welcome email sent successfully",
      notification
    });
  } catch (error) {
    logger.error('Error sending welcome email', { error, userId: req.user?.id });
    res.status(500).json({ 
      error: {
        type: 'SERVER_ERROR',
        message: 'Failed to send welcome email'
      }
    });
  }
});

export default router;
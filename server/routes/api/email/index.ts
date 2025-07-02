import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../middleware';
import { z } from 'zod';
import { storage } from '../../../storage';
import { emailService } from '../../../services/email';
import { Logger } from '../../../utils/logger';
import smtpRoutes from './smtp';
import type { User } from '@shared/schema';

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
    // Need to cast here to avoid type errors since the returned User type is different
    // from the req.user object which comes from passport
    let updatedUser = req.user as unknown as User;
    
    // Update email if provided
    if (email !== undefined) {
      // Make sure we're passing a string or undefined, not null
      const emailToUpdate = email || undefined; // Use undefined instead of empty string for null values
      updatedUser = await storage.updateUserEmail(req.user.id, emailToUpdate);
      logger.info('User email updated', { userId: req.user.id, email: emailToUpdate || "none" });
    }
    
    // Update notification preferences if provided
    if (notificationPreferences) {
      // Need to typecast to ensure compatibility
      const preferences = notificationPreferences as Record<string, boolean>;
      const updatedUserWithPrefs = await storage.updateUserNotificationPreferences(req.user.id, preferences);
      // Update our working copy with the new preferences
      updatedUser = updatedUserWithPrefs;
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
 * @route POST /api/email/notifications/process-pending
 * @desc Process and send pending email notifications
 * @access Private
 */
router.post('/notifications/process-pending', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    // Get pending notifications for the current user
    const pendingNotifications = await storage.getUserEmailNotifications(req.user.id);
    const pending = pendingNotifications.filter(n => n.status === 'pending');
    
    if (pending.length === 0) {
      return res.json({
        success: true,
        message: 'No pending notifications to process',
        processed: 0
      });
    }
    
    // Process pending emails
    const results = await emailService.processPendingEmails(pending);
    
    logger.info('Processed pending emails', { 
      userId: req.user.id, 
      sent: results.sent, 
      failed: results.failed 
    });
    
    res.json({
      success: true,
      message: `Processed ${results.sent + results.failed} notifications. ${results.sent} sent successfully, ${results.failed} failed.`,
      results
    });
  } catch (error) {
    logger.error('Error processing pending emails', { error, userId: req.user?.id });
    res.status(500).json({ 
      error: {
        type: 'SERVER_ERROR',
        message: 'Failed to process pending emails'
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
    
    try {
      // Send email
      await emailService.sendEmail({
        to: userEmail,
        subject: "Welcome to Team Collaborator!",
        html,
        metadata: { userId: req.user.id, notificationType: "welcome" }
      });
      
      // Update notification status to sent if email sending succeeds
      await storage.updateEmailNotification(notification.id, { 
        status: 'sent',
        sentAt: new Date()
      });
    } catch (emailError) {
      // Update notification status to failed if email sending fails
      await storage.updateEmailNotification(notification.id, { 
        status: 'failed',
        error: emailError instanceof Error ? emailError.message : String(emailError)
      });
      
      // Don't throw the error, as we still created the notification successfully
      logger.warn('Email sending failed but notification was created', { 
        error: emailError, 
        notificationId: notification.id 
      });
    }
    
    // Get updated notification status
    const updatedNotification = await storage.getEmailNotification(notification.id);
    
    // Log based on the actual status
    if (updatedNotification?.status === 'sent') {
      logger.info('Welcome email sent successfully', { userId: req.user.id });
    } else {
      logger.info('Welcome email notification created', { 
        userId: req.user.id, 
        status: updatedNotification?.status || 'unknown' 
      });
    }
    
    res.json({ 
      success: true, 
      message: updatedNotification?.status === 'sent' 
        ? "Welcome email sent successfully" 
        : "Welcome email notification created",
      notification: updatedNotification || notification
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

/**
 * @route POST /api/email/direct-test
 * @desc Send a direct test email (for testing purposes)
 * @access Public (for testing only)
 */
router.post('/direct-test', async (req, res) => {
  try {
    const testEmail = 'darkryuudan@gmail.com';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email System Test</h2>
        <p>Hello! This is a test email from your Team Collaborator application.</p>
        <p><strong>Test Results:</strong></p>
        <ul>
          <li>✅ Email service is working correctly</li>
          <li>✅ SMTP configuration is functional</li>
          <li>✅ Email notifications are ready to use</li>
        </ul>
        <p>Your email notification system is now operational!</p>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated test message from Team Collaborator.</p>
      </div>
    `;
    
    await emailService.sendEmail({
      to: testEmail,
      subject: 'Team Collaborator - Email System Test',
      html,
      metadata: { testType: 'direct-test' }
    });
    
    logger.info('Direct test email sent successfully', { to: testEmail });
    
    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to send direct test email', { error });
    
    res.status(500).json({
      error: {
        type: 'EMAIL_SEND_ERROR',
        message: 'Failed to send test email',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

export default router;
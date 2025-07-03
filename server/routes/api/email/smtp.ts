import { Router } from 'express';
import { requireAuth, isAdmin, validateRequest } from '../../../middleware';
import { z } from 'zod';
import { emailService } from '../../../services/email';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('SmtpRoutes');

// SMTP settings schema
const smtpSettingsSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().int().positive("Port must be a positive number"),
  user: z.string().min(1, "SMTP username is required"),
  password: z.string().optional(),
  secure: z.boolean().default(false),
  fromEmail: z.string().email("Must be a valid email address"),
  fromName: z.string().min(1, "From name is required"),
});

// Store SMTP settings in memory (in production, these would be stored in a database or env vars)
let smtpSettings: z.infer<typeof smtpSettingsSchema> | null = null;

/**
 * @route GET /api/email/smtp-settings
 * @desc Get SMTP settings
 * @access Admin only
 */
router.get('/smtp-settings', requireAuth, isAdmin, (req, res) => {
  try {
    // If we have settings stored, return them
    if (smtpSettings) {
      // Don't return the actual password for security
      const safeSettings = {
        ...smtpSettings,
        password: smtpSettings.password ? '••••••••' : '',
      };
      return res.json(safeSettings);
    }
    
    // Otherwise, return current environment settings
    return res.json({
      host: process.env.SMTP_HOST || 'smtp.godaddy.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.GODADDY_SMTP_USER || process.env.SMTP_USER || '',
      password: process.env.GODADDY_SMTP_PASSWORD || process.env.SMTP_PASSWORD ? '••••••••' : '',
      secure: process.env.SMTP_SECURE === 'true',
      fromEmail: process.env.COMPANY_EMAIL_FROM || 'noreply@teamcollaborator.com',
      fromName: 'Team Collaborator',
    });
  } catch (error) {
    logger.error('Error getting SMTP settings', { error });
    res.status(500).json({ error: 'Failed to get SMTP settings' });
  }
});

/**
 * @route PUT /api/email/smtp-settings
 * @desc Update SMTP settings
 * @access Admin only
 */
router.put('/smtp-settings', requireAuth, isAdmin, validateRequest(smtpSettingsSchema), (req, res) => {
  try {
    // If password is empty, keep the current password from environment
    const passwordToUse = req.body.password || 
                         process.env.GODADDY_SMTP_PASSWORD || 
                         process.env.SMTP_PASSWORD || 
                         (smtpSettings?.password);
    
    // Store the settings
    smtpSettings = {
      ...req.body,
      password: passwordToUse,
    };
    
    // Update email service with new settings (only if we have all required fields)
    if (smtpSettings) {
      emailService.updateSmtpSettings({
        host: smtpSettings.host,
        port: smtpSettings.port,
        auth: {
          user: smtpSettings.user,
          pass: smtpSettings.password || '',
        },
        secure: smtpSettings.secure,
        from: `${smtpSettings.fromName} <${smtpSettings.fromEmail}>`,
      });
    }
    
    logger.info('SMTP settings updated successfully', { userId: req.user?.id });
    
    // Don't return the actual password for security
    const safeSettings = {
      ...smtpSettings,
      password: '••••••••',
    };
    
    res.json(safeSettings);
  } catch (error) {
    logger.error('Error updating SMTP settings', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update SMTP settings' });
  }
});

/**
 * @route POST /api/email/test
 * @desc Test SMTP connection by sending a test email
 * @access Admin only
 */
router.post('/test', requireAuth, isAdmin, validateRequest(smtpSettingsSchema), async (req, res) => {
  try {
    const tempSettings = {
      host: req.body.host,
      port: req.body.port,
      auth: {
        user: req.body.user,
        pass: req.body.password,
      },
      secure: req.body.secure,
      from: `${req.body.fromName} <${req.body.fromEmail}>`,
    };
    
    // Test email to the current user's email if available, otherwise to the from email
    const testEmail = req.user?.email || req.body.fromEmail;
    
    // Create a temporary email service and send a test email
    await emailService.sendTestEmail(testEmail, tempSettings);
    
    logger.info('Test email sent successfully', { 
      userId: req.user?.id, 
      recipientEmail: testEmail 
    });
    
    res.json({ 
      success: true, 
      message: `Test email sent successfully to ${testEmail}. Please check your inbox.` 
    });
  } catch (error) {
    logger.error('Error sending test email', { error, userId: req.user?.id });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

export default router;
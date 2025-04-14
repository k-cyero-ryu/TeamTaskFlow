import nodemailer from 'nodemailer';
import { EmailNotification } from '../../../shared/schema';
import { Logger } from '../../utils/logger';
import { storage } from '../../storage';

// Initialize logger for email service
const logger = new Logger('EmailService');

// Email template types
type EmailTemplate = 'task_assignment' | 'task_comment' | 'task_due' | 'welcome' | 'password_reset';

// Email send options
interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  metadata?: Record<string, any>;
}

// Email processing results
interface EmailProcessingResults {
  sent: number;
  failed: number;
  details: Array<{
    id: number;
    success: boolean;
    error?: string;
  }>;
}

// SMTP configuration options
interface SmtpConfig {
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
  secure: boolean;
  from?: string;
}

/**
 * Email service for sending notifications
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;
  private smtpConfig: SmtpConfig | null = null;
  
  /**
   * Initialize the email service
   */
  constructor() {
    // Configure the email transporter
    // In development, we use a test account
    // In production, we would use real SMTP credentials
    this.defaultFrom = 'Team Collaborator <noreply@teamcollaborator.com>';
    
    // Create a transporter with the desired configuration
    this.transporter = this.createTransporter();
    
    logger.info('Email service initialized');
  }
  
  /**
   * Update SMTP settings and recreate the transporter
   * @param config New SMTP configuration
   */
  updateSmtpSettings(config: SmtpConfig): void {
    this.smtpConfig = config;
    if (config.from) {
      this.defaultFrom = config.from;
    }
    
    // Recreate the transporter with new settings
    this.transporter = this.createTransporter(config);
    logger.info('SMTP settings updated');
  }
  
  /**
   * Create the email transporter based on environment or supplied config
   * @param config Optional SMTP configuration to use
   * @returns Email transporter
   */
  private createTransporter(config?: SmtpConfig): nodemailer.Transporter {
    // If config is supplied, use it directly
    if (config) {
      logger.info('Using supplied SMTP configuration');
      return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass
        }
      });
    }
    
    // If we have stored SMTP config, use that
    if (this.smtpConfig) {
      logger.info('Using stored SMTP configuration');
      return nodemailer.createTransport({
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: {
          user: this.smtpConfig.auth.user,
          pass: this.smtpConfig.auth.pass
        }
      });
    }
    
    // In development or if no SMTP credentials, use nodemailer's "ethereal" test account
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
      logger.info('Using development email transport');
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_EMAIL || 'ethereal.user@ethereal.email',
          pass: process.env.ETHEREAL_PASSWORD || 'ethereal_password'
        }
      });
    }
    
    // In production, use real SMTP credentials from environment variables
    logger.info('Using production email transport from environment variables');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  
  /**
   * Send a test email to verify SMTP settings
   * @param recipientEmail Email address to send the test to
   * @param tempSettings Temporary SMTP settings to use
   * @returns Information about the sent message
   */
  async sendTestEmail(recipientEmail: string, tempSettings?: SmtpConfig): Promise<nodemailer.SentMessageInfo> {
    // Create a temporary transporter with the supplied settings
    const tempTransporter = tempSettings 
      ? nodemailer.createTransport({
          host: tempSettings.host,
          port: tempSettings.port,
          secure: tempSettings.secure,
          auth: {
            user: tempSettings.auth.user,
            pass: tempSettings.auth.pass
          }
        })
      : this.transporter;
    
    const fromAddress = tempSettings?.from || this.defaultFrom;
    
    // Send a test email
    try {
      const mailOptions = {
        from: fromAddress,
        to: recipientEmail,
        subject: 'Test Email from Team Collaborator',
        text: 'This is a test email to verify your SMTP settings are working correctly.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>SMTP Test Successful</h2>
            <p>Congratulations! If you're reading this email, your SMTP settings are configured correctly.</p>
            <p>You can now use email notifications in Team Collaborator.</p>
            <p>This is a test message sent at: ${new Date().toLocaleString()}</p>
            <p>Best regards,<br>Team Collaborator</p>
          </div>
        `
      };
      
      logger.debug('Sending test email', { to: recipientEmail });
      
      const info = await tempTransporter.sendMail(mailOptions);
      
      logger.info('Test email sent successfully', { 
        messageId: info.messageId,
        to: recipientEmail
      });
      
      // If we're using Ethereal email, include the preview URL
      if (
        (tempSettings?.host === 'smtp.ethereal.email' || 
        (!tempSettings && process.env.NODE_ENV === 'development'))
        && info.messageId
      ) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          logger.info('Test email preview URL', { previewUrl });
          info.previewUrl = previewUrl;
        }
      }
      
      return info;
    } catch (error) {
      logger.error('Failed to send test email', { error, to: recipientEmail });
      throw error;
    }
  }

  /**
   * Send an email
   * @param options Email send options
   * @returns Information about the sent message
   */
  async sendEmail(options: EmailSendOptions): Promise<nodemailer.SentMessageInfo> {
    try {
      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text || this.stripHtml(options.html),
        html: options.html
      };
      
      logger.debug('Sending email', { 
        to: options.to, 
        subject: options.subject,
        metadata: options.metadata 
      });
      
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', { 
        messageId: info.messageId,
        to: options.to,
        metadata: options.metadata
      });
      
      return info;
    } catch (error) {
      logger.error('Failed to send email', { 
        error, 
        to: options.to, 
        subject: options.subject,
        metadata: options.metadata
      });
      
      throw error;
    }
  }
  
  /**
   * Generate an email from a template
   * @param template The template to use
   * @param data Data to populate the template with
   * @returns The rendered HTML
   */
  generateEmailFromTemplate(template: EmailTemplate, data: Record<string, any>): string {
    // In a real implementation, we would use a template engine like Handlebars
    // For now, we'll use simple string replacements
    
    switch (template) {
      case 'task_assignment':
        return this.generateTaskAssignmentEmail(data);
      case 'task_comment':
        return this.generateTaskCommentEmail(data);
      case 'task_due':
        return this.generateTaskDueEmail(data);
      case 'welcome':
        return this.generateWelcomeEmail(data);
      case 'password_reset':
        return this.generatePasswordResetEmail(data);
      default:
        throw new Error(`Unknown email template: ${template}`);
    }
  }
  
  /**
   * Process pending email notifications
   * @param notifications Pending email notifications
   * @returns Results of the processing
   */
  async processPendingEmails(notifications: EmailNotification[]): Promise<EmailProcessingResults> {
    const results: EmailProcessingResults = {
      sent: 0,
      failed: 0,
      details: []
    };
    
    logger.info(`Processing ${notifications.length} pending email notifications`);
    
    // Process each notification
    for (const notification of notifications) {
      try {
        // Skip notifications that are not pending or have a future sendAt date
        if (notification.status !== 'pending') {
          continue;
        }
        
        // We removed sendAt from the schema, so this check is no longer needed
        // if (notification.sendAt && new Date(notification.sendAt) > new Date()) {
        //   continue;
        // }
        
        // Get user email from user associated with notification
        const user = await storage.getUser(notification.userId);
        if (!user || !user.email) {
          logger.error(`User ${notification.userId} has no email to send notification to`);
          continue;
        }
        
        // Send the email
        await this.sendEmail({
          to: user.email,
          subject: notification.subject,
          html: notification.content,
          metadata: {}
        });
        
        // Update with success
        // Note: In the real implementation, this would update the database
        results.sent++;
        results.details.push({
          id: notification.id,
          success: true
        });
        
        logger.debug('Successfully sent notification email', { id: notification.id });
      } catch (error) {
        // Update with failure
        results.failed++;
        results.details.push({
          id: notification.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        logger.error('Failed to send notification email', { 
          id: notification.id, 
          error
        });
      }
    }
    
    logger.info('Finished processing pending emails', { 
      processed: notifications.length,
      sent: results.sent,
      failed: results.failed
    });
    
    return results;
  }
  
  /**
   * Strip HTML tags to create plain text version
   * @param html HTML content
   * @returns Plain text content
   */
  private stripHtml(html: string): string {
    // A simple HTML tag stripper - in production would use a proper HTML-to-text library
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Generate task assignment email
   * @param data Task data
   * @returns HTML email content
   */
  private generateTaskAssignmentEmail(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Task Assignment</h2>
        <p>Hello ${data.recipientName || 'there'},</p>
        <p>You have been assigned to a new task:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${data.taskTitle || 'Task'}</h3>
          <p>${data.taskDescription || 'No description provided.'}</p>
          <p><strong>Due date:</strong> ${data.dueDate || 'No due date'}</p>
          <p><strong>Priority:</strong> ${data.priority || 'Normal'}</p>
        </div>
        <p>Click the button below to view the task:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.taskUrl || '#'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Task</a>
        </div>
        <p>Thank you,<br>Team Collaborator</p>
      </div>
    `;
  }
  
  /**
   * Generate task comment email
   * @param data Comment data
   * @returns HTML email content
   */
  private generateTaskCommentEmail(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Comment on Task</h2>
        <p>Hello ${data.recipientName || 'there'},</p>
        <p>${data.commenterName || 'Someone'} commented on a task you're following:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${data.taskTitle || 'Task'}</h3>
          <div style="border-left: 3px solid #4CAF50; padding-left: 10px; margin: 10px 0;">
            <p style="font-style: italic;">${data.commentContent || 'No comment content'}</p>
            <p style="font-size: 0.8em; color: #666;">- ${data.commenterName || 'Team Member'} at ${data.commentTime || 'recently'}</p>
          </div>
        </div>
        <p>Click the button below to view the conversation:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.taskUrl || '#'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Conversation</a>
        </div>
        <p>Thank you,<br>Team Collaborator</p>
      </div>
    `;
  }
  
  /**
   * Generate task due reminder email
   * @param data Task data
   * @returns HTML email content
   */
  private generateTaskDueEmail(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Task Due Reminder</h2>
        <p>Hello ${data.recipientName || 'there'},</p>
        <p>This is a reminder that the following task is due ${data.dueText || 'soon'}:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${data.taskTitle || 'Task'}</h3>
          <p>${data.taskDescription || 'No description provided.'}</p>
          <p><strong>Due date:</strong> ${data.dueDate || 'Soon'}</p>
          <p><strong>Status:</strong> ${data.status || 'Open'}</p>
        </div>
        <p>Click the button below to view or update the task:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.taskUrl || '#'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Task</a>
        </div>
        <p>Thank you,<br>Team Collaborator</p>
      </div>
    `;
  }
  
  /**
   * Generate welcome email
   * @param data User data
   * @returns HTML email content
   */
  private generateWelcomeEmail(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Team Collaborator!</h2>
        <p>Hello ${data.recipientName || 'there'},</p>
        <p>Thank you for joining Team Collaborator. We're excited to have you onboard!</p>
        <p>Here are a few things you can do to get started:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Join a team or create your own</li>
          <li>Create your first task</li>
          <li>Explore our communication features</li>
        </ul>
        <p>Click the button below to get started:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.dashboardUrl || '#'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
        </div>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>The Team Collaborator Team</p>
      </div>
    `;
  }
  
  /**
   * Generate password reset email
   * @param data Reset data
   * @returns HTML email content
   */
  private generatePasswordResetEmail(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${data.recipientName || 'there'},</p>
        <p>We received a request to reset your password for your Team Collaborator account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.resetUrl || '#'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
        <p>Thank you,<br>Team Collaborator</p>
      </div>
    `;
  }
}

// Create an instance of the email service to export
export const emailService = new EmailService();
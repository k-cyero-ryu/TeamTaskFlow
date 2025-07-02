import sgMail from '@sendgrid/mail';
import { Logger } from '../../utils/logger';

const logger = new Logger('SendGridService');

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

export class SendGridService {
  private initialized = false;
  private defaultFrom = 'Team Collaborator <noreply@teamcollaborator.com>';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid API key not found - SendGrid integration disabled');
      return;
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      logger.info('SendGrid service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SendGrid service', { error });
    }
  }

  async sendEmail(options: SendGridEmailOptions): Promise<boolean> {
    if (!this.initialized) {
      logger.error('SendGrid service not initialized - cannot send email');
      return false;
    }

    try {
      const msg = {
        to: options.to,
        from: options.from || this.defaultFrom,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        ...(options.templateId && {
          templateId: options.templateId,
          dynamicTemplateData: options.dynamicTemplateData
        })
      };

      logger.debug('Sending email via SendGrid', { 
        to: options.to, 
        subject: options.subject,
        templateId: options.templateId 
      });

      await sgMail.send(msg);
      
      logger.info('Email sent successfully via SendGrid', { 
        to: options.to, 
        subject: options.subject 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send email via SendGrid', { 
        error, 
        to: options.to, 
        subject: options.subject 
      });
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isAvailable(): boolean {
    return this.initialized;
  }
}

export const sendGridService = new SendGridService();
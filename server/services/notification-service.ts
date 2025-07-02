import { storage } from '../storage';
import { emailService } from './email';
import { Logger } from '../utils/logger';
import { Task, User, Comment } from '@shared/schema';

interface NotificationPreferences {
  taskAssigned?: boolean;
  taskUpdated?: boolean;
  taskCommented?: boolean;
  mentionedInComment?: boolean;
  privateMessage?: boolean;
  groupMessage?: boolean;
  taskDueReminder?: boolean;
}

const logger = new Logger('NotificationService');

export interface NotificationContext {
  task?: Task;
  user?: User;
  comment?: Comment;
  assignedUser?: User;
  commenter?: User;
  recipient?: User;
  baseUrl?: string;
}

export class NotificationService {
  /**
   * Safely get notification preferences from user
   */
  private getNotificationPreferences(user: User): NotificationPreferences {
    const preferences = user.notificationPreferences as any;
    return {
      taskAssigned: preferences?.taskAssigned ?? true,
      taskUpdated: preferences?.taskUpdated ?? true,
      taskCommented: preferences?.taskCommented ?? true,
      mentionedInComment: preferences?.mentionedInComment ?? true,
      privateMessage: preferences?.privateMessage ?? true,
      groupMessage: preferences?.groupMessage ?? false,
      taskDueReminder: preferences?.taskDueReminder ?? true,
    };
  }
  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(context: NotificationContext): Promise<void> {
    if (!context.task || !context.assignedUser || !context.user) {
      logger.error('Missing required context for task assignment notification');
      return;
    }

    const { task, assignedUser, user: assigner, baseUrl = '' } = context;

    // Check if user has email and wants task assignment notifications
    const preferences = this.getNotificationPreferences(assignedUser);
    if (!assignedUser.email || !preferences.taskAssigned) {
      logger.debug('User does not want task assignment notifications or has no email', {
        userId: assignedUser.id,
        hasEmail: !!assignedUser.email,
        wantsNotifications: preferences.taskAssigned
      });
      return;
    }

    try {
      // Generate email content
      const html = emailService.generateEmailFromTemplate('task_assignment', {
        recipientName: assignedUser.username,
        taskTitle: task.title,
        taskDescription: task.description,
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        priority: task.priority || 'Normal',
        taskUrl: `${baseUrl}/tasks/${task.id}`,
        assignerName: assigner.username
      });

      // Create notification record
      const notification = await storage.createEmailNotification({
        userId: assignedUser.id,
        subject: `New Task Assignment: ${task.title}`,
        content: html,
        type: 'task_assignment',
        status: 'pending',
        recipientEmail: assignedUser.email,
        relatedEntityType: 'task',
        relatedEntityId: task.id
      });

      // Send email
      await emailService.sendEmail({
        to: assignedUser.email,
        subject: `New Task Assignment: ${task.title}`,
        html,
        metadata: { 
          userId: assignedUser.id, 
          notificationType: 'task_assignment',
          taskId: task.id
        }
      });

      // Update notification status
      await storage.updateEmailNotification(notification.id, {
        status: 'sent',
        sentAt: new Date()
      });

      logger.info('Task assignment notification sent', {
        taskId: task.id,
        recipientId: assignedUser.id,
        notificationId: notification.id
      });
    } catch (error) {
      logger.error('Failed to send task assignment notification', {
        error,
        taskId: task.id,
        recipientId: assignedUser.id
      });
    }
  }

  /**
   * Send task comment notification
   */
  async sendTaskCommentNotification(context: NotificationContext): Promise<void> {
    if (!context.task || !context.comment || !context.commenter || !context.recipient) {
      logger.error('Missing required context for task comment notification');
      return;
    }

    const { task, comment, commenter, recipient, baseUrl = '' } = context;

    // Don't send notification to the commenter themselves
    if (commenter.id === recipient.id) {
      return;
    }

    // Check if user has email and wants comment notifications
    const preferences = this.getNotificationPreferences(recipient);
    if (!recipient.email || !preferences.taskCommented) {
      logger.debug('User does not want comment notifications or has no email', {
        userId: recipient.id,
        hasEmail: !!recipient.email,
        wantsNotifications: preferences.taskCommented
      });
      return;
    }

    try {
      // Generate email content
      const html = emailService.generateEmailFromTemplate('task_comment', {
        recipientName: recipient.username,
        taskTitle: task.title,
        commenterName: commenter.username,
        commentContent: comment.content,
        commentTime: new Date(comment.createdAt).toLocaleString(),
        taskUrl: `${baseUrl}/tasks/${task.id}`
      });

      // Create notification record
      const notification = await storage.createEmailNotification({
        userId: recipient.id,
        subject: `New Comment on Task: ${task.title}`,
        content: html,
        type: 'task_comment',
        status: 'pending',
        recipientEmail: recipient.email,
        relatedEntityType: 'comment',
        relatedEntityId: comment.id
      });

      // Send email
      await emailService.sendEmail({
        to: recipient.email,
        subject: `New Comment on Task: ${task.title}`,
        html,
        metadata: { 
          userId: recipient.id, 
          notificationType: 'task_comment',
          taskId: task.id,
          commentId: comment.id
        }
      });

      // Update notification status
      await storage.updateEmailNotification(notification.id, {
        status: 'sent',
        sentAt: new Date()
      });

      logger.info('Task comment notification sent', {
        taskId: task.id,
        commentId: comment.id,
        recipientId: recipient.id,
        notificationId: notification.id
      });
    } catch (error) {
      logger.error('Failed to send task comment notification', {
        error,
        taskId: task.id,
        commentId: comment.id,
        recipientId: recipient.id
      });
    }
  }

  /**
   * Send task due date reminder notification
   */
  async sendTaskDueReminder(context: NotificationContext): Promise<void> {
    if (!context.task || !context.recipient) {
      logger.error('Missing required context for task due reminder notification');
      return;
    }

    const { task, recipient, baseUrl = '' } = context;

    // Check if user has email and wants due date reminders
    const preferences = this.getNotificationPreferences(recipient);
    if (!recipient.email || !preferences.taskDueReminder) {
      logger.debug('User does not want due date reminders or has no email', {
        userId: recipient.id,
        hasEmail: !!recipient.email,
        wantsNotifications: preferences.taskDueReminder
      });
      return;
    }

    try {
      const dueDate = new Date(task.dueDate!);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let dueText = 'soon';
      if (daysUntilDue < 0) {
        dueText = `${Math.abs(daysUntilDue)} day(s) ago`;
      } else if (daysUntilDue === 0) {
        dueText = 'today';
      } else if (daysUntilDue === 1) {
        dueText = 'tomorrow';
      } else {
        dueText = `in ${daysUntilDue} day(s)`;
      }

      // Generate email content
      const html = emailService.generateEmailFromTemplate('task_due', {
        recipientName: recipient.username,
        taskTitle: task.title,
        taskDescription: task.description,
        dueDate: dueDate.toLocaleDateString(),
        dueText,
        status: task.status,
        taskUrl: `${baseUrl}/tasks/${task.id}`
      });

      // Create notification record
      const notification = await storage.createEmailNotification({
        userId: recipient.id,
        subject: `Task Due Reminder: ${task.title}`,
        content: html,
        type: 'task_due',
        status: 'pending',
        recipientEmail: recipient.email,
        relatedEntityType: 'task',
        relatedEntityId: task.id
      });

      // Send email
      await emailService.sendEmail({
        to: recipient.email,
        subject: `Task Due Reminder: ${task.title}`,
        html,
        metadata: { 
          userId: recipient.id, 
          notificationType: 'task_due',
          taskId: task.id
        }
      });

      // Update notification status
      await storage.updateEmailNotification(notification.id, {
        status: 'sent',
        sentAt: new Date()
      });

      logger.info('Task due reminder notification sent', {
        taskId: task.id,
        recipientId: recipient.id,
        notificationId: notification.id,
        dueText
      });
    } catch (error) {
      logger.error('Failed to send task due reminder notification', {
        error,
        taskId: task.id,
        recipientId: recipient.id
      });
    }
  }

  /**
   * Process overdue task reminders for all users
   */
  async processOverdueTaskReminders(baseUrl: string = ''): Promise<void> {
    try {
      const tasks = await storage.getTasks();
      const now = new Date();

      for (const task of tasks) {
        if (!task.dueDate || task.status === 'completed') {
          continue;
        }

        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          // Task is overdue, send reminders to participants
          const participants = await storage.getTaskParticipants(task.id);
          
          for (const participant of participants) {
            const user = await storage.getUser(participant.id);
            if (user) {
              await this.sendTaskDueReminder({
                task,
                recipient: user,
                baseUrl
              });
            }
          }
        }
      }

      logger.info('Processed overdue task reminders');
    } catch (error) {
      logger.error('Failed to process overdue task reminders', { error });
    }
  }
}

export const notificationService = new NotificationService();
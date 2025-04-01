import ical, { ICalCalendar, ICalEventBusyStatus } from 'ical-generator';
import { CalendarEvent } from '../../../shared/schema';
import { Logger } from '../../utils/logger';

// Initialize logger for calendar service
const logger = new Logger('CalendarService');

/**
 * Calendar service for generating iCalendar files
 */
export class CalendarService {
  /**
   * Generate an iCalendar for a single event
   * @param event The calendar event
   * @param organizer The organizer's name
   * @returns ICalCalendar iCalendar object
   */
  generateCalendarForEvent(event: CalendarEvent, organizer: string): ICalCalendar {
    try {
      // Create a new calendar
      const calendar = ical({
        name: `${event.title} - Team Collaborator`,
        prodId: { company: 'Team Collaborator', product: 'Calendar' },
        timezone: 'UTC',
      });
      
      // Add the event to the calendar
      this.addEventToCalendar(calendar, event, organizer);
      
      return calendar;
    } catch (error) {
      logger.error('Failed to generate calendar for event', { error, eventId: event.id });
      throw error;
    }
  }
  
  /**
   * Generate an iCalendar with multiple events
   * @param events Array of calendar events
   * @param organizer The organizer's name
   * @returns ICalCalendar iCalendar object
   */
  generateCalendar(events: CalendarEvent[], organizer: string): ICalCalendar {
    try {
      // Create a new calendar
      const calendar = ical({
        name: `${organizer}'s Calendar - Team Collaborator`,
        prodId: { company: 'Team Collaborator', product: 'Calendar' },
        timezone: 'UTC',
      });
      
      // Add each event to the calendar
      events.forEach(event => {
        this.addEventToCalendar(calendar, event, organizer);
      });
      
      return calendar;
    } catch (error) {
      logger.error('Failed to generate calendar', { error });
      throw error;
    }
  }
  
  /**
   * Add an event to a calendar
   * @param calendar The calendar to add the event to
   * @param event The event to add
   * @param organizer The organizer's name
   */
  private addEventToCalendar(calendar: ICalCalendar, event: CalendarEvent, organizer: string): void {
    try {
      // Parse dates
      const startTime = new Date(event.startTime);
      const endTime = event.endTime ? new Date(event.endTime) : null;
      
      // Use a safe allDay value - convert null to false
      const allDay = event.allDay === true;
      
      // Create the calendar event
      calendar.createEvent({
        id: event.id.toString(),
        start: startTime,
        end: endTime || undefined,
        allDay: allDay,
        summary: event.title,
        description: event.description || undefined,
        location: this.getLocationFromEvent(event),
        organizer: { name: organizer, email: 'noreply@teamcollaborator.com' },
        created: event.createdAt,
        lastModified: event.updatedAt || event.createdAt,
        status: 'CONFIRMED' as any,
        busystatus: this.getBusyStatusFromEvent(event) as any,
      });
    } catch (error) {
      logger.error('Failed to add event to calendar', { error, eventId: event.id });
      throw error;
    }
  }
  
  /**
   * Get the location string for an event based on its related entity
   * @param event The calendar event
   * @returns string Location or undefined
   */
  private getLocationFromEvent(event: CalendarEvent): string | undefined {
    if (!event.relatedEntityType) {
      return undefined;
    }
    
    switch (event.relatedEntityType) {
      case 'task':
        return `Task #${event.relatedEntityId}`;
      case 'meeting':
        return `Meeting #${event.relatedEntityId}`;
      default:
        return undefined;
    }
  }
  
  /**
   * Get the busy status for an event based on its type
   * @param event The calendar event
   * @returns ICalEventBusyStatus Busy status
   */
  private getBusyStatusFromEvent(event: CalendarEvent): ICalEventBusyStatus {
    switch (event.type) {
      case 'task_due':
        return 'BUSY';
      case 'meeting':
        return 'BUSY';
      case 'reminder':
        return 'FREE';
      default:
        return 'BUSY';
    }
  }
}

// Create an instance of the calendar service to export
export const calendarService = new CalendarService();
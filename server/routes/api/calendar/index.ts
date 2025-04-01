import { Router } from 'express';
import { storage } from '../../../storage';
import { requireAuth } from '../../../middleware';
import { z } from 'zod';
import { validateRequest } from '../../../middleware';
import { calendarService } from '../../../services/calendar';

const router = Router();

// Define schemas for validation
const createEventSchema = z.object({
  userId: z.number(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()).optional(),
  allDay: z.boolean().optional(),
  type: z.string(),
  relatedEntityId: z.number().nullable().optional(),
  relatedEntityType: z.string().nullable().optional(),
});

const updateEventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().or(z.date()).optional(),
  endTime: z.string().or(z.date()).optional(),
  allDay: z.boolean().optional(),
  type: z.string().optional(),
});

// Get all calendar events for the authenticated user
router.get('/events', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const events = await storage.getUserCalendarEvents(req.user.id);
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Create a new calendar event
router.post('/events', requireAuth, validateRequest(createEventSchema), async (req, res) => {
  try {
    // Ensure the user can only create events for themselves
    if (req.user && req.body.userId !== req.user.id) {
      return res.status(403).json({ error: 'Cannot create events for other users' });
    }
    
    const event = await storage.createCalendarEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Get a specific calendar event
router.get('/events/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await storage.getCalendarEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Only allow users to access their own events
    if (req.user && event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// Update a calendar event
router.put('/events/:id', requireAuth, validateRequest(updateEventSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await storage.getCalendarEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Only allow users to update their own events
    if (req.user && event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updatedEvent = await storage.updateCalendarEvent(id, req.body);
    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Delete a calendar event
router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await storage.getCalendarEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Only allow users to delete their own events
    if (req.user && event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await storage.deleteCalendarEvent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// Generate iCalendar file for all events
router.get('/ical', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const events = await storage.getUserCalendarEvents(req.user.id);
    const calendar = calendarService.generateCalendar(events, req.user.username);
    
    // Set response headers
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${req.user.username}-calendar.ics"`);
    
    // Send the calendar data
    res.send(calendar.toString());
  } catch (error) {
    console.error('Error generating iCalendar file:', error);
    res.status(500).json({ error: 'Failed to generate iCalendar file' });
  }
});

// Generate iCalendar file for a specific event
router.get('/ical/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await storage.getCalendarEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Only allow users to access their own events
    if (req.user && event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const calendar = calendarService.generateCalendarForEvent(event, req.user?.username || 'user');
    
    // Set response headers
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="event-${id}.ics"`);
    
    // Send the calendar data
    res.send(calendar.toString());
  } catch (error) {
    console.error('Error generating iCalendar file:', error);
    res.status(500).json({ error: 'Failed to generate iCalendar file' });
  }
});

export default router;
import { WebSocket } from 'ws';
import { Logger } from './utils/logger';

const logger = new Logger('WebSocket');

// Map to track all connected clients
export const clients = new Map<WebSocket, number>();

/**
 * Broadcast a message to all connected clients
 * 
 * @param message The message to broadcast
 * @param targetUserIds Optional list of user IDs to filter recipients (if provided, only these users will receive the message)
 */
export function broadcastWebSocketMessage(
  message: any,
  targetUserIds?: number[]
): void {
  try {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    let errorCount = 0;
    
    // Convert to array of entries for easier filtering
    const clientEntries = Array.from(clients.entries());
    
    // Apply filter if targetUserIds is provided
    const targetEntries = targetUserIds 
      ? clientEntries.filter(([_, userId]) => targetUserIds.includes(userId))
      : clientEntries;
    
    for (const [client, userId] of targetEntries) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;
        } catch (wsError) {
          errorCount++;
          logger.error(`Error sending WebSocket message to user ${userId}`, { error: wsError });
        }
      }
    }
    
    logger.debug(`WebSocket broadcast: ${message.type} sent to ${sentCount} clients (${errorCount} failed)`, {
      messageType: message.type,
      targetUserCount: targetUserIds?.length,
      sentCount,
      errorCount
    });
  } catch (error) {
    logger.error('Error broadcasting WebSocket message', { error, messageType: message?.type });
  }
}

/**
 * Send a WebSocket message to a specific user
 * 
 * @param userId The ID of the user to send the message to
 * @param message The message to send
 * @returns True if the message was sent, false otherwise
 */
export function sendWebSocketMessageToUser(
  userId: number, 
  message: any
): boolean {
  try {
    const messageStr = JSON.stringify(message);
    let sent = false;
    
    // Find all connections for this user (a user might have multiple connections)
    const clientEntries = Array.from(clients.entries())
      .filter(([_, clientUserId]) => clientUserId === userId);
    
    for (const [client, _] of clientEntries) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sent = true;
          logger.debug(`WebSocket message ${message.type} sent to user ${userId}`);
        } catch (wsError) {
          logger.error(`Error sending WebSocket message to user ${userId}`, { error: wsError });
        }
      }
    }
    
    if (!sent) {
      logger.debug(`No active connections found for user ${userId}`);
    }
    
    return sent;
  } catch (error) {
    logger.error(`Error sending WebSocket message to user ${userId}`, { error, messageType: message?.type });
    return false;
  }
}
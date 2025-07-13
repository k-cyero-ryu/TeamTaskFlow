/**
 * WebSocket proxy middleware for production environments
 * This helps handle WebSocket connections in reverse proxy setups
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('WebSocketProxy');

export function setupWebSocketProxy(app: Express) {
  // Add a health check endpoint for WebSocket availability
  app.get('/ws/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      websocketSupported: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Handle WebSocket upgrade attempts that might be hitting the HTTP server
  app.all('/ws', (req: Request, res: Response, next: NextFunction) => {
    // Check if this is a WebSocket upgrade request
    const isWebSocketUpgrade = req.get('upgrade') === 'websocket';
    
    if (isWebSocketUpgrade) {
      logger.info('WebSocket upgrade request detected on HTTP route', {
        method: req.method,
        headers: {
          upgrade: req.get('upgrade'),
          connection: req.get('connection'),
          'sec-websocket-key': req.get('sec-websocket-key'),
          'sec-websocket-version': req.get('sec-websocket-version')
        }
      });
      
      // This should not happen in a properly configured setup
      // but we'll provide guidance for debugging
      res.status(426).json({
        error: 'Upgrade Required',
        message: 'This endpoint requires a WebSocket upgrade',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        },
        documentation: 'Configure reverse proxy to handle WebSocket upgrades'
      });
    } else {
      // Regular HTTP request to /ws endpoint
      res.status(400).json({
        error: 'Bad Request',
        message: 'This endpoint only accepts WebSocket connections',
        websocketUrl: `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/ws`
      });
    }
  });
}

// Helper to detect production environment issues
export function detectProductionIssues(req: Request): string[] {
  const issues: string[] = [];
  
  // Check for reverse proxy headers
  const forwardedFor = req.get('x-forwarded-for');
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  
  if (forwardedFor || forwardedProto || forwardedHost) {
    issues.push('Reverse proxy detected - ensure WebSocket proxy is configured');
  }
  
  // Check for Apache/Nginx specific headers
  const server = req.get('server');
  if (server?.includes('Apache')) {
    issues.push('Apache detected - ensure mod_proxy_wstunnel is enabled');
  }
  if (server?.includes('nginx')) {
    issues.push('Nginx detected - ensure proxy_pass and upgrade headers are configured');
  }
  
  return issues;
}
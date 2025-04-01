import { Router } from 'express';
import passport from 'passport';
import { handleApiError, InternalServerError } from '../../../utils/errors';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('AuthRoutes');

/**
 * @route POST /api/auth/login
 * @desc Authenticate a user
 * @access Public
 */
router.post('/login', (req, res, next) => {
  try {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        logger.error('Authentication error', { error: err });
        return handleApiError(res, new InternalServerError('Authentication error'));
      }
      
      if (!user) {
        logger.warn('Authentication failed', { info });
        return res.status(401).json({
          error: {
            type: 'UNAUTHORIZED',
            message: info?.message || 'Authentication failed'
          }
        });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          logger.error('Login session error', { error: loginErr });
          return handleApiError(res, new InternalServerError('Login session error'));
        }
        
        logger.info('User logged in successfully', { userId: user.id });
        return res.status(200).json(user);
      });
    })(req, res, next);
  } catch (error) {
    logger.error('Unexpected login error', { error });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout a user (Note: This endpoint is for compatibility but is not used - the logout is handled directly at /api/logout)
 * @access Private
 */
router.post('/logout', (req, res) => {
  logger.info('Logout request to deprecated endpoint /api/auth/logout, redirecting');
  res.redirect(307, '/api/logout');
});

export default router;
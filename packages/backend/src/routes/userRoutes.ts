/**
 * User Management Routes
 */

import { Router } from 'express';
import {
  authenticateWallet,
  createUser,
  getUserProfile,
  getCurrentUser,
  updateUserProfile,
  deleteUser,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import {
  createUserSchema,
  updateUserProfileSchema,
  walletAuthSchema,
  userIdParamSchema,
} from '../validators/userValidators';

const router = Router();

// Public routes
router.post('/auth', validateBody(walletAuthSchema), authenticateWallet);
router.post('/', validateBody(createUserSchema), createUser);

// Protected routes (require authentication)
router.get('/me', authenticateToken, getCurrentUser);
router.get('/:userId', authenticateToken, validateParams(userIdParamSchema), getUserProfile);
router.patch(
  '/:userId',
  authenticateToken,
  validateParams(userIdParamSchema),
  validateBody(updateUserProfileSchema),
  updateUserProfile
);
router.delete('/:userId', authenticateToken, validateParams(userIdParamSchema), deleteUser);

export default router;

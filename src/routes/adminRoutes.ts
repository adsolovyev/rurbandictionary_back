import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';
import { getReports,
    getAdminStats,
    resolveReport,
    getRecentPendingDefinitions,
    getRecentReports,
    getAllActiveReports,
    blockDefinition,
    banUser,
 } from '../controllers/adminController';

import {
  getPendingDefinitions,
  approveDefinition,
  rejectDefinition,
  getAllUsers, 
  resetUserPassword,
  searchUsers,
} from '../controllers/adminController';

const router = Router();

// Все маршруты требуют авторизации и прав админа
router.use(authenticate, isAdmin);

router.get('/definitions/pending', getPendingDefinitions);
router.put('/definitions/:id/approve', approveDefinition);
router.put('/definitions/:id/reject', rejectDefinition);
router.get('/reports', getReports);
router.get('/stats', getAdminStats);
router.get('/pending/recent', getRecentPendingDefinitions);

router.get('/reports/all', getAllActiveReports);
router.put('/reports/:id/resolve', resolveReport);
router.get('/reports/recent', getRecentReports);
router.put('/definitions/:id/block', blockDefinition);
router.put('/users/:userId/ban', banUser);
router.get('/users', getAllUsers);
router.post('/users/:userId/reset-password', resetUserPassword);
router.get('/users/search', searchUsers);

export default router;
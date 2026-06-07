import { Router } from 'express';
import {
  getRandomDefinitions,
  getDefinitionsByWord,
  createDefinition,
  voteDefinition,
  reportDefinition,
  getDefinitionById,
  getDefinitionsByAuthor,
  getDefinitionsByExactWord,
} from '../controllers/definitionController';
import { authenticate } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

router.get('/random', optionalAuth, getRandomDefinitions);
router.get('/word/:word/exact', optionalAuth, getDefinitionsByExactWord);
router.get('/by-author', optionalAuth, getDefinitionsByAuthor);
router.get('/:id', optionalAuth, getDefinitionById);
router.get('/', optionalAuth, getDefinitionsByWord);
router.post('/', authenticate, createDefinition);
router.post('/:id/vote', authenticate, voteDefinition);
router.post('/:id/report', authenticate, reportDefinition);

export default router;
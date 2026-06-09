import { Router } from 'express';
import { getWordsByLetter, getSuggestions, getRandomWord, getActiveWords } from '../controllers/browseController';

const router = Router();

router.get('/browse', getWordsByLetter); // /api/browse?letter=А&page=1
router.get('/suggest', getSuggestions);
router.get('/random-word', getRandomWord);
router.get('/words/active', getActiveWords);

export default router;
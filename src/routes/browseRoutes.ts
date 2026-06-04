import { Router } from 'express';
import { getWordsByLetter, getSuggestions, getRandomWord } from '../controllers/browseController';

const router = Router();

router.get('/browse', getWordsByLetter);
router.get('/suggest', getSuggestions);
router.get('/random-word', getRandomWord);

export default router;
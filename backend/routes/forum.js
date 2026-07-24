const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');

router.get('/', forumController.getQuestions);
router.post('/', forumController.createQuestion);
router.get('/:id', forumController.getQuestionById);
router.post('/:id/edit', forumController.updateQuestion);
router.post('/:id/delete', forumController.deleteQuestion);
router.post('/:id/replies', forumController.createReply);
router.post('/:id/replies/:replyId/delete', forumController.deleteReply);

module.exports = router;

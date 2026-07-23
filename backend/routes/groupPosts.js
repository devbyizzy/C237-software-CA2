const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

router.post('/:id/replies', groupController.createReply);

module.exports = router;

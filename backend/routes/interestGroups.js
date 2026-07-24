const express = require('express');
const router = express.Router();
const interestGroupController = require('../controllers/interestGroupController');

router.get('/', interestGroupController.getInterestGroups);
router.post('/', interestGroupController.createInterestGroup);
router.post('/:id/edit', interestGroupController.updateInterestGroup);
router.post('/:id/delete', interestGroupController.deleteInterestGroup);

module.exports = router;

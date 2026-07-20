const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/', profileController.getMyProfile);
router.put('/', profileController.updateMyProfile);
router.get('/:id', profileController.getProfileById);

module.exports = router;
const express = require('express');
const router = express.Router();
const ccaController = require('../controllers/ccaController');

router.get('/', ccaController.getAllCcas);
router.get('/:id', ccaController.getCcaById);
router.post('/', ccaController.createCca);
router.post('/:id/join', ccaController.joinCca);
router.post('/:id/leave', ccaController.leaveCca);

module.exports = router;


const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const planController = require('../controllers/planController');

router.get('/', planController.getAllPlans);
router.get('/:id', planController.getPlanById);
router.post('/:id/subscribe', authMiddleware, planController.subscribeToPlan);

module.exports = router;

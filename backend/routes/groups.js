const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

// Keep /dashboard above /:id so it is not treated as a group id.
router.get('/', groupController.getAllGroups);
router.get('/dashboard', groupController.getDashboardGroups);
router.get('/:id', groupController.getGroupById);
router.get('/:id/members', groupController.getGroupMembers);
router.get('/:id/posts', groupController.getGroupPosts);
router.get('/:id/requests', groupController.getJoinRequests);

router.post('/', groupController.createGroup);
router.post('/:id/edit', groupController.updateGroup);
router.post('/:id/delete', groupController.deleteGroup);
router.post('/:id/join', groupController.joinGroup);
router.post('/:id/leave', groupController.leaveGroup);
router.post('/:id/requests/:userId/accept', groupController.acceptRequest);
router.post('/:id/requests/:userId/reject', groupController.rejectRequest);
router.post('/:id/posts', groupController.createPost);

module.exports = router;

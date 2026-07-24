// =====================================================
//  ADVANCED SEARCH FEATURE — Search API Routes
//  Provides a GET endpoint for searching across:
//  - Questions
//  - Interest Groups
//  - CCAs
//  - Modules (module-related questions + study groups)
// =====================================================

const express = require('express');
const router = express.Router();

// Load the search controller
const searchController = require('../controllers/searchController');

// GET /api/search — Run an advanced search
router.get('/search', searchController.search);

module.exports = router;


// =====================================================
//  ADVANCED SEARCH FEATURE — Search Controller
//  This controller handles read-only searches across
//  existing database tables ONLY:
//
//  - Interest Groups (student_groups WHERE group_type
//    = 'interest')
//  - CCAs (ccas WHERE status = 'active')
//  - Modules (student_groups WHERE module_code is set)
//
//  All queries use parameterised MySQL.
//  Sorting values are whitelisted for safety.
// =====================================================

const pool = require('../utils/db');
const database = pool.promise();

// -------------------------------------------------------
//  Safe whitelist of allowed sorting values per type
// -------------------------------------------------------

const groupSortOptions = {
  newest: 'g.created_at DESC',
  oldest: 'g.created_at ASC',
  az: 'g.group_name ASC',
  za: 'g.group_name DESC'
};

const ccaSortOptions = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  az: 'cca_name ASC',
  za: 'cca_name DESC'
};

const moduleGroupSortOptions = {
  newest: 'g.created_at DESC',
  oldest: 'g.created_at ASC',
  az: 'g.group_name ASC',
  za: 'g.group_name DESC'
};

// -------------------------------------------------------
//  Helper: get a safe sort value or default
// -------------------------------------------------------

function getSort(sortMap, selectedSort, defaultSort) {
  const safeSort = sortMap[selectedSort];
  return safeSort !== undefined ? safeSort : defaultSort;
}

// -------------------------------------------------------
//  Helper: get a safe page number (minimum 1)
// -------------------------------------------------------

function getPage(rawPage) {
  const page = parseInt(rawPage, 10);
  if (isNaN(page) || page < 1) {
    return 1;
  }
  return page;
}

// -------------------------------------------------------
//  SEARCH: Search across all supported content types
//  GET /api/search?q=&type=&category=&diploma=&sort=&page=
// -------------------------------------------------------

exports.search = async (req, res) => {
  try {
    // --- Read and validate query parameters ---

    // Get the search keyword from the URL query string
    const rawKeyword = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    // Limit keyword length to 100 characters for safety
    const keyword = rawKeyword.slice(0, 100);

    // Get the selected result type (default: 'all')
    const type = typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : 'all';

    // Validate the result type against allowed values
    const validTypes = ['all', 'groups', 'ccas', 'modules'];
    const selectedType = validTypes.includes(type) ? type : 'all';

    // Get filter values
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const diploma = typeof req.query.diploma === 'string' ? req.query.diploma.trim() : '';

    // Get sorting option (default: newest)
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : 'newest';

    // Get page number (default: 1)
    const page = getPage(req.query.page);

    // Number of results per page
    const limit = 10;
    const offset = (page - 1) * limit;

    // Create the LIKE pattern for partial keyword searching
    const likePattern = keyword ? `%${keyword}%` : null;

    // -------------------------------------------------
    //  Build and run the search queries
    // -------------------------------------------------

    let results = [];
    let allCount = 0;
    let groupsCount = 0;
    let ccasCount = 0;
    let modulesCount = 0;

    // Array to hold promises for parallel execution
    const promises = [];

    // Track which types to search
    const searchAll = (selectedType === 'all');
    const searchGroups = (selectedType === 'all' || selectedType === 'groups');
    const searchCCAs = (selectedType === 'all' || selectedType === 'ccas');
    const searchModules = (selectedType === 'all' || selectedType === 'modules');

    // --- Helper: run a COUNT query ---
    async function runCount(sql, params) {
      const [rows] = await database.query(sql, params);
      return rows[0].total;
    }

    // --- Helper: run a SELECT data query ---
    async function runData(sql, params) {
      const [rows] = await database.query(sql, params);
      return rows;
    }

    // =============================================
    //  SEARCH GROUPS
    //  Table: student_groups (all group types)
    // =============================================
    if (searchGroups) {
      const countSql = `
        SELECT COUNT(*) AS total
        FROM student_groups g
        WHERE 1 = 1
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ?)' : ''}
          ${diploma ? 'AND g.diploma LIKE ?' : ''}
      `;
      const countParams = [];
      if (keyword) {
        countParams.push(likePattern, likePattern);
      }
      if (diploma) {
        countParams.push(`%${diploma}%`);
      }

      const orderBy = getSort(groupSortOptions, sort, 'g.created_at DESC');

      const dataSql = `
        SELECT
          g.group_id,
          g.group_name,
          g.description,
          g.diploma,
          g.privacy,
          g.created_at,
          g.creator_id,
          u.name AS creator_name,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND join_status = 'accepted') AS member_count
        FROM student_groups g
        JOIN users u ON u.user_id = g.creator_id
        WHERE 1 = 1
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ?)' : ''}
          ${diploma ? 'AND g.diploma LIKE ?' : ''}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [];
      if (keyword) {
        dataParams.push(likePattern, likePattern);
      }
      if (diploma) {
        dataParams.push(`%${diploma}%`);
      }
      dataParams.push(limit, offset);

      if (searchAll) {
        promises.push(
          runCount(countSql, countParams).then(count => { groupsCount = count; })
        );
      }

      if (selectedType === 'groups') {
        promises.push(
          runData(dataSql, dataParams).then(rows => {
            results = rows.map(r => ({
              type: 'group',
              id: r.group_id,
              group_name: r.group_name,
              description: r.description,
              diploma: r.diploma,
              privacy: r.privacy,
              created_at: r.created_at,
              creator_name: r.creator_name,
              member_count: r.member_count
            }));
          })
        );
        promises.push(
          runCount(countSql, countParams).then(count => { groupsCount = count; allCount = count; })
        );
      }
    }

    // =============================================
    //  SEARCH CCAs
    //  Table: ccas WHERE status = 'active'
    // =============================================
    if (searchCCAs) {
      const countSql = `
        SELECT COUNT(*) AS total
        FROM ccas
        WHERE status = 'active'
          ${keyword ? 'AND (cca_name LIKE ? OR description LIKE ?)' : ''}
          ${category ? 'AND category = ?' : ''}
      `;
      const countParams = [];
      if (keyword) {
        countParams.push(likePattern, likePattern);
      }
      if (category) {
        countParams.push(category);
      }

      const orderBy = getSort(ccaSortOptions, sort, 'created_at DESC');

      const dataSql = `
        SELECT
          cca_id,
          cca_name,
          category,
          description,
          meeting_day,
          meeting_start_time,
          meeting_end_time,
          location,
          image_url,
          member_count,
          created_at
        FROM ccas
        WHERE status = 'active'
          ${keyword ? 'AND (cca_name LIKE ? OR description LIKE ?)' : ''}
          ${category ? 'AND category = ?' : ''}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [];
      if (keyword) {
        dataParams.push(likePattern, likePattern);
      }
      if (category) {
        dataParams.push(category);
      }
      dataParams.push(limit, offset);

      if (searchAll) {
        promises.push(
          runCount(countSql, countParams).then(count => { ccasCount = count; })
        );
      }

      if (selectedType === 'ccas') {
        promises.push(
          runData(dataSql, dataParams).then(rows => {
            results = rows.map(r => ({
              type: 'cca',
              id: r.cca_id,
              cca_name: r.cca_name,
              category: r.category,
              description: r.description,
              meeting_day: r.meeting_day,
              location: r.location,
              image_url: r.image_url,
              member_count: r.member_count,
              created_at: r.created_at
            }));
          })
        );
        promises.push(
          runCount(countSql, countParams).then(count => { ccasCount = count; allCount = count; })
        );
      }
    }

    // =============================================
    //  SEARCH MODULES
    //  Uses student_groups WHERE module_code is set
    // =============================================
    if (searchModules) {
      const countSql = `
        SELECT COUNT(*) AS total
        FROM student_groups g
        WHERE g.module_code IS NOT NULL AND g.module_code != ''
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ? OR g.module_code LIKE ?)' : ''}
      `;
      const countParams = [];
      if (keyword) {
        countParams.push(likePattern, likePattern, likePattern);
      }

      const orderBy = getSort(moduleGroupSortOptions, sort, 'g.created_at DESC');

      const dataSql = `
        SELECT
          g.group_id,
          g.group_name,
          g.description,
          g.module_code,
          g.created_at,
          g.creator_id,
          u.name AS creator_name,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND join_status = 'accepted') AS member_count
        FROM student_groups g
        JOIN users u ON u.user_id = g.creator_id
        WHERE g.module_code IS NOT NULL AND g.module_code != ''
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ? OR g.module_code LIKE ?)' : ''}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [];
      if (keyword) {
        dataParams.push(likePattern, likePattern, likePattern);
      }
      dataParams.push(limit, offset);

      if (searchAll) {
        promises.push(
          runCount(countSql, countParams).then(count => { modulesCount = count; })
        );
      }

      if (selectedType === 'modules') {
        promises.push(
          runData(dataSql, dataParams).then(rows => {
            results = rows.map(r => ({
              type: 'module',
              id: r.group_id,
              group_name: r.group_name,
              description: r.description,
              module_code: r.module_code,
              created_at: r.created_at,
              creator_name: r.creator_name,
              member_count: r.member_count
            }));
          })
        );
        promises.push(
          runCount(countSql, countParams).then(count => { modulesCount = count; allCount = count; })
        );
      }
    }

    // =============================================
    //  SEARCH ALL — combine results from all types
    // =============================================
    if (selectedType === 'all') {
      // Interest Group query
      const groupSql = `
        SELECT
          g.group_id,
          g.group_name,
          g.description,
          g.diploma,
          g.privacy,
          g.created_at,
          g.creator_id,
          u.name AS creator_name,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND join_status = 'accepted') AS member_count,
          'group' AS result_type
        FROM student_groups g
        JOIN users u ON u.user_id = g.creator_id
        WHERE 1 = 1
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ?)' : ''}
          ${diploma ? 'AND g.diploma LIKE ?' : ''}
        ORDER BY ${getSort(groupSortOptions, sort, 'g.created_at DESC')}
        LIMIT ? OFFSET ?
      `;
      const groupParams = [];
      if (keyword) {
        groupParams.push(likePattern, likePattern);
      }
      if (diploma) {
        groupParams.push(`%${diploma}%`);
      }
      groupParams.push(limit, offset);

      // CCA query
      const ccaSql = `
        SELECT
          cca_id,
          cca_name,
          category,
          description,
          meeting_day,
          location,
          member_count,
          created_at,
          'cca' AS result_type
        FROM ccas
        WHERE status = 'active'
          ${keyword ? 'AND (cca_name LIKE ? OR description LIKE ?)' : ''}
          ${category ? 'AND category = ?' : ''}
        ORDER BY ${getSort(ccaSortOptions, sort, 'created_at DESC')}
        LIMIT ? OFFSET ?
      `;
      const ccaParams = [];
      if (keyword) {
        ccaParams.push(likePattern, likePattern);
      }
      if (category) {
        ccaParams.push(category);
      }
      ccaParams.push(limit, offset);

      // Module query (groups with module_code)
      const moduleSql = `
        SELECT
          g.group_id,
          g.group_name,
          g.description,
          g.module_code,
          g.created_at,
          g.creator_id,
          u.name AS creator_name,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND join_status = 'accepted') AS member_count,
          'module' AS result_type
        FROM student_groups g
        JOIN users u ON u.user_id = g.creator_id
        WHERE g.module_code IS NOT NULL AND g.module_code != ''
          ${keyword ? 'AND (g.group_name LIKE ? OR g.description LIKE ? OR g.module_code LIKE ?)' : ''}
        ORDER BY ${getSort(moduleGroupSortOptions, sort, 'g.created_at DESC')}
        LIMIT ? OFFSET ?
      `;
      const moduleParams = [];
      if (keyword) {
        moduleParams.push(likePattern, likePattern, likePattern);
      }
      moduleParams.push(limit, offset);

      // Run all three queries in parallel
      const [groupRows, ccaRows, moduleRows] = await Promise.all([
        runData(groupSql, groupParams),
        runData(ccaSql, ccaParams),
        runData(moduleSql, moduleParams)
      ]);

      // Combine all results into one array
      const allResults = [];

      groupRows.forEach(r => {
        allResults.push({
          type: 'group',
          id: r.group_id,
          group_name: r.group_name,
          description: r.description,
          diploma: r.diploma,
          privacy: r.privacy,
          created_at: r.created_at,
          creator_name: r.creator_name,
          member_count: r.member_count
        });
      });

      ccaRows.forEach(r => {
        allResults.push({
          type: 'cca',
          id: r.cca_id,
          cca_name: r.cca_name,
          category: r.category,
          description: r.description,
          meeting_day: r.meeting_day,
          location: r.location,
          member_count: r.member_count,
          created_at: r.created_at
        });
      });

      moduleRows.forEach(r => {
        allResults.push({
          type: 'module',
          id: r.group_id,
          group_name: r.group_name,
          description: r.description,
          module_code: r.module_code,
          created_at: r.created_at,
          creator_name: r.creator_name,
          member_count: r.member_count
        });
      });

      // Sort combined results by date
      const sortDesc = (sort !== 'oldest');
      allResults.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortDesc ? dateB - dateA : dateA - dateB;
      });

      results = allResults;
    }

    // Wait for all parallel queries to finish
    await Promise.all(promises);

    if (selectedType === 'all') {
      allCount = groupsCount + ccasCount + modulesCount;
    }

    // Calculate total pages for pagination
    const totalPages = Math.ceil(allCount / limit) || 1;

    // Send the JSON response back to the frontend
    return res.json({
      success: true,
      keyword: keyword,
      type: selectedType,
      results: results,
      counts: {
        all: allCount,
        groups: groupsCount,
        ccas: ccasCount,
        modules: modulesCount
      },
      pagination: {
        page: page,
        limit: limit,
        totalResults: allCount,
        totalPages: totalPages
      }
    });

  } catch (error) {
    // Log the technical error in the terminal
    console.error('Search error:', error);

    // Send a friendly message to the browser (never expose raw SQL errors)
    return res.status(500).json({
      success: false,
      message: 'Unable to complete the search. Please try again later.',
      results: [],
      counts: { all: 0, groups: 0, ccas: 0, modules: 0 },
      pagination: { page: 1, limit: 10, totalResults: 0, totalPages: 0 }
    });
  }
};


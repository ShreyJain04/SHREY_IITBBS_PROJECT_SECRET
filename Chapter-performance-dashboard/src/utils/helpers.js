const buildFilterQuery = (filters) => {
  const query = {};

  // Handle class filtering
  if (filters.class) {
    const classInput = filters.class.toString().trim();
    
    if (/^\d+$/.test(classInput)) {
      query.class = `Class ${classInput}`;
    } else {
      // using exact match or regex for partial matching
      query.class = new RegExp(classInput, 'i');
    }
  }

  // Handle unit filtering - supports both exact and partial matches
  if (filters.unit) {
    const unitInput = filters.unit.toString().trim();
    
    if (/^\d+$/.test(unitInput)) {
      query.unit = new RegExp(`${unitInput}`, 'i');
    } else {
      query.unit = new RegExp(unitInput, 'i');
    }
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.subject) {
    query.subject = new RegExp(filters.subject, 'i');
  }

  if (filters.isWeakChapter !== undefined) {
    query.isWeakChapter = filters.isWeakChapter === 'true' || filters.isWeakChapter === true;
  }

  return query;
};

const getPaginationParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  return {
    page: Math.max(1, page),
    limit: Math.min(10, Math.max(1, limit)), // Max 10 items per page
    skip
  };
};

module.exports = {
  buildFilterQuery,
  getPaginationParams
};
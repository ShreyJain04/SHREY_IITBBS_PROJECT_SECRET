const validateChapter = (chapterData) => {
  const errors = [];
  
  if (!chapterData.subject || typeof chapterData.subject !== 'string' || chapterData.subject.trim() === '') {
    errors.push('Subject is required and must be a non-empty string');
  }
  
  if (!chapterData.chapter || typeof chapterData.chapter !== 'string' || chapterData.chapter.trim() === '') {
    errors.push('Chapter is required and must be a non-empty string');
  }
  
  if (!chapterData.class || typeof chapterData.class !== 'string' || chapterData.class.trim() === '') {
    errors.push('Class is required and must be a non-empty string');
  }
  
  if (!chapterData.unit || typeof chapterData.unit !== 'string' || chapterData.unit.trim() === '') {
    errors.push('Unit is required and must be a non-empty string');
  }
  
  // Validate yearWiseQuestionCount
  if (!chapterData.yearWiseQuestionCount || typeof chapterData.yearWiseQuestionCount !== 'object') {
    errors.push('yearWiseQuestionCount is required and must be an object');
  } else {
    // Check if all values are numbers
    for (const [year, count] of Object.entries(chapterData.yearWiseQuestionCount)) {
      if (typeof count !== 'number' || count < 0) {
        errors.push(`Question count for year ${year} must be a non-negative number`);
      }
      
      // Validate year format (should be a 4-digit year)
      if (!/^\d{4}$/.test(year)) {
        errors.push(`Year ${year} must be a 4-digit number`);
      }
    }
  }
  
  // Validate questionSolved
  if (typeof chapterData.questionSolved !== 'number' || chapterData.questionSolved < 0) {
    errors.push('questionSolved must be a non-negative number');
  }
  
  // Validate status
  const validStatuses = ['Completed', 'In Progress', 'Not Started'];
  if (!chapterData.status || !validStatuses.includes(chapterData.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Validate isWeakChapter
  if (typeof chapterData.isWeakChapter !== 'boolean') {
    errors.push('isWeakChapter must be a boolean value');
  }
  
  // Additional validation: questionSolved shouldn't exceed total questions
  if (chapterData.yearWiseQuestionCount && typeof chapterData.questionSolved === 'number') {
    const totalQuestions = Object.values(chapterData.yearWiseQuestionCount).reduce((sum, count) => sum + count, 0);
    if (chapterData.questionSolved > totalQuestions) {
      errors.push('questionSolved cannot exceed total questions available');
    }
  }
  
  return errors;
};

module.exports = {
  validateChapter
};
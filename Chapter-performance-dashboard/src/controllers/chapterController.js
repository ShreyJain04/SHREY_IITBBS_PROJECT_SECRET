const fs = require('fs').promises;
const path = require('path');
const Chapter = require('../models/Chapter');
const { validateChapter } = require('../utils/validation');
const { buildFilterQuery, getPaginationParams } = require('../utils/helpers');
const { invalidateCache } = require('../middleware/cache');

// Helper function to execute queries with timeout
const executeWithTimeout = async (operation, timeoutMs = 30000) => {
  return Promise.race([
    operation,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Get all chapters with filtering and pagination
const getAllChapters = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filterQuery = buildFilterQuery(req.query);
    
    const [chapters, totalCount] = await Promise.all([
      executeWithTimeout(
        Chapter.find(filterQuery)
          .select('-__v')
          .sort({ id: 1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .maxTimeMS(25000), // MongoDB server timeout
        30000 // Application timeout
      ),
      executeWithTimeout(
        Chapter.countDocuments(filterQuery).maxTimeMS(10000),
        15000
      )
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      data: {
        chapters,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get chapters error:', error);
    
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        message: 'Database operation timed out. Please try again or contact support.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get chapter by ID
const getChapterById = async (req, res) => {
  try {
    const { id } = req.params;
    const chapterId = parseInt(id);
    
    if (isNaN(chapterId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chapter ID'
      });
    }
    
    const chapter = await executeWithTimeout(
      Chapter.findOne({ id: chapterId })
        .select('-__v')
        .lean()
        .maxTimeMS(10000),
      15000
    );
    
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }
    
    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    console.error('Get chapter by ID error:', error);
    
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        message: 'Database operation timed out. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to get next available ID
const getNextId = async () => {
  try {
    const lastChapter = await executeWithTimeout(
      Chapter.findOne({}, {}, { sort: { 'id': -1 } })
        .lean()
        .maxTimeMS(10000),
      15000
    );
    return lastChapter && lastChapter.id ? lastChapter.id + 1 : 1;
  } catch (error) {
    console.error('Error getting next ID:', error);
    return 1;
  }
};

// Upload chapters from JSON file with bulk operations
const uploadChapters = async (req, res) => {
  console.log('=== UPLOAD DEBUG ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('Content-Type:', req.get('Content-Type'));
  console.log('==================');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath, 'utf8');
    let chaptersData;
    
    try {
      chaptersData = JSON.parse(fileContent);
    } catch (parseError) {
      await fs.unlink(filePath);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format'
      });
    }
    
    if (!Array.isArray(chaptersData)) {
      await fs.unlink(filePath);
      return res.status(400).json({
        success: false,
        message: 'JSON must contain an array of chapters'
      });
    }
    
    console.log(`Processing ${chaptersData.length} chapters...`);
    
    const results = {
      successful: [],
      failed: [],
      updated: [],
      created: []
    };
    
    // Validate all chapters first
    const validChapters = [];
    for (let i = 0; i < chaptersData.length; i++) {
      const chapterData = chaptersData[i];
      
      const validationErrors = validateChapter ? validateChapter(chapterData) : [];
      
      if (validationErrors.length > 0) {
        results.failed.push({
          index: i,
          data: chapterData,
          errors: validationErrors
        });
      } else {
        validChapters.push({ index: i, data: chapterData });
      }
    }
    
    console.log(`${validChapters.length} chapters passed validation`);
    
    if (validChapters.length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({
        success: false,
        message: 'No valid chapters found',
        data: {
          totalProcessed: chaptersData.length,
          successful: 0,
          failed: results.failed.length,
          failedChapters: results.failed
        }
      });
    }
    
    // Get all existing chapters to check for duplicates with timeout
    console.log('Checking for existing chapters...');
    
    const existingChapters = await executeWithTimeout(
      Chapter.find({
        $or: validChapters.map(item => ({
          subject: item.data.subject,
          chapter: item.data.chapter,
          class: item.data.class
        }))
      })
      .lean()
      .maxTimeMS(30000), // 30 second MongoDB timeout
      45000 // 45 second application timeout
    );
    
    console.log(`Found ${existingChapters.length} existing chapters`);
    
    // Create a map for quick lookup
    const existingChaptersMap = new Map();
    existingChapters.forEach(chapter => {
      const key = `${chapter.subject}-${chapter.chapter}-${chapter.class}`;
      existingChaptersMap.set(key, chapter);
    });
    
    // Get starting ID for new chapters
    let nextId = await getNextId();
    
    // Prepare bulk operations
    const bulkOps = [];
    
    for (const { index, data } of validChapters) {
      const key = `${data.subject}-${data.chapter}-${data.class}`;
      const existingChapter = existingChaptersMap.get(key);
      
      if (existingChapter) {
        // Update existing chapter
        bulkOps.push({
          updateOne: {
            filter: { _id: existingChapter._id },
            update: { $set: data }
          }
        });
        
        results.updated.push({
          index,
          id: existingChapter.id,
          subject: data.subject,
          chapter: data.chapter,
          class: data.class
        });
      } else {
        // Create new chapter
        const newChapterData = { ...data, id: nextId++ };
        bulkOps.push({
          insertOne: {
            document: newChapterData
          }
        });
        
        results.created.push({
          index,
          id: newChapterData.id,
          subject: data.subject,
          chapter: data.chapter,
          class: data.class
        });
      }
    }
    
    // Execute bulk operations with timeout
    console.log(`Executing ${bulkOps.length} bulk operations...`);
    
    if (bulkOps.length > 0) {
      try {
        const bulkResult = await executeWithTimeout(
          Chapter.collection.bulkWrite(bulkOps, {
            ordered: false, // Continue processing even if some operations fail
            writeConcern: { w: 1, j: true },
            maxTimeMS: 60000 // 60 second MongoDB timeout
          }),
          90000 // 90 second application timeout
        );
        
        console.log('Bulk operation result:', {
          insertedCount: bulkResult.insertedCount,
          modifiedCount: bulkResult.modifiedCount,
          upsertedCount: bulkResult.upsertedCount
        });
        
        results.successful = [...results.updated, ...results.created];
        
      } catch (bulkError) {
        console.error('Bulk operation error:', bulkError);
        
        if (bulkError.message.includes('timed out')) {
          await fs.unlink(filePath);
          return res.status(504).json({
            success: false,
            message: 'Database operation timed out. The file was too large or the server is overloaded. Please try with smaller batches.',
            error: process.env.NODE_ENV === 'development' ? bulkError.message : undefined
          });
        }
        
        // Handle partial success in bulk operations
        if (bulkError.result) {
          const partialResults = bulkError.result;
          console.log('Partial bulk results:', {
            insertedCount: partialResults.nInserted,
            modifiedCount: partialResults.nModified
          });
          
          // Still count successful operations
          results.successful = [...results.updated, ...results.created];
        }
        
        // Add bulk errors to failed results
        if (bulkError.writeErrors) {
          bulkError.writeErrors.forEach(writeError => {
            results.failed.push({
              index: writeError.index,
              errors: [writeError.errmsg]
            });
          });
        }
      }
    }
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    // Invalidate cache after successful uploads
    if (results.successful.length > 0) {
      try {
        await invalidateCache('cache:/api/v1/chapters*');
      } catch (cacheError) {
        console.error('Cache invalidation error:', cacheError);
      }
    }
    
    const statusCode = results.failed.length > 0 ? 207 : 201;
    
    console.log(`Upload completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    
    res.status(statusCode).json({
      success: results.failed.length === 0,
      message: `${results.successful.length} chapters processed successfully, ${results.failed.length} failed`,
      data: {
        totalProcessed: chaptersData.length,
        successful: results.successful.length,
        failed: results.failed.length,
        created: results.created.length,
        updated: results.updated.length,
        createdChapters: results.created,
        updatedChapters: results.updated,
        failedChapters: results.failed
      }
    });
    
  } catch (error) {
    console.error('Upload chapters error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('File cleanup error:', unlinkError);
      }
    }
    
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        message: 'Database operation timed out. Please try again with a smaller file or contact support.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllChapters,
  getChapterById,
  uploadChapters
};
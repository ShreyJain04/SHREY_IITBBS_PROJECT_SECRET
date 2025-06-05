const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: false, 
    unique: true,
    sparse: true // Allows multiple documents without this field
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  chapter: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String, 
    required: true,
    trim: true
  },
  unit: {
    type: String, 
    required: true,
    trim: true
  },
  yearWiseQuestionCount: {
    type: Map,
    of: Number,
    required: true,
    default: () => new Map()
  },
  questionSolved: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['Completed', 'In Progress', 'Not Started'],
    default: 'Not Started'
  },
  isWeakChapter: {
    type: Boolean,
    required: true,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate ID before saving if not provided
chapterSchema.pre('save', async function(next) {
  if (!this.id && this.isNew) {
    try {
      // Find the highest existing ID and increment by 1
      const lastChapter = await this.constructor.findOne({}, {}, { sort: { 'id': -1 } });
      this.id = lastChapter && lastChapter.id ? lastChapter.id + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Indexes for better query performance
chapterSchema.index({ class: 1, subject: 1 });
chapterSchema.index({ status: 1 });
chapterSchema.index({ isWeakChapter: 1 });
chapterSchema.index({ unit: 1 });
chapterSchema.index({ id: 1 });

// Virtual to get class number as integer
chapterSchema.virtual('classNumber').get(function() {
  const match = this.class.match(/\d+/);
  return match ? parseInt(match[0]) : null;
});

// Virtual to calculate total questions across all years
chapterSchema.virtual('totalQuestions').get(function() {
  if (!this.yearWiseQuestionCount) return 0;
  let total = 0;
  for (let count of this.yearWiseQuestionCount.values()) {
    total += count;
  }
  return total;
});

// Virtual to calculate completion percentage
chapterSchema.virtual('completionPercentage').get(function() {
  const total = this.totalQuestions;
  return total > 0 ? Math.round((this.questionSolved / total) * 100) : 0;
});

// Ensure virtuals are included when converting to JSON
chapterSchema.set('toJSON', { virtuals: true });
chapterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Chapter', chapterSchema);
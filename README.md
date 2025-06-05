# SHREY_IITBBS_PROJECT_SECRET
# Chapter Performance Dashboard API

A RESTful API backend for managing chapter performance data with caching, rate limiting, and comprehensive filtering capabilities.

## 🚀 Features

- **RESTful API Endpoints** with comprehensive filtering and pagination
- **Redis Caching** for improved performance (1-hour cache duration)
- **Rate Limiting** (30 requests/minute per IP using Redis)
- **File Upload** support for bulk chapter imports
- **Real-time Cache Invalidation**
- **Comprehensive Error Handling** with timeout protection
- **Performance Optimized** with bulk operations and indexing

## 📋 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **Redis** - Caching and rate limiting
- **Multer** - File upload handling

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chapter-performance-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/chapter-performance
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads
   ```

4. **Start the servers**
   
   **Development mode:**
   ```bash
   npm run dev
   ```
   
   **Production mode:**
   ```bash
   npm start
   ```

## 📡 API Endpoints

### 1. Get All Chapters
```http
GET /api/v1/chapters
```

**Query Parameters:**
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 10, max: 100)
- `class` (string): Filter by class (e.g., "Class 10")
- `subject` (string): Filter by subject (e.g., "Mathematics")
- `unit` (string): Filter by unit (e.g., "Algebra")
- `status` (string): Filter by status ("Completed", "In Progress", "Not Started")
- `isWeakChapter` (boolean): Filter weak chapters (true/false)

**Example:**
```http
GET /api/v1/chapters?page=1&limit=10&class=Class 10&subject=Mathematics&status=Completed
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chapters": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 45,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Get Chapter by ID
```http
GET /api/v1/chapters/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "subject": "Mathematics",
    "chapter": "Linear Equations",
    "class": "Class 10",
    "unit": "Algebra",
    "yearWiseQuestionCount": {
      "2023": 5,
      "2022": 3
    },
    "questionSolved": 4,
    "status": "In Progress",
    "isWeakChapter": false,
    "totalQuestions": 8,
    "completionPercentage": 50
  }
}
```

### 3. Upload Chapters (Bulk Import)
```http
POST /api/v1/chapters
```

**Content-Type:** `multipart/form-data`

**Body:** JSON file containing array of chapters

**Example JSON structure:**
```json
[
  {
    "subject": "Mathematics",
    "chapter": "Linear Equations",
    "class": "Class 10",
    "unit": "Algebra",
    "yearWiseQuestionCount": {
      "2023": 5,
      "2022": 3
    },
    "questionSolved": 4,
    "status": "In Progress",
    "isWeakChapter": false
  }
]
```

**Response:**
```json
{
  "success": true,
  "message": "25 chapters processed successfully, 2 failed",
  "data": {
    "totalProcessed": 27,
    "successful": 25,
    "failed": 2,
    "created": 20,
    "updated": 5,
    "createdChapters": [...],
    "updatedChapters": [...],
    "failedChapters": [...]
  }
}
```

## 🔧 Data Schema

### Chapter Model
```javascript
{
  id: Number,                    // Auto-generated unique ID
  subject: String,               // Required
  chapter: String,               // Required
  class: String,                 // Required
  unit: String,                  // Required
  yearWiseQuestionCount: Map,    // Year -> Question count mapping
  questionSolved: Number,        // Default: 0
  status: String,                // "Completed" | "In Progress" | "Not Started"
  isWeakChapter: Boolean,        // Default: false
  createdAt: Date,               // Auto-generated
  updatedAt: Date                // Auto-generated
}
```

### Virtual Fields
- `totalQuestions`: Sum of all year-wise question counts
- `completionPercentage`: (questionSolved / totalQuestions) * 100

## 📚 Filtering Examples

### Filter by Class and Subject
```http
GET /api/v1/chapters?class=Class 10&subject=Mathematics
```

### Get Weak Chapters Only
```http
GET /api/v1/chapters?isWeakChapter=true
```

### Filter by Status with Pagination
```http
GET /api/v1/chapters?status=Completed&page=2&limit=20
```

### Multiple Filters
```http
GET /api/v1/chapters?class=Class 12&subject=Physics&unit=Mechanics&status=In Progress&page=1&limit=15
```

## ⚡ Performance Features

### Redis Caching
- **Cache Duration:** 1 hour for GET requests
- **Cache Key Pattern:** `cache:/api/v1/chapters*`
- **Auto-invalidation:** Cache is cleared when new chapters are uploaded
- **Fallback:** Graceful degradation when Redis is unavailable

### Rate Limiting
- **API Endpoints:** 30 requests/minute per IP
- **Upload Endpoint:** 5 requests/minute per IP
- **Storage:** Redis-based with memory fallback
- **Headers:** Standard rate limit headers included

### Database Optimization
- **Indexes:** Optimized for common query patterns
- **Bulk Operations:** Efficient batch processing for uploads
- **Timeouts:** Configurable query timeouts to prevent hanging
- **Lean Queries:** Reduced memory usage for large datasets


## 🔍 Monitoring & Debugging

### Cache Status Headers
- `X-Cache-Status: HIT` - Data served from cache
- `X-Cache-Status: MISS` - Data cached for future requests
- `X-Cache-Status: DISABLED` - Redis unavailable

### Logging
- Request logging with Morgan
- Error logging for debugging
- Performance metrics for database operations

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/chapter-performance
REDIS_URL=redis://redis-server:6379
MAX_FILE_SIZE=10485760
```

## 📊 API Testing

### Postman Collection
A comprehensive Postman collection is available with:
- All endpoints pre-configured
- Example requests with sample data
- Environment variables for easy testing
- Automated tests for response validation

### Sample Test Data
```json
[
  {
    "subject": "Mathematics",
    "chapter": "Quadratic Equations",
    "class": "Class 10",
    "unit": "Algebra",
    "yearWiseQuestionCount": {
      "2023": 8,
      "2022": 6,
      "2021": 7
    },
    "questionSolved": 15,
    "status": "Completed",
    "isWeakChapter": false
  }
]
```



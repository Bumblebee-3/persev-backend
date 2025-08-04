const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// School Schema
const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  contingentCode: { type: String, unique: true, sparse: true },
  teacherName: { type: String, required: true },
  teacherMobile: { type: String, required: true },
  teacherEmail: { type: String, required: true, unique: true },
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Event Category Schema
const eventCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
}, {
  timestamps: true
});

// Event Schema
const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventCategory', required: true },
  description: String,
  minParticipants: { type: Number, required: true },
  maxParticipants: { type: Number, required: true },
  minGrade: { type: Number, required: true, min: 8, max: 12 },
  maxGrade: { type: Number, required: true, min: 8, max: 12 },
  genderRequirement: { 
    type: String, 
    enum: ['any', 'male_female_required', 'male_only', 'female_only'], 
    default: 'any' 
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Event Registration Schema
const eventRegistrationSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  registrationStatus: { 
    type: String, 
    enum: ['registered', 'confirmed', 'cancelled'], 
    default: 'registered' 
  },
  participants: [{
    name: { type: String, required: true },
    grade: { type: Number, required: true, min: 8, max: 12 },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    participantOrder: { type: Number, required: true }
  }]
}, {
  timestamps: true
});

// Create compound index to prevent duplicate registrations
eventRegistrationSchema.index({ schoolId: 1, eventId: 1 }, { unique: true });

// Validation middleware
eventRegistrationSchema.pre('save', async function(next) {
  try {
    // Validate participant count against event requirements
    const participantCount = this.participants.length;
    
    // Populate the event to check constraints
    const event = await mongoose.model('Event').findById(this.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check participant count
    if (participantCount < event.minParticipants) {
      throw new Error(`Minimum ${event.minParticipants} participants required`);
    }
    if (participantCount > event.maxParticipants) {
      throw new Error(`Maximum ${event.maxParticipants} participants allowed`);
    }

    // Check gender requirements
    if (event.genderRequirement === 'male_female_required') {
      const maleCount = this.participants.filter(p => p.gender === 'male').length;
      const femaleCount = this.participants.filter(p => p.gender === 'female').length;
      if (maleCount === 0 || femaleCount === 0) {
        throw new Error('This event requires both male and female participants');
      }
    }

    // Check grade requirements
    const invalidGrades = this.participants.filter(p => 
      p.grade < event.minGrade || p.grade > event.maxGrade
    );
    if (invalidGrades.length > 0) {
      throw new Error(`All participants must be in grades ${event.minGrade}-${event.maxGrade}`);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Create models
const School = mongoose.model('School', schoolSchema);
const EventCategory = mongoose.model('EventCategory', eventCategorySchema);
const Event = mongoose.model('Event', eventSchema);
const EventRegistration = mongoose.model('EventRegistration', eventRegistrationSchema);

let isConnected = false;

async function initializeDatabase() {
  if (isConnected) {
    console.log('Using existing database connection');
    return { School, EventCategory, Event, EventRegistration };
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    });

    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📡 MongoDB disconnected');
      isConnected = false;
    });

    console.log('🎉 Database models initialized successfully!');
    
    return { School, EventCategory, Event, EventRegistration };
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function disconnectFromDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('📡 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { 
  initializeDatabase, 
  disconnectFromDatabase,
  School,
  EventCategory,
  Event,
  EventRegistration
};
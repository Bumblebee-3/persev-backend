const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeDatabase, disconnectFromDatabase, EventCategory, Event } = require('./init_db');

async function populateDatabase() {
  try {
    await initializeDatabase();
    
    console.log('Starting database population...\n');

    // Clear existing data (optional - remove in production)
    await EventCategory.deleteMany({});
    await Event.deleteMany({});
    console.log('Cleared existing data');

    // Event categories data
    const categories = [
      { name: 'Sports', description: 'Athletic competitions and physical challenges' },
      { name: 'Stage', description: 'Performing arts and creative showcases' },
      { name: 'Classroom', description: 'Academic competitions and intellectual challenges' }
    ];

    // Insert Categories
    const insertedCategories = await EventCategory.insertMany(categories);
    console.log('✅ Categories inserted:', insertedCategories.length);

    // Get category IDs for reference
    const sportsCategory = insertedCategories.find(c => c.name === 'Sports')._id;
    const stageCategory = insertedCategories.find(c => c.name === 'Stage')._id;
    const classroomCategory = insertedCategories.find(c => c.name === 'Classroom')._id;

    // Events data
    const events = [
      // Sports Events
      { name: 'Explorare', categoryId: sportsCategory, minParticipants: 4, maxParticipants: 6, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Adventure and exploration challenge' },
      { name: 'Monopolium', categoryId: sportsCategory, minParticipants: 3, maxParticipants: 5, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Strategic board game competition' },
      { name: 'Football', categoryId: sportsCategory, minParticipants: 11, maxParticipants: 15, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Inter-school football tournament' },
      { name: 'Basketball', categoryId: sportsCategory, minParticipants: 5, maxParticipants: 8, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Basketball championship' },
      { name: 'Gully Cricket', categoryId: sportsCategory, minParticipants: 6, maxParticipants: 10, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Street cricket tournament' },
      { name: 'Table Tennis', categoryId: sportsCategory, minParticipants: 2, maxParticipants: 4, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Table tennis singles and doubles' },
      { name: 'Tug of War', categoryId: sportsCategory, minParticipants: 8, maxParticipants: 12, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Traditional tug of war competition' },
      { name: 'E-Sports', categoryId: sportsCategory, minParticipants: 1, maxParticipants: 7, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Video game tournament' },

      // Stage Events
      { name: 'Gratia', categoryId: stageCategory, minParticipants: 6, maxParticipants: 8, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Group dance performance competition' },
      { name: 'Panache', categoryId: stageCategory, minParticipants: 5, maxParticipants: 7, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Fashion and style showcase' },
      { name: 'Symphonia', categoryId: stageCategory, minParticipants: 5, maxParticipants: 7, minGrade: 8, maxGrade: 12, genderRequirement: 'any', description: 'Musical performance competition' },
      { name: 'Mr. and Mrs. Perseverantia', categoryId: stageCategory, minParticipants: 2, maxParticipants: 2, minGrade: 9, maxGrade: 12, genderRequirement: 'male_female_required', description: 'Personality and talent showcase for one male and one female participant' },

      // Classroom Events
      { name: 'Admeta: Category 1', categoryId: classroomCategory, minParticipants: 2, maxParticipants: 2, minGrade: 9, maxGrade: 10, genderRequirement: 'any', description: 'Academic debate for grades 9-10' },
      { name: 'Admeta: Category 2', categoryId: classroomCategory, minParticipants: 2, maxParticipants: 2, minGrade: 11, maxGrade: 12, genderRequirement: 'any', description: 'Academic debate for grades 11-12' },
      { name: 'Artem', categoryId: classroomCategory, minParticipants: 1, maxParticipants: 1, minGrade: 11, maxGrade: 12, genderRequirement: 'any', description: 'Art and creativity challenge' },
      { name: 'Carmen: Category 1', categoryId: classroomCategory, minParticipants: 1, maxParticipants: 1, minGrade: 9, maxGrade: 10, genderRequirement: 'any', description: 'Poetry and creative writing for grades 9-10' },
      { name: 'Carmen: Category 2', categoryId: classroomCategory, minParticipants: 1, maxParticipants: 1, minGrade: 11, maxGrade: 12, genderRequirement: 'any', description: 'Poetry and creative writing for grades 11-12' },
      { name: 'Fabula', categoryId: classroomCategory, minParticipants: 4, maxParticipants: 10, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Storytelling and narrative competition' },
      { name: 'Fortuna', categoryId: classroomCategory, minParticipants: 2, maxParticipants: 3, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Strategy and luck-based games' },
      { name: 'Codeferno', categoryId: classroomCategory, minParticipants: 1, maxParticipants: 2, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Programming and coding competition' },
      { name: 'Gustatio', categoryId: classroomCategory, minParticipants: 2, maxParticipants: 2, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Culinary arts and cooking challenge' },
      { name: 'Mahim 16', categoryId: classroomCategory, minParticipants: 3, maxParticipants: 4, minGrade: 9, maxGrade: 12, genderRequirement: 'any', description: 'Local knowledge and trivia' },
      { name: 'Negotium', categoryId: classroomCategory, minParticipants: 2, maxParticipants: 2, minGrade: 9, maxGrade: 12, genderRequirement: 'grade_mixed_required', description: 'Business and entrepreneurship challenge (requires one grade 9-10 and one grade 11-12)' }
    ];

    // Insert Events
    const insertedEvents = await Event.insertMany(events);
    console.log('✅ Events inserted:', insertedEvents.length);

    // Print summary using MongoDB aggregation
    const summary = await EventCategory.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'events'
        }
      },
      {
        $project: {
          name: 1,
          eventCount: { $size: '$events' }
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);

    console.log('\n📊 Database Summary:');
    summary.forEach(cat => {
      console.log(`   ${cat.name}: ${cat.eventCount} events`);
    });

    console.log('\n🎉 Database population completed successfully!');

  } catch (error) {
    console.error('❌ Database population failed:', error);
    throw error;
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  populateDatabase()
    .then(() => {
      console.log('Database population completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database population failed:', err);
      process.exit(1);
    });
}

module.exports = { populateDatabase };
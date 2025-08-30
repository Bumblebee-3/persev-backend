const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const models = require('./init_db'); 

async function populateDatabase(options = { resetIds: false }) {
  try {
    await models.initializeDatabase();
    const db = models.db();

    console.log('Starting database population...\n');
    
    // Optionally reset autoincrement IDs if tables are empty
    if (options.resetIds) {
      console.log('Checking for autoincrement reset...');
      models.resetAutoIncrement();
    }
    
    // Note: NOT deleting existing data to preserve registrations and consistent IDs
    console.log('Updating existing data (preserving registrations)');

    // Event categories data
    const categories = [
      { name: 'Sports', description: 'Athletic competitions and physical challenges' },
      { name: 'Stage', description: 'Performing arts and creative showcases' },
      { name: 'Classroom', description: 'Academic competitions and intellectual challenges' }
    ];

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO event_categories (name, description) VALUES (?, ?)
    `);

    const updateCategory = db.prepare(`
      UPDATE event_categories SET description = ? WHERE name = ?
    `);

    const catTx = db.transaction((rows) => {
      const ids = [];
      for (const c of rows) {
        // Try to insert, if it exists (IGNORE), then update
        insertCategory.run(c.name, c.description ?? null);
        updateCategory.run(c.description ?? null, c.name);
        
        // Get the actual ID
        const existing = db.prepare('SELECT id FROM event_categories WHERE name = ?').get(c.name);
        ids.push({ id: existing.id, name: c.name });
      }
      return ids;
    });

    const insertedCategories = catTx(categories);
    console.log('✅ Categories upserted:', insertedCategories.length);

    // Map category names -> ids
    const idByName = Object.fromEntries(insertedCategories.map(c => [c.name, c.id]));
    const sportsCategory = idByName['Sports'];
    const stageCategory = idByName['Stage'];
    const classroomCategory = idByName['Classroom'];

    // Events data
    const events = [
      // Sports Events
      { name: 'Explorare', category_id: sportsCategory, min_participants: 4,  max_participants: 4,  min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Adventure and exploration challenge' },
      { name: 'Monopolium', category_id: sportsCategory, min_participants: 1,  max_participants: 1,  min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Strategic board game competition' },
      { name: 'Football', category_id: sportsCategory, min_participants: 8, max_participants: 8, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Inter-school football tournament' },
      { name: 'Basketball', category_id: sportsCategory, min_participants: 7,  max_participants: 10,  min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Basketball championship' },
      { name: 'Gully Cricket', category_id: sportsCategory, min_participants: 7,  max_participants: 7, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Street cricket tournament (6 participants +1 substitute)' },
      { name: 'Table Tennis', category_id: sportsCategory, min_participants: 2,  max_participants: 4,  min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Table tennis singles and doubles' },
      { name: 'Tug of War', category_id: sportsCategory, min_participants: 8,  max_participants: 8, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Traditional tug of war competition (6 participants + 2 substitutes)' },
      { name: 'E-Sports', category_id: sportsCategory, min_participants: 2,  max_participants: 4,  min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Video game tournament' },

      // Stage Events
      { name: 'Gratia', category_id: stageCategory, min_participants: 6, max_participants: 8, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Group dance performance competition' },
      { name: 'Panache', category_id: stageCategory, min_participants: 5, max_participants: 7, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Fashion and style showcase' },
      { name: 'Symphonia', category_id: stageCategory, min_participants: 5, max_participants: 7, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Musical performance competition' },
      { name: 'Mr. and Mrs. Perseverantia', category_id: stageCategory, min_participants: 2, max_participants: 2, min_grade: 9,  max_grade: 12, gender_requirement: 'male_female_required', description: 'Personality and talent showcase for one male and one female participant' },

      // Classroom Events
      { name: 'Admeta: Category 1', category_id: classroomCategory, min_participants: 2, max_participants: 2, min_grade: 9,  max_grade: 10, gender_requirement: 'any', description: 'Academic debate for grades 9-10' },
      { name: 'Admeta: Category 2', category_id: classroomCategory, min_participants: 2, max_participants: 2, min_grade: 11, max_grade: 12, gender_requirement: 'any', description: 'Academic debate for grades 11-12' },
      { name: 'Artem', category_id: classroomCategory, min_participants: 1, max_participants: 1, min_grade: 9, max_grade: 12, gender_requirement: 'any', description: 'Art and creativity challenge' },
      { name: 'Carmen: Category 1', category_id: classroomCategory, min_participants: 1, max_participants: 1, min_grade: 9,  max_grade: 10, gender_requirement: 'any', description: 'Poetry and creative writing for grades 9-10' },
      { name: 'Carmen: Category 2', category_id: classroomCategory, min_participants: 1, max_participants: 1, min_grade: 11, max_grade: 12, gender_requirement: 'any', description: 'Poetry and creative writing for grades 11-12' },
      { name: 'Fabula', category_id: classroomCategory, min_participants: 4, max_participants: 10, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Storytelling and narrative competition' },
      { name: 'Fortuna', category_id: classroomCategory, min_participants: 3, max_participants: 3, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Strategy and luck-based games' },
      { name: 'Codeferno', category_id: classroomCategory, min_participants: 1, max_participants: 1, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Programming and coding competition' },
      { name: 'Gustatio', category_id: classroomCategory, min_participants: 2, max_participants: 2, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Culinary arts and cooking challenge' },
      { name: 'Mahim 16', category_id: classroomCategory, min_participants: 3, max_participants: 4, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Mystery based-crime event' },
      { name: "‘Ad’venturium", category_id: classroomCategory, min_participants: 3, max_participants: 3, min_grade: 9,  max_grade: 12, gender_requirement: 'any', description: 'Business and entrepreneurship challenge ' }
    ];

    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO events
        (name, category_id, description, min_participants, max_participants, min_grade, max_grade, gender_requirement, is_active)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const updateEvent = db.prepare(`
      UPDATE events SET
        category_id = ?,
        description = ?,
        min_participants = ?,
        max_participants = ?,
        min_grade = ?,
        max_grade = ?,
        gender_requirement = ?,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);

    const eventTx = db.transaction((rows) => {
      for (const e of rows) {
        // Try to insert, if it exists (IGNORE), then update
        insertEvent.run(
          e.name,
          e.category_id,
          e.description ?? null,
          e.min_participants,
          e.max_participants,
          e.min_grade,
          e.max_grade,
          e.gender_requirement
        );
        
        updateEvent.run(
          e.category_id,
          e.description ?? null,
          e.min_participants,
          e.max_participants,
          e.min_grade,
          e.max_grade,
          e.gender_requirement,
          e.name
        );
      }
    });

    eventTx(events);
    console.log('✅ Events upserted:', events.length);

    // Summary
    const summaryStmt = db.prepare(`
      SELECT ec.name AS name, COUNT(e.id) AS eventCount
      FROM event_categories ec
      LEFT JOIN events e ON e.category_id = ec.id
      GROUP BY ec.id
      ORDER BY ec.name ASC
    `);
    const summary = summaryStmt.all();

    console.log('\nSummary:');
    for (const row of summary) {
      console.log(`   ${row.name}: ${row.eventCount} events`);
    }

    console.log('\nPopulation completed successfully!');
    console.log('Note: Existing registrations and stable IDs preserved');
  } catch (error) {
    console.error('Population failed:', error);
    throw error;
  } finally {
    await models.disconnectFromDatabase();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const resetIds = args.includes('--reset-ids');
  
  populateDatabase({ resetIds })
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
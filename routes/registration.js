const express = require('express');
const { School, Event, EventCategory, EventRegistration } = require('../database/init_db');
const googleSheetsService = require('../services/googleSheets');

const router = express.Router();

// Get stage events
router.get('/events/stage', async (req, res) => {
    try {
        const stageCategory = await EventCategory.findOne({ name: 'Stage' });
        if (!stageCategory) {
            return res.status(404).json({ message: 'Stage category not found' });
        }

        const events = await Event.find({ 
            categoryId: stageCategory._id, 
            isActive: true 
        }).sort({ name: 1 });

        res.json(events);
    } catch (error) {
        console.error('Error fetching stage events:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Register for stage events
router.post('/register/stage', async (req, res) => {
    try {
        const { school: schoolData, events } = req.body;

        // Validate input
        if (!schoolData || !events || events.length === 0) {
            return res.status(400).json({ message: 'School data and events are required' });
        }

        // Create or update school
        let school = await School.findOne({ name: schoolData.name });
        if (school) {
            // Update existing school
            school.contingentCode = schoolData.contingentCode || school.contingentCode;
            school.teacherName = schoolData.teacherName;
            school.teacherMobile = schoolData.teacherMobile;
            school.teacherEmail = schoolData.teacherEmail;
            await school.save();
        } else {
            // Create new school
            school = new School(schoolData);
            await school.save();
        }

        // Save all registrations and collect event names for sheets sync
        const eventsWithNames = [];
        
        for (let eventData of events) {
            const event = await Event.findById(eventData.eventId);
            if (!event) {
                return res.status(400).json({ message: `Event not found: ${eventData.eventId}` });
            }

            // Delete existing registrations for this event and school (for updates)
            await EventRegistration.deleteMany({ 
                schoolId: school._id, 
                eventId: eventData.eventId 
            });

            // Create new registration
            const eventRegistration = new EventRegistration({
                schoolId: school._id,
                eventId: eventData.eventId,
                participants: eventData.participants
            });

            await eventRegistration.save();
            console.log(`Registration saved for event: ${event.name}`);

            // Add event name for sheets sync
            eventsWithNames.push({
                ...eventData,
                eventName: event.name
            });
        }

        console.log('All registrations completed successfully');

        // Sync to Google Sheets (non-blocking)
        try {
            await googleSheetsService.addStageRegistration({
                school: schoolData,
                events: eventsWithNames
            });
            console.log('✅ Successfully synced to Google Sheets');
        } catch (sheetsError) {
            console.warn('⚠️ Google Sheets sync failed, but registration was successful:', sheetsError.message);
        }

        res.status(201).json({ 
            message: 'Registration completed successfully',
            schoolId: school._id,
            eventsRegistered: events.length
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get registration status for a school
router.get('/registrations/:schoolId', async (req, res) => {
    try {
        const { schoolId } = req.params;

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        const registrations = await EventRegistration.find({ schoolId })
            .populate('eventId', 'name description minParticipants maxParticipants minGrade maxGrade genderRequirement')
            .populate('schoolId', 'name contingentCode teacherName');

        res.json({
            school: school,
            registrations: registrations
        });

    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check if user has existing stage registrations
router.get('/check-stage-registration', async (req, res) => {
    try {
        // For now, we'll use a simple mapping. In production, you'd get this from session
        const userSchoolMapping = {
            'user1': 'JB Vaccha High School',
            'user2': 'Delhi Public School',
            'user3': 'Ryan International School'
        };
        
        // Get username from session or query parameter for testing
        const username = req.session?.username || req.query.username || 'user1';
        const schoolName = userSchoolMapping[username];
        
        if (!schoolName) {
            return res.json({ hasRegistration: false });
        }

        const school = await School.findOne({ name: schoolName });
        if (!school) {
            return res.json({ hasRegistration: false });
        }

        // Check if school has any stage event registrations
        const stageCategory = await EventCategory.findOne({ name: 'Stage' });
        if (!stageCategory) {
            return res.json({ hasRegistration: false });
        }

        const stageEvents = await Event.find({ categoryId: stageCategory._id });
        const stageEventIds = stageEvents.map(event => event._id);

        const existingRegistrations = await EventRegistration.find({
            schoolId: school._id,
            eventId: { $in: stageEventIds }
        }).populate('eventId');

        res.json({
            hasRegistration: existingRegistrations.length > 0,
            school: school,
            registrations: existingRegistrations
        });

    } catch (error) {
        console.error('Error checking registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all categories and their events (for future expansion)
router.get('/events/all', async (req, res) => {
    try {
        const categories = await EventCategory.find().sort({ name: 1 });
        const result = [];

        for (let category of categories) {
            const events = await Event.find({ 
                categoryId: category._id, 
                isActive: true 
            }).sort({ name: 1 });

            result.push({
                category: category,
                events: events
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching all events:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get registration statistics
router.get('/stats/registrations', async (req, res) => {
    try {
        console.log('📊 Fetching registration statistics...');
        
        // Add timeout wrapper for database operations
        const timeoutMs = 15000; // 15 seconds
        
        const totalRegistrations = await Promise.race([
            EventRegistration.countDocuments(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), timeoutMs))
        ]);
        
        const totalSchools = await Promise.race([
            School.countDocuments(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), timeoutMs))
        ]);
        
        // Get total event registrations (sum of all individual event registrations)
        const eventRegistrations = await Promise.race([
            EventRegistration.find(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), timeoutMs))
        ]);
        
        const totalEventRegistrations = eventRegistrations.length;

        console.log(`✅ Stats: ${totalRegistrations} registrations, ${totalSchools} schools`);

        res.json({
            totalRegistrations: totalRegistrations,
            totalSchools: totalSchools,
            totalEventRegistrations: totalEventRegistrations
        });
    } catch (error) {
        console.error('❌ Error fetching registration stats:', error.message);
        
        // Return default values if database is unavailable
        res.json({
            totalRegistrations: 0,
            totalSchools: 0,
            totalEventRegistrations: 0,
            error: 'Database unavailable'
        });
    }
});

module.exports = router;
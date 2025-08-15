const express = require('express');
const mongoose = require('mongoose');
const { School, StageEvent, StageRegistration, SportsRegistration, ClassroomRegistration } = require('../database/init_db');
const googleSheetsService = require('../services/googleSheets');

const router = express.Router();

// Debug: Check if models are available
console.log('Models loaded in registration routes:', {
    School: !!School,
    StageEvent: !!StageEvent, 
    StageRegistration: !!StageRegistration,
    SportsRegistration: !!SportsRegistration,
    ClassroomRegistration: !!ClassroomRegistration
});

// Dummy auth middleware
const requireAuth = (req, res, next) => {
    next();
};

const userSchoolMapping = require("../index.js");


// Get stage events
router.get('/events/stage', async (req, res) => {
    try {
        const events = await StageEvent.find({ isActive: true }).sort({ name: 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching stage events:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Register for stage events
router.post('/register/stage', requireAuth, async (req, res) => {
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

        // Delete ALL existing registrations for this school first
        // This ensures that events changed from "yes" to "no" are properly removed
        const deletedCount = await StageRegistration.deleteMany({ schoolId: school._id });
        console.log(`Deleted ${deletedCount.deletedCount} existing registrations for school: ${school.name}`);

        // Save all registrations and collect event names for sheets sync
        const eventsWithNames = [];
        
        for (let eventData of events) {
            const event = await StageEvent.findById(eventData.eventId);
            if (!event) {
                return res.status(400).json({ message: `Event not found: ${eventData.eventId}` });
            }

            // Create new registration
            const eventRegistration = new StageRegistration({
                schoolId: school._id,
                eventId: eventData.eventId,
                participants: eventData.participants.map(participant => {
                    // Filter out null gender values - only include gender if it's not null
                    const cleanParticipant = {
                        name: participant.name,
                        grade: participant.grade,
                        participantOrder: participant.participantOrder
                    };
                    
                    // Only add gender field if it's not null or empty
                    if (participant.gender && participant.gender.trim() !== '') {
                        cleanParticipant.gender = participant.gender;
                    }
                    
                    return cleanParticipant;
                })
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

        // Send immediate success response to user
        res.status(201).json({ 
            message: 'Registration completed successfully',
            schoolId: school._id,
            eventsRegistered: events.length
        });

        // Sync to Google Sheets in background (non-blocking)
        setImmediate(async () => {
            try {
                await googleSheetsService.addStageRegistration({
                    school: schoolData,
                    events: eventsWithNames
                });
                console.log('✅ Background Google Sheets sync completed');
            } catch (sheetsError) {
                console.warn('⚠️ Background Google Sheets sync failed:', sheetsError.message);
            }
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

        const registrations = await StageRegistration.find({ schoolId })
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
        // Use global mapping
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
        const existingRegistrations = await StageRegistration.find({
            schoolId: school._id
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

// Check if user has existing sports registrations
router.get('/check-sports-registration', async (req, res) => {
    try {
        // Use global mapping
        const username = req.session?.username || req.query.username || 'user1';
        const schoolName = userSchoolMapping[username];
        
        if (!schoolName) {
            return res.json({ hasRegistration: false });
        }

        const school = await School.findOne({ name: schoolName });
        if (!school) {
            return res.json({ hasRegistration: false });
        }

        // Check if school has any sports event registrations
        const existingRegistrations = await SportsRegistration.find({
            schoolId: school._id
        });

        res.json({
            hasRegistration: existingRegistrations.length > 0,
            school: school,
            registrations: existingRegistrations
        });

    } catch (error) {
        console.error('Error checking sports registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check if user has existing classroom registrations
router.get('/check-classroom-registration', async (req, res) => {
    try {
        // Use global mapping
        const username = req.session?.username || req.query.username || 'user1';
        const schoolName = userSchoolMapping[username];

        console.log(username)
        console.log(schoolName)
        
        if (!schoolName) {
            return res.json({ hasRegistration: false });
        }

        console.log(School)
        const school = await School.findOne({ name: schoolName });
        if (!school) {
            return res.json({ hasRegistration: false });
        }

        // Use the imported ClassroomRegistration model
        const existingRegistrations = await ClassroomRegistration.find({
            schoolId: school._id
        });

        res.json({
            hasRegistration: existingRegistrations.length > 0,
            school: school,
            registrations: existingRegistrations
        });

    } catch (error) {
        console.error('Error checking classroom registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Register for classroom events
router.post('/register/classroom', async (req, res) => {
    try {
        const { school: schoolData, events } = req.body;
        
        console.log('📊 Processing classroom registration for:', schoolData.name);
        
        // Validate input
        if (!schoolData || !events || events.length === 0) {
            return res.status(400).json({ message: 'School information and events are required' });
        }

        // Create or update school
        let school = await School.findOne({ name: schoolData.name });
        if (!school) {
            school = new School(schoolData);
        } else {
            Object.assign(school, schoolData);
        }
        await school.save();

        // Event name mapping
        const eventNameMapping = {
            'admeta-cat1': 'Admeta: Category 1',
            'admeta-cat2': 'Admeta: Category 2',
            'artem': 'Artem',
            'carmen-cat1': 'Carmen: Category 1',
            'carmen-cat2': 'Carmen: Category 2',
            'fabula': 'Fabula',
            'fortuna': 'Fortuna',
            'codeferno': 'Codeferno',
            'gustatio': 'Gustatio',
            'mahim16': 'Mahim 16',
            'adventurium': "‘Ad’venturium"
        };

        // Delete existing registrations for this school
        await ClassroomRegistration.deleteMany({ schoolId: school._id });
        console.log('🗑️ Removed existing classroom registrations');

        // Create new registrations and collect events with names for sheets sync
        const registrations = [];
        const eventsWithNames = [];
        
        for (const eventData of events) {
            const registration = new ClassroomRegistration({
                schoolId: school._id,
                eventId: eventData.eventId,
                eventName: eventNameMapping[eventData.eventId] || eventData.eventId,
                participants: eventData.participants
            });
            registrations.push(registration);
            
            // Add event name for sheets sync
            eventsWithNames.push({
                ...eventData,
                eventName: eventNameMapping[eventData.eventId] || eventData.eventId
            });
            
            console.log(`✅ Classroom registration prepared for event: ${eventNameMapping[eventData.eventId] || eventData.eventId}`);
        }

        await ClassroomRegistration.insertMany(registrations);
        console.log('All classroom registrations completed successfully');

        // Send immediate success response to user
        res.json({
            message: 'Classroom events registration successful',
            schoolId: school._id,
            registeredEvents: registrations.length
        });

        // Sync to Google Sheets in background (non-blocking)
        setImmediate(async () => {
            try {
                await googleSheetsService.addClassroomRegistration({
                    school: schoolData,
                    events: eventsWithNames
                });
                console.log('✅ Background Google Sheets sync completed for classroom');
            } catch (sheetsError) {
                console.warn('⚠️ Background Google Sheets sync failed for classroom:', sheetsError.message);
            }
        });

    } catch (error) {
        console.error('❌ Classroom registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Get registration statistics
router.get('/stats/registrations', async (req, res) => {
    try {
        // Count stage registrations
        const stageRegistrationCount = await StageRegistration.countDocuments();
        
        // Count sports registrations  
        const sportsRegistrationCount = await SportsRegistration.countDocuments();
        
        // Count classroom registrations using imported model
        const classroomRegistrationCount = await ClassroomRegistration.countDocuments();
        
        const totalRegistrations = stageRegistrationCount + sportsRegistrationCount + classroomRegistrationCount;
        
        res.json({
            totalRegistrations,
            totalStageRegistrations: stageRegistrationCount,
            totalSportsRegistrations: sportsRegistrationCount,
            totalClassroomRegistrations: classroomRegistrationCount,
            totalSchools: await School.countDocuments()
        });
        
    } catch (error) {
        console.error('Error fetching registration statistics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Sports registration endpoint
router.post('/register/sports', requireAuth, async (req, res) => {
    try {
        const { school: schoolData, events } = req.body;
        
        console.log('📊 Processing sports registration for:', schoolData.name);
        
        // Find or create school
        let school = await School.findOne({ name: schoolData.name });
        if (!school) {
            school = new School({
                name: schoolData.name,
                contingentCode: schoolData.contingentCode,
                teacherName: schoolData.teacherName,
                teacherMobile: schoolData.teacherMobile,
                teacherEmail: schoolData.teacherEmail
            });
            await school.save();
            console.log('✅ New school created for sports registration');
        } else {
            // Update school information
            school.teacherName = schoolData.teacherName;
            school.teacherMobile = schoolData.teacherMobile;
            school.teacherEmail = schoolData.teacherEmail;
            await school.save();
            console.log('✅ School information updated for sports registration');
        }

        // Remove existing sports registrations for this school
        await SportsRegistration.deleteMany({ schoolId: school._id });
        console.log('🗑️ Removed existing sports registrations');

        // Create new registrations
        const eventsWithNames = [];
        for (const eventData of events) {
            const registration = new SportsRegistration({
                schoolId: school._id,
                eventId: eventData.eventId,
                eventName: getSportsEventName(eventData.eventId),
                participants: eventData.participants
            });
            
            await registration.save();
            eventsWithNames.push({
                ...eventData,
                eventName: getSportsEventName(eventData.eventId)
            });
            console.log(`✅ Sports registration saved for event: ${getSportsEventName(eventData.eventId)}`);
        }

        console.log('All sports registrations completed successfully');

        // Send immediate success response to user
        res.status(201).json({ 
            message: 'Sports registration completed successfully',
            schoolId: school._id,
            eventsRegistered: events.length
        });

        // Sync to Google Sheets in background (non-blocking)
        setImmediate(async () => {
            try {
                await googleSheetsService.addSportsRegistration({
                    school: schoolData,
                    events: eventsWithNames
                });
                console.log('✅ Background Google Sheets sync completed for sports');
            } catch (sheetsError) {
                console.warn('⚠️ Background Google Sheets sync failed for sports:', sheetsError.message);
            }
        });

    } catch (error) {
        console.error('❌ Sports registration error:', error);
        res.status(500).json({ 
            message: 'Sports registration failed',
            error: error.message 
        });
    }
});

// Helper function to get sports event names
function getSportsEventName(eventId) {
    const sportsEventNames = {
        'explorare': 'Explorare',
        'monopolium': 'Monopolium',
        'football-u18-boys': 'Football: Category 1: U18 Boys',
        'football-u16-boys': 'Football: Category 2: U16 Boys',
        'football-u18-girls': 'Football: Category 3: U18 Girls',
        'basketball-u19-boys': 'Basketball: Boys (U19)',
        'basketball-u16-boys': 'Basketball: Boys (U16)',
        'basketball-u19-girls': 'Basketball: Girls (U19)',
        'basketball-u16-girls': 'Basketball: Girls (U16)',
        'gully-cricket': 'Gully Cricket',
        'table-tennis': 'Table Tennis',
        'tug-of-war-boys': 'Tug Of War: Boys (Under 16 and Under 19)',
        'tug-of-war-girls': 'Tug Of War: Girls (Under 16 and Under 19)'
    };
    return sportsEventNames[eventId] || eventId;
}

module.exports = router;
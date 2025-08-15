// Import existing models from the database initialization
const { SportsRegistration, ClassroomRegistration } = require('../database/init_db');

// For now, we'll use the existing models and create a StageRegistration equivalent
// Note: We need to check if StageRegistration exists or create it

const mongoose = require('mongoose');

// Check if StageRegistration model exists, if not create it
let StageRegistration;
try {
    StageRegistration = mongoose.model('StageRegistration');
} catch (error) {
    // Model doesn't exist, create it
    const stageRegistrationSchema = new mongoose.Schema({
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        participants: [{
            name: { type: String, required: true },
            standard: { type: String, required: true },
            division: { type: String, required: true }
        }],
        submittedBy: { type: String, required: true }
    }, {
        timestamps: true
    });

    StageRegistration = mongoose.model('StageRegistration', stageRegistrationSchema);
}

// For admin API compatibility, we'll create an alias for SportsRegistration
const SportsGamingRegistration = SportsRegistration;

module.exports = {
    SportsGamingRegistration,
    ClassroomRegistration,
    StageRegistration
};

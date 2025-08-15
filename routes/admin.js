const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { SportsRegistration, ClassroomRegistration } = require('../database/init_db');

// Middleware to verify admin JWT token
const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Admin login endpoint
router.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required' });
    }
    
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Invalid admin password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
        { role: 'admin', loginTime: new Date() },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    res.json({ 
        success: true, 
        message: 'Admin login successful',
        token: token
    });
});

// Get all registrations for admin dashboard
router.get('/registrations', verifyAdminToken, async (req, res) => {
    try {
        // Fetch all registrations from collections and populate school information
        const sportsRegistrations = await SportsRegistration.find()
            .populate('schoolId', 'name contingentCode')
            .sort({ registrationDate: -1 });
            
        const classroomRegistrations = await ClassroomRegistration.find()
            .populate('schoolId', 'name contingentCode')
            .sort({ registrationDate: -1 });
        
        // Transform the data to match admin dashboard expectations
        const transformRegistration = (reg, type) => ({
            id: reg._id,
            type: type,
            schoolName: reg.schoolId?.name || 'Unknown School',
            contingentCode: reg.schoolId?.contingentCode || 'Unknown',
            eventName: reg.eventName,
            participantCount: reg.participants.length,
            participants: reg.participants.map(p => ({
                name: p.name,
                standard: p.grade ? p.grade.toString() : 'Unknown',
                division: 'A' // Default since grade/division structure may differ
            })),
            submittedAt: reg.registrationDate || reg.createdAt,
            submittedBy: 'System' // Since this info may not be available in existing schema
        });
        
        // Combine and format the data
        const allRegistrations = {
            sportsGaming: sportsRegistrations.map(reg => transformRegistration(reg, 'Sports & Gaming')),
            classroom: classroomRegistrations.map(reg => transformRegistration(reg, 'Classroom')),
            stage: [] // Stage events don't exist in current schema
        };
        
        // Summary statistics
        const summary = {
            totalRegistrations: sportsRegistrations.length + classroomRegistrations.length,
            sportsGamingCount: sportsRegistrations.length,
            classroomCount: classroomRegistrations.length,
            stageCount: 0
        };
        
        res.json({
            success: true,
            summary: summary,
            registrations: allRegistrations
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching registrations',
            error: error.message 
        });
    }
});

// Get registrations by school
router.get('/registrations/school/:contingentCode', verifyAdminToken, async (req, res) => {
    try {
        const { contingentCode } = req.params;
        
        // Find school by contingent code first
        const { School } = require('../database/init_db');
        const school = await School.findOne({ contingentCode });
        
        if (!school) {
            return res.status(404).json({ 
                success: false, 
                message: 'School not found' 
            });
        }
        
        const sportsRegistrations = await SportsRegistration.find({ schoolId: school._id })
            .populate('schoolId', 'name contingentCode')
            .sort({ registrationDate: -1 });
            
        const classroomRegistrations = await ClassroomRegistration.find({ schoolId: school._id })
            .populate('schoolId', 'name contingentCode')
            .sort({ registrationDate: -1 });
        
        const schoolRegistrations = {
            contingentCode: contingentCode,
            schoolName: school.name,
            sportsGaming: sportsRegistrations,
            classroom: classroomRegistrations,
            stage: [],
            totalRegistrations: sportsRegistrations.length + classroomRegistrations.length
        };
        
        res.json({
            success: true,
            data: schoolRegistrations
        });
    } catch (error) {
        console.error('Error fetching school registrations:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching school registrations',
            error: error.message 
        });
    }
});

// Get registrations by event type
router.get('/registrations/type/:eventType', verifyAdminToken, async (req, res) => {
    try {
        const { eventType } = req.params;
        let registrations = [];
        
        switch (eventType.toLowerCase()) {
            case 'sports':
            case 'sportsgaming':
                registrations = await SportsRegistration.find()
                    .populate('schoolId', 'name contingentCode')
                    .sort({ registrationDate: -1 });
                break;
            case 'classroom':
                registrations = await ClassroomRegistration.find()
                    .populate('schoolId', 'name contingentCode')
                    .sort({ registrationDate: -1 });
                break;
            case 'stage':
                registrations = []; // Stage events don't exist in current schema
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid event type' });
        }
        
        res.json({
            success: true,
            eventType: eventType,
            count: registrations.length,
            registrations: registrations
        });
    } catch (error) {
        console.error('Error fetching registrations by type:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching registrations by type',
            error: error.message 
        });
    }
});

module.exports = router;

const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = '1yQ3ctzl7xL_UsxDQTDV1P00zKFSSk6NWCuDPp_Cr6Dg';
        this.classroomSheetName = process.env.CLASSROOM_SHEET_NAME || 'Classroom Events';
        this.init();
    }

    async init() {
        try {
            // Load service account credentials from environment or file
            let credentials;
            
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                // Load from environment variable (for production)
                credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            } else {
                // Load from file (for development)
                const credentialsPath = path.join(__dirname, '../.config/google-credentials.json');
                credentials = require(credentialsPath);
            }

            const auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file'
                ]
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets service initialized');
            
            // Initialize sheets
            await this.initializeSheets();
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
            // Don't throw - allow app to continue without sheets integration
        }
    }

    async initializeSheets() {
        try {
            // Get current sheets
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);

            // Initialize Stage Registrations sheet
            if (!sheetNames.includes('Stage Registrations')) {
                await this.createSheet('Stage Registrations', [
                    'Timestamp',
                    'School Name',
                    'Contingent Code',
                    'Teacher Name',
                    'Teacher Mobile',
                    'Teacher Email',
                    'Event Name',
                    'Participant Name',
                    'Grade',
                    'Gender',
                    'Participant Order'
                ]);
            } else {
                await this.ensureHeaders('Stage Registrations', [
                    'Timestamp',
                    'School Name',
                    'Contingent Code',
                    'Teacher Name',
                    'Teacher Mobile',
                    'Teacher Email',
                    'Event Name',
                    'Participant Name',
                    'Grade',
                    'Gender',
                    'Participant Order'
                ]);
            }

            // Initialize Sports Registrations sheet
            if (!sheetNames.includes('Sports Registrations')) {
                await this.createSheet('Sports Registrations', [
                    'Timestamp',
                    'School Name',
                    'Contingent Code',
                    'Teacher Name',
                    'Teacher Mobile',
                    'Teacher Email',
                    'Event Name',
                    'Participant Name',
                    'Grade',
                    'Gender',
                    'Weight (kg)',
                    'Participant Order'
                ]);
            } else {
                await this.ensureHeaders('Sports Registrations', [
                    'Timestamp',
                    'School Name',
                    'Contingent Code',
                    'Teacher Name',
                    'Teacher Mobile',
                    'Teacher Email',
                    'Event Name',
                    'Participant Name',
                    'Grade',
                    'Gender',
                    'Weight (kg)',
                    'Participant Order'
                ]);
            }

            // Initialize Classroom Events sheet
            if (!sheetNames.includes(this.classroomSheetName)) {
                await this.createSheet(this.classroomSheetName, this.getClassroomHeaders());
            } else {
                await this.ensureHeaders(this.classroomSheetName, this.getClassroomHeaders());
            }

        } catch (error) {
            console.error('❌ Failed to initialize sheets:', error.message);
        }
    }

    async addStageRegistration(registrationData) {
        if (!this.sheets) {
            console.warn('Google Sheets not available, skipping sync');
            return;
        }

        try {
            const { school, events } = registrationData;
            
            // Ensure the sheet exists
            await this.createSheetIfNotExists('Stage Registrations');
            
            // Get all existing data from the sheet
            const existingData = await this.getAllSheetData();
            
            // Find and remove existing entries for this school
            const filteredData = this.removeSchoolEntries(existingData, school.name);
            
            // Prepare new rows for this school
            const newRows = [];
            for (const eventReg of events) {
                const eventName = eventReg.eventName || 'Unknown Event';
                
                for (const participant of eventReg.participants) {
                    newRows.push([
                        new Date().toISOString(), // Timestamp
                        school.name,
                        school.contingentCode || '',
                        school.teacherName,
                        school.teacherMobile,
                        school.teacherEmail,
                        eventName,
                        participant.name,
                        participant.grade,
                        participant.gender || '',
                        participant.participantOrder || ''
                    ]);
                }
            }

            // Combine filtered data with new entries
            const finalData = [...filteredData, ...newRows];
            
            // Clear the sheet and write all data back
            await this.updateEntireSheet(finalData);

            console.log(`✅ Updated Google Sheets: removed old entries for ${school.name}, added ${newRows.length} new rows`);
            return { updatedRows: newRows.length };

        } catch (error) {
            console.error('❌ Failed to sync to Google Sheets:', error.message);
            // Don't throw - registration should still succeed even if sheets fails
        }
    }

    async getAllSheetData() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Stage Registrations!A:K'
            });

            const rows = response.data.values || [];
            
            // Return data without headers (skip first row if it exists)
            if (rows.length > 0 && rows[0][0] === 'Timestamp') {
                return rows.slice(1); // Skip header row
            }
            
            return rows;
        } catch (error) {
            console.warn('⚠️ Could not get existing sheet data:', error.message);
            return []; // Return empty array if sheet doesn't exist yet
        }
    }

    removeSchoolEntries(data, schoolName) {
        // Filter out all rows that belong to this school (column B contains school name)
        return data.filter(row => {
            if (!row || row.length < 2) return true; // Keep malformed rows
            return row[1] !== schoolName; // Keep rows where school name doesn't match
        });
    }

    async updateEntireSheet(data) {
        try {
            // Clear the sheet first (except headers)
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'Stage Registrations!A2:K'
            });

            // Ensure headers exist
            await this.ensureHeaders();

            // If there's data to write, append it
            if (data.length > 0) {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Stage Registrations!A:K',
                    valueInputOption: 'RAW',
                    resource: {
                        values: data
                    }
                });
            }

            console.log(`✅ Sheet updated with ${data.length} total rows`);
        } catch (error) {
            console.error('❌ Failed to update entire sheet:', error.message);
            throw error;
        }
    }

    async ensureHeaders(sheetName = 'Stage Registrations', headers) {
        try {
            // Check if headers already exist
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A1:K1`
            });

            if (!response.data.values || response.data.values.length === 0) {
                // Add headers
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:K1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });

                console.log(`✅ Added headers to ${sheetName} sheet`);
            }
        } catch (error) {
            // If the sheet doesn't exist, createSheetIfNotExists will handle it
            console.warn(`⚠️ Headers check failed for ${sheetName} (sheet may not exist yet):`, error.message);
        }
    }

    async createSheet(sheetName, headers) {
        try {
            // Create the sheet
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
            console.log(`✅ Created sheet: ${sheetName}`);
            
            // Add headers to the new sheet immediately
            const range = `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`;
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [headers]
                }
            });

            console.log(`✅ Added headers to new sheet: ${sheetName}`);
        } catch (error) {
            console.error(`❌ Failed to create sheet ${sheetName}:`, error.message);
        }
    }

    async createSheetIfNotExists(sheetName) {
        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
            
            if (!sheetNames.includes(sheetName)) {
                let headers = [];
                if (sheetName === 'Stage Registrations') {
                    headers = [
                        'Timestamp', 'School Name', 'Contingent Code', 'Teacher Name',
                        'Teacher Mobile', 'Teacher Email', 'Event Name', 'Participant Name',
                        'Grade', 'Gender', 'Participant Order'
                    ];
                } else if (sheetName === 'Sports Registrations') {
                    headers = [
                        'Timestamp', 'School Name', 'Contingent Code', 'Teacher Name',
                        'Teacher Mobile', 'Teacher Email', 'Event Name', 'Participant Name',
                        'Grade', 'Gender', 'Weight (kg)', 'Participant Order'
                    ];
                } else if (sheetName === this.classroomSheetName) {
                    headers = this.getClassroomHeaders();
                }
                
                await this.createSheet(sheetName, headers);
            }
        } catch (error) {
            console.error(`❌ Failed to check/create sheet ${sheetName}:`, error.message);
        }
    }

    async addSportsRegistration(registrationData) {
        if (!this.sheets) {
            console.warn('Google Sheets not available, skipping sync');
            return;
        }

        try {
            console.log('📊 Starting Google Sheets sync for sports registration...');
            
            const { school, events } = registrationData;
            
            // Ensure the sheet exists
            await this.createSheetIfNotExists('Sports Registrations');
            
            // Get all existing data from the sheet
            const existingData = await this.getAllSportsSheetData();
            
            // Find and remove existing entries for this school
            const filteredData = this.removeSchoolEntries(existingData, school.name);
            
            // Prepare new rows for this school
            const newRows = [];
            for (const eventReg of events) {
                const eventName = eventReg.eventName || 'Unknown Event';
                console.log(`Processing sports event: ${eventName}`);
                
                for (const participant of eventReg.participants) {
                    const row = [
                        new Date().toISOString(), // Timestamp
                        school.name,
                        school.contingentCode || '',
                        school.teacherName,
                        school.teacherMobile,
                        school.teacherEmail,
                        eventName,
                        participant.name,
                        participant.grade,
                        participant.gender || '',
                        participant.weight || '',
                        participant.participantOrder || ''
                    ];
                    newRows.push(row);
                }
            }

            // Combine filtered data with new entries
            const finalData = [...filteredData, ...newRows];
            
            // Clear the sheet and write all data back
            await this.updateEntireSportsSheet(finalData);

            console.log(`✅ Updated Sports Google Sheets: removed old entries for ${school.name}, added ${newRows.length} new rows`);
            console.log('✅ Sports registration sync completed');
            
            return { updatedRows: newRows.length };

        } catch (error) {
            console.error('❌ Failed to sync sports data to Google Sheets:', error.message);
            // Don't throw - registration should still succeed even if sheets fails
        }
    }

    async getAllSportsSheetData() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sports Registrations!A:L'
            });

            const rows = response.data.values || [];
            
            // Return data without headers (skip first row if it exists)
            if (rows.length > 0 && rows[0][0] === 'Timestamp') {
                return rows.slice(1); // Skip header row
            }
            
            return rows;
        } catch (error) {
            console.warn('⚠️ Could not get existing sports sheet data:', error.message);
            return []; // Return empty array if sheet doesn't exist yet
        }
    }

    async updateEntireSportsSheet(data) {
        try {
            // Clear the sheet first (except headers)
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'Sports Registrations!A2:L'
            });

            // Ensure headers exist
            await this.ensureSportsHeaders();

            // If there's data to write, append it
            if (data.length > 0) {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Sports Registrations!A:L',
                    valueInputOption: 'RAW',
                    resource: {
                        values: data
                    }
                });
            }

            console.log(`✅ Sports sheet updated with ${data.length} total rows`);
        } catch (error) {
            console.error('❌ Failed to update entire sports sheet:', error.message);
            throw error;
        }
    }

    async ensureSportsHeaders() {
        try {
            // Check if headers already exist
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sports Registrations!A1:L1'
            });

            if (!response.data.values || response.data.values.length === 0) {
                // Add headers
                const headers = [
                    'Timestamp',
                    'School Name',
                    'Contingent Code',
                    'Teacher Name',
                    'Teacher Mobile',
                    'Teacher Email',
                    'Event Name',
                    'Participant Name',
                    'Grade',
                    'Gender',
                    'Weight (kg)',
                    'Participant Order'
                ];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Sports Registrations!A1:L1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });

                console.log('✅ Added headers to Sports Google Sheets');
            }
        } catch (error) {
            // If the sheet doesn't exist, createSheetIfNotExists will handle it
            console.warn('⚠️ Sports headers check failed (sheet may not exist yet):', error.message);
        }
    }

    async getRegistrationStats() {
        if (!this.sheets) return null;

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Stage Registrations!A:K'
            });

            const rows = response.data.values || [];
            return {
                totalEntries: Math.max(0, rows.length - 1), // Exclude header
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Failed to get stats from Google Sheets:', error.message);
            return null;
        }
    }

    async addClassroomRegistration(registrationData) {
        if (!this.sheets) {
            console.warn('Google Sheets not available, skipping sync');
            return;
        }

        try {
            console.log('📊 Starting Google Sheets sync for classroom registration...');
            
            const { school, events } = registrationData;
            
            // Ensure the sheet exists
            await this.createSheetIfNotExists(this.classroomSheetName);
            
            // Get all existing data from the sheet
            const existingData = await this.getAllClassroomSheetData();
            
            // Find and remove existing entries for this school
            const filteredData = this.removeSchoolEntries(existingData, school.name);
            
            // Prepare new rows for this school
            const newRows = [];
            for (const eventReg of events) {
                const eventName = eventReg.eventName || 'Unknown Event';
                console.log(`Processing classroom event: ${eventName}`);
                
                for (const participant of eventReg.participants) {
                    const row = [
                        new Date().toISOString(), // Timestamp
                        school.name,
                        school.contingentCode || '',
                        school.teacherName,
                        school.teacherMobile,
                        school.teacherEmail,
                        eventName,
                        participant.name,
                        participant.grade
                    ];
                    newRows.push(row);
                }
            }

            // Combine filtered data with new entries
            const finalData = [...filteredData, ...newRows];
            
            // Clear the sheet and write all data back
            await this.updateEntireClassroomSheet(finalData);

            console.log(`✅ Updated Classroom Google Sheets: removed old entries for ${school.name}, added ${newRows.length} new rows`);
            console.log('✅ Classroom registration sync completed');
            
            return { updatedRows: newRows.length };
            
        } catch (error) {
            console.error('❌ Error syncing classroom registration to Google Sheets:', error);
            // Don't throw - registration should still succeed even if sheets fails
        }
    }

    async getAllClassroomSheetData() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.classroomSheetName}!A:I`
            });

            const rows = response.data.values || [];
            
            // Return data without headers (skip first row if it exists)
            if (rows.length > 0 && rows[0][0] === 'Timestamp') {
                return rows.slice(1); // Skip header row
            }
            
            return rows;
        } catch (error) {
            console.warn('⚠️ Could not get existing classroom sheet data:', error.message);
            return []; // Return empty array if sheet doesn't exist yet
        }
    }

    async updateEntireClassroomSheet(data) {
        try {
            // Clear the sheet first (except headers)
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${this.classroomSheetName}!A2:I`
            });

            // Ensure headers exist
            await this.ensureClassroomHeaders();

            // If there's data to write, append it
            if (data.length > 0) {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.classroomSheetName}!A:I`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: data
                    }
                });
            }

            console.log(`✅ Classroom sheet updated with ${data.length} total rows`);
        } catch (error) {
            console.error('❌ Failed to update entire classroom sheet:', error.message);
            throw error;
        }
    }

    async ensureClassroomHeaders() {
        try {
            // Check if headers already exist
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.classroomSheetName}!A1:I1`
            });

            if (!response.data.values || response.data.values.length === 0) {
                // Add headers
                const headers = this.getClassroomHeaders();

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.classroomSheetName}!A1:I1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });

                console.log(`✅ Added headers to ${this.classroomSheetName} sheet`);
            }
        } catch (error) {
            // If the sheet doesn't exist, createSheetIfNotExists will handle it
            console.warn(`⚠️ Classroom headers check failed (sheet may not exist yet):`, error.message);
        }
    }

    getClassroomHeaders() {
        return [
            'Timestamp',
            'School Name',
            'Contingent Code',
            'Teacher Name',
            'Teacher Mobile',
            'Teacher Email',
            'Event Name',
            'Participant Name',
            'Grade'
        ];
    }
}

module.exports = new GoogleSheetsService();
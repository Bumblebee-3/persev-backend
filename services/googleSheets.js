const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = '1yQ3ctzl7xL_UsxDQTDV1P00zKFSSk6NWCuDPp_Cr6Dg';
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
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
            // Don't throw - allow app to continue without sheets integration
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

    async ensureHeaders() {
        try {
            // Check if headers already exist
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Stage Registrations!A1:K1'
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
                    'Participant Order'
                ];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Stage Registrations!A1:K1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });

                console.log('✅ Added headers to Google Sheets');
            }
        } catch (error) {
            // If the sheet doesn't exist, createSheetIfNotExists will handle it
            console.warn('⚠️ Headers check failed (sheet may not exist yet):', error.message);
        }
    }

    async createSheetIfNotExists(sheetName) {
        try {
            // Get current sheets
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheetExists = spreadsheet.data.sheets.some(
                sheet => sheet.properties.title === sheetName
            );

            if (!sheetExists) {
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
                    'Participant Order'
                ];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:K1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });

                console.log(`✅ Added headers to new sheet: ${sheetName}`);
            }
        } catch (error) {
            console.error(`❌ Failed to create sheet ${sheetName}:`, error.message);
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
}

module.exports = new GoogleSheetsService();
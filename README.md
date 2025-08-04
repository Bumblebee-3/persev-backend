<div align="center">

# Perseverantia 2025
Code for the official website for Perseverantia 2025

https://github.com/user-attachments/assets/a459d288-3105-451a-a152-b6129d036bb1

**Live Site:** [https://perseverantia.events-at-scottishmahim.com/](https://perseverantia.events-at-scottishmahim.com/)
</div>

## Setup & Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with these keys:
   ```env
   UNAMES=user1,user2,user3,...
   PASSWORDS=hash1,hash2,hash3,...
   MONGODB_URI=<Your MongoDB Atlas URI>
   GOOGLE_SPREADSHEET_ID=<Your Google Sheet ID>
   GOOGLE_CREDENTIALS_PATH=./.config/google-credentials.json
   ```

3. Place your Google service account JSON in `.config/google-credentials.json`.

4. Initialize and populate the database:
   ```bash
   node database/init_db.js
   node database/populate_db.js
   ```

5. (Optional) Reset the database for a clean slate:
   ```bash
   node database/reset_db.js
   ```

6. Start the server:
   ```bash
   node index.js
   ```

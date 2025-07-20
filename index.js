const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.once('open', () => console.log('Connected to MongoDB'));

// 🔄 Updated schema to include imageUrl
const cyberNewsSchema = new mongoose.Schema({
  title: String,
  description: String,
  url: String,
  imageUrl: String, // <-- New field
  published: String,
  fetchedAt: { type: Date, default: Date.now },
});

const CyberNews = mongoose.model('CyberNews', cyberNewsSchema, 'CyberNews');

// 🔄 Function to fetch and store news
 // 🔄 Function to fetch and store unique news
async function fetchAndStoreNews() {
  try {
    const now = new Date();

    const response = await axios.get('https://api.currentsapi.services/v1/search', {
      headers: { Authorization: process.env.CURRENTS_API_KEY },
      params: { keywords: 'cybersecurity', country: 'US' },
    });

    const articles = response.data.news;

    let insertedCount = 0;

    for (const article of articles) {
      const result = await CyberNews.updateOne(
        { url: article.url }, // Filter by unique article URL
        {
          $setOnInsert: {
            title: article.title,
            description: article.description,
            imageUrl: article.image,
            published: article.published,
            fetchedAt: now,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) insertedCount++;
    }

    console.log(`Inserted ${insertedCount} new unique articles at ${now.toISOString()}`);
  } catch (err) {
    console.error('Error fetching or storing news:', err.message);
  }
}

// Initial fetch on startup
fetchAndStoreNews();

// Refresh every 24 hours
setInterval(fetchAndStoreNews, REFRESH_INTERVAL);

// API endpoint
app.get('/api/news', async (req, res) => {
  try {
    const existingNews = await CyberNews.find({
  imageUrl: { $nin: [null, "", "None"] }
}).sort({ fetchedAt: -1 });

    res.json({ source: 'mongo', news: existingNews });
  } catch (error) {
    console.error('Error loading news from DB:', error.message);
    res.status(500).json({ error: 'Failed to load news' });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


const { google } = require('googleapis');
const keys = require('./credentials.json'); // path to your downloaded file

const auth = new google.auth.GoogleAuth({
  credentials: keys,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
app.post('/api/upload-to-google', async (req, res) => {
  const spreadsheetId = '1BM7tWdvlXbzoq9TLtpfT456MxzneJetG2ds26D5q5LU';
  const sheetName = 'sheet1';

  try {
    // ✅ Flatten object: convert array values to comma-separated strings
    const cleanedData = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (Array.isArray(value)) {
        cleanedData[key] = value.join(', ');
      } else {
        cleanedData[key] = value;
      }
    }

    // ✅ Prepare values as 1D array for Google Sheets row
    const values = [Object.values(cleanedData)];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values },
    });

    console.log('Uploaded:', response.data);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Upload failed:', error.message);
    res.status(500).json({ error: 'Error uploading to Sheets' });
  }
});

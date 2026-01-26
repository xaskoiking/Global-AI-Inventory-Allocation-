import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Initialize Google AI with API Key from Environment
const API_KEY = process.env.GOOGLE_AI_KEY;
let genAI = null;

if (API_KEY) {
    genAI = new GoogleGenAI({ apiKey: API_KEY });
    console.log('[GaiaAI] Proxy initialized with GOOGLE_AI_KEY.');
} else {
    console.error('[GaiaAI] CRITICAL: GOOGLE_AI_KEY not found in environment!');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/ai', async (req, res) => {
    const { model: modelName, parts, config } = req.body;

    console.log(`[GaiaAI] Proxy Request: Model=${modelName}, Parts=${parts?.length || 0}`);

    try {
        if (!genAI) {
            throw new Error('AI Service not initialized. Check server environment variables.');
        }

        if (!parts || !Array.isArray(parts)) {
            throw new Error('Invalid request: "parts" must be an array.');
        }

        const model = genAI.models.get({
            model: modelName,
            config: config
        });

        // Pack parts into the standard request format
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });

        if (!result.text) {
            throw new Error('AI returned an empty response.');
        }

        res.json({ text: result.text });
    } catch (error) {
        console.error('AI Proxy Error:', error.message);
        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
});

// Handle React routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`GAIA 3.0 Backend running on port ${port}`);
});

// server.js
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");
const axios = require("axios");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const zlib = require('zlib'); // For potential error stream decompression, useful for ElevenLabs

const app = express();
const port = process.env.PORT || 3000;

// --- Provider Configuration ---
const sttServiceProvider = (process.env.STT_PROVIDER || "gemini").toLowerCase();
const ttsServiceProvider = (process.env.TTS_PROVIDER || "eleven").toLowerCase();

// --- Initialize Google Generative AI ---
let genAI;
let geminiVisionModel; // For multimodal tasks (like STT with audio files)
let geminiTextModel;   // For text-only tasks

if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const safetySettings = [ /* ... safety settings ... */ ]; // Keep your safety settings
    geminiVisionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
    geminiTextModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
} else {
    if (sttServiceProvider === "gemini") {
        console.warn("STT_PROVIDER is 'gemini' but GEMINI_API_KEY is not found. Gemini STT will not work.");
    }
    // Gemini text models might also be used by other endpoints, so a general warning is good.
    console.warn("GEMINI_API_KEY not found. Gemini related features may not work.");
}

app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });

app.use((req, res, next) => { // Security Headers
    res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' http://localhost:" + port + " https://api.elevenlabs.io; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

async function fileToGenerativePart(filePath, mimeType) {
    const fileData = await fsp.readFile(filePath);
    return { inlineData: { data: fileData.toString("base64"), mimeType } };
}

// 🎙️ Speech-to-Text Endpoint
app.post("/stt", upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded." });
    }
    const inputPath = req.file.path;
    const wavPath = `${inputPath}.wav`;
    const lang = req.body.lang || "en";

    try {
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error("FFMPEG Error:", stderr);
                    return reject(new Error("Audio conversion failed"));
                }
                resolve();
            });
        });

        let transcript;
        console.log(`Using STT Provider: ${sttServiceProvider}`);

        if (sttServiceProvider === "gemini") {
            if (!genAI || !geminiVisionModel) {
                return res.status(500).json({ error: "Gemini STT provider selected, but API key or model not configured." });
            }
            const audioPart = await fileToGenerativePart(wavPath, "audio/wav");
            const prompt = `Transcribe the following audio accurately. The language is likely ${lang}. Provide only the transcription text.`;
            const result = await geminiVisionModel.generateContent([prompt, audioPart]);
            transcript = result.response.text();
        } else if (sttServiceProvider === "eleven") {
            if (!process.env.ELEVEN_API_KEY) {
                return res.status(500).json({ error: "ElevenLabs STT provider selected, but ELEVEN_API_KEY not configured." });
            }
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const FormData = require("form-data");
            const formData = new FormData();
            formData.append("file", fs.createReadStream(wavPath), { filename: 'audio.wav', contentType: 'audio/wav' });
            // Note: Check ElevenLabs STT API documentation for any other required form fields like 'model_id' if problems persist.

            try {
                const sttResponse = await axios.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    formData,
                    { headers: { ...formData.getHeaders(), "xi-api-key": elevenApiKey } }
                );
                transcript = sttResponse.data.text;
            } catch (elevenErr) { // Catch specific to ElevenLabs STT call
                console.error("--- ElevenLabs STT API Call Failed ---");
                if (elevenErr.isAxiosError && elevenErr.response) {
                    console.error(`Status from ElevenLabs: ${elevenErr.response.status}`);
                    console.error("Response Headers:", JSON.stringify(elevenErr.response.headers, null, 2));
                    // THIS IS THE MOST IMPORTANT LOG FOR THE 422 ERROR:
                    console.error("Raw error response data from ElevenLabs:", JSON.stringify(elevenErr.response.data, null, 2));

                    if (elevenErr.response.data && elevenErr.response.data.detail && Array.isArray(elevenErr.response.data.detail)) {
                        console.error("Specific Validation Errors from ElevenLabs STT:");
                        elevenErr.response.data.detail.forEach((errorItem, index) => {
                            console.error(`  Error ${index + 1}: loc: [${errorItem.loc?.join(', ')}], msg: ${errorItem.msg}, type: ${errorItem.type}`);
                        });
                    }
                } else {
                    console.error("Non-Axios error during ElevenLabs STT call:", elevenErr.message);
                }
                console.error("------------------------------------------");
                throw elevenErr; // Re-throw to be caught by the main try-catch for the route
            }
        } else {
            return res.status(501).json({ error: `STT provider '${sttServiceProvider}' not supported or misconfigured.` });
        }
        res.json({ text: transcript });

    } catch (err) { // Main catch for the /stt route
        console.error("STT Main Route Error:", err.message); // err.message will have "Request failed with status code 422" if it's the re-thrown Axios error
        // The detailed log from the ElevenLabs specific catch block (above) is more useful for debugging the 422.
        res.status(500).json({ error: err.message || "STT operation failed" });
    } finally {
        try {
            await fsp.unlink(inputPath);
            if (fs.existsSync(wavPath)) {
                await fsp.unlink(wavPath);
            }
        } catch (unlinkErr) {
            console.error("Error unlinking STT audio files:", unlinkErr);
        }
    }
});

// 🌐 Translation Endpoint (Uses Gemini by default)
app.post("/translate", async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) return res.status(400).json({ error: "Missing text or target language" });
        if (!genAI || !geminiTextModel) return res.status(500).json({ error: "Gemini API not configured." });

        const prompt = `Translate the following text into ${targetLang}. Output only the translated text, with no additional commentary or conversational filler:\n\nText: "${text}"`;
        const result = await geminiTextModel.generateContent(prompt);
        res.json({ translatedText: result.response.text().trim() });
    } catch (err) {
        console.error("Translation Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Translation failed. " + (err.message || "") });
    }
});

// 🔊 Text-to-Speech Endpoint
app.post("/tts", async (req, res) => {
    const { text, lang, instructions } = req.body;
    console.log(`Using TTS Provider: ${ttsServiceProvider}`);

    try {
        if (ttsServiceProvider === "eleven") {
            if (!process.env.ELEVEN_API_KEY) {
                return res.status(500).json({ error: "ElevenLabs TTS provider selected, but ELEVEN_API_KEY not configured." });
            }
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const voiceId = process.env.ELEVEN_VOICE_ID ||
                (lang === "ja" ? "YOUR_VALID_JAPANESE_VOICE_ID" : // REPLACE THESE EXAMPLE IDs
                    lang === "de" ? "YOUR_VALID_GERMAN_VOICE_ID" :
                        "YOUR_VALID_DEFAULT_VOICE_ID"); // e.g. an English voice

            console.log(`ElevenLabs TTS using Voice ID: ${voiceId}`);
            const payload = { text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } };
            // ... (handle instructions if needed for ElevenLabs) ...

            const ttsResponse = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                payload,
                { responseType: "stream", headers: { "xi-api-key": elevenApiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" } }
            );

            const tempDir = path.join(__dirname, 'temp_audio');
            if (!fs.existsSync(tempDir)){ fs.mkdirSync(tempDir); }
            const uniqueFilename = `tts_output_${Date.now()}.mp3`;
            const filePath = path.join(tempDir, uniqueFilename);
            const fileStream = fs.createWriteStream(filePath);

            ttsResponse.data.pipe(fileStream);

            await new Promise((resolve, reject) => {
                fileStream.on("finish", resolve);
                fileStream.on("error", reject);
            });

            res.json({ audioUrl: `/tts_audio/${uniqueFilename}` });
            setTimeout(() => { /* ... cleanup ... */ }, 600000);

        } else if (ttsServiceProvider === "google-cloud-tts") {
            console.warn("Google Cloud Text-to-Speech provider selected but not implemented in this version.");
            res.status(501).json({ error: "Google Cloud Text-to-Speech provider is not yet implemented." });
        } else { // Includes "gemini" or any other unsupported value
            console.warn(`TTS provider '${ttsServiceProvider}' selected. Note: @google/generative-ai SDK (for Gemini) does not directly provide TTS. Consider ElevenLabs or implement Google Cloud Text-to-Speech.`);
            res.status(501).json({ error: `TTS provider '${ttsServiceProvider}' not directly supported by this server for TTS. Use 'eleven' or implement support for other services.` });
        }
    } catch (err) { // Main catch for the /tts route
        console.error(`TTS Handler Error (${ttsServiceProvider}): ${err.message}`);
        let detailedErrorMessage = `TTS operation failed with provider ${ttsServiceProvider}.`;
        // Refined error logging from previous suggestions for ElevenLabs TTS:
        if (ttsServiceProvider === "eleven" && err.isAxiosError && err.response) {
            console.error(`Error from ElevenLabs TTS: Status ${err.response.status}`);
            console.error("ElevenLabs TTS Response Body:", JSON.stringify(err.response.data, null, 2)); // Log the full detailed response
            const detail = err.response.data?.detail;
            if (typeof detail === 'string') detailedErrorMessage = `ElevenLabs TTS Error (${err.response.status}): ${detail}`;
            else if (Array.isArray(detail)) detailedErrorMessage = `ElevenLabs TTS Error (${err.response.status}): ${detail.map(d => `${(d.loc || []).join('->')}: ${d.msg}`).join('; ')}`;
            else if (detail) detailedErrorMessage = `ElevenLabs TTS Error (${err.response.status}): ${JSON.stringify(detail)}`;
            else detailedErrorMessage = `ElevenLabs TTS Error (${err.response.status}): ${err.message}`;
        } else if (err.message) {
            detailedErrorMessage = err.message;
        }
        res.status(500).json({ error: detailedErrorMessage });
    }
});

// Serve temporary TTS audio files
app.use('/tts_audio', express.static(path.join(__dirname, 'temp_audio')));

// 🤖 Gemini Distractors Endpoint (Uses Gemini by default)
app.post("/gemini_distractors", async (req, res) => {
    // ... (code remains the same, uses geminiTextModel) ...
    try {
        const { baseText, targetLang, distractorCount } = req.body;
        // ... (validation) ...
        if (!genAI || !geminiTextModel) return res.status(500).json({ error: "Gemini API not configured." });
        // ... (prompt and call to geminiTextModel.generateContent)
        const prompt = `You are an assistant for a word game. For the base text "${baseText}" (which is in ${targetLang}), generate exactly ${distractorCount} alternative distractor options in ${targetLang}. Output only the alternatives, each on a new line. Do not include numbering, bullet points, or any extra commentary.`;
        const result = await geminiTextModel.generateContent(prompt); // Adjust model and params as needed
        const distractors = result.response.text().split("\n").map(l => l.trim()).filter(l => l.length > 0 && l !== baseText).map(l => l.replace(/^\d+\.\s*/, ""));
        res.json({ distractors });
    } catch (err) {
        console.error("Distractors Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to generate distractors. " + (err.message || "")});
    }
});

// 📄 Save Text Endpoint (No changes)
app.post("/save_text", async (req, res) => {
    // ... (code remains the same) ...
    try {
        // ...
        await fsp.writeFile(filePath, content);
        res.json({ message: "File saved successfully.", filePath });
    } catch (err) {
        console.error("Save Text Error:", err);
        res.status(500).json({ error: "Unexpected server error during save operation." });
    }
});

app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`🎙️ STT Provider configured: ${sttServiceProvider}`);
    console.log(`🔊 TTS Provider configured: ${ttsServiceProvider}`);
    // ... (warnings for missing API keys based on selected providers) ...
    if (sttServiceProvider === "gemini" && !process.env.GEMINI_API_KEY) console.warn("🔴 STT_PROVIDER is 'gemini' but GEMINI_API_KEY is missing!");
    if (sttServiceProvider === "eleven" && !process.env.ELEVEN_API_KEY) console.warn("🔴 STT_PROVIDER is 'eleven' but ELEVEN_API_KEY is missing!");
    if (ttsServiceProvider === "eleven" && !process.env.ELEVEN_API_KEY) console.warn("🔴 TTS_PROVIDER is 'eleven' but ELEVEN_API_KEY is missing!");
    if (ttsServiceProvider === "eleven" && !process.env.ELEVEN_VOICE_ID) console.warn("🟡 TTS_PROVIDER is 'eleven' but ELEVEN_VOICE_ID is not set in .env. Falling back to hardcoded example voice IDs - PLEASE UPDATE THEM!");

});
// server.js
require("dotenv").config();
const express = require("express");
const multer = multer");
const fs = require("fs");
const fsp = fs.promises; // Using fs.promises for async file operations
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");
const axios = require("axios");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google Generative AI
let genAI;
let geminiVisionModel; // For multimodal tasks (like STT with audio files)
let geminiTextModel;   // For text-only tasks

if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Configuration for safety settings - adjust as needed
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    geminiVisionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings }); // Good for multimodal
    geminiTextModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });    // Good for text tasks
} else {
    console.warn("GEMINI_API_KEY not found in .env file. Gemini related endpoints will not work.");
}

const provider = process.env.PROVIDER || "gemini"; // Default to gemini if not specified

app.use(cors()); // Consider restricting this in production
app.use(express.json());
const upload = multer({ dest: "uploads/" });

// Security headers
app.use((req, res, next) => {
    // Stricter CSP, allows connections to self and your specific backend.
    // If your client and server are on different origins in production, adjust accordingly.
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self' http://localhost:" + port + (provider === "eleven" ? " https://api.elevenlabs.io" : "") + ";" +
        " script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" // 'unsafe-inline' often needed for simple examples, but try to avoid in prod.
    );
    // Be specific with origins in production instead of '*'
    res.setHeader("Access-Control-Allow-Origin", "*"); // For development. In production, list specific origins.
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Add Authorization if you plan to use it
    next();
});

// Helper function to convert file to GenerativePart
async function fileToGenerativePart(filePath, mimeType) {
    const fileData = await fsp.readFile(filePath);
    return {
        inlineData: {
            data: fileData.toString("base64"),
            mimeType,
        },
    };
}

// 🎙️ Speech-to-Text Endpoint
app.post("/stt", upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded." });
    }

    const inputPath = req.file.path;
    const wavPath = `${inputPath}.wav`; // FFMPEG works best if output has .wav extension
    const lang = req.body.lang || "en"; // Language hint

    try {
        await new Promise((resolve, reject) => {
            exec(
                `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}"`, // Quoted paths
                async (error, stdout, stderr) => {
                    if (error) {
                        console.error("FFMPEG Error:", stderr);
                        return reject(new Error("Audio conversion failed"));
                    }
                    resolve();
                }
            );
        });

        let transcript;
        if (provider === "eleven" && process.env.ELEVEN_API_KEY) {
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const FormData = require("form-data"); // Keep require here as it's specific to this block
            const formData = new FormData();
            formData.append("file", fs.createReadStream(wavPath), { filename: 'audio.wav', contentType: 'audio/wav' });
            // formData.append("language", lang); // ElevenLabs STT API might not have a direct language parameter in the same way. Check their docs for language specification.

            const sttResponse = await axios.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                formData,
                { headers: { ...formData.getHeaders(), "xi-api-key": elevenApiKey } }
            );
            transcript = sttResponse.data.text;

        } else if (genAI && geminiVisionModel) {
            const audioPart = await fileToGenerativePart(wavPath, "audio/wav");
            const prompt = `Transcribe the following audio. The language is likely ${lang}. Provide only the transcription text.`;

            const result = await geminiVisionModel.generateContent([prompt, audioPart]);
            const response = result.response;
            transcript = response.text();
        } else {
            return res.status(500).json({ error: "STT provider not configured or Gemini API key missing." });
        }
        res.json({ text: transcript });

    } catch (err) {
        console.error("STT Error:", err);
        res.status(500).json({ error: err.message || "STT failed" });
    } finally {
        try {
            await fsp.unlink(inputPath);
            if (fs.existsSync(wavPath)) { // Check if wavPath was created before unlinking
                await fsp.unlink(wavPath);
            }
        } catch (unlinkErr) {
            console.error("Error unlinking files:", unlinkErr);
        }
    }
});

// 🌐 Translation Endpoint
app.post("/translate", async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({ error: "Missing text or target language" });
        }
        if (!genAI || !geminiTextModel) {
            return res.status(500).json({ error: "Gemini API not configured." });
        }

        const prompt = `Translate the following text into ${targetLang}. Output only the translated text, with no additional commentary or conversational filler:\n\nText: "${text}"`;

        const result = await geminiTextModel.generateContent(prompt);
        const response = result.response;
        const translatedText = response.text().trim();

        res.json({ translatedText });
    } catch (err) {
        console.error("Translation Error:", err);
        res.status(500).json({ error: "Translation failed. " + (err.message || "") });
    }
});

// 🔊 Text-to-Speech Endpoint
app.post("/tts", async (req, res) => {
    try {
        const { text, lang, instructions } = req.body; // instructions might be less relevant for ElevenLabs unless mapped to specific features

        if (provider === "eleven" && process.env.ELEVEN_API_KEY) {
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const voiceId = process.env.ELEVEN_VOICE_ID ||
                (lang === "ja" ? "pqHifnNXEr2bK552o4gV" : // Example IDs, replace with your actual ElevenLabs voice IDs
                    lang === "de" ? "FYP4xS7kAxQ74LNYKBbN" :
                        "21m00Tcm4TlvDq8ikWAM"); // Default (e.g., Rachel)

            const payload = {
                text,
                model_id: "eleven_multilingual_v2", // Or other suitable model
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            };
            // ElevenLabs has specific ways to guide style, 'style_instructions' is not a standard param.
            // You might use voice cloning with specific samples or their speech synthesis request schema for advanced control.
            // For simplicity, we'll omit direct 'instructions' mapping here unless you have a specific ElevenLabs setup for it.
            if (instructions) {
                console.log("Note: 'instructions' for ElevenLabs TTS might need specific mapping to their API features.");
                // Example: if instructions imply emotion, you might try to encode that in the text itself or use a specific voice.
            }

            const ttsResponse = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                payload,
                {
                    responseType: "stream",
                    headers: {
                        "xi-api-key": elevenApiKey,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg"
                    }
                }
            );

            // Save and serve the MP3. Consider unique filenames in a production environment.
            const tempDir = path.join(__dirname, 'temp_audio');
            if (!fs.existsSync(tempDir)){
                fs.mkdirSync(tempDir);
            }
            const uniqueFilename = `tts_output_${Date.now()}.mp3`;
            const filePath = path.join(tempDir, uniqueFilename);
            const fileStream = fs.createWriteStream(filePath);

            ttsResponse.data.pipe(fileStream);

            fileStream.on("finish", () => {
                res.json({ audioUrl: `/tts_audio/${uniqueFilename}` });
                // Optional: Clean up the file after some time or after it's been fetched once.
                setTimeout(() => {
                    if (fs.existsSync(filePath)) {
                        fsp.unlink(filePath).catch(err => console.error("Error deleting TTS file:", err));
                    }
                }, 600000); // Delete after 10 minutes
            });
            fileStream.on("error", (err) => {
                console.error("Failed to save audio stream:", err);
                res.status(500).json({ error: "Failed to save audio" });
            });

        } else {
            // Gemini API (via @google/generative-ai SDK) does not directly support TTS.
            // You would use Google Cloud Text-to-Speech API for this.
            console.warn("TTS with Gemini provider selected, but @google/generative-ai SDK does not provide TTS. Use Google Cloud Text-to-Speech API or ElevenLabs.");
            return res.status(501).json({ error: "TTS not supported by the current Gemini SDK. Consider Google Cloud TTS or ensure PROVIDER is set to 'eleven'." });
        }

    } catch (err) {
        console.error("TTS Error:", err.response ? err.response.data : err);
        res.status(500).json({ error: "TTS failed. " + (err.message || "") });
    }
});

// Serve temporary TTS audio files
app.use('/tts_audio', express.static(path.join(__dirname, 'temp_audio')));


// 🤖 GPT Distractors Endpoint (Now Gemini Distractors)
app.post("/gemini_distractors", async (req, res) => { // Renamed endpoint for clarity
    try {
        const { baseText, targetLang, distractorCount } = req.body;
        if (!baseText || !targetLang || distractorCount == null) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        if (!genAI || !geminiTextModel) {
            return res.status(500).json({ error: "Gemini API not configured." });
        }

        const prompt = `You are an assistant for a word game. For the base text "${baseText}" (which is in ${targetLang}), generate exactly ${distractorCount} alternative distractor options in ${targetLang}.
        Output only the alternatives, each on a new line. Do not include numbering, bullet points, or any extra commentary.`;

        // For more structured output, you could explore Gemini's JSON mode if available and desired.
        // For now, relying on careful prompting.
        const generationConfig = {
            maxOutputTokens: 150, // Adjust as needed
            temperature: 0.7, // Adjust for creativity vs. determinism
        };

        const result = await geminiTextModel.generateContent({
            contents: [{ role: "user", parts: [{text: prompt}] }],
            generationConfig,
            // systemInstruction: "You are a helpful assistant for a word game. Provide alternative words or phrases as distractors with no extra commentary, each on a new line." // Alternative way to set system behavior
        });
        const response = result.response;
        const distractorText = response.text();

        const distractors = distractorText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && l !== baseText) // Ensure non-empty and not the base text itself
            .map((l) => l.replace(/^\d+\.\s*/, "")); // Remove leading numbers if any

        res.json({ distractors });
    } catch (err) {
        console.error("Distractors Error:", err);
        res.status(500).json({ error: "Failed to generate distractors. " + (err.message || "")});
    }
});

// 📄 Save Text Endpoint (No changes needed here for API conversion)
app.post("/save_text", async (req, res) => {
    try {
        const { id, content } = req.body;
        if (!id || !content) {
            return res.status(400).json({ error: "Missing id or content" });
        }
        const dataDir = process.env.DATA_STORE_DIR;
        if (!dataDir) {
            console.error("DATA_STORE_DIR environment variable not set.");
            return res.status(500).json({ error: "Server configuration error: DATA_STORE_DIR not set" });
        }

        // Ensure dataDir exists
        try {
            await fsp.mkdir(dataDir, { recursive: true });
        } catch (mkdirErr) {
            console.error("Error creating data directory:", mkdirErr);
            return res.status(500).json({ error: "Failed to ensure data storage directory." });
        }

        const now = new Date();
        const prefix = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}_`;

        // Sanitize 'id' to prevent directory traversal and invalid characters
        const safeId = path.basename(id).replace(/[^a-z0-9_\-\.]/gi, '_');
        const filename = prefix + safeId;
        const filePath = path.join(dataDir, filename);

        await fsp.writeFile(filePath, content);
        res.json({ message: "File saved successfully.", filePath });

    } catch (err) { // Catching specific error types can be more robust
        console.error("Save Text Error:", err);
        res.status(500).json({ error: "Unexpected server error during save operation." });
    }
});

app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    if (!process.env.GEMINI_API_KEY && provider === "gemini") {
        console.warn("🔴 GEMINI_API_KEY is not set. Gemini features will not work.");
    }
    if (!process.env.ELEVEN_API_KEY && provider === "eleven") {
        console.warn("🔴 ELEVEN_API_KEY is not set. ElevenLabs features will not work.");
    }
    if (!process.env.DATA_STORE_DIR) {
        console.warn("🟡 DATA_STORE_DIR is not set. '/save_text' endpoint will not function correctly.");
    }
});
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
const port = 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Choose provider from env variable: "eleven" or default "openai"
const provider = process.env.PROVIDER || "openai";

app.use(cors());
app.use(express.json());

// Set up file storage for uploaded audio
const upload = multer({ dest: "uploads/" });

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self' http://localhost:3000"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});

/**
 * 🎙️ Speech-to-Text (STT) Endpoint
 * Now uses the language sent in the request (via req.body.lang or req.body field from FormData)
 */
app.post("/stt", upload.single("audio"), async (req, res) => {
    try {
        const inputPath = req.file.path;
        const wavPath = `${inputPath}.wav`;
        const lang = req.body.lang || "en"; // Use language provided from client

        console.log("📤 Received audio file:", inputPath, "with language:", lang);

        // Convert to WAV using ffmpeg
        exec(
            `ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${wavPath}`,
            async (error) => {
                if (error) {
                    console.error("❌ Error converting file:", error);
                    return res.status(500).json({ error: "Audio conversion failed" });
                }

                console.log("✅ Audio converted to WAV:", wavPath);

                try {
                    let transcript;
                    if (provider === "eleven") {
                        // Use ElevenLabs STT API (assumed endpoint)
                        const elevenApiKey = process.env.ELEVEN_API_KEY;
                        const FormData = require("form-data");
                        const formData = new FormData();
                        formData.append("file", fs.createReadStream(wavPath));
                        // Use the provided language here
                        formData.append("language", lang);

                        const sttResponse = await axios.post(
                            "https://api.elevenlabs.io/v1/speech-to-text",
                            formData,
                            {
                                headers: {
                                    ...formData.getHeaders(),
                                    "xi-api-key": elevenApiKey,
                                },
                            }
                        );
                        transcript = sttResponse.data.text; // Assuming response format contains a "text" field
                    } else {
                        // Fallback to OpenAI Whisper STT
                        const response = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(wavPath),
                            model: "whisper-1",
                            language: lang, // Now use language from client
                        });
                        transcript = response.text;
                    }
                    console.log("📝 Transcribed text:", transcript);
                    res.json({ text: transcript });
                } catch (apiError) {
                    console.error("❌ Error transcribing:", apiError);
                    res.status(500).json({ error: "STT failed" });
                } finally {
                    // Cleanup: Delete temp files
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(wavPath);
                }
            }
        );
    } catch (error) {
        console.error("❌ Unexpected error:", error);
        res.status(500).json({ error: "Unexpected server error" });
    }
});

/**
 * 🌐 Translation Endpoint
 */
app.post("/translate", async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({ error: "Missing text or target language" });
        }
        console.log(`🌍 Translating to ${targetLang}: ${text}`);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful translation assistant. Translate the following text into " +
                        targetLang +
                        ". Output only the translated text with no additional commentary.",
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            max_tokens: 100,
        });
        if (!response || !response.choices?.[0]?.message) {
            throw new Error("Invalid OpenAI response format");
        }
        const translatedText = response.choices[0].message.content.trim();
        console.log("✅ Translated:", translatedText);
        res.json({ translatedText });
    } catch (error) {
        console.error("❌ Error translating:", error);
        res.status(500).json({ error: error.message || "Translation failed" });
    }
});

/**
 * 🔊 Text-to-Speech (TTS) Endpoint
 */
app.post("/tts", async (req, res) => {
    try {
        const { text, lang } = req.body;
        console.log(`🎙️ Converting text to speech (${lang}):`, text);

        let audioStream;
        if (provider === "eleven") {
            // Use ElevenLabs TTS API
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const voiceId =
                process.env.ELEVEN_VOICE_ID ||
                (lang === "ja"
                    ? "default_japanese_voice_id"
                    : lang === "de"
                        ? "default_german_voice_id"
                        : "default_voice_id");
            const ttsResponse = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    text: text,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                },
                {
                    responseType: "stream",
                    headers: {
                        "xi-api-key": elevenApiKey,
                        "Content-Type": "application/json",
                    },
                }
            );
            audioStream = ttsResponse.data;
        } else {
            // Fallback to OpenAI TTS endpoint
            const response = await openai.audio.speech.create({
                model: "gpt-4o-mini-tts",
                voice: lang === "ja" ? "onyx" : lang === "de" ? "echo" : "nova",
                input: text,
                language: lang,
                response_format: "mp3",
            });
            audioStream = response.body;
        }

        // Define file path for saving the audio file
        const filePath = path.join(__dirname, "tts_output.mp3");
        const fileStream = fs.createWriteStream(filePath);
        audioStream.pipe(fileStream);

        fileStream.on("finish", () => {
            console.log("✅ TTS Audio file saved:", filePath);
            // Change URL as needed; here we assume a public URL is served
            res.json({ audioUrl: "https://faw987.duckdns.org/tts_output.mp3" });
        });

        fileStream.on("error", (err) => {
            console.error("❌ Error saving TTS file:", err);
            res.status(500).json({ error: "Failed to save audio" });
        });
    } catch (error) {
        console.error("❌ TTS API Error:", error);
        res.status(500).json({ error: "TTS failed" });
    }
});

// Serve the TTS audio file
app.use("/tts_output.mp3", express.static(path.join(__dirname, "tts_output.mp3")));

/**
 * 🤖 GPT Distractors Endpoint
 * Generates alternative distractor options for the base text.
 */
app.post("/gpt_distractors", async (req, res) => {
    try {
        const { baseText, targetLang, distractorCount } = req.body;
        if (!baseText || !targetLang || !distractorCount) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const prompt = `Generate ${distractorCount} alternative distractor options for the base text "${baseText}" in ${targetLang}.
Please output exactly the alternatives separated by newline, with no extra commentary.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant for a word game. Provide alternative words or phrases as distractors with no extra commentary.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            max_tokens: 150,
        });

        const distractorText = response.choices[0].message.content;
        // Split the text into an array (remove any numbering, etc.)
        const distractors = distractorText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.replace(/^\d+\.\s*/, ""));
        res.json({ distractors });
    } catch (error) {
        console.error("❌ GPT distractors error:", error);
        res.status(500).json({ error: "Failed to generate distractors" });
    }
});

/**
 * 📄 Save Text Endpoint
 * Accepts an "id" and "content" from the request body and creates a file named after the id
 * in the directory defined by the environment variable DATA_STORE_DIR.
 */
app.post("/save_text", async (req, res) => {
    try {
        const { id, content } = req.body;
        if (!id || !content) {
            return res.status(400).json({ error: "Missing id or content in request body." });
        }
        const dataDir = process.env.DATA_STORE_DIR;
        if (!dataDir) {
            return res.status(500).json({ error: "DATA_STORE_DIR not defined in environment variables." });
        }
        // Ensure the filename is safe (avoid directory traversal)
        const safeId = path.basename(id);
        const filePath = path.join(dataDir, safeId);
        fs.writeFile(filePath, content, (err) => {
            if (err) {
                console.error("❌ Error writing file:", err);
                return res.status(500).json({ error: "Failed to save file." });
            }
            console.log(`✅ File saved: ${filePath}`);
            res.json({ message: "File saved successfully.", filePath });
        });
    } catch (error) {
        console.error("❌ Unexpected error:", error);
        res.status(500).json({ error: "Unexpected server error." });
    }
});

// 🚀 Start the server
app.listen(port, "0.0.0.0", () =>
    console.log(`✅ Server running on http://localhost:${port}`)
);
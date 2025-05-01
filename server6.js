// server.js
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
const provider = process.env.PROVIDER || "openai";

app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });

// Security headers
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

// 🎙️ Speech-to-Text Endpoint
app.post("/stt", upload.single("audio"), async (req, res) => {
    try {
        const inputPath = req.file.path;
        const wavPath = `${inputPath}.wav`;
        const lang = req.body.lang || "en";

        exec(
            `ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${wavPath}`,
            async (error) => {
                if (error) {
                    return res.status(500).json({ error: "Audio conversion failed" });
                }
                try {
                    let transcript;
                    if (provider === "eleven") {
                        const elevenApiKey = process.env.ELEVEN_API_KEY;
                        const FormData = require("form-data");
                        const formData = new FormData();
                        formData.append("file", fs.createReadStream(wavPath));
                        formData.append("language", lang);
                        const sttResponse = await axios.post(
                            "https://api.elevenlabs.io/v1/speech-to-text",
                            formData,
                            { headers: { ...formData.getHeaders(), "xi-api-key": elevenApiKey } }
                        );
                        transcript = sttResponse.data.text;
                    } else {
                        const response = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(wavPath),
                            model: "whisper-1",
                            language: lang,
                        });
                        transcript = response.text;
                    }
                    res.json({ text: transcript });
                } catch {
                    res.status(500).json({ error: "STT failed" });
                } finally {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(wavPath);
                }
            }
        );
    } catch {
        res.status(500).json({ error: "Unexpected server error" });
    }
});

// 🌐 Translation Endpoint
app.post("/translate", async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({ error: "Missing text or target language" });
        }
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Translate the following into ${targetLang}, output only the translated text.`
                },
                { role: "user", content: text }
            ],
            max_tokens: 100,
        });
        const translatedText = response.choices[0].message.content.trim();
        res.json({ translatedText });
    } catch {
        res.status(500).json({ error: "Translation failed" });
    }
});

// 🔊 Text-to-Speech Endpoint (with optional instructions)
app.post("/tts", async (req, res) => {
    try {
        const { text, lang, instructions } = req.body;
        let audioStream;

        if (provider === "eleven") {
            // ElevenLabs: inject style_instructions only if provided
            const elevenApiKey = process.env.ELEVEN_API_KEY;
            const voiceId = process.env.ELEVEN_VOICE_ID ||
                (lang === "ja" ? "default_japanese_voice_id" :
                    lang === "de" ? "default_german_voice_id" :
                        "default_voice_id");
            const payload = {
                text,
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            };
            if (instructions) {
                payload.voice_settings.style_instructions = instructions;
            }
            const ttsResponse = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                payload,
                {
                    responseType: "stream",
                    headers: {
                        "xi-api-key": elevenApiKey,
                        "Content-Type": "application/json"
                    }
                }
            );
            audioStream = ttsResponse.data;

        } else {
            // OpenAI: include instructions only when non-empty
            const params = {
                model: "gpt-4o-mini-tts",
                voice: lang === "ja" ? "onyx" : lang === "de" ? "echo" : "nova",
                input: text,
                response_format: "mp3",
            };
            if (instructions) {
                params.instructions = instructions;
            }
            const response = await openai.audio.speech.create(params);
            audioStream = response.body;
        }

        // Save and serve the MP3
        const filePath = path.join(__dirname, "tts_output.mp3");
        const fileStream = fs.createWriteStream(filePath);
        audioStream.pipe(fileStream);
        fileStream.on("finish", () =>
            res.json({ audioUrl: `https://${req.headers.host}/tts_output.mp3` })
        );
        fileStream.on("error", () =>
            res.status(500).json({ error: "Failed to save audio" })
        );

    } catch {
        res.status(500).json({ error: "TTS failed" });
    }
});
app.use(
    "/tts_output.mp3",
    express.static(path.join(__dirname, "tts_output.mp3"))
);

// 🤖 GPT Distractors Endpoint
app.post("/gpt_distractors", async (req, res) => {
    try {
        const { baseText, targetLang, distractorCount } = req.body;
        if (!baseText || !targetLang || distractorCount == null) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        const prompt = `Generate ${distractorCount} alternative distractor options for the base text "${baseText}" in ${targetLang}. Please output exactly the alternatives separated by newline, with no extra commentary.`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant for a word game. Provide alternative words or phrases as distractors with no extra commentary.",
                },
                { role: "user", content: prompt },
            ],
            max_tokens: 150,
        });
        const distractorText = response.choices[0].message.content;
        const distractors = distractorText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .map((l) => l.replace(/^\d+\.\s*/, ""));
        res.json({ distractors });
    } catch {
        res.status(500).json({ error: "Failed to generate distractors" });
    }
});

// 📄 Save Text Endpoint
app.post("/save_text", async (req, res) => {
    try {
        const { id, content } = req.body;
        if (!id || !content) {
            return res.status(400).json({ error: "Missing id or content" });
        }
        const dataDir = process.env.DATA_STORE_DIR;
        if (!dataDir) {
            return res.status(500).json({ error: "DATA_STORE_DIR not set" });
        }
        const now = new Date();
        const prefix = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}_`;
        const safeId = path.basename(id);
        const filename = prefix + safeId;
        const filePath = path.join(dataDir, filename);
        fs.writeFile(filePath, content, (err) => {
            if (err) return res.status(500).json({ error: "Failed to save file." });
            res.json({ message: "File saved.", filePath });
        });
    } catch {
        res.status(500).json({ error: "Unexpected server error." });
    }
});

app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
});
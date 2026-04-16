const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());

// =======================
// CONFIG
// =======================
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen:7b";

// =======================
// MEMORY STORE (simple + fast)
// =======================
const sessions = {};

// structure:
// sessions[id] = {
//   messages: [],
//   summary: ""
// }

// =======================
// SUMMARIZATION
// =======================
async function summarize(messages, oldSummary = "") {
    const history = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const prompt = `
You are a memory compression system.

Existing summary:
${oldSummary}

New conversation:
${history}

Update a short memory summary containing:
- user identity
- preferences
- important facts
- context

Keep it concise.
`;

    const res = await axios.post(OLLAMA_URL, {
        model: MODEL,
        prompt,
        stream: false,
    });

    return res.data.response;
}

// =======================
// SESSION
// =======================
app.post("/session", (req, res) => {
    const sessionId = uuidv4();

    sessions[sessionId] = {
        messages: [],
        summary: "",
    };

    res.json({ sessionId });
});

// =======================
// CHAT ENDPOINT
// =======================
const MAX_MESSAGES = 6;

app.post("/chat", async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessions[sessionId]) {
            return res.status(400).json({ error: "Invalid sessionId" });
        }

        const session = sessions[sessionId];

        // 1. store user message
        session.messages.push({
            role: "user",
            content: message,
        });

        // 2. summarize if needed
        if (session.messages.length > MAX_MESSAGES) {
            session.summary = await summarize(
                session.messages,
                session.summary,
            );
            session.messages = session.messages.slice(-2);
        }

        // 3. build prompt
        const recent = session.messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

        const prompt = `
You are a helpful assistant.

Memory summary:
${session.summary}

Recent conversation:
${recent}

assistant:
`;

        // 4. call Qwen 7B
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt,
            stream: false,
        });

        const reply = response.data.response;

        // 5. store assistant response
        session.messages.push({
            role: "assistant",
            content: reply,
        });

        res.json({
            response: reply,
            summary: session.summary,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Chat failed" });
    }
});

// =======================
// OPTIONAL: STREAMING
// =======================
app.post("/chat-stream", async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        const session = sessions[sessionId];
        if (!session)
            return res.status(400).json({ error: "Invalid sessionId" });

        session.messages.push({ role: "user", content: message });

        const recent = session.messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

        const prompt = `
Memory:
${session.summary}

Recent:
${recent}

assistant:
`;

        const response = await axios({
            method: "POST",
            url: OLLAMA_URL,
            data: {
                model: MODEL,
                prompt,
                stream: true,
            },
            responseType: "stream",
        });

        res.setHeader("Content-Type", "text/plain");

        let fullReply = "";

        response.data.on("data", (chunk) => {
            const lines = chunk.toString().split("\n").filter(Boolean);

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        fullReply += json.response;
                        res.write(json.response);
                    }
                } catch {}
            }
        });

        response.data.on("end", () => {
            session.messages.push({
                role: "assistant",
                content: fullReply,
            });

            res.end();
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Stream failed" });
    }
});

// =======================
// SESSION DEBUG
// =======================
app.get("/session/:id", (req, res) => {
    const session = sessions[req.params.id];
    if (!session) return res.status(404).json({ error: "Not found" });

    res.json(session);
});

app.delete("/session/:id", (req, res) => {
    delete sessions[req.params.id];
    res.json({ status: "deleted" });
});

// =======================
app.listen(3000, () => {
    console.log("🚀 Simple Qwen Chat Server running on http://localhost:3000");
});

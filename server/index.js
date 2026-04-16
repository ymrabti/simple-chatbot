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
const EMBEDDING_URL = "http://localhost:8000/embed";
const MODEL = "qwen:7b";

// =======================
// MEMORY STORE
// =======================
const sessions = {};

// structure:
// sessions[id] = {
//   messages: [],
//   summary: "",
//   vectors: [{ text, vector }]
// }

// =======================
// EMBEDDINGS
// =======================
async function embed(text) {
    const res = await axios.post(EMBEDDING_URL, {
        texts: [text],
    });
    return res.data.embeddings[0];
}

// cosine similarity
function cosine(a, b) {
    let dot = 0,
        normA = 0,
        normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] ** 2;
        normB += b[i] ** 2;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =======================
// VECTOR MEMORY
// =======================
async function storeVector(sessionId, text) {
    if (!sessions[sessionId]) return;

    const vector = await embed(text);

    sessions[sessionId].vectors.push({
        text,
        vector,
    });
}

async function recall(sessionId, query, k = 3) {
    if (!sessions[sessionId]) return [];

    const queryVec = await embed(query);

    return sessions[sessionId].vectors
        .map((v) => ({
            text: v.text,
            score: cosine(queryVec, v.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((v) => v.text);
}

// =======================
// SUMMARIZATION
// =======================
async function summarize(messages, oldSummary = "") {
    const history = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const prompt = `
You are a memory compression system.

Existing summary:
${oldSummary}

New messages:
${history}

Update the summary with key facts, preferences, identity, and important context.
Keep it short but informative.
`;

    const res = await axios.post(OLLAMA_URL, {
        model: MODEL,
        prompt,
        stream: false,
    });

    return res.data.response;
}

// =======================
// SESSION MANAGEMENT
// =======================
app.post("/session", (req, res) => {
    const id = uuidv4();

    sessions[id] = {
        messages: [],
        summary: "",
        vectors: [],
    };

    res.json({ sessionId: id });
});

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
// CHAT ENDPOINT (CORE)
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
        session.messages.push({ role: "user", content: message });

        // 2. vector memory store
        await storeVector(sessionId, message);

        // 3. recall relevant memories
        const memories = await recall(sessionId, message);

        // 4. summarization trigger
        if (session.messages.length > MAX_MESSAGES) {
            session.summary = await summarize(
                session.messages,
                session.summary,
            );
            session.messages = session.messages.slice(-2);
        }

        // 5. build prompt
        const prompt = `
You are a helpful assistant.

Long-term summary:
${session.summary}

Relevant past memories:
${memories.join("\n")}

Recent conversation:
${session.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

user: ${message}
assistant:
`;

        // 6. call LLM
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt,
            stream: false,
        });

        const reply = response.data.response;

        // 7. store assistant reply
        session.messages.push({ role: "assistant", content: reply });
        await storeVector(sessionId, reply);

        res.json({
            response: reply,
            summary: session.summary,
            memoriesUsed: memories,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chat failed" });
    }
});

// =======================
// STREAMING CHAT
// =======================
app.post("/chat-stream", async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        const session = sessions[sessionId];
        if (!session)
            return res.status(400).json({ error: "Invalid sessionId" });

        session.messages.push({ role: "user", content: message });

        const memories = await recall(sessionId, message);

        const prompt = `
Summary:
${session.summary}

Memories:
${memories.join("\n")}

Recent:
${session.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

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

        response.data.on("end", async () => {
            session.messages.push({ role: "assistant", content: fullReply });

            await storeVector(sessionId, fullReply);

            res.end();
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Stream failed" });
    }
});

// =======================
// HEALTH CHECK
// =======================
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        sessions: Object.keys(sessions).length,
    });
});

// =======================
app.listen(3000, () => {
    console.log("🚀 Full AI Server running on http://localhost:3000");
});

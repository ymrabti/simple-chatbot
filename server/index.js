const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const ChatSession = require("./models/ChatSession");
const app = express();
app.use(express.json());
app.use(cors());

const MAX_MESSAGES = 6;
// =======================
// CONFIG
// =======================
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen:7b";

// =======================
// MEMORY STORE (simple + fast)
// =======================
const sessions = {};

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

// ======================
// DB CONNECT
// ======================
mongoose.connect("mongodb://localhost:27017/chatapp");

// ======================
// CREATE SESSION
// ======================
app.post("/session", async (req, res) => {
  const session = await ChatSession.create({
    title: "New Chat"
  });

  res.json(session);
});

// ======================
// GET ALL SESSIONS
// ======================
app.get("/sessions", async (req, res) => {
  const sessions = await ChatSession.find().sort({ updatedAt: -1 });
  res.json(sessions);
});

// ======================
// GET SINGLE SESSION
// ======================
app.get("/session/:id", async (req, res) => {
  const session = await ChatSession.findById(req.params.id);
  res.json(session);
});

// ======================
// CHAT STREAM
// ======================
app.post("/chat-stream", async (req, res) => {
  const { sessionId, message } = req.body;

  const session = await ChatSession.findById(sessionId);
  if (!session) return res.status(404).json({ error: "not found" });

  session.messages.push({ role: "user", content: message });

  const prompt = `
${session.summary}

${session.messages.map(m => `${m.role}: ${m.content}`).join("\n")}

assistant:
`;

  const response = await axios({
    method: "POST",
    url: OLLAMA_URL,
    data: { model: MODEL, prompt, stream: true },
    responseType: "stream"
  });

  res.setHeader("Content-Type", "text/plain");

  let full = "";

  response.data.on("data", chunk => {
    const lines = chunk.toString().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.response) {
          full += json.response;
          res.write(json.response);
        }
      } catch {}
    }
  });

  response.data.on("end", async () => {
    session.messages.push({ role: "assistant", content: full });

    // keep last context small
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    session.updatedAt = new Date();
    await session.save();

    res.end();
  });
});

// =======================
// OPTIONAL: STREAMING
// =======================
/* app.post("/chat-stream", async (req, res) => {
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
                    console.log(line);
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
}); */

// =======================
// CHAT ENDPOINT
// =======================
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
app.listen(3000, () => {
    console.log("🚀 Simple Qwen Chat Server running on http://localhost:3000");
});

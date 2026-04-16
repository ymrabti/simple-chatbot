const axios = require('axios');

const EMBEDDING_API = 'http://localhost:8000/embed'; // your Python service

// 🧠 store vectors per session
const memory = {};

async function embed(text) {
    const res = await axios.post(EMBEDDING_API, {
        texts: [text],
    });
    return res.data.embeddings[0];
}

// cosine similarity
function similarity(a, b) {
    let dot = 0,
        normA = 0,
        normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// store message
async function store(sessionId, text) {
    const vector = await embed(text);

    if (!memory[sessionId]) memory[sessionId] = [];

    memory[sessionId].push({ text, vector });
}

// retrieve top-k relevant memories
async function recall(sessionId, query, k = 3) {
    if (!memory[sessionId]) return [];

    const queryVec = await embed(query);

    return memory[sessionId]
        .map((m) => ({
            text: m.text,
            score: similarity(queryVec, m.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((m) => m.text);
}

module.exports = { store, recall };

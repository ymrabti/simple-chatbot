const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const OLLAMA_URL = "http://localhost:11434/api/generate";

// 🔹 Basic chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { prompt, model = "qwen:7b" } = req.body;

    const response = await axios.post(OLLAMA_URL, {
      model,
      prompt,
      stream: false
    });

    res.json({
      response: response.data.response,
      model
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});


// 🔥 Streaming endpoint (REAL-TIME TOKENS)
app.post("/chat-stream", async (req, res) => {
  try {
    const { prompt, model = "qwen:7b" } = req.body;

    const response = await axios({
      method: "post",
      url: OLLAMA_URL,
      data: {
        model,
        prompt,
        stream: true
      },
      responseType: "stream"
    });

    res.setHeader("Content-Type", "text/plain");

    response.data.on("data", chunk => {
      const lines = chunk.toString().split("\n").filter(Boolean);

      for (const line of lines) {
        const json = JSON.parse(line);
        if (json.response) {
          res.write(json.response);
        }
      }
    });

    response.data.on("end", () => {
      res.end();
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Streaming failed" });
  }
});


// 🔹 Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.listen(3000, () => {
  console.log("🚀 Chat API running on http://localhost:3000");
});
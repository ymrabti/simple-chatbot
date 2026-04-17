# Simple Qwen Chatbot

A web-based chatbot powered by [Ollama](https://ollama.ai/) with the Qwen 7B model. Angular frontend with an Express backend that proxies to your local Ollama instance.

## Tech Stack

- **Frontend:** Angular 21 (standalone components)
- **Backend:** Express.js
- **AI:** Ollama + Qwen 7B

## Prerequisites

- [Ollama](https://ollama.ai/) installed and running
- Qwen 7B model pulled: `ollama run qwen:7b`

## Quick Start

1. **Start the backend:**
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Server runs on `http://localhost:3000`

2. **Start the frontend:**
   ```bash
   cd client
   npm install
   npm start
   ```
   App runs on `http://localhost:8372`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session` | Create a new chat session |
| POST | `/chat` | Send a message |
| POST | `/chat-stream` | Send a message (streaming) |
| GET | `/session/:id` | View session state |
| DELETE | `/session/:id` | Delete a session |

## Project Structure

```
chatbot/
├── client/               # Angular 21 frontend
│   └── src/app/
│       ├── chat/        # ChatComponent
│       ├── models/      # Message interface
│       └── services/    # ChatService
└── server/              # Express backend
    ├── index.js         # API routes
    └── memory.js        # Session memory store
```

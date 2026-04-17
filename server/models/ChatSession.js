const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    role: String,
    content: String,
    createdAt: { type: Date, default: Date.now },
});

const ChatSessionSchema = new mongoose.Schema({
    title: { type: String, default: "New Chat" },
    messages: [MessageSchema],
    summary: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChatSession", ChatSessionSchema);

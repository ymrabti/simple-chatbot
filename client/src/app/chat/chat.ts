import { Component, OnInit } from '@angular/core';
import { ChatService } from '../services/chat';
import { Message } from '../models/message.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
  providers: [HttpClient],
})
export class ChatComponent implements OnInit {
  sessions: any[] = [];
  activeSession: any;
  streaming = false;
  stopFlag = false;
  messages: Message[] = [];
  input = '';
  loading = false;

  constructor(
    private http: HttpClient,
  ) {}

  async send() {
    if (!this.input.trim() || !this.activeSession) return;

    const msg = this.input;
    this.input = '';

    this.messages.push({ role: 'user', content: msg });

    const assistant: Message = { role: 'assistant', content: '' };
    this.messages.push(assistant);

    this.streaming = true;
    this.stopFlag = false;

    const res = await fetch('http://localhost:3000/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.activeSession._id,
        message: msg,
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      if (this.stopFlag) {
        reader.cancel();
        break;
      }

      const { value, done } = await reader.read();
      if (done) break;

      assistant.content += decoder.decode(value);
    }

    this.streaming = false;
  }

  stop() {
    this.stopFlag = true;
    this.streaming = false;
  }

  ngOnInit() {
    /* fetch('http://localhost:3000/session', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => (this.sessionId = data.sessionId)); */
    this.loadSessions();
  }

  loadSessions() {
    this.http
      .get<any[]>('http://localhost:3000/sessions')
      .subscribe((res) => (this.sessions = res));
  }

  createSession() {
    this.http.post('http://localhost:3000/session', {}).subscribe((s: any) => {
      this.sessions.unshift(s);
      this.selectSession(s);
    });
  }

  selectSession(session: any) {
    this.activeSession = session;
    this.messages = session.messages || [];
  }

  renderMarkdown(text: string) {
    return marked.parse(text || '');
  }
}

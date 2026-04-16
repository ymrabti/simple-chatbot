import { Component, OnInit } from '@angular/core';
import { ChatService } from '../services/chat';
import { Message } from '../models/message.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, provideHttpClient } from '@angular/common/http';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
  providers: [HttpClient],
})
export class ChatComponent implements OnInit {
  sessionId!: string;
  messages: Message[] = [];
  input = '';
  loading = false;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.chatService.createSession().subscribe((res) => {
      this.sessionId = res.sessionId;
    });
  }

  send() {
    if (!this.input.trim()) return;

    const userMsg: Message = {
      role: 'user',
      content: this.input,
    };

    this.messages.push(userMsg);
    this.loading = true;

    this.chatService.sendMessage(this.sessionId, this.input).subscribe((res) => {
      this.messages.push({
        role: 'assistant',
        content: res.response,
      });
      this.loading = false;
    });

    this.input = '';
  }
}

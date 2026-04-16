import { Component, OnInit } from '@angular/core';
import { ChatService } from '../services/chat';
import { Message } from '../models/message.model';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, BrowserModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
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

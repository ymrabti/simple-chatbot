import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private API = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  createSession(): Observable<any> {
    return this.http.post(`${this.API}/session`, {});
  }

  sendMessage(sessionId: string, message: string): Observable<any> {
    return this.http.post(`${this.API}/chat-stream`, {
      sessionId,
      message,
    });
  }

  async streamChat(sessionId: string, message: string, onToken: (t: string) => void) {
    const response = await fetch(`${this.API}/chat-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
    });

    if (!response.body) throw new Error('No stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;

      if (value) {
        const chunk = decoder.decode(value);
        onToken(chunk);
      }
    }
  }
}

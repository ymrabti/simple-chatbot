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
    return this.http.post(`${this.API}/chat`, {
      sessionId,
      message,
    });
  }
}

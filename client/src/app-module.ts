import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from './app/chat/chat';
import { App } from './app/app';

@NgModule({
  declarations: [
  ],
  imports: [CommonModule, ChatComponent, App],
})
export class AppModule {}

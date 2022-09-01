import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageService } from './storage.service';
import { TelegramApiService } from './telegram-api.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, TelegramApiService, StorageService],
})
export class AppModule {}

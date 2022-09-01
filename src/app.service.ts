import { Injectable, OnModuleInit } from '@nestjs/common';
import { SETTINGS } from './settings';
import { StorageService } from './storage.service';
import { TelegramApiService } from './telegram-api.service';
import { Message } from './message';

@Injectable()
export class AppService implements OnModuleInit {

    constructor(private telegramApiService: TelegramApiService, private storageService: StorageService) { }

    public async onModuleInit(): Promise<void> {
        await this.telegramApiService.auth(SETTINGS.phoneNumber);
        await this.telegramApiService.scanChannels(SETTINGS.channels, this.telegramApiService);
        setInterval(this.telegramApiService.scanChannels, SETTINGS.repeat_every_minutes * 60000, SETTINGS.channels, this.telegramApiService);

        this.telegramApiService.telegramMessages$.subscribe(message => {
            var fileName = this.storageService.getFileName();
            this.storageService.readWriteSync(fileName, this.buildLogMessage(message));
        });
    }

    private buildLogMessage(message: Message): string {
        const _message = {
            message: message.message,
            created_date: (new Date(message.date * 1000)).toLocaleTimeString(),
            edit_date: (new Date(message.edit_date * 1000)).toLocaleTimeString(),
            id: message.id,
            from_id: message.from_id,
            peer_id: message.peer_id
        };

        return JSON.stringify(_message);
    }
}


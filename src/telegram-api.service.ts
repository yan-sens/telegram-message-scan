import { Injectable, Logger } from "@nestjs/common";
import { Subject } from "rxjs";
import { SETTINGS } from "./settings";
import { Message } from "./message";
import * as MTProto from "@mtproto/core";
import * as path from "path";
import * as prompt from "prompt";

@Injectable()
export class TelegramApiService {

    private api_id = SETTINGS.api_id;
    private api_hash = SETTINGS.api_hash;
    private tags = SETTINGS.tags;
    private posts_count = SETTINGS.posts_count;
    private comments_count = SETTINGS.comments_count;
    private mtProto: any;
    private logger = new Logger('TelegramApiService');

    public telegramMessages$ = new Subject<Message>();

    constructor() {
        this.mtProto = new MTProto({
            api_id: this.api_id,
            api_hash: this.api_hash,
            test: false,
            storageOptions: {
                path: path.resolve(__dirname, '.data/1.json')
            }
        });

        this.subscribeToUpdates();
    }

    public async subscribeToUpdates(): Promise<void> {
        this.mtProto.updates.on('updates', (updateInfo: { updates: { message: Message; }[]; }) => {
            updateInfo.updates.forEach(async (update: { message: Message; }) => {                
                if (update?.message) 
                    this.ValidateMessage(update?.message, this);              
            });
        });
    }

    public async auth(mobile: string): Promise<void> {
        prompt.start();

        try {   
            this.logger.log('Get authorization...');     
            await this.mtProto.call('account.getAuthorizations', {}); 
            this.logger.log('Success authorized');
        } catch (e) {
            try {
                if (e.error_code === 401) {
                    this.logger.error('Login expired. Retry');
                    const { phone_code_hash } = await this.sendCode(mobile);
                    this.logger.log('Send code to your telegram messanger...');
        
                    const { code } = await prompt.get('code');
        
                    await this.sigIn({ code, mobile, phone_code_hash });
                } else {
                    this.logger.error(e);
                }
            } catch (error) {
                this.logger.error(error);
            }
        } 
    }

    public async scanChannels(channelsToScan: string[], context: TelegramApiService): Promise<void> {
        for (let i = 0; i < channelsToScan.length; i++) {
            await context.scanChannel(channelsToScan[i]);
        }
    }
    
    private sendCode(mobile: string): Promise<any> {
        return this.mtProto.call('auth.sendCode', {
            phone_number: mobile,
            api_id: this.api_id,
            api_hash: this.api_hash,
            settings: {
                _: 'codeSettings'
            }
        });
    }

    private async sigIn({ code, mobile, phone_code_hash }): Promise<any> {
        try {
            return this.mtProto.call('auth.signIn', {
                phone_code: code,
                phone_number: mobile,
                phone_code_hash: phone_code_hash
            });
        } catch (e) {
            this.logger.error(e);
            if (e.error_message !== 'SESSION_PASSWORD_NEEDED') {
                return;
            }
        }

        return undefined;
    }

    private async scanChannel(channelName: string): Promise<void> {
        try {
            this.logger.log(`Start scan ${channelName}.`);
            const context = this;
            const resolveGroup = await this.mtProto.call("contacts.resolveUsername", {
                username: channelName.replace('@', '')
            });

            this.logger.log('Resolve group received.');

            this.sleep(3000);

            if (resolveGroup.chats.length === 0) {
                this.logger.warn(`${channelName} does not have a chat.`);
                return;
            }

            const { access_hash, id } = resolveGroup.chats[0];
            const limit = this.posts_count;

            const posts = 
                await this.mtProto.call("messages.getHistory", {
                    peer: {
                        _: "inputPeerChannel",
                        channel_id: id,
                        access_hash
                    },
                    max_id: 9999999999999999,
                    offset: 0,
                    limit
                });

            this.logger.log(`${channelName} posts received.`);

            this.sleep(3000);

            posts.messages.forEach(async (post: Message, index: number) => {

                this.logger.log(`Post ${post.id}: scanning...`);
                this.ValidateMessage(post, context);

                try {
                    const postChats = 
                        await this.mtProto.call("messages.getDiscussionMessage", {
                            peer: {
                                _: "inputPeerChannel",
                                channel_id: id,
                                access_hash
                            },
                            msg_id: post.id,
                        });

                    this.logger.log(`Post ${post.id} chat received.`);

                    if (postChats.chats.length === 0) {
                        this.logger.warn(`${channelName}: can't access to post chat.`);
                        return;
                    }

                    this.sleep(3000);

                    const commentsHistory = 
                        await this.mtProto.call("messages.getHistory", {
                            peer: {
                                _: "inputPeerChannel",
                                channel_id: postChats.chats[0].id,
                                access_hash: postChats.chats[0].access_hash
                            },
                            max_id: 9999999999999999,
                            offset: 0,
                            limit: this.comments_count
                        });

                    this.logger.log(`Post ${post.id} comments received.`);
                    this.logger.log(`Post ${post.id} comments: scanning...`);
                    commentsHistory.messages.forEach((message: Message) => this.ValidateMessage(message, context)); 

                    this.sleep(3000);

                    if (index == posts.messages.length - 1) 
                        this.logger.log(`End scan ${channelName}.`); 

                } catch (e) {
                    this.logger.error(e);
                }                        
            });            
        } catch(e) {
            this.logger.error(e);
        }
    }

    private ValidateMessage(message: Message, context: TelegramApiService): void {
        if (message?.message) {
            try {
                if (context.tags.some(x => message.message?.toLowerCase().includes(x.toLowerCase()))) {
                    context.telegramMessages$.next(message as Message);
                }                        
            } catch (error) {
                context.logger.error(error);
            }
        } 
    }

    private sleep(milliseconds: number): void {
        const date = Date.now();
        let currentDate = null;
        do {
            currentDate = Date.now();
        } while (currentDate - date < milliseconds);
    }
}
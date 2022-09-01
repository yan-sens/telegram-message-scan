import { Injectable } from "@nestjs/common";
import { readFileSync, appendFileSync, writeFileSync }  from 'fs';

@Injectable()
export class StorageService {

    public getFileName(): any {
        const date = new Date();
        const fileName = `logs/${date.toLocaleDateString().replace(/\//g, "-")}-${date.getHours()}.json`;
        try {
            readFileSync(fileName);
            return fileName;
        } catch (e){
            appendFileSync(fileName, '[]');
            return this.getFileName();
        }        
    }

    public readWriteSync(fileName: string, message: string) {
        const data = readFileSync(fileName, 'utf-8');  
        const parsedMessage = JSON.parse(message);
        const parsedData = JSON.parse(data).filter(x => x.id != parsedMessage.id);
        parsedData.push(parsedMessage);
      
        writeFileSync(fileName, JSON.stringify(parsedData, null, "\t"), 'utf-8');
      }
}
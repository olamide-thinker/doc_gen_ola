import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  UseGuards, 
  Req, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { FirebaseGuard } from '../auth/firebase.guard';
import * as fs from 'fs';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

@Controller('api/upload')
export class UploadsController {
  @Post()
  @UseGuards(FirebaseGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    };
  }
}

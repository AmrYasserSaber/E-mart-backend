import { Injectable, InternalServerErrorException } from '@nestjs/common';
import ImageKit, { toFile } from '@imagekit/nodejs';
import { env } from '../config/env';

export interface UploadedMedia {
  fileId: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
}

export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private readonly imagekit = new ImageKit({
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
  });

  async uploadImages(
    files: UploadFile[],
    folder = '/emart/products',
  ): Promise<UploadedMedia[]> {
    if (!files.length) {
      return [];
    }

    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const imageFile = await toFile(file.buffer, file.originalname, {
            type: file.mimetype || undefined,
          });

          const result = await this.imagekit.files.upload({
            file: imageFile,
            fileName: `${Date.now()}-${file.originalname}`,
            folder,
            useUniqueFileName: true,
          });

          if (!result.fileId || !result.url) {
            throw new Error('ImageKit response missing fileId or url');
          }

          return {
            fileId: result.fileId,
            url: result.url,
            fileName: result.name ?? file.originalname,
            mimeType: file.mimetype || null,
            size: typeof result.size === 'number' ? result.size : null,
          } satisfies UploadedMedia;
        }),
      );

      return uploaded;
    } catch {
      throw new InternalServerErrorException('Image upload failed');
    }
  }
}

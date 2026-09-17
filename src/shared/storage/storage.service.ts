import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import * as path from 'path';
import { EnvService } from '../../config/env.service';

export type ImageUrls = {
  original: string;
  thumbnail: string;
  card: string;
  detail: string;
};

export type StoredFile = {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  urls: ImageUrls;
};

const AUTO = { fetch_format: 'auto' as const, quality: 'auto' as const };

/**
 * Storage de imágenes: Cloudinary (bucket) si está configurado; si no, disco local.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly env: EnvService) {
    if (this.env.isCloudinaryConfigured) {
      cloudinary.config({
        cloud_name: this.env.cloudinaryCloudName,
        api_key: this.env.cloudinaryApiKey,
        api_secret: this.env.cloudinaryApiSecret,
        secure: true,
      });
    } else if (this.env.isProduction) {
      this.logger.error(
        'Cloudinary no configurado en production (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).',
      );
    } else {
      this.logger.warn(
        'Cloudinary no configurado: las fotos se guardan en /uploads (solo local).',
      );
    }
  }

  async uploadImage(opts: {
    buffer: Buffer;
    folder: string;
    filename: string;
    mime?: string;
  }): Promise<StoredFile> {
    if (this.env.isCloudinaryConfigured) {
      return this.uploadToCloudinary(opts);
    }
    if (this.env.isProduction) {
      throw new InternalServerErrorException({
        error: 'storage_not_configured',
      });
    }
    return this.uploadLocal(opts);
  }

  /** URLs derivadas (Cloudinary on-the-fly). Si no hay publicId, todas apuntan al original. */
  imageUrls(publicId: string | undefined, originalUrl: string): ImageUrls {
    const id =
      publicId ||
      (originalUrl.includes('res.cloudinary.com')
        ? (publicIdFromCloudinaryUrl(originalUrl) ?? undefined)
        : undefined);
    if (!id || !this.env.isCloudinaryConfigured) {
      return {
        original: originalUrl,
        thumbnail: originalUrl,
        card: originalUrl,
        detail: originalUrl,
      };
    }

    return {
      original: originalUrl,
      thumbnail: cloudinary.url(id, {
        secure: true,
        transformation: [
          { width: 200, height: 200, crop: 'fill', gravity: 'auto' },
          AUTO,
        ],
      }),
      card: cloudinary.url(id, {
        secure: true,
        transformation: [
          { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
          AUTO,
        ],
      }),
      detail: cloudinary.url(id, {
        secure: true,
        transformation: [{ width: 1600, crop: 'limit' }, AUTO],
      }),
    };
  }

  async delete(file: { url?: string; publicId?: string }): Promise<void> {
    if (file.publicId && this.env.isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(file.publicId).catch((err: unknown) => {
        this.logger.warn(
          `Cloudinary destroy failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      return;
    }
    const url = file.url ?? '';
    if (url.includes('res.cloudinary.com') && this.env.isCloudinaryConfigured) {
      const publicId = publicIdFromCloudinaryUrl(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch(() => undefined);
      }
      return;
    }
    if (url.startsWith('/api/uploads/')) {
      const relative = url.replace(/^\/api\/uploads\//, '');
      const fullPath = path.join(process.cwd(), 'uploads', relative);
      await fs.unlink(fullPath).catch((err: unknown) => {
        const e = err as { code?: string };
        if (e.code === 'ENOENT') return;
        throw err;
      });
    }
  }

  private uploadToCloudinary(opts: {
    buffer: Buffer;
    folder: string;
    filename: string;
  }): Promise<StoredFile> {
    const publicId = `baby-go/${opts.folder}/${stripExtension(opts.filename)}`;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          overwrite: true,
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(
              error instanceof Error
                ? error
                : new InternalServerErrorException({ error: 'upload_failed' }),
            );
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            urls: this.imageUrls(result.public_id, result.secure_url),
          });
        },
      );
      stream.end(opts.buffer);
    });
  }

  private async uploadLocal(opts: {
    buffer: Buffer;
    folder: string;
    filename: string;
  }): Promise<StoredFile> {
    const dir = path.join(process.cwd(), 'uploads', opts.folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, opts.filename), opts.buffer);
    const url = `/api/uploads/${opts.folder}/${opts.filename}`;
    return { url, urls: this.imageUrls(undefined, url) };
  }
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function publicIdFromCloudinaryUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? decodeURIComponent(match[1]) : null;
}

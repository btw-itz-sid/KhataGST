// backend/src/services/storageService.ts
// Unified Cloud Object Storage & Local File Storage Service
// Supports Cloudflare R2, AWS S3, and Local Disk Fallback
// ✅ Real S3/R2 upload via @aws-sdk/client-s3

import * as fs from "fs";
import * as path from "path";

export interface UploadResult {
  storageProvider: "local" | "s3" | "r2";
  storageKey: string;
  url: string;
}

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");

// Ensure local directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class StorageService {
  private static instance: StorageService;
  private provider: "local" | "s3" | "r2";
  private s3Client: any | null = null;
  private bucketName: string = "";
  private publicUrl: string = "";

  private constructor() {
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      this.provider = "r2";
      this.bucketName = process.env.R2_BUCKET || "khatagst-uploads";
      this.publicUrl = process.env.R2_PUBLIC_URL || "";
      this.initS3Client({
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: "auto",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
    } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET) {
      this.provider = "s3";
      this.bucketName = process.env.S3_BUCKET;
      this.publicUrl = process.env.S3_PUBLIC_URL || "";
      this.initS3Client({
        region: process.env.AWS_REGION || "ap-south-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } else {
      this.provider = "local";
    }
    console.log(`📦 Storage Service initialized with provider: ${this.provider}`);
  }

  private initS3Client(config: any) {
    try {
      const { S3Client } = require("@aws-sdk/client-s3");
      this.s3Client = new S3Client(config);
    } catch {
      console.warn("⚠️ @aws-sdk/client-s3 not installed — falling back to local storage");
      this.provider = "local";
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Upload a file buffer to storage
   */
  public async upload(params: {
    fileBuffer: Buffer;
    originalFilename: string;
    mimeType: string;
    userId: string;
    folder?: string;
  }): Promise<UploadResult> {
    const ext = path.extname(params.originalFilename).toLowerCase() || ".jpg";
    const folder = params.folder || "scans";
    const safeFilename = `${folder}/${Date.now()}_${params.userId.slice(0, 8)}${ext}`;

    // ── Cloud Upload (S3 / R2) ──────────────────────────────────────────
    if (this.s3Client && (this.provider === "s3" || this.provider === "r2")) {
      try {
        const { PutObjectCommand } = require("@aws-sdk/client-s3");
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: safeFilename,
          Body: params.fileBuffer,
          ContentType: params.mimeType,
        }));

        const url = this.publicUrl
          ? `${this.publicUrl}/${safeFilename}`
          : `https://${this.bucketName}.s3.amazonaws.com/${safeFilename}`;

        return {
          storageProvider: this.provider,
          storageKey: safeFilename,
          url,
        };
      } catch (err) {
        console.error(`☁️ ${this.provider.toUpperCase()} upload failed, falling back to local:`, err);
        // Fall through to local storage
      }
    }

    // ── Local Fallback ──────────────────────────────────────────────────
    const fullPath = path.join(UPLOADS_DIR, safeFilename);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, params.fileBuffer);

    return {
      storageProvider: "local",
      storageKey: safeFilename,
      url: `/uploads/${safeFilename.replace(/\\/g, "/")}`,
    };
  }

  /**
   * Retrieve file as buffer
   */
  public async getFileBuffer(storageKey: string): Promise<Buffer> {
    // Cloud retrieval
    if (this.s3Client && (this.provider === "s3" || this.provider === "r2")) {
      try {
        const { GetObjectCommand } = require("@aws-sdk/client-s3");
        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch (err) {
        console.error("Cloud file retrieval failed:", err);
        // Fall through to local
      }
    }

    const fullPath = path.join(UPLOADS_DIR, storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${storageKey}`);
    }
    return fs.readFileSync(fullPath);
  }

  /**
   * Get public/signed URL for file
   */
  public getUrl(storageKey: string): string {
    if (this.publicUrl && (this.provider === "s3" || this.provider === "r2")) {
      return `${this.publicUrl}/${storageKey}`;
    }
    return `/uploads/${storageKey.replace(/\\/g, "/")}`;
  }

  /**
   * Delete file
   */
  public async delete(storageKey: string): Promise<boolean> {
    // Cloud deletion
    if (this.s3Client && (this.provider === "s3" || this.provider === "r2")) {
      try {
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }));
        return true;
      } catch (err) {
        console.error("Cloud file deletion failed:", err);
      }
    }

    // Local deletion
    try {
      const fullPath = path.join(UPLOADS_DIR, storageKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = StorageService.getInstance();

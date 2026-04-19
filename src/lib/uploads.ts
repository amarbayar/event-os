import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  getExtensionForMimeType,
  sanitizeUploadFolder,
} from "@/lib/upload-config";

function buildLocalUploadPath(folder: string, fileName: string) {
  return path.join(process.cwd(), "public/uploads", folder, fileName);
}

function buildGcsObjectPath(folder: string, fileName: string) {
  const prefix = sanitizeUploadFolder(process.env.GCS_UPLOAD_PREFIX || "uploads");
  return path.posix.join(prefix, folder, fileName);
}

function getStorageDriver(): "local" | "gcs" {
  return process.env.FILE_STORAGE_DRIVER === "gcs" ? "gcs" : "local";
}

function resolvePublicUrl(filePath: string): string {
  if (getStorageDriver() === "gcs") {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME is required when FILE_STORAGE_DRIVER=gcs");
    }

    const baseUrl =
      process.env.GCS_PUBLIC_BASE_URL ||
      `https://storage.googleapis.com/${bucketName}`;

    return `${baseUrl.replace(/\/+$/, "")}/${filePath}`;
  }

  return `/uploads/${filePath}`;
}

type StoreUploadedFileInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  folder: string;
};

type StoredFile = {
  fileName: string;
  storagePath: string;
  url: string;
  provider: "local" | "gcs";
};

async function storeLocally(
  folder: string,
  fileName: string,
  buffer: Buffer
): Promise<StoredFile> {
  const storagePath = path.posix.join(folder, fileName);
  const absolutePath = buildLocalUploadPath(folder, fileName);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    fileName,
    storagePath,
    url: resolvePublicUrl(storagePath),
    provider: "local",
  };
}

async function storeInGcs(
  folder: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<StoredFile> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is required when FILE_STORAGE_DRIVER=gcs");
  }

  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const objectPath = buildGcsObjectPath(folder, fileName);
  const file = storage.bucket(bucketName).file(objectPath);

  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return {
    fileName,
    storagePath: objectPath,
    url: resolvePublicUrl(objectPath),
    provider: "gcs",
  };
}

export async function storeUploadedFile(
  input: StoreUploadedFileInput
): Promise<StoredFile> {
  const folder = sanitizeUploadFolder(input.folder);
  const extension = getExtensionForMimeType(input.mimeType, input.originalName);
  const fileName = `${randomUUID()}.${extension}`;

  if (getStorageDriver() === "gcs") {
    return storeInGcs(folder, fileName, input.buffer, input.mimeType);
  }

  return storeLocally(folder, fileName, input.buffer);
}

export function buildAbsoluteFileUrl(url: string, request?: Request): string {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, `${getAppBaseUrl(request)}/`).toString();
}

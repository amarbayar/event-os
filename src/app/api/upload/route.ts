import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedUploadMimeType,
} from "@/lib/upload-config";
import { storeUploadedFile } from "@/lib/uploads";

export async function POST(req: NextRequest) {
  // Auth check — uploads require login
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "general";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Max 20MB." },
      { status: 400 }
    );
  }

  if (!isAllowedUploadMimeType(file.type)) {
    return NextResponse.json(
      {
        error:
          "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF, PPT, PPTX, DOC, DOCX.",
      },
      { status: 400 }
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const stored = await storeUploadedFile({
      buffer: Buffer.from(bytes),
      mimeType: file.type,
      originalName: file.name,
      folder,
    });

    return NextResponse.json(
      {
        data: {
          url: stored.url,
          fileName: stored.fileName,
          provider: stored.provider,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Failed to store uploaded file" },
      { status: 500 }
    );
  }
}

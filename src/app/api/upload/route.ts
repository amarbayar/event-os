import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedUploadMimeType,
  sanitizeUploadFolder,
} from "@/lib/upload-config";
import { storeUploadedFile } from "@/lib/uploads";

async function stakeholderCanUploadToFolder(params: {
  userId: string;
  organizationId: string;
  folder: string;
}) {
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, params.userId),
      eq(userOrganizations.organizationId, params.organizationId),
      eq(userOrganizations.role, "stakeholder")
    ),
    columns: {
      linkedEntityType: true,
      linkedEntityId: true,
    },
  });

  if (!membership?.linkedEntityType || !membership.linkedEntityId) {
    return false;
  }

  const entityFolder = sanitizeUploadFolder(
    `${membership.linkedEntityType}/${membership.linkedEntityId}`
  );

  return params.folder === entityFolder || params.folder.startsWith(`${entityFolder}/`);
}

export async function POST(req: NextRequest) {
  // Auth check — uploads require login
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = sanitizeUploadFolder((formData.get("folder") as string) || "general");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (session.user.role === "stakeholder") {
    const organizationId = session.user.organizationId;
    if (
      !organizationId ||
      !(await stakeholderCanUploadToFolder({
        userId: session.user.id,
        organizationId,
        folder,
      }))
    ) {
      return NextResponse.json(
        { error: "Stakeholder uploads must target your portal entity." },
        { status: 403 }
      );
    }
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

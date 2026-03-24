import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");
const MAX_SIZE = 20 * 1024 * 1024; // 20MB — modern phone cameras

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "general";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const folderPath = path.join(UPLOAD_DIR, folder);

  await mkdir(folderPath, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(folderPath, fileName), Buffer.from(bytes));

  const url = `/uploads/${folder}/${fileName}`;

  return NextResponse.json({ data: { url, fileName } }, { status: 201 });
}

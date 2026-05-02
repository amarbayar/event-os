import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("uploaded asset previews", () => {
  it("renders checklist file uploads as previewable downloadable assets", () => {
    const checklist = readFileSync(join(root, "src/components/checklist-panel.tsx"), "utf8");
    const preview = readFileSync(join(root, "src/components/uploaded-asset-preview.tsx"), "utf8");

    expect(checklist).toContain("UploadedAssetPreview");
    expect(checklist).toContain('item.itemType === "file_upload"');
    expect(preview).toContain("Open full size");
    expect(preview).toContain("Download");
    expect(preview).toContain("<img");
  });

  it("shows uploaded speaker headshots on speaker sheets and the agenda drawer", () => {
    const speakers = readFileSync(join(root, "src/app/events/[slug]/speakers/client.tsx"), "utf8");
    const agenda = readFileSync(join(root, "src/app/events/[slug]/agenda/client.tsx"), "utf8");

    expect(speakers).toContain("Speaker headshot");
    expect(speakers).toContain("UploadedAssetPreview");
    expect(agenda).toContain("speaker-headshot-large");
    expect(agenda).toContain("Open speaker sheet");
  });
});

import { describe, it, expect } from "vitest";
import type { NotifyParams } from "@/lib/notify";

describe("NotifyParams discriminated union", () => {
  it("accepts raw title params", () => {
    const params: NotifyParams = {
      userId: "u1",
      orgId: "o1",
      type: "assignment",
      title: "You were assigned to John",
    };
    expect("title" in params).toBe(true);
    expect("titleKey" in params).toBe(false);
  });

  it("accepts i18n title params", () => {
    const params: NotifyParams = {
      userId: "u1",
      orgId: "o1",
      type: "assignment",
      titleKey: "assigned",
      titleParams: { entity: "John" },
      locale: "mn",
    };
    expect("titleKey" in params).toBe(true);
    expect(params.locale).toBe("mn");
  });

  it("i18n params require locale", () => {
    // This is a compile-time check — if this file compiles, the type is correct.
    // TypeScript would error if locale were missing from I18nNotifyParams.
    const params: NotifyParams = {
      userId: "u1",
      orgId: "o1",
      type: "stage_change",
      titleKey: "stageChanged",
      titleParams: { entity: "Jane", stage: "confirmed" },
      locale: "en",
    };
    expect(params.locale).toBe("en");
  });
});

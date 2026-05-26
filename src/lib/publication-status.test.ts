import { describe, expect, it } from "vitest";
import { describePublicationReportStatus } from "@/lib/publication-status";

describe("publication report status", () => {
  it("explains unavailable Avito API capabilities in human words", () => {
    expect(describePublicationReportStatus("api_capability_unavailable")).toContain("Метод Avito API недоступен");
    expect(describePublicationReportStatus("autoload_profile_manual_setup_required")).toContain("feed URL");
  });
});

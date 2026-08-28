import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isNavActive } from "@/components/SidebarNav";
import { activeSettingsItem } from "@/components/SettingsNav";

const ROUTES_DIR = join(process.cwd(), "src/routes/_authenticated");

function settingsRouteFiles() {
  return readdirSync(ROUTES_DIR).filter((f) => f.startsWith("settings.") && f.endsWith(".tsx"));
}

describe("settings routes share the same chrome", () => {
  const files = settingsRouteFiles();

  it("finds every settings route", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(settingsRouteFiles())("%s renders AppShell and SettingsNav", (file) => {
    const src = readFileSync(join(ROUTES_DIR, file), "utf8");
    expect(src).toContain("<AppShell");
    expect(src).toContain("<SettingsNav");
  });
});

describe("active section detection", () => {
  it("highlights the settings hub only for the hub itself", () => {
    expect(activeSettingsItem("/settings")?.to).toBe("/settings");
    expect(activeSettingsItem("/settings/team")?.to).toBe("/settings/team");
    expect(activeSettingsItem("/settings/ai-assistant")?.to).toBe("/settings/ai-assistant");
  });

  it("keeps the left nav lit while browsing nested pages", () => {
    expect(isNavActive("/settings/team", "/settings")).toBe(true);
    expect(isNavActive("/contacts/abc", "/contacts")).toBe(true);
    expect(isNavActive("/settings/booking", "/settings/booking")).toBe(true);
    expect(isNavActive("/settings/booking", "/settings")).toBe(false);
    expect(isNavActive("/opportunities", "/contacts")).toBe(false);
  });
});

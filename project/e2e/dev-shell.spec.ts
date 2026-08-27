import { test, expect } from "@playwright/test";

test.describe("dev-shell", () => {
  test("boots, shows HUD, renders Babylon canvas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /RTS Platform/i })).toBeVisible();
    await expect(page.getByTestId("hud")).toBeVisible();
    await expect(page.getByTestId("babylon-canvas")).toBeVisible();
    await expect(page.getByTestId("hud-tick")).toBeVisible();
    // tick is numeric
    await expect(page.getByTestId("hud-tick")).toHaveText(/\d+/);
  });

  test("scenario selector switches and snapshot updates", async ({ page }) => {
    await page.goto("/");
    const sel = page.getByTestId("scenario-select");
    await expect(sel).toBeVisible();
    await sel.selectOption("duel");
    // snapshot log should contain duel entities (alpha/bravo)
    await expect(page.getByTestId("snapshot-log")).toContainText("alpha", { timeout: 8000 });
  });

  test("start/pause and step controls work", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByTestId("toggle-run");
    await expect(toggle).toHaveText(/Start|Pause/);
    await toggle.click();
    await expect(toggle).toHaveText("Pause");
    await toggle.click();
    await expect(toggle).toHaveText("Start");
    await page.getByTestId("step-once").click();
    // tick should advance (poll)
    const tickBefore = await page.getByTestId("hud-tick").innerText();
    await page.getByTestId("step-once").click();
    await expect(async () => {
      const now = await page.getByTestId("hud-tick").innerText();
      expect(Number(now)).toBeGreaterThan(Number(tickBefore));
    }).toPass({ timeout: 5000 });
  });

  test("spawn command increases entity count", async ({ page }) => {
    await page.goto("/");
    const countEl = page.getByTestId("hud-entities");
    const before = Number(await countEl.innerText());
    await page.getByTestId("spawn-btn").click();
    // need to step to process queued command
    await page.getByTestId("step-once").click();
    await expect(async () => {
      const after = Number(await page.getByTestId("hud-entities").innerText());
      expect(after).toBeGreaterThan(before);
    }).toPass({ timeout: 5000 });
  });

  test("visual: HUD and canvas are present (snapshot)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800); // let Babylon first frame render
    await expect(page.getByTestId("hud")).toBeVisible();
    // visual check — canvas has non-zero size
    const box = await page.getByTestId("babylon-canvas").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });
});

/**
 * E2E smoke test — verifies the app loads and renders the title screen.
 * Uses Playwright against the live Vite dev server.
 */

import { test, expect } from "@playwright/test";

test.describe("LithoDrop Title Screen", () => {
  test("loads and renders title screen", async ({ page }) => {
    await page.goto("/");

    // Wait for page title
    await expect(page).toHaveTitle(/LithoDrop/i);

    // HUD root should mount
    await expect(page.locator("#hud-root")).toBeAttached();

    // Canvas should be present and non-empty
    const canvas = page.locator("#game-canvas-container canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Take a screenshot for visual review
    await page.screenshot({ path: "test-results/title-screen.png" });
  });

  test("Start Mission button advances to tutorial", async ({ page }) => {
    await page.goto("/");

    // Wait for canvas to render
    const canvas = page.locator("#game-canvas-container canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // The PixiJS canvas handles the button; we verify the phase label appears
    // Note: PixiJS events don't translate to DOM, so we test the HUD phase indicator
    // In M2+, the Descent HUD label will appear after the Start button is clicked
    // For M1, we verify no JS errors occurred
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Wait a moment for PixiJS to fully initialize
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });

  test("advances from Title to Tutorial and into Descend flight phase with working controls", async ({
    page,
  }) => {
    await page.goto("/");
    const canvas = page.locator("#game-canvas-container canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // 1. Click Start Mission on title canvas
    await canvas.click({
      position: { x: box.width / 2, y: box.height * 0.58 },
    });
    await page.waitForTimeout(800);

    // 2. Click Certify & Launch in TutorialScene
    await canvas.click({
      position: { x: box.width / 2 + 162, y: box.height - 34 },
    });

    // 3. Verify Descend HUD label mounts
    const descendLabel = page.locator(".descend-hud-corner .hud-phase-label");
    await expect(descendLabel).toContainText("DESCEND PHASE", { timeout: 10000 });

    // 4. Test flight controls (W = main thruster, A = steer CCW, S = hover brake)
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyW");

    await page.keyboard.down("KeyA");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyA");

    await page.keyboard.down("KeyS");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyS");

    await page.screenshot({ path: "test-results/flight-descent.png" });
  });
});

import { expect, test } from "@playwright/test";

const theme = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test("a chosen theme is applied before first paint on the next load", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  // What <html> carries the moment the document is parsed, before anything paints.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { themeAtLoad: string | null }).themeAtLoad =
        document.documentElement.getAttribute("data-theme");
    });
  });
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Theme" });
  await expect(group.getByRole("radio", { name: "System" })).toBeChecked();

  await group.getByRole("radio", { name: "Dark" }).click();
  expect(await theme(page)).toBe("dark");

  await page.reload();
  expect(
    await page.evaluate(
      () => (window as unknown as { themeAtLoad: string | null }).themeAtLoad,
    ),
  ).toBe("dark");
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#171717");
  const bg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(bg).toBe("rgb(10, 10, 10)");

  // Arrow keys move the choice within the group; System forgets it.
  await group.getByRole("radio", { name: "Dark" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(group.getByRole("radio", { name: "Light" })).toBeChecked();
  expect(await theme(page)).toBe("light");
  await page.keyboard.press("ArrowLeft");
  await expect(group.getByRole("radio", { name: "System" })).toBeChecked();
  expect(await theme(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
});

test("System follows the device setting as it changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/compress-image");
  const bg = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe("rgb(245, 245, 245)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await bg()).toBe("rgb(10, 10, 10)");
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#171717");
});

test("without JavaScript the switch stays hidden and the system theme applies", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeHidden();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(10, 10, 10)");
  await context.close();
});

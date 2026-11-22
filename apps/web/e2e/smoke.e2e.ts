import { expect, test } from "@playwright/test";
import { watchPage } from "./page";

const pages = [
  { path: "/", title: /^Tools: form-ready photos/, canonical: "/" },
  {
    path: "/compress-image",
    title: /^Compress image to KB/,
    canonical: "/compress-image",
  },
  {
    path: "/forms/np/psc/lok-sewa-application",
    title: /^Lok Sewa Aayog online application · Tools/,
    canonical: "/forms/np/psc/lok-sewa-application",
  },
];

for (const p of pages) {
  test(`${p.path} renders with title and canonical`, async ({ page }) => {
    const { problems } = watchPage(page);
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(p.title);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const canonical = new URL(
      (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "",
    );
    expect(canonical.protocol).toBe("https:");
    expect(canonical.pathname).toBe(p.canonical);
    expect(problems).toEqual([]);
  });
}

test("tool pages show the upload control", async ({ page }) => {
  await page.goto("/compress-image");
  await expect(page.getByLabel(/^Choose/)).toBeAttached();
  await expect(page.getByLabel("Size limit (KB)")).toHaveValue("100");
});

test("unknown path serves the 404 page", async ({ page }) => {
  const { problems } = watchPage(page);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle(/^Page not found/);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(problems.filter((p) => !p.includes("404"))).toEqual([]);
});

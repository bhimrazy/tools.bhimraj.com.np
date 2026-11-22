import { expect, test } from "@playwright/test";
import { decodeImage, makeImage } from "./images";
import { downloadResult, watchPage } from "./page";

test("forms are listed Nepal, United States, Bangladesh", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("#forms").getByRole("heading", { level: 3 }),
  ).toHaveText([/^Nepal/, /^United States/, /^Bangladesh/]);
});

test("search finds forms by their Nepali and Bengali names", async ({
  page,
}) => {
  const { problems } = watchPage(page);
  await page.goto("/");
  const search = page.getByRole("searchbox", {
    name: "Search forms and tools",
  });
  await search.fill("लोक सेवा");
  const results = page.locator("#search-results");
  await expect(
    results.getByRole("link", {
      name: /Lok Sewa Aayog online application photo/,
    }),
  ).toBeVisible();
  await expect(results.getByRole("link", { name: /Teletalk/ })).toHaveCount(0);

  await search.fill("টেলিটক");
  await expect(
    results.getByRole("link", { name: /Teletalk job application photo/ }),
  ).toBeVisible();
  await expect(results.getByRole("link", { name: /Lok Sewa/ })).toHaveCount(0);

  await search.fill("passport visa");
  await expect(results).toContainText(/No match for .passport visa./);
  expect(problems).toEqual([]);
});

test("a size and a limit open the tool with that size rule", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search forms and tools" })
    .fill("300x300 px 100kb");
  const results = page.locator("#search-results");
  await expect(results).toContainText("300 × 300 px");
  await expect(results).toContainText("under 100 KB");
  // The form asking for exactly that comes first.
  await expect(results.getByRole("link").first()).toHaveAccessibleName(
    /Teletalk job application photo/,
  );
  await results
    .getByRole("link", { name: /Make an image 300 × 300 px under 100 KB/ })
    .click();
  await expect(page).toHaveURL(/\/compress-image\?kb=100&w=300&h=300$/);
  await expect(page.getByLabel("Size limit (KB)")).toHaveValue("100");
  await expect(page.getByLabel("Width (px)")).toHaveValue("300");
  await expect(page.getByLabel("Height (px)")).toHaveValue("300");
});

test("a photo dropped on the home page is routed to its form and made there", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const { problems } = watchPage(page);
  await page.goto("/");
  const photo = await makeImage(page, {
    name: "portrait.jpg",
    width: 1500,
    height: 2000,
  });
  await page.getByLabel("Choose a file").setInputFiles(photo);
  await expect(
    page.getByRole("heading", {
      name: "What do you want to do with this file?",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: /^Make a Lok Sewa Aayog online application photo/,
    })
    .click();

  await expect(page).toHaveURL(/\/forms\/np\/psc\/lok-sewa-application#photo$/);
  const section = page.locator("section#photo");
  const { buffer } = await downloadResult(page, testInfo, section);
  const { width, height } = await decodeImage(page, buffer);
  expect([width, height]).toEqual([300, 350]);
  expect(problems).toEqual([]);
});

test("a wide image is offered as a signature first", async ({ page }) => {
  await page.goto("/");
  const wide = await makeImage(page, {
    name: "sign.jpg",
    width: 1200,
    height: 300,
  });
  await page.getByLabel("Choose a file").setInputFiles(wide);
  const routes = page.getByRole("link", { name: /^Make a / });
  await expect(routes.first()).toHaveAccessibleName(/signature/);
});

test("a file that isn't an image says so and what to do", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose a file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Can't open notes.txt. Choose a JPG, PNG or WebP image.",
  );
});

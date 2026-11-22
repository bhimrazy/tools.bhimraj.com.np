import { expect, test } from "@playwright/test";
import { makeImage } from "./images";
import { downloadResult, pickFile } from "./page";

// "Files never leave your device": nothing may be requested from outside the site origin.
test("every request stays on the site origin, including a full compress run", async ({
  page,
  baseURL,
}, testInfo) => {
  const origin = new URL(baseURL!).origin;
  const offSite: string[] = [];
  const check = (url: string) => {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (u.origin !== origin) offSite.push(url);
    } else if (
      u.protocol !== "blob:" &&
      u.protocol !== "data:" &&
      u.protocol !== "about:"
    ) {
      offSite.push(url);
    }
  };
  page.context().on("request", (r) => check(r.url()));

  for (const path of ["/", "/np/lok-sewa-photo", "/compress-image"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  const photo = await makeImage(page, {
    name: "privacy.jpg",
    width: 1600,
    height: 1200,
  });
  await pickFile(page, photo);
  await downloadResult(page, testInfo);

  expect(offSite).toEqual([]);
});

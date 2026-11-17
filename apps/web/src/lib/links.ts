export const REPO_URL = "https://github.com/bhimrazy/tools.bhimraj.com.np";
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new`;

/** Prefilled issue for reporting that a preset's spec changed. */
export function specIssueUrl(title: string, pagePath: string): string {
  const params = new URLSearchParams({
    title: `Spec changed: ${title}`,
    body: `Page: /${pagePath.replace(/^\/+/, "")}\nWhat changed (link to the official notice if you have it):\n`,
  });
  return `${NEW_ISSUE_URL}?${params}`;
}

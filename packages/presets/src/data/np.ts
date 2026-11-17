import type { Preset } from "../index";
import { kbMax, kbMin } from "../schema";

// Figures come from an applicant-guide site, not an official PSC notice; official pages gave no sizes.
const source = {
  url: "https://loksewatayariapp.com/tools/photo-signature-resizer",
  label: "Third-party applicant guide (not official)",
};
const common = {
  country: "NP",
  portal: "Lok Sewa Aayog (psconline.psc.gov.np)",
  source,
  verifiedAt: null,
} as const;

export const np: Preset[] = [
  {
    ...common,
    id: "np-lok-sewa-photo",
    path: "np/lok-sewa-photo",
    title: "Lok Sewa Aayog online application photo",
    kind: "photo",
    output: {
      format: "image/jpeg",
      width: 300,
      height: 350,
      minBytes: kbMin(10),
      maxBytes: kbMax(200),
      background: "#ffffff",
    },
    notes:
      "Unconfirmed: 300x350 px (reported as 'about'), 10-200 KB, white/light background are from a third-party guide. Provincial PSCs are reported to want 350x350. Check the advertisement and the portal's upload message.",
  },
  {
    ...common,
    id: "np-lok-sewa-signature",
    path: "np/lok-sewa-signature",
    title: "Lok Sewa Aayog online application signature",
    kind: "signature",
    output: {
      format: "image/jpeg",
      width: 300,
      height: 80,
      minBytes: kbMin(5),
      maxBytes: kbMax(100),
      background: "#ffffff",
    },
    notes:
      "Unconfirmed: 300x80 px (reported as 'about'), 5-100 KB are from a third-party guide. Check the advertisement and the portal's upload message.",
  },
];

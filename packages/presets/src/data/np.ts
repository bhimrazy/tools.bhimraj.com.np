import type { Preset } from "../index";
import { kbToMaxBytes, kbToMinBytes } from "../bytes";

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
    rule: {
      format: "image/jpeg",
      fit: "cover",
      width: 300,
      height: 350,
      minBytes: kbToMinBytes(10),
      maxBytes: kbToMaxBytes(200),
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
    rule: {
      format: "image/jpeg",
      fit: "contain",
      width: 300,
      height: 80,
      minBytes: kbToMinBytes(5),
      maxBytes: kbToMaxBytes(100),
      background: "#ffffff",
    },
    notes:
      "Unconfirmed: 300x80 px (reported as 'about'), 5-100 KB are from a third-party guide. Check the advertisement and the portal's upload message.",
  },
];

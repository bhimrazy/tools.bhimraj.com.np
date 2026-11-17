import type { Preset } from "../index";
import { kbMax } from "../schema";

export const us: Preset[] = [
  {
    id: "us-dv-lottery-photo",
    path: "us/dv-lottery-photo",
    country: "US",
    portal: "Diversity Visa Program (dvprogram.state.gov)",
    title: "US DV Lottery entry photo",
    kind: "photo",
    output: {
      format: "image/jpeg",
      width: 600,
      height: 600,
      maxBytes: kbMax(240),
      background: "#ffffff",
    },
    source: {
      url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
      label: "U.S. Department of State - Photo Requirements",
    },
    verifiedAt: null,
    notes:
      "Unconfirmed: the State Dept page returned 403 to our fetch. Search excerpts show square, JPEG, <= 240 kB; some secondary guides allow 600-1200 px square. 600x600 is the safe size. Background must be plain white or off-white.",
  },
];

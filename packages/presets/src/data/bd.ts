import type { Preset } from "../index";
import { kbMax } from "../schema";

const common = {
  country: "BD",
  portal: "Teletalk Alljobs (alljobs.teletalk.com.bd)",
  source: null,
  verifiedAt: null,
} as const;
const caveat =
  "Unconfirmed: the Teletalk portal pages were not readable. Pixel sizes are widely reported; KB caps vary by circular (some portals say 300 KB photo / 100-120 KB signature). We use the strictest reported cap so the file passes either way. Check your circular.";

export const bd: Preset[] = [
  {
    ...common,
    id: "bd-teletalk-photo",
    path: "bd/teletalk-photo",
    title: "Teletalk job application photo",
    kind: "photo",
    output: {
      format: "image/jpeg",
      width: 300,
      height: 300,
      maxBytes: kbMax(100),
      background: "#ffffff",
    },
    notes: caveat,
  },
  {
    ...common,
    id: "bd-teletalk-signature",
    path: "bd/teletalk-signature",
    title: "Teletalk job application signature",
    kind: "signature",
    output: {
      format: "image/jpeg",
      width: 300,
      height: 80,
      maxBytes: kbMax(60),
      background: "#ffffff",
    },
    notes: caveat,
  },
];

import type { Preset } from "../index";
import { kbToMaxBytes } from "../bytes";

const common = {
  country: "BD",
  portal: "Teletalk Alljobs (alljobs.teletalk.com.bd)",
  org: "teletalk",
  form: "job-application",
  formTitle: "Teletalk job application",
  formLocalName: { lang: "bn", text: "টেলিটক" },
  source: null,
  verifiedAt: null,
} as const;
const caveat =
  "Unconfirmed: the Teletalk portal pages were not readable. Pixel sizes are widely reported; KB caps vary by circular (some portals say 300 KB photo / 100-120 KB signature). We use the strictest reported cap so the file passes either way. Check your circular.";

export const bd: Preset[] = [
  {
    ...common,
    id: "bd-teletalk-job-application-photo",
    upload: "photo",
    title: "Teletalk job application photo",
    kind: "photo",
    rule: {
      format: "image/jpeg",
      fit: "cover",
      width: 300,
      height: 300,
      maxBytes: kbToMaxBytes(100),
      background: "#ffffff",
    },
    notes: caveat,
  },
  {
    ...common,
    id: "bd-teletalk-job-application-signature",
    upload: "signature",
    title: "Teletalk job application signature",
    kind: "signature",
    rule: {
      format: "image/jpeg",
      fit: "contain",
      width: 300,
      height: 80,
      maxBytes: kbToMaxBytes(60),
      background: "#ffffff",
    },
    notes: caveat,
  },
];

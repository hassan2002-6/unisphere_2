import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

/**
 * PDF rendering (spec §9 finalized-form PDF, §10 admit-card internal preview).
 * Server-only by location — nothing in src/server ships to the client bundle.
 *
 * Both documents are built from portal records alone:
 *  - every approval entry is labelled as an in-portal approval record, NOT a
 *    cryptographic digital signature — no signature image or seal is ever
 *    fabricated, and no legal validity is claimed; and
 *  - the admit card is watermarked as an internal preview that is explicitly
 *    not an official university-issued admit card.
 */

/** Exact disclaimer printed under every approval record (never replaced by a “signature”). */
export const APPROVAL_RECORD_LABEL = "In-portal approval record — not a cryptographic digital signature";

/** Exact watermark / banner text on the admit-card preview. */
export const ADMIT_CARD_WATERMARK = "INTERNAL PREVIEW — NOT AN OFFICIAL UNIVERSITY-ISSUED ADMIT CARD";

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 52;
const FOOTER_ZONE = 52; // reserved band above the bottom edge for the footer

const DARK = rgb(0.12, 0.14, 0.17);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.84, 0.86, 0.89);
const ACCENT = rgb(0.11, 0.32, 0.7);
const DANGER = rgb(0.66, 0.13, 0.16);
const SUCCESS = rgb(0.09, 0.45, 0.24);

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

/** Characters pdf-lib's standard fonts cannot encode are replaced, never dropped silently. */
function safeFor(font: PDFFont, text: string): string {
  try {
    font.encodeText(text);
    return text;
  } catch {
    let out = "";
    for (const ch of text) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += "?";
      }
    }
    return out;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
      let cut = rest.length;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const DECISION_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CORRECTIONS_REQUESTED: "Corrections requested",
  UNDER_REVIEW: "In review",
  SUBMITTED: "Submitted",
  WITHDRAWN: "Withdrawn",
};

/** Simple cursor-based writer over one or more A4 pages. */
class Writer {
  readonly pages: PDFPage[] = [];
  private page: PDFPage;
  private y: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_ZONE) this.newPage();
  }

  gap(height: number) {
    this.y -= height;
  }

  /** Ruled horizontal separator across the content width. */
  rule(color: RGB = RULE, thickness = 0.8) {
    this.ensure(12);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness, color });
    this.y -= 12;
  }

  /** One line-wrapped paragraph; returns the number of points consumed. */
  paragraph(
    text: string,
    opts: { size?: number; style?: "regular" | "bold" | "italic"; color?: RGB; x?: number; width?: number; lineHeight?: number } = {},
  ): number {
    const size = opts.size ?? 10;
    const font = this.fonts[opts.style ?? "regular"];
    const color = opts.color ?? DARK;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? PAGE_W - MARGIN - x;
    const lh = opts.lineHeight ?? size * 1.5;
    const lines = wrapText(safeFor(font, text.replace(/\r\n?/g, "\n").replace(/\n/g, " ")), font, size, width);
    for (const line of lines) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    return lines.length * lh;
  }

  line(text: string, x: number, size: number, style: "regular" | "bold" | "italic", color: RGB = DARK, align: "left" | "right" = "left") {
    const font = this.fonts[style];
    const safe = safeFor(font, text);
    const drawX = align === "right" ? x - font.widthOfTextAtSize(safe, size) : x;
    this.page.drawText(safe, { x: drawX, y: this.y - size, size, font, color });
  }

  hline(x1: number, x2: number, y: number, color: RGB = RULE, thickness = 0.8) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  vline(x: number, y1: number, y2: number, color: RGB = RULE, thickness = 0.8) {
    this.page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color });
  }

  box(x: number, y: number, width: number, height: number, opts: { fill?: RGB; border?: RGB; borderWidth?: number } = {}) {
    this.page.drawRectangle({
      x,
      y,
      width,
      height,
      ...(opts.fill ? { color: opts.fill } : {}),
      ...(opts.border ? { borderColor: opts.border, borderWidth: opts.borderWidth ?? 1 } : {}),
    });
  }

  get cursorY(): number {
    return this.y;
  }

  set cursorY(y: number) {
    this.y = y;
  }

  /** Footer with the generation date on every page (spec: footer with generation date). */
  finishFooter(centerText: string) {
    const size = 8;
    const generated = `Generated by UniSphere on ${fmtDateTime(new Date())} (PKT)`;
    this.pages.forEach((page, index) => {
      const fy = 34;
      page.drawLine({
        start: { x: MARGIN, y: fy + 16 },
        end: { x: PAGE_W - MARGIN, y: fy + 16 },
        thickness: 0.6,
        color: RULE,
      });
      page.drawText(safeFor(this.fonts.regular, generated), { x: MARGIN, y: fy, size, font: this.fonts.regular, color: MUTED });
      const right = `Page ${index + 1} of ${this.pages.length}`;
      page.drawText(right, {
        x: PAGE_W - MARGIN - this.fonts.regular.widthOfTextAtSize(right, size),
        y: fy,
        size,
        font: this.fonts.regular,
        color: MUTED,
      });
      const center = safeFor(this.fonts.regular, centerText);
      page.drawText(center, {
        x: (PAGE_W - this.fonts.regular.widthOfTextAtSize(center, size)) / 2,
        y: fy,
        size,
        font: this.fonts.regular,
        color: MUTED,
      });
    });
  }
}

/* ─────────────────────────── Finalized form PDF (§9) ─────────────────────────── */

export type SubmissionPdfApproval = {
  step: number;
  decision: string;
  actorName: string;
  actorRole: string | null;
  at: Date;
  comment: string | null;
};

export type SubmissionPdfInput = {
  refNo: string;
  title: string;
  status: string;
  submittedBy: { name: string; role: string; email: string; registrationNo: string | null };
  submittedAt: Date;
  finalizedAt: Date | null;
  fields: { label: string; value: string }[];
  approvals: SubmissionPdfApproval[];
};

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  COORDINATOR: "Coordinator",
  FYP_HEAD: "FYP Head",
  MENTOR: "Mentor",
  ADMIN: "Administrator",
};

function roleLabel(role: string | null): string {
  if (!role) return "—";
  return ROLE_LABEL[role] ?? role.replaceAll("_", " ");
}

/** Two-column label/value rows with hairline rules — used for submission fields. */
function drawFieldTable(w: Writer, fonts: Fonts, rows: { label: string; value: string }[]) {
  const labelW = 150;
  const valueX = MARGIN + labelW + 12;
  const valueW = PAGE_W - MARGIN - valueX;
  const padY = 7;
  const size = 9.5;
  const lh = size * 1.42;

  for (const row of rows) {
    const labelLines = wrapText(safeFor(fonts.bold, row.label), fonts.bold, size, labelW);
    const valueLines = wrapText(safeFor(fonts.regular, row.value), fonts.regular, size, valueW);
    const bodyH = Math.max(labelLines.length, valueLines.length) * lh;
    const rowH = bodyH + padY * 2;
    w.ensure(rowH + 4);

    const top = w.cursorY;
    w.hline(MARGIN, PAGE_W - MARGIN, top, RULE, 0.6);
    let yy = top;
    for (const l of labelLines) {
      w.cursorY = yy;
      w.line(l, MARGIN, size, "bold");
      yy -= lh;
    }
    yy = top;
    for (const l of valueLines) {
      w.cursorY = yy;
      w.line(l, valueX, size, "regular");
      yy -= lh;
    }
    w.cursorY = top - rowH;
  }
  w.hline(MARGIN, PAGE_W - MARGIN, w.cursorY, RULE, 0.6);
  w.gap(10);
}

/**
 * The finalized-submission PDF: title, refNo, submitted-by, the field table and
 * the per-step approval history — each approval entry labelled as an in-portal
 * approval record (never a fabricated signature).
 */
export async function renderSubmissionPdf(input: SubmissionPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Form submission ${input.refNo} — ${input.title}`);
  doc.setAuthor("UniSphere");
  doc.setCreator("UniSphere (in-portal record)");
  doc.setProducer("UniSphere");
  doc.setSubject("Form submission and approval history (in-portal record)");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const w = new Writer(doc, fonts);

  // Header band
  w.box(MARGIN, w.cursorY - 5, PAGE_W - MARGIN * 2, 3, { fill: ACCENT });
  w.gap(16);
  w.paragraph("UNISPHERE — IN-PORTAL RECORD", { size: 8.5, style: "bold", color: MUTED });
  w.gap(2);
  w.paragraph(input.title, { size: 18, style: "bold", lineHeight: 24 });
  w.gap(2);
  w.paragraph(`Reference: ${input.refNo}`, { size: 10, style: "bold", color: ACCENT });
  w.gap(2);
  w.paragraph(`Status: ${DECISION_LABEL[input.status] ?? input.status.replaceAll("_", " ")}`, { size: 10, color: MUTED });
  w.gap(8);

  // Meta block
  const meta: { label: string; value: string }[] = [
    {
      label: "Submitted by",
      value: `${input.submittedBy.name} (${roleLabel(input.submittedBy.role)})${input.submittedBy.registrationNo ? ` · ${input.submittedBy.registrationNo}` : ""}`,
    },
    { label: "Email", value: input.submittedBy.email },
    { label: "Submitted", value: fmtDateTime(input.submittedAt) },
    { label: "Finalized", value: input.finalizedAt ? fmtDateTime(input.finalizedAt) : "Not yet finalized" },
  ];
  drawFieldTable(w, fonts, meta);

  // Field table
  w.paragraph("Submission fields", { size: 12.5, style: "bold" });
  w.gap(6);
  if (input.fields.length === 0) {
    w.paragraph("No fields recorded on this submission.", { size: 9.5, style: "italic", color: MUTED });
  } else {
    drawFieldTable(w, fonts, input.fields);
  }

  // Approval history
  w.gap(6);
  w.paragraph("Approval history", { size: 12.5, style: "bold" });
  w.gap(4);
  w.paragraph(`Each entry below carries the label “${APPROVAL_RECORD_LABEL}”.`, { size: 8.5, style: "italic", color: MUTED });
  w.gap(4);

  if (input.approvals.length === 0) {
    w.paragraph("No approval decisions have been recorded on this submission yet.", { size: 9.5, style: "italic", color: MUTED });
  } else {
    // Approval table: columns for the decision, its actor and its timestamp;
    // every row block carries the in-portal (not-a-signature) label.
    const cols = [30, 74, 118, 84, PAGE_W - MARGIN * 2 - (30 + 74 + 118 + 84)];
    const xs = [MARGIN];
    for (let i = 0; i < cols.length - 1; i++) xs.push(xs[i] + cols[i]);
    const size = 8.5;
    const lh = 11;

    // Header row
    w.ensure(20);
    let top = w.cursorY;
    const headers = ["Step", "Decision", "Reviewed by", "Role", "When"];
    w.cursorY = top - size - 3;
    headers.forEach((h, i) => w.line(h, xs[i] + 4, size, "bold", MUTED));
    w.hline(MARGIN, PAGE_W - MARGIN, top, RULE, 0.9);
    top -= 16;
    w.cursorY = top;

    for (const a of input.approvals) {
      const commentLines = a.comment ? wrapText(safeFor(fonts.regular, a.comment), fonts.regular, size, PAGE_W - MARGIN * 2 - 16) : [];
      const cellDefs: { value: string; style: "regular" | "bold" }[] = [
        { value: String(a.step), style: "bold" },
        { value: DECISION_LABEL[a.decision] ?? a.decision.replaceAll("_", " "), style: "bold" },
        { value: a.actorName, style: "regular" },
        { value: roleLabel(a.actorRole), style: "regular" },
        { value: fmtDateTime(a.at), style: "regular" },
      ];
      const cellLines = cellDefs.map((c, i) => wrapText(safeFor(fonts[c.style], c.value), fonts[c.style], size, cols[i] - 8));
      const maxCellLines = Math.max(1, ...cellLines.map((l) => l.length));
      const labelH = 12;
      const mainH = maxCellLines * lh + 3;
      const commentH = commentLines.length * (size * 1.35 + 1);
      const rowH = mainH + (commentLines.length ? commentH + 2 : 0) + labelH + 6;
      w.ensure(rowH + 4);
      top = w.cursorY;
      const bottom = top - rowH;

      // Vertical column separators through the whole row band.
      for (const x of xs.slice(1)) w.vline(x, top, bottom, RULE, 0.6);

      cellLines.forEach((lines, i) => {
        let ly = top - size - 3;
        for (const l of lines) {
          w.cursorY = ly;
          w.line(l, xs[i] + 4, size, cellDefs[i].style);
          ly -= lh;
        }
      });

      let cy = top - mainH;
      if (commentLines.length) {
        for (const l of commentLines) {
          w.cursorY = cy;
          w.line(l, MARGIN + 8, size, "italic", MUTED);
          cy -= size * 1.35 + 1;
        }
        cy -= 1;
      }
      w.cursorY = cy - 4;
      w.line(APPROVAL_RECORD_LABEL, MARGIN + 8, 7.5, "italic", MUTED);

      w.hline(MARGIN, PAGE_W - MARGIN, bottom, RULE, 0.6);
      w.cursorY = bottom;
    }
    w.gap(8);
  }

  w.finishFooter(`${input.refNo} · form approval record`);
  return doc.save();
}

/* ─────────────────────────── Admit card preview PDF (§10) ─────────────────────────── */

export type AdmitCardPdfCheck = { label: string; detail: string; passed: boolean; soft?: boolean };

export type AdmitCardPdfInput = {
  examLabel: string;
  student: { name: string; registrationNo: string | null; email: string; department: string | null };
  rule: { requiredFormKey: string | null; requireEnrollment: boolean; feeClearanceEnabled: boolean };
  checks: AdmitCardPdfCheck[];
};

/**
 * The admit-card INTERNAL PREVIEW PDF. It is watermarked (banner + diagonal
 * watermark) as not an official university-issued admit card, and it carries
 * only what the portal actually knows (no fabricated exam hall/seat data).
 */
export async function renderAdmitCardPdf(input: AdmitCardPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Admit card preview — ${input.student.name} (${ADMIT_CARD_WATERMARK.replaceAll(" — ", " - ")})`);
  doc.setAuthor("UniSphere");
  doc.setCreator("UniSphere (internal preview)");
  doc.setProducer("UniSphere");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const w = new Writer(doc, fonts);

  // Prominent banner — the watermark text, repeated across the page.
  const bannerSize = 10.5;
  const bannerW = fonts.bold.widthOfTextAtSize(ADMIT_CARD_WATERMARK, bannerSize);
  w.box(MARGIN, w.cursorY - 26, PAGE_W - MARGIN * 2, 30, { fill: rgb(0.996, 0.91, 0.91), border: DANGER, borderWidth: 1 });
  w.cursorY -= 19;
  w.line(ADMIT_CARD_WATERMARK, (PAGE_W - bannerW) / 2, bannerSize, "bold", DANGER);
  w.cursorY -= 25;
  w.paragraph("This preview is generated from portal records for internal eligibility checking and is not valid for examination entry.", {
    size: 8.5,
    style: "italic",
    color: MUTED,
  });
  w.gap(10);

  w.paragraph("Admit Card — Internal Preview", { size: 19, style: "bold", lineHeight: 24 });
  w.gap(2);
  w.paragraph(input.examLabel, { size: 11, style: "bold", color: ACCENT });
  w.gap(10);

  // Student block — only records the portal actually holds.
  drawFieldTable(w, fonts, [
    { label: "Student", value: input.student.name },
    { label: "Registration no.", value: input.student.registrationNo ?? "Not on record" },
    { label: "Program / department", value: input.student.department ?? "Not on record" },
    { label: "Email", value: input.student.email },
  ]);

  // Eligibility checks as recorded by the portal.
  w.paragraph("Eligibility checks", { size: 12.5, style: "bold" });
  w.gap(6);
  for (const check of input.checks) {
    const state = check.soft ? "NOTE" : check.passed ? "PASS" : "MISSING";
    const color = check.soft ? MUTED : check.passed ? SUCCESS : DANGER;
    w.paragraph(`${state} — ${check.label}: ${check.detail}`, { size: 9.5, style: "bold", color, lineHeight: 14 });
    w.gap(3);
  }
  w.gap(4);
  w.paragraph(
    `Configuration at issue time — required form: ${input.rule.requiredFormKey ?? "none"}; enrollment required: ${
      input.rule.requireEnrollment ? "yes" : "no"
    }; fee-clearance flag: ${input.rule.feeClearanceEnabled ? "on (not tracked in the portal)" : "off"}.`,
    { size: 8.5, style: "italic", color: MUTED },
  );
  w.gap(10);
  w.rule();
  w.paragraph(
    "Fee clearance, attendance and any university-specific conditions are verified outside the portal. Present only an official university-issued admit card at the examination hall.",
    { size: 8.5, style: "italic", color: MUTED },
  );

  // Diagonal watermark across the lower half of the page.
  const watermarkSize = 13;
  const wmWidth = fonts.bold.widthOfTextAtSize(ADMIT_CARD_WATERMARK, watermarkSize);
  const angle = degrees(30);
  const projected = wmWidth * Math.cos((30 * Math.PI) / 180);
  const wmX = Math.max(MARGIN, (PAGE_W - projected) / 2);
  for (const page of w.pages) {
    for (const wmY of [250, 480]) {
      page.drawText(ADMIT_CARD_WATERMARK, {
        x: wmX,
        y: wmY,
        size: watermarkSize,
        font: fonts.bold,
        color: DANGER,
        opacity: 0.16,
        rotate: angle,
      });
    }
  }

  w.finishFooter("admit-card internal preview");
  return doc.save();
}

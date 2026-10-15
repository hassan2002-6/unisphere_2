/**
 * Generates docs/PERMISSIONS.md from the canonical RBAC matrix (src/lib/rbac.ts).
 * Run: `bun scripts/gen-permissions.ts` from apps/web. Re-run whenever the
 * matrix changes so the documented permissions can never drift from the code.
 */
import { CAPABILITY_LABELS, ROLE_LABELS, capabilitiesFor, type Capability, type Role } from "@/lib/rbac";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROLES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];
const CAPS = Object.keys(CAPABILITY_LABELS) as Capability[];

const matrix = [
  `| Capability | ${ROLES.map((r) => ROLE_LABELS[r]).join(" | ")} |`,
  `| --- | ${ROLES.map(() => ":---:").join(" | ")} |`,
  ...CAPS.map(
    (c) =>
      `| ${CAPABILITY_LABELS[c]} (\`${c}\`) | ${ROLES.map((r) => (capabilitiesFor(r).includes(c) ? "✅" : "—")).join(" | ")} |`,
  ),
];

const perRole = ROLES.map((r) => {
  const caps = capabilitiesFor(r);
  return `### ${ROLE_LABELS[r]} (\`${r}\`)\n\n${
    caps.length ? caps.map((c) => `- ${CAPABILITY_LABELS[c]} (\`${c}\`)`).join("\n") : "_Base portal access only._"
  }`;
});

const doc = `# UniSphere — role permission matrix

> **Generated file — do not edit by hand.** The single source of truth is
> \`apps/web/src/lib/rbac.ts\`; regenerate with \`bun scripts/gen-permissions.ts\`
> from \`apps/web\`. Every portal page, server action and API route is checked
> against this matrix server-side (see \`tests/security.test.ts\`, which also
> statically fails the build if a page skips its guard).

## Matrix

${matrix.join("\n")}

## Per-role capability lists

${perRole.join("\n\n")}

## Notes

- **View access** follows the capability plus record scoping inside each
  service (students see only their own records; faculty see their assigned
  courses; coordinators/admins see the whole institutional scope). The guard
  and the scope check are enforced on the server for every read and write.
- **Export** is \`reports.view\` (CSV via \`/api/reports/summary?format=csv\`).
- **Delete/archive**: academic records are archived/retired (form templates,
  users via deactivation, inventory) rather than hard-deleted; complaint and
  notification cleanup only happens through record edits.
- MENTOR retains a standard dashboard only — the alumni-mentorship workflow is
  retired from the active portal (DB models kept).
`;

const out = join(process.cwd(), "..", "..", "docs", "PERMISSIONS.md");
writeFileSync(out, doc);
console.log(`wrote ${out} (${doc.length} chars, ${CAPS.length} capabilities)`);

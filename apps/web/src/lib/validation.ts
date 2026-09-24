import { z } from "zod";

/**
 * Validation helpers (plan component C3/C7). Form templates store a JSON
 * `fields` spec; `buildFormSchema` turns it into a Zod object so submissions
 * are validated server-side with the same schema the renderer uses.
 */

export const formFieldSpecSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "field name must be a valid identifier"),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
  placeholder: z.string().optional(),
});

export type FormFieldSpec = z.infer<typeof formFieldSpecSchema>;

export const formFieldsSchema = z.array(formFieldSpecSchema).min(1);

function fieldToZod(field: FormFieldSpec): z.ZodTypeAny {
  switch (field.type) {
    case "select": {
      const opts = field.options ?? [];
      const base = opts.length > 0 ? z.enum(opts as [string, ...string[]]) : z.string().min(1);
      return field.required ? base : base.optional().or(z.literal(""));
    }
    case "date":
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a date (YYYY-MM-DD)")
        .refine((v) => !Number.isNaN(Date.parse(v)), "invalid date");
    case "number": {
      const base = z.coerce.number().finite();
      return field.required ? base : base.optional();
    }
    case "checkbox": {
      const base = z.coerce.boolean();
      return field.required ? base.refine((v) => v === true, "must be checked") : base.optional();
    }
    case "textarea":
      return z.string().min(field.required ? 5 : 0).max(4000);
    case "text":
    default:
      return z.string().trim().min(field.required ? 1 : 0).max(500);
  }
}

/** Build the submission schema from a template's field spec array. */
export function buildFormSchema(fields: FormFieldSpec[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let schema = fieldToZod(field);
    if (!field.required) schema = schema.optional();
    shape[field.name] = schema;
  }
  return z.object(shape).strict();
}

/** Standard API error shape: { error: { code, message, details? } } */
export function apiError(code: string, message: string, details?: unknown, status = 400) {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function zodError(result: { error: z.ZodError }): Response {
  return apiError(
    "validation_error",
    "The submitted data is invalid.",
    result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    422,
  );
}

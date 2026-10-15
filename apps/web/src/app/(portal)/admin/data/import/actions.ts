"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/server/services/forms";
import { importCsv, type ImportEntity, type ImportReport } from "@/server/services/import-admin";

export type ImportState = { report?: ImportReport; error?: string };

export async function importCsvAction(_prev: ImportState | undefined, fd: FormData): Promise<ImportState> {
  const user = await requireUser();
  const entity = String(fd.get("entity") ?? "students") as ImportEntity;

  let csv = String(fd.get("csv") ?? "");
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) csv = await file.text();

  if (!csv.trim()) return { error: "Paste CSV rows or choose a .csv file first." };

  try {
    const report = await importCsv(user, entity, csv);
    revalidatePath("/admin/data");
    revalidatePath("/admin/users");
    return { report };
  } catch (e) {
    return { error: e instanceof ServiceError ? e.message : "Import failed — please check the file and try again." };
  }
}

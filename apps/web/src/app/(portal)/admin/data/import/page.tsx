import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ImportForm } from "@/components/admin-import-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) {
    return (
      <>
        <PageHeader icon={FileSpreadsheet} title="CSV import" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>CSV import is limited to administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Data management", href: "/admin/data" }, { label: "CSV import" }]}
        icon={FileSpreadsheet}
        title="CSV import"
        description="Bulk-enter students, faculty and course sections. Existing records (matched by email, employee ID or course section) are updated instead of duplicated."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/data">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      <ImportForm />
    </>
  );
}

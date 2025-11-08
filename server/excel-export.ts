import XLSX from "xlsx";
import type { Gap, User, FormTemplate } from "@shared/schema";

export interface GapWithRelations extends Gap {
  reporter?: User;
  assignee?: User;
  template?: FormTemplate;
}

export function generateExcelReport(
  gaps: GapWithRelations[],
  template?: FormTemplate
): Buffer {
  const worksheet = template
    ? buildTemplateWorksheet(gaps, template)
    : buildStandardWorksheet(gaps);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Gaps Report");

  // Add metadata sheet
  const metadataWorksheet = XLSX.utils.aoa_to_sheet([
    ["Report Generated", new Date().toLocaleString()],
    ["Total Records", gaps.length],
    ["Template", template?.name || "All Templates"],
  ]);
  XLSX.utils.book_append_sheet(workbook, metadataWorksheet, "Metadata");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function buildStandardWorksheet(gaps: GapWithRelations[]) {
  const rows = gaps.map((gap) => ({
    "Gap ID": gap.gapId,
    Title: gap.title,
    Description: gap.description,
    Status: gap.status,
    Priority: gap.priority,
    Severity: gap.severity || "N/A",
    Department: gap.department || "N/A",
    Reporter: gap.reporter?.name || "Unknown",
    "Reporter Email": gap.reporter?.email || "Unknown",
    Assignee: gap.assignee?.name || "Unassigned",
    "Assignee Email": gap.assignee?.email || "N/A",
    Template: gap.template?.name || "N/A",
    "Created At": gap.createdAt ? new Date(gap.createdAt).toLocaleString() : "",
    "Updated At": gap.updatedAt ? new Date(gap.updatedAt).toLocaleString() : "",
    "Resolved At": gap.resolvedAt
      ? new Date(gap.resolvedAt).toLocaleString()
      : "N/A",
    "Closed At": gap.closedAt ? new Date(gap.closedAt).toLocaleString() : "N/A",
    "TAT Deadline": gap.tatDeadline
      ? new Date(gap.tatDeadline).toLocaleString()
      : "N/A",
    "Resolution Summary": gap.resolutionSummary || "N/A",
    "Attachments Count": Array.isArray(gap.attachments)
      ? gap.attachments.length
      : 0,
  }));

  return XLSX.utils.json_to_sheet(rows);
}

function buildTemplateWorksheet(
  gaps: GapWithRelations[],
  template: FormTemplate
) {
  const schema = template.schemaJson as any;

  // Build dynamic columns from template schema
  const dynamicColumns: string[] = [];
  const columnMapping: Map<string, string> = new Map();

  if (schema && schema.sections) {
    schema.sections.forEach((section: any) => {
      section.questions?.forEach((question: any) => {
        const columnName = `${section.name} - ${question.text}`;
        dynamicColumns.push(columnName);
        columnMapping.set(`${section.id}.${question.id}`, columnName);
      });
    });
  }

  // Build rows
  const rows = gaps.map((gap) => {
    const row: any = {
      "Gap ID": gap.gapId,
      Title: gap.title,
      Status: gap.status,
      Priority: gap.priority,
      Reporter: gap.reporter?.name || "Unknown",
      "Reporter Email": gap.reporter?.email || "Unknown",
      Assignee: gap.assignee?.name || "Unassigned",
      Department: gap.department || "N/A",
      "Created At": gap.createdAt
        ? new Date(gap.createdAt).toLocaleString()
        : "",
      "Resolved At": gap.resolvedAt
        ? new Date(gap.resolvedAt).toLocaleString()
        : "N/A",
    };

    // Add form responses
    if (gap.formResponsesJson && typeof gap.formResponsesJson === "object") {
      const responses = gap.formResponsesJson as any;

      // Iterate through sections and questions
      Object.entries(responses).forEach(([sectionKey, sectionData]: [string, any]) => {
        if (typeof sectionData === "object" && sectionData !== null) {
          Object.entries(sectionData).forEach(([questionId, value]: [string, any]) => {
            // Find the original section ID (remove instance suffix if repeatable)
            const baseSectionId = sectionKey.split('_')[0];
            const columnKey = `${baseSectionId}.${questionId}`;
            const columnName = columnMapping.get(columnKey);

            if (columnName) {
              // Handle file uploads
              if (value && typeof value === "object" && value.originalName) {
                row[columnName] = value.originalName;
              } else if (Array.isArray(value)) {
                row[columnName] = value.join(", ");
              } else {
                row[columnName] = value || "";
              }
            }
          });
        }
      });
    }

    // Fill missing columns
    dynamicColumns.forEach((col) => {
      if (!(col in row)) {
        row[col] = "N/A";
      }
    });

    return row;
  });

  return XLSX.utils.json_to_sheet(rows);
}

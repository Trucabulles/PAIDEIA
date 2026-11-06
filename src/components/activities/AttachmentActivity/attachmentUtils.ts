export const ATTACHMENT_FILE_ACCEPT =
  ".odt,.doc,.docx,.pdf,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.zip";

export function attachmentKindLabel(extension: string) {
  switch (extension.trim().toLowerCase()) {
    case "pdf":
      return "PDF";
    case "doc":
    case "docx":
      return "WORD";
    case "odt":
      return "WRITER";
    case "ppt":
    case "pptx":
      return "PPT";
    case "odp":
      return "IMPRESS";
    case "xls":
    case "xlsx":
      return "EXCEL";
    case "ods":
      return "CALC";
    case "zip":
      return "ZIP";
    default:
      return "FICHIER";
  }
}

export function formatAttachmentSize(sizeBytes?: number | null) {
  if (!Number.isFinite(sizeBytes) || !sizeBytes) {
    return "";
  }
  if (sizeBytes >= 1_048_576) {
    return `${(sizeBytes / 1_048_576).toFixed(1)} Mo`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} Ko`;
  }
  return `${sizeBytes} o`;
}

export function attachmentIconTone(extension: string) {
  switch (extension.trim().toLowerCase()) {
    case "pdf":
      return "pdf";
    case "doc":
    case "docx":
    case "odt":
      return "document";
    case "ppt":
    case "pptx":
    case "odp":
      return "presentation";
    case "xls":
    case "xlsx":
    case "ods":
      return "spreadsheet";
    case "zip":
      return "archive";
    default:
      return "generic";
  }
}


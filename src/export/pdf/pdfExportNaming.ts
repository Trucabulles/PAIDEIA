function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function lessonPdfFileName(title: string, date = new Date()): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u2500+/g, " ")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lecon";
  const day = `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
  const time = `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  return `${slug}_${day}_${time}.pdf`;
}

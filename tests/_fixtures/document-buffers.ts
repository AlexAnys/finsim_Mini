import JSZip from "jszip";
import * as XLSX from "xlsx";

export const financialText = "资产配置报告：分散风险，保留现金，预期收益不代表保证盈利。";

export async function docxBuffer(options: { malformedEndTag?: boolean; attributes?: number } = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const attrs = Array.from({ length: options.attributes ?? 0 }, (_, i) => `a${i}="x"`).join(" ");
  const closeText = options.malformedEndTag ? "</w:t\ntrailing>" : "</w:t>";
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ${attrs}><w:body><w:p><w:r><w:t>${financialText}${closeText}</w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function spreadsheetBuffer(bookType: "xlsx" | "biff8" | "csv") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["资产类别", "配置金额", "说明"],
    ["现金", 25000, financialText],
    ["股票", 75000, "避免集中持仓"],
  ]), "资产配置");
  return Buffer.from(XLSX.write(workbook, { bookType, type: "buffer" }));
}

/**
 * CSV 내보내기 유틸리티
 */

export interface ExportConfig<T> {
  data: T[];
  headers: string[];
  rowMapper: (item: T) => (string | number | null | undefined)[];
  filename: string;
}

/**
 * 데이터를 CSV 파일로 내보내기
 */
export function exportToCSV<T>({
  data,
  headers,
  rowMapper,
  filename,
}: ExportConfig<T>): void {
  if (data.length === 0) {
    throw new Error("내보낼 데이터가 없습니다.");
  }

  const rows = data.map(rowMapper);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell ?? ""}"`).join(",")
    ),
  ].join("\n");

  // UTF-8 BOM for Korean support
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 날짜를 한국 형식으로 포맷
 */
export function formatDateKR(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ko-KR");
}

/**
 * 날짜/시간을 한국 형식으로 포맷
 */
export function formatDateTimeKR(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("ko-KR");
}

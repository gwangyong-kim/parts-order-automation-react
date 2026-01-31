"use client";

import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, Info, Layers } from "lucide-react";
import Modal from "./Modal";

interface FieldGuide {
  name: string;
  description: string;
  required: boolean;
  example?: string;
  type?: string;
}

interface SheetConfig {
  name: string;
  label: string;
  description: string;
  fields: FieldGuide[];
  required: boolean;
}

interface MultiSheetUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: Record<string, Record<string, unknown>[]>) => Promise<void>;
  title: string;
  templateName: string;
  sheets: SheetConfig[];
  isLoading?: boolean;
}

export default function MultiSheetUpload({
  isOpen,
  onClose,
  onUpload,
  title,
  templateName,
  sheets,
  isLoading = false,
}: MultiSheetUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetData, setSheetData] = useState<Record<string, Record<string, unknown>[]>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<"guide" | "upload" | "preview">("guide");
  const [activeSheet, setActiveSheet] = useState(sheets[0]?.name || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      setErrors(["Excel 파일(.xlsx, .xls)만 지원합니다."]);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const parsedData: Record<string, Record<string, unknown>[]> = {};
      const parseErrors: string[] = [];

      for (const sheet of sheets) {
        // 시트 이름 매칭 (대소문자 무시, 공백 무시)
        const sheetName = workbook.SheetNames.find(
          (name) => name.toLowerCase().replace(/\s/g, "") === sheet.label.toLowerCase().replace(/\s/g, "")
        );

        if (sheetName) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
          parsedData[sheet.name] = jsonData;
        } else if (sheet.required) {
          parseErrors.push(`필수 워크시트 "${sheet.label}"를 찾을 수 없습니다.`);
        } else {
          parsedData[sheet.name] = [];
        }
      }

      if (parseErrors.length > 0) {
        setErrors(parseErrors);
        setFile(null);
        return;
      }

      setSheetData(parsedData);
      setStep("preview");
    } catch (err) {
      setErrors(["파일을 읽는 중 오류가 발생했습니다: " + (err as Error).message]);
      setFile(null);
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    for (const sheet of sheets) {
      // 헤더와 예시 데이터 생성
      const headers = sheet.fields.map((f) => f.name);
      const exampleRow = sheet.fields.reduce((obj, field) => {
        obj[field.name] = field.example || "";
        return obj;
      }, {} as Record<string, string>);

      const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: headers });

      // 컬럼 너비 설정
      const colWidths = sheet.fields.map((f) => ({
        wch: Math.max(f.name.length * 2, (f.example?.length || 10) * 1.5, 15),
      }));
      worksheet["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.label);
    }

    XLSX.writeFile(workbook, `${templateName}_템플릿.xlsx`);
  };

  const handleUpload = async () => {
    // 필수 시트 검증
    const requiredSheets = sheets.filter((s) => s.required);
    const missingSheets = requiredSheets.filter((s) => !sheetData[s.name] || sheetData[s.name].length === 0);

    if (missingSheets.length > 0) {
      setErrors([`필수 워크시트의 데이터가 없습니다: ${missingSheets.map((s) => s.label).join(", ")}`]);
      return;
    }

    try {
      await onUpload(sheetData);
      handleClose();
    } catch (error) {
      // 오류 메시지를 줄 단위로 분리하여 표시
      const errorMessage = (error as Error).message || "업로드 중 오류가 발생했습니다.";
      const errorLines = errorMessage.split("\n").filter((line) => line.trim());
      setErrors(errorLines);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSheetData({});
    setErrors([]);
    setStep("guide");
    setActiveSheet(sheets[0]?.name || "");
    onClose();
  };

  const currentSheet = sheets.find((s) => s.name === activeSheet);
  const requiredFields = currentSheet?.fields.filter((f) => f.required) || [];
  const optionalFields = currentSheet?.fields.filter((f) => !f.required) || [];
  const currentPreview = sheetData[activeSheet]?.slice(0, 10) || [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="xl">
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4">
          {["guide", "upload", "preview"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === s
                    ? "bg-[var(--primary)] text-white"
                    : ["guide", "upload", "preview"].indexOf(step) > i
                      ? "bg-[var(--success)] text-white"
                      : "bg-[var(--gray-200)] text-[var(--text-secondary)]"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm ${step === s ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
              >
                {s === "guide" ? "가이드" : s === "upload" ? "파일선택" : "미리보기"}
              </span>
              {i < 2 && <div className="w-8 h-0.5 bg-[var(--gray-200)]" />}
            </div>
          ))}
        </div>

        {/* Guide Step */}
        {step === "guide" && (
          <div className="space-y-4">
            {/* Multi-sheet Info */}
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-[var(--primary)] mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-[var(--text-primary)]">다중 워크시트 Excel 업로드</h4>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    하나의 Excel 파일에 여러 워크시트로 데이터를 구성합니다.
                    <br />
                    워크시트 이름: <strong>{sheets.map((s) => s.label).join(", ")}</strong>
                  </p>
                  <button onClick={handleDownloadTemplate} className="btn btn-secondary mt-3">
                    <Download className="w-4 h-4" />
                    템플릿 다운로드 (.xlsx)
                  </button>
                </div>
              </div>
            </div>

            {/* Sheet Tabs */}
            <div className="flex border-b border-[var(--glass-border)]">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(sheet.name)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSheet === sheet.name
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {sheet.label}
                  {sheet.required && <span className="text-[var(--danger)] ml-1">*</span>}
                </button>
              ))}
            </div>

            {/* Sheet Description */}
            {currentSheet && (
              <div className="text-sm text-[var(--text-secondary)] bg-[var(--gray-50)] p-3 rounded-lg">
                <strong>워크시트명:</strong> {currentSheet.label}
                <br />
                {currentSheet.description}
              </div>
            )}

            {/* Required Fields */}
            {requiredFields.length > 0 && (
              <div className="border border-[var(--glass-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--danger)]/5 px-4 py-2 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
                    <span className="font-semibold text-sm text-[var(--danger)]">필수 항목</span>
                  </div>
                </div>
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--text-secondary)]">
                        <th className="pb-2 font-medium">필드명</th>
                        <th className="pb-2 font-medium">설명</th>
                        <th className="pb-2 font-medium">타입</th>
                        <th className="pb-2 font-medium">예시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {requiredFields.map((field) => (
                        <tr key={field.name}>
                          <td className="py-2 font-medium text-[var(--text-primary)]">{field.name}</td>
                          <td className="py-2 text-[var(--text-secondary)]">{field.description}</td>
                          <td className="py-2">
                            <code className="text-xs bg-[var(--gray-100)] px-1 rounded">{field.type || "text"}</code>
                          </td>
                          <td className="py-2 text-[var(--text-muted)]">{field.example || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Optional Fields */}
            {optionalFields.length > 0 && (
              <div className="border border-[var(--glass-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--gray-100)] px-4 py-2 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="font-semibold text-sm text-[var(--text-secondary)]">선택 항목</span>
                  </div>
                </div>
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--text-secondary)]">
                        <th className="pb-2 font-medium">필드명</th>
                        <th className="pb-2 font-medium">설명</th>
                        <th className="pb-2 font-medium">타입</th>
                        <th className="pb-2 font-medium">예시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {optionalFields.map((field) => (
                        <tr key={field.name}>
                          <td className="py-2 font-medium text-[var(--text-primary)]">{field.name}</td>
                          <td className="py-2 text-[var(--text-secondary)]">{field.description}</td>
                          <td className="py-2">
                            <code className="text-xs bg-[var(--gray-100)] px-1 rounded">{field.type || "text"}</code>
                          </td>
                          <td className="py-2 text-[var(--text-muted)]">{field.example || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setStep("upload")} className="btn btn-primary">
                다음: 파일 선택
              </button>
            </div>
          </div>
        )}

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--glass-border)] rounded-lg p-12 text-center cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
            >
              <Upload className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-primary)] font-medium">클릭하여 Excel 파일을 선택하세요</p>
              <p className="text-sm text-[var(--text-muted)] mt-2">지원 형식: Excel (.xlsx, .xls)</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                워크시트: {sheets.map((s) => s.label).join(", ")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {file && (
              <div className="flex items-center gap-3 p-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-[var(--success)]" />
                <span className="flex-1 text-sm font-medium">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null);
                    setSheetData({});
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {errors.length > 0 && (
              <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-[var(--danger)]">
                    {error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep("guide")} className="btn btn-secondary">
                이전
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--success)]">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">파일이 파싱되었습니다: {file?.name}</span>
            </div>

            {/* Sheet Tabs for Preview */}
            <div className="flex border-b border-[var(--glass-border)]">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(sheet.name)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSheet === sheet.name
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {sheet.label}
                  <span className="ml-2 text-xs text-[var(--text-muted)]">({sheetData[sheet.name]?.length || 0}행)</span>
                </button>
              ))}
            </div>

            {/* Preview Table */}
            {currentPreview.length > 0 ? (
              <div className="border border-[var(--glass-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--gray-100)] px-4 py-2 border-b border-[var(--glass-border)]">
                  <span className="font-semibold text-sm">미리보기 (처음 10행)</span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--gray-50)] sticky top-0">
                      <tr>
                        {Object.keys(currentPreview[0] || {}).map((key) => (
                          <th
                            key={key}
                            className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {currentPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((value, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap">
                              {String(value ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                이 워크시트에 데이터가 없습니다.
              </div>
            )}

            {/* Upload Summary */}
            <div className="bg-[var(--info)]/10 border border-[var(--info)]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-[var(--info)] mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">업로드 요약</p>
                  <ul className="text-sm text-[var(--text-secondary)] mt-1 list-disc list-inside space-y-1">
                    {sheets.map((sheet) => (
                      <li key={sheet.name}>
                        {sheet.label}: {sheetData[sheet.name]?.length || 0}건
                        {sheet.required && !sheetData[sheet.name]?.length && (
                          <span className="text-[var(--danger)]"> (필수)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--warning)] mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">업로드 전 확인사항</p>
                  <ul className="text-sm text-[var(--text-secondary)] mt-1 list-disc list-inside space-y-1">
                    <li>중복 제품코드는 기존 데이터를 덮어씁니다</li>
                    <li>BOM 업로드 시 해당 제품의 기존 BOM이 모두 삭제 후 새로 등록됩니다</li>
                    <li>존재하지 않는 제품코드/파츠코드는 오류로 처리됩니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-[var(--danger)]">
                    {error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="btn btn-secondary">
                이전
              </button>
              <button onClick={handleUpload} disabled={isLoading} className="btn btn-primary">
                {isLoading ? "업로드 중..." : "업로드 실행"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

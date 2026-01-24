"use client";

import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, Info } from "lucide-react";
import Modal from "./Modal";

interface FieldGuide {
  name: string;
  description: string;
  required: boolean;
  example?: string;
  type?: string;
}

interface ExcelUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: Record<string, unknown>[]) => Promise<void>;
  title: string;
  templateName: string;
  fields: FieldGuide[];
  isLoading?: boolean;
}

export default function ExcelUpload({
  isOpen,
  onClose,
  onUpload,
  title,
  templateName,
  fields,
  isLoading = false,
}: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<"guide" | "upload" | "preview">("guide");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv") && !selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      setErrors(["지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 선택해주세요."]);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    // Parse CSV for preview
    if (selectedFile.name.endsWith(".csv")) {
      const text = await selectedFile.text();
      const rows = text.split("\n").filter(row => row.trim());
      const headers = rows[0].split(",").map(h => h.trim().replace(/"/g, ""));

      const data = rows.slice(1).map(row => {
        const values = row.split(",").map(v => v.trim().replace(/"/g, ""));
        const obj: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || "";
        });
        return obj;
      });

      setPreview(data.slice(0, 10)); // Show first 10 rows
      setStep("preview");
    } else {
      // For Excel files, show preview step without parsing (server will handle)
      setPreview([]);
      setStep("preview");
    }
  };

  const handleDownloadTemplate = () => {
    // Generate CSV template
    const headers = fields.map(f => f.name).join(",");
    const exampleRow = fields.map(f => f.example || "").join(",");
    const csv = `${headers}\n${exampleRow}`;

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${templateName}_템플릿.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      // For CSV files, parse and send data
      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const rows = text.split("\n").filter(row => row.trim());
        const headers = rows[0].split(",").map(h => h.trim().replace(/"/g, ""));

        const data = rows.slice(1).map(row => {
          const values = row.split(",").map(v => v.trim().replace(/"/g, ""));
          const obj: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || "";
          });
          return obj;
        });

        await onUpload(data);
      }

      handleClose();
    } catch (error) {
      setErrors([(error as Error).message || "업로드 중 오류가 발생했습니다."]);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setStep("guide");
    onClose();
  };

  const requiredFields = fields.filter(f => f.required);
  const optionalFields = fields.filter(f => !f.required);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4">
          {["guide", "upload", "preview"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s ? "bg-[var(--primary)] text-white" :
                ["guide", "upload", "preview"].indexOf(step) > i ? "bg-[var(--success)] text-white" :
                "bg-[var(--gray-200)] text-[var(--text-secondary)]"
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm ${step === s ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                {s === "guide" ? "가이드" : s === "upload" ? "파일선택" : "미리보기"}
              </span>
              {i < 2 && <div className="w-8 h-0.5 bg-[var(--gray-200)]" />}
            </div>
          ))}
        </div>

        {/* Guide Step */}
        {step === "guide" && (
          <div className="space-y-4">
            {/* Template Download */}
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-[var(--primary)] mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-[var(--text-primary)]">템플릿 다운로드</h4>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    아래 템플릿을 다운로드하여 데이터를 입력한 후 업로드해주세요.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="btn btn-secondary mt-3"
                  >
                    <Download className="w-4 h-4" />
                    템플릿 다운로드 (.csv)
                  </button>
                </div>
              </div>
            </div>

            {/* Required Fields */}
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
                    {requiredFields.map(field => (
                      <tr key={field.name}>
                        <td className="py-2 font-medium text-[var(--text-primary)]">{field.name}</td>
                        <td className="py-2 text-[var(--text-secondary)]">{field.description}</td>
                        <td className="py-2"><code className="text-xs bg-[var(--gray-100)] px-1 rounded">{field.type || "text"}</code></td>
                        <td className="py-2 text-[var(--text-muted)]">{field.example || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                      {optionalFields.map(field => (
                        <tr key={field.name}>
                          <td className="py-2 font-medium text-[var(--text-primary)]">{field.name}</td>
                          <td className="py-2 text-[var(--text-secondary)]">{field.description}</td>
                          <td className="py-2"><code className="text-xs bg-[var(--gray-100)] px-1 rounded">{field.type || "text"}</code></td>
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
              <p className="text-[var(--text-primary)] font-medium">
                클릭하여 파일을 선택하거나 드래그하세요
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                지원 형식: CSV, Excel (.xlsx, .xls)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {file && (
              <div className="flex items-center gap-3 p-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-[var(--success)]" />
                <span className="flex-1 text-sm font-medium">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-[var(--text-muted)] hover:text-[var(--danger)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {errors.length > 0 && (
              <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-[var(--danger)]">{error}</p>
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
              <span className="font-medium">파일이 선택되었습니다: {file?.name}</span>
            </div>

            {preview.length > 0 && (
              <div className="border border-[var(--glass-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--gray-100)] px-4 py-2 border-b border-[var(--glass-border)]">
                  <span className="font-semibold text-sm">미리보기 (처음 10행)</span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--gray-50)] sticky top-0">
                      <tr>
                        {Object.keys(preview[0] || {}).map(key => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((value, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap">
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--warning)] mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">업로드 전 확인사항</p>
                  <ul className="text-sm text-[var(--text-secondary)] mt-1 list-disc list-inside space-y-1">
                    <li>중복 데이터는 기존 데이터를 덮어씁니다</li>
                    <li>필수 항목이 비어있는 행은 건너뜁니다</li>
                    <li>코드가 비어있으면 자동 생성됩니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-[var(--danger)]">{error}</p>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="btn btn-secondary">
                이전
              </button>
              <button
                onClick={handleUpload}
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? "업로드 중..." : "업로드 실행"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Bell,
  Database,
  Shield,
  Link,
  Save,
  Globe,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileDown,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
}

interface Backup {
  fileName: string;
  createdAt: string;
  size: number;
  sizeFormatted: string;
}

interface DbStats {
  database: {
    type: string;
    size: number;
    sizeFormatted: string;
    lastModified: string;
    integrityCheck: string;
  };
  tables: Record<string, number>;
  totalRecords: number;
  recentActivity: {
    last24hTransactions: number;
    last7dOrders: number;
    last7dSalesOrders: number;
  };
}

const sections: SettingsSection[] = [
  { id: "profile", title: "프로필", icon: User },
  { id: "language", title: "언어 설정", icon: Globe },
  { id: "notifications", title: "알림 설정", icon: Bell },
  { id: "security", title: "보안", icon: Shield },
  { id: "integrations", title: "외부 연동", icon: Link },
  { id: "system", title: "시스템", icon: Database },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("profile");
  const [language, setLanguage] = useState("ko");
  const [notifications, setNotifications] = useState({
    email: true,
    lowStock: true,
    orderStatus: true,
    mrpAlerts: false,
  });
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);

  // 백업 목록 조회
  const { data: backupData, isLoading: backupsLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Failed to fetch backups");
      return res.json();
    },
    enabled: activeSection === "system",
  });

  // DB 통계 조회
  const { data: dbStats, isLoading: statsLoading } = useQuery<DbStats>({
    queryKey: ["dbStats"],
    queryFn: async () => {
      const res = await fetch("/api/database/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: activeSection === "system",
  });

  // 정리 미리보기
  const { data: cleanupPreview } = useQuery({
    queryKey: ["cleanupPreview", cleanupDays],
    queryFn: async () => {
      const res = await fetch(`/api/database/cleanup?daysToKeep=${cleanupDays}`);
      if (!res.ok) throw new Error("Failed to fetch preview");
      return res.json();
    },
    enabled: showCleanupDialog,
  });

  // 백업 생성
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "수동 백업" }),
      });
      if (!res.ok) throw new Error("Backup failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("백업이 완료되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: () => {
      toast.error("백업에 실패했습니다.");
    },
  });

  // 백업 복구
  const restoreBackupMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (!res.ok) throw new Error("Restore failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("데이터가 복구되었습니다. 페이지를 새로고침 해주세요.");
      setShowRestoreDialog(false);
      setSelectedBackup(null);
    },
    onError: () => {
      toast.error("복구에 실패했습니다.");
    },
  });

  // 백업 삭제
  const deleteBackupMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const res = await fetch(`/api/backup/${fileName}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("백업이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: () => {
      toast.error("삭제에 실패했습니다.");
    },
  });

  // 데이터 정리
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/database/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysToKeep: cleanupDays }),
      });
      if (!res.ok) throw new Error("Cleanup failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setShowCleanupDialog(false);
      queryClient.invalidateQueries({ queryKey: ["dbStats"] });
    },
    onError: () => {
      toast.error("데이터 정리에 실패했습니다.");
    },
  });

  const handleSave = () => {
    toast.info("설정이 저장되었습니다.");
  };

  const handleExportData = async () => {
    try {
      window.open("/api/database/export?format=download", "_blank");
      toast.success("데이터 내보내기가 시작되었습니다.");
    } catch {
      toast.error("내보내기에 실패했습니다.");
    }
  };

  const handleDownloadBackup = (fileName: string) => {
    window.open(`/api/backup/${fileName}`, "_blank");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">시스템 설정</h1>
          <p className="text-[var(--text-secondary)]">
            시스템 환경 및 사용자 설정을 관리합니다.
          </p>
        </div>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          저장
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? "bg-[var(--primary)] text-white"
                      : "hover:bg-[var(--glass-bg)] text-[var(--text-secondary)]"
                  }`}
                >
                  <section.icon className="w-5 h-5" />
                  {section.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                프로필 설정
              </h2>
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-[var(--primary)]">
                      {session?.user?.name?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div>
                    <button className="btn-secondary">프로필 사진 변경</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      이름
                    </label>
                    <input
                      type="text"
                      defaultValue={session?.user?.name || ""}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      아이디
                    </label>
                    <input
                      type="text"
                      defaultValue={session?.user?.username || ""}
                      className="input w-full"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      이메일
                    </label>
                    <input
                      type="email"
                      defaultValue={session?.user?.email || ""}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      부서
                    </label>
                    <input
                      type="text"
                      defaultValue={session?.user?.department || ""}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Language Section */}
          {activeSection === "language" && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                언어 설정
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    언어
                  </label>
                  <select
                    className="input w-full max-w-xs"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    시스템에서 사용할 언어를 선택합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === "notifications" && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                알림 설정
              </h2>
              <div className="space-y-4">
                {[
                  { key: "email", label: "이메일 알림", desc: "중요 알림을 이메일로 받습니다." },
                  { key: "lowStock", label: "저재고 알림", desc: "파츠 재고가 안전재고 이하일 때 알림을 받습니다." },
                  { key: "orderStatus", label: "발주 상태 알림", desc: "발주 상태 변경 시 알림을 받습니다." },
                  { key: "mrpAlerts", label: "MRP 알림", desc: "MRP 계산 결과에서 긴급 품목 발생 시 알림을 받습니다." },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--glass-bg)]"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="text-sm text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) =>
                          setNotifications((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[var(--gray-300)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                보안 설정
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)] mb-4">비밀번호 변경</h3>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        현재 비밀번호
                      </label>
                      <input type="password" className="input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        새 비밀번호
                      </label>
                      <input type="password" className="input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        새 비밀번호 확인
                      </label>
                      <input type="password" className="input w-full" />
                    </div>
                    <button className="btn-primary">비밀번호 변경</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Section */}
          {activeSection === "integrations" && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                외부 연동
              </h2>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-[var(--glass-border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#4285F4]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-[#4285F4]">G</span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Google Sheets</p>
                        <p className="text-sm text-[var(--text-muted)]">발주 데이터 자동 동기화</p>
                      </div>
                    </div>
                    <button className="btn-secondary">연결</button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-[var(--glass-border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#4A154B]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-[#4A154B]">S</span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Slack</p>
                        <p className="text-sm text-[var(--text-muted)]">알림 메시지 전송</p>
                      </div>
                    </div>
                    <button className="btn-secondary">연결</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Section */}
          {activeSection === "system" && (
            <>
              {/* 시스템 정보 */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                  시스템 정보
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">버전</p>
                    <p className="font-medium text-[var(--text-primary)]">2.0.0</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">프레임워크</p>
                    <p className="font-medium text-[var(--text-primary)]">Next.js 16</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">데이터베이스</p>
                    <p className="font-medium text-[var(--text-primary)]">SQLite + Prisma</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">DB 크기</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {statsLoading ? "..." : dbStats?.database.sizeFormatted || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 데이터베이스 상태 */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                  데이터베이스 상태
                </h2>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : dbStats ? (
                  <div className="space-y-6">
                    {/* 무결성 상태 */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--glass-bg)]">
                      {dbStats.database.integrityCheck === "ok" ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-[var(--success)]" />
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">데이터베이스 정상</p>
                            <p className="text-sm text-[var(--text-muted)]">무결성 검사 통과</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-6 h-6 text-[var(--warning)]" />
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">주의 필요</p>
                            <p className="text-sm text-[var(--text-muted)]">{dbStats.database.integrityCheck}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 테이블별 레코드 수 */}
                    <div>
                      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                        테이블별 레코드 수 (총 {dbStats.totalRecords.toLocaleString()}개)
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(dbStats.tables).map(([table, count]) => (
                          <div key={table} className="p-3 rounded-lg bg-[var(--gray-50)] border border-[var(--gray-200)]">
                            <p className="text-xs text-[var(--text-muted)]">{table}</p>
                            <p className="font-mono font-medium text-[var(--text-primary)]">{count.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 최근 활동 */}
                    <div>
                      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">최근 활동</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-[var(--primary-50)]">
                          <p className="text-xs text-[var(--text-muted)]">24시간 거래</p>
                          <p className="font-mono font-medium text-[var(--primary)]">
                            {dbStats.recentActivity.last24hTransactions}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--info-50)]">
                          <p className="text-xs text-[var(--text-muted)]">7일 발주</p>
                          <p className="font-mono font-medium text-[var(--info)]">
                            {dbStats.recentActivity.last7dOrders}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--success-50)]">
                          <p className="text-xs text-[var(--text-muted)]">7일 수주</p>
                          <p className="font-mono font-medium text-[var(--success)]">
                            {dbStats.recentActivity.last7dSalesOrders}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--text-muted)]">통계를 불러올 수 없습니다.</p>
                )}
              </div>

              {/* 백업 관리 */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    백업 관리
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createBackupMutation.mutate()}
                      disabled={createBackupMutation.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      {createBackupMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      지금 백업
                    </button>
                  </div>
                </div>

                {backupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : backupData?.backups?.length > 0 ? (
                  <div className="space-y-3">
                    {backupData.backups.map((backup: Backup) => (
                      <div
                        key={backup.fileName}
                        className="flex items-center justify-between p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]"
                      >
                        <div className="flex items-center gap-4">
                          <HardDrive className="w-8 h-8 text-[var(--primary)]" />
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{backup.fileName}</p>
                            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(backup.createdAt).toLocaleString("ko-KR")}
                              </span>
                              <span>{backup.sizeFormatted}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadBackup(backup.fileName)}
                            className="p-2 hover:bg-[var(--gray-100)] rounded-lg transition-colors"
                            title="다운로드"
                          >
                            <FileDown className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBackup(backup);
                              setShowRestoreDialog(true);
                            }}
                            className="p-2 hover:bg-[var(--info-50)] rounded-lg transition-colors"
                            title="복구"
                          >
                            <RefreshCw className="w-4 h-4 text-[var(--info)]" />
                          </button>
                          <button
                            onClick={() => deleteBackupMutation.mutate(backup.fileName)}
                            disabled={deleteBackupMutation.isPending}
                            className="p-2 hover:bg-[var(--danger-50)] rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      * 최근 {backupData.config.maxBackups}개의 백업만 보관됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <HardDrive className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">저장된 백업이 없습니다.</p>
                    <p className="text-sm text-[var(--text-muted)]">위 버튼을 클릭하여 백업을 생성하세요.</p>
                  </div>
                )}
              </div>

              {/* 데이터 관리 */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                  데이터 관리
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={handleExportData}
                    className="p-4 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors text-left"
                  >
                    <Download className="w-6 h-6 text-[var(--primary)] mb-2" />
                    <p className="font-medium text-[var(--text-primary)]">데이터 내보내기</p>
                    <p className="text-sm text-[var(--text-muted)]">전체 데이터를 JSON으로 내보냅니다.</p>
                  </button>

                  <button
                    onClick={() => setShowCleanupDialog(true)}
                    className="p-4 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors text-left"
                  >
                    <Trash2 className="w-6 h-6 text-[var(--warning)] mb-2" />
                    <p className="font-medium text-[var(--text-primary)]">오래된 데이터 정리</p>
                    <p className="text-sm text-[var(--text-muted)]">알림, 로그 등 오래된 데이터를 삭제합니다.</p>
                  </button>

                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["dbStats"] })}
                    className="p-4 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors text-left"
                  >
                    <RefreshCw className="w-6 h-6 text-[var(--info)] mb-2" />
                    <p className="font-medium text-[var(--text-primary)]">통계 새로고침</p>
                    <p className="text-sm text-[var(--text-muted)]">데이터베이스 통계를 다시 불러옵니다.</p>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 복구 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={showRestoreDialog}
        onClose={() => {
          setShowRestoreDialog(false);
          setSelectedBackup(null);
        }}
        onConfirm={() => selectedBackup && restoreBackupMutation.mutate(selectedBackup.fileName)}
        title="데이터 복구"
        message={`"${selectedBackup?.fileName}" 백업으로 복구하시겠습니까? 현재 데이터가 백업 시점의 데이터로 대체됩니다.`}
        confirmText="복구"
        variant="warning"
        isLoading={restoreBackupMutation.isPending}
      />

      {/* 데이터 정리 다이얼로그 */}
      <ConfirmDialog
        isOpen={showCleanupDialog}
        onClose={() => setShowCleanupDialog(false)}
        onConfirm={() => cleanupMutation.mutate()}
        title="오래된 데이터 정리"
        message={
          cleanupPreview
            ? `${cleanupDays}일 이전의 데이터를 정리합니다.\n\n정리 대상:\n- 읽은 알림: ${cleanupPreview.preview.notifications}개\n- 업로드 로그: ${cleanupPreview.preview.bulkUploadLogs}개\n\n총 ${cleanupPreview.preview.total}개의 레코드가 삭제됩니다.`
            : "데이터 정리 대상을 확인 중..."
        }
        confirmText="정리"
        variant="warning"
        isLoading={cleanupMutation.isPending}
      />
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Cropper, { Area } from "react-easy-crop";
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
  Camera,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";

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
  checksumValid?: boolean;
  metadata?: {
    type?: string;
    description?: string;
    appVersion?: string;
    recordCounts?: Record<string, number>;
  };
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

  // 비밀번호 변경 상태
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 프로필 이미지 상태
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 크롭 상태
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // 사용자 프로필 조회
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const res = await fetch(`/api/users/${session.user.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!session?.user?.id,
  });

  // 프로필 이미지 초기화
  useEffect(() => {
    if (userProfile?.profileImage) {
      setProfileImage(userProfile.profileImage);
    }
  }, [userProfile]);

  // 외부 연동 상태
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState({
    spreadsheetId: "",
    sheetName: "",
    isConnected: false,
  });
  const [slackConfig, setSlackConfig] = useState({
    webhookUrl: "",
    channel: "",
    isConnected: false,
  });

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

  // 비밀번호 변경 처리
  const handleChangePassword = async () => {
    // 유효성 검사
    if (!currentPassword) {
      toast.error("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (!newPassword) {
      toast.error("새 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("새 비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "비밀번호 변경에 실패했습니다.");
      }

      toast.success("비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 파일 선택 시 크롭 모달 열기
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 허용)");
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB를 초과할 수 없습니다.");
      return;
    }

    // 파일을 Data URL로 변환하여 크롭 모달에 표시
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setSelectedFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 크롭 완료 콜백
  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 크롭된 이미지를 Blob으로 변환
  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas is empty"));
        },
        "image/jpeg",
        0.95
      );
    });
  };

  // 크롭 후 업로드
  const handleCropAndUpload = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;

    setIsUploadingImage(true);
    setShowCropModal(false);

    try {
      // 크롭된 이미지 생성
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);

      const formData = new FormData();
      formData.append("file", croppedBlob, "profile.jpg");

      const res = await fetch("/api/users/profile-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "이미지 업로드에 실패했습니다.");
      }

      setProfileImage(data.profileImage);
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("프로필 이미지가 변경되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploadingImage(false);
      setCropImageSrc(null);
      setSelectedFile(null);
    }
  };

  // 크롭 모달 닫기
  const handleCropCancel = () => {
    setShowCropModal(false);
    setCropImageSrc(null);
    setSelectedFile(null);
  };

  // 프로필 이미지 삭제 처리
  const handleImageDelete = async () => {
    if (!profileImage) return;

    setIsUploadingImage(true);
    try {
      const res = await fetch("/api/users/profile-image", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("이미지 삭제에 실패했습니다.");
      }

      setProfileImage(null);
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("프로필 이미지가 삭제되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 삭제에 실패했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Google Sheets 연결 저장
  const handleSaveGoogleSheets = () => {
    if (!googleSheetsConfig.spreadsheetId || !googleSheetsConfig.sheetName) {
      toast.error("스프레드시트 ID와 시트 이름을 입력해주세요.");
      return;
    }
    setGoogleSheetsConfig((prev) => ({ ...prev, isConnected: true }));
    setShowGoogleSheetsModal(false);
    toast.success("Google Sheets 연동 설정이 저장되었습니다.");
  };

  // Google Sheets 연결 해제
  const handleDisconnectGoogleSheets = () => {
    setGoogleSheetsConfig({ spreadsheetId: "", sheetName: "", isConnected: false });
    toast.info("Google Sheets 연동이 해제되었습니다.");
  };

  // Slack 연결 저장
  const handleSaveSlack = () => {
    if (!slackConfig.webhookUrl) {
      toast.error("Webhook URL을 입력해주세요.");
      return;
    }
    setSlackConfig((prev) => ({ ...prev, isConnected: true }));
    setShowSlackModal(false);
    toast.success("Slack 연동 설정이 저장되었습니다.");
  };

  // Slack 연결 해제
  const handleDisconnectSlack = () => {
    setSlackConfig({ webhookUrl: "", channel: "", isConnected: false });
    toast.info("Slack 연동이 해제되었습니다.");
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
                  <div className="relative">
                    <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-full flex items-center justify-center overflow-hidden">
                      {profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profileImage}
                          alt="프로필 이미지"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-[var(--primary)]">
                          {session?.user?.name?.charAt(0) || "U"}
                        </span>
                      )}
                    </div>
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      사진 변경
                    </button>
                    {profileImage && (
                      <button
                        onClick={handleImageDelete}
                        disabled={isUploadingImage}
                        className="text-sm text-[var(--danger)] hover:underline"
                      >
                        사진 삭제
                      </button>
                    )}
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
                      <input
                        type="password"
                        className="input w-full"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호 입력"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        새 비밀번호
                      </label>
                      <input
                        type="password"
                        className="input w-full"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호 입력 (최소 4자)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        새 비밀번호 확인
                      </label>
                      <input
                        type="password"
                        className="input w-full"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="새 비밀번호 다시 입력"
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isChangingPassword && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      비밀번호 변경
                    </button>
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
                {/* Google Sheets */}
                <div className={`p-4 rounded-lg border ${googleSheetsConfig.isConnected ? "border-[var(--success)] bg-[var(--success)]/5" : "border-[var(--glass-border)]"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#4285F4]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-[#4285F4]">G</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text-primary)]">Google Sheets</p>
                          {googleSheetsConfig.isConnected && (
                            <span className="badge badge-success text-xs">연결됨</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                          {googleSheetsConfig.isConnected
                            ? `시트: ${googleSheetsConfig.sheetName}`
                            : "발주 데이터 자동 동기화"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {googleSheetsConfig.isConnected && (
                        <button
                          onClick={handleDisconnectGoogleSheets}
                          className="text-sm text-[var(--danger)] hover:underline"
                        >
                          연결 해제
                        </button>
                      )}
                      <button
                        onClick={() => setShowGoogleSheetsModal(true)}
                        className="btn-secondary"
                      >
                        {googleSheetsConfig.isConnected ? "설정" : "연결"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slack */}
                <div className={`p-4 rounded-lg border ${slackConfig.isConnected ? "border-[var(--success)] bg-[var(--success)]/5" : "border-[var(--glass-border)]"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#4A154B]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-[#4A154B]">S</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text-primary)]">Slack</p>
                          {slackConfig.isConnected && (
                            <span className="badge badge-success text-xs">연결됨</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                          {slackConfig.isConnected && slackConfig.channel
                            ? `채널: ${slackConfig.channel}`
                            : "알림 메시지 전송"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {slackConfig.isConnected && (
                        <button
                          onClick={handleDisconnectSlack}
                          className="text-sm text-[var(--danger)] hover:underline"
                        >
                          연결 해제
                        </button>
                      )}
                      <button
                        onClick={() => setShowSlackModal(true)}
                        className="btn-secondary"
                      >
                        {slackConfig.isConnected ? "설정" : "연결"}
                      </button>
                    </div>
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
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-[var(--text-primary)]">{backup.fileName}</p>
                              {backup.checksumValid !== undefined && (
                                backup.checksumValid ? (
                                  <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                                    <CheckCircle className="w-3 h-3" />
                                    검증됨
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-[var(--warning)]">
                                    <AlertTriangle className="w-3 h-3" />
                                    검증 필요
                                  </span>
                                )
                              )}
                              {backup.metadata?.type && (
                                <span className={`badge text-xs ${
                                  backup.metadata.type === "STARTUP" ? "badge-info" :
                                  backup.metadata.type === "SCHEDULED" ? "badge-success" :
                                  backup.metadata.type === "PRE_RESTORE" ? "badge-warning" :
                                  "badge-secondary"
                                }`}>
                                  {backup.metadata.type === "STARTUP" ? "시작" :
                                   backup.metadata.type === "SCHEDULED" ? "자동" :
                                   backup.metadata.type === "PRE_RESTORE" ? "복원전" :
                                   backup.metadata.type === "manual" ? "수동" : backup.metadata.type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(backup.createdAt).toLocaleString("ko-KR")}
                              </span>
                              <span>{backup.sizeFormatted}</span>
                              {backup.metadata?.recordCounts?.total && (
                                <span>{backup.metadata.recordCounts.total.toLocaleString()} 레코드</span>
                              )}
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

      {/* Google Sheets 연동 모달 */}
      <Modal
        isOpen={showGoogleSheetsModal}
        onClose={() => setShowGoogleSheetsModal(false)}
        title="Google Sheets 연동"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[var(--info)]/10 text-sm">
            <p className="text-[var(--text-primary)]">
              Google Sheets와 연동하면 발주 데이터를 자동으로 동기화할 수 있습니다.
            </p>
            <a
              href="https://developers.google.com/sheets/api/quickstart/js"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline mt-2"
            >
              API 설정 가이드
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              스프레드시트 ID
            </label>
            <input
              type="text"
              value={googleSheetsConfig.spreadsheetId}
              onChange={(e) =>
                setGoogleSheetsConfig((prev) => ({ ...prev, spreadsheetId: e.target.value }))
              }
              className="input w-full"
              placeholder="예: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              URL에서 /d/ 다음에 있는 값입니다.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              시트 이름
            </label>
            <input
              type="text"
              value={googleSheetsConfig.sheetName}
              onChange={(e) =>
                setGoogleSheetsConfig((prev) => ({ ...prev, sheetName: e.target.value }))
              }
              className="input w-full"
              placeholder="예: 발주목록"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={() => setShowGoogleSheetsModal(false)}
              className="btn-secondary"
            >
              취소
            </button>
            <button onClick={handleSaveGoogleSheets} className="btn-primary">
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* Slack 연동 모달 */}
      <Modal
        isOpen={showSlackModal}
        onClose={() => setShowSlackModal(false)}
        title="Slack 연동"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[var(--info)]/10 text-sm">
            <p className="text-[var(--text-primary)]">
              Slack Webhook을 설정하면 중요 알림을 Slack 채널로 전송할 수 있습니다.
            </p>
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline mt-2"
            >
              Webhook 생성 가이드
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Webhook URL
            </label>
            <input
              type="text"
              value={slackConfig.webhookUrl}
              onChange={(e) =>
                setSlackConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))
              }
              className="input w-full"
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              채널 이름 (선택)
            </label>
            <input
              type="text"
              value={slackConfig.channel}
              onChange={(e) =>
                setSlackConfig((prev) => ({ ...prev, channel: e.target.value }))
              }
              className="input w-full"
              placeholder="예: #inventory-alerts"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              기본 채널 대신 다른 채널로 전송하려면 입력하세요.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={() => setShowSlackModal(false)}
              className="btn-secondary"
            >
              취소
            </button>
            <button onClick={handleSaveSlack} className="btn-primary">
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* 이미지 크롭 모달 */}
      <Modal
        isOpen={showCropModal}
        onClose={handleCropCancel}
        title="프로필 이미지 편집"
        size="lg"
      >
        <div className="space-y-4">
          {cropImageSrc && (
            <>
              <div className="relative w-full h-80 bg-black rounded-lg overflow-hidden">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* 줌 컨트롤 */}
              <div className="flex items-center gap-4 px-4">
                <ZoomOut className="w-5 h-5 text-[var(--text-muted)]" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-[var(--gray-200)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
                <ZoomIn className="w-5 h-5 text-[var(--text-muted)]" />
              </div>

              <p className="text-sm text-[var(--text-muted)] text-center">
                이미지를 드래그하여 위치를 조정하고, 슬라이더로 확대/축소하세요.
              </p>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)]">
            <button onClick={handleCropCancel} className="btn-secondary">
              취소
            </button>
            <button
              onClick={handleCropAndUpload}
              disabled={isUploadingImage}
              className="btn-primary flex items-center gap-2"
            >
              {isUploadingImage && <Loader2 className="w-4 h-4 animate-spin" />}
              적용
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

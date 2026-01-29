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
  Settings,
  History,
  Cloud,
  CloudOff,
  ToggleLeft,
  ToggleRight,
  Activity,
  Timer,
  Archive,
  GitCompare,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import UploadLogsContent from "@/components/settings/UploadLogsContent";
import { usePermission } from "@/hooks/usePermission";

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

interface BackupSettings {
  id: number;
  autoBackupEnabled: boolean;
  backupFrequency: string;
  backupTime: string;
  retentionDays: number;
  maxBackupCount: number;
  cloudBackupEnabled: boolean;
  cloudProvider: string | null;
  encryptionEnabled: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  slackWebhookUrl: string | null;
  diskThresholdGb: number;
}

interface BackupHistoryItem {
  id: number;
  fileName: string;
  fileSize: number;
  backupType: string;
  status: string;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface DiskUsage {
  backup: {
    totalSize: number;
    totalSizeFormatted: string;
    fileCount: number;
    oldestBackup: { name: string; date: string } | null;
    newestBackup: { name: string; date: string } | null;
  };
  data: {
    totalSize: number;
    totalSizeFormatted: string;
  };
  threshold: {
    limitGb: number;
    isOverThreshold: boolean;
    usagePercent: number;
  };
}

const baseSections: SettingsSection[] = [
  { id: "profile", title: "프로필", icon: User },
  { id: "language", title: "언어 설정", icon: Globe },
  { id: "notifications", title: "알림 설정", icon: Bell },
];

// ADMIN 전용 섹션 (외부 연동)
const adminOnlySections: SettingsSection[] = [
  { id: "integrations", title: "외부 연동", icon: Link },
];

const backupSections: SettingsSection[] = [
  { id: "system", title: "시스템", icon: Database },
  { id: "upload-logs", title: "업로드 로그", icon: Upload },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [activeSection, setActiveSection] = useState("profile");

  // ADMIN만 외부 연동 섹션 표시
  const isAdmin = session?.user?.role === "ADMIN";
  // 백업 권한이 있는 사용자만 시스템/업로드 로그 섹션 표시
  const canViewBackup = can("backup", "view");
  const sections = [
    ...baseSections,
    ...(isAdmin ? adminOnlySections : []),
    ...(canViewBackup ? backupSections : []),
  ];
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
  const [showBackupSettingsModal, setShowBackupSettingsModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareBackup, setCompareBackup] = useState<string | null>(null);

  // 비밀번호 변경 상태
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 프로필 폼 상태
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileDepartment, setProfileDepartment] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

  // 프로필 데이터 초기화
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || "");
      setProfileEmail(userProfile.email || "");
      setProfileDepartment(userProfile.department || "");
      if (userProfile.profileImage) {
        setProfileImage(userProfile.profileImage);
      }
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
  const { data: backupData, isLoading: backupsLoading, error: backupsError } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "백업 목록을 불러오는데 실패했습니다.");
      }
      return res.json();
    },
    enabled: activeSection === "system",
    retry: false,
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

  // 백업 설정 조회
  const { data: backupSettingsData, isLoading: settingsLoading } = useQuery<{
    settings: BackupSettings;
    history: BackupHistoryItem[];
    diskUsage: DiskUsage;
  }>({
    queryKey: ["backupSettings"],
    queryFn: async () => {
      const res = await fetch("/api/backup/settings");
      if (!res.ok) throw new Error("Failed to fetch backup settings");
      return res.json();
    },
    enabled: activeSection === "system",
  });

  // 백업 비교 데이터 조회
  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ["backupCompare", compareBackup],
    queryFn: async () => {
      const res = await fetch(`/api/backup/compare?fileName=${compareBackup}`);
      if (!res.ok) throw new Error("Failed to compare");
      return res.json();
    },
    enabled: !!compareBackup && showCompareModal,
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

  // 백업 설정 업데이트
  const updateBackupSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<BackupSettings>) => {
      const res = await fetch("/api/backup/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Settings update failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("백업 설정이 저장되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["backupSettings"] });
    },
    onError: () => {
      toast.error("설정 저장에 실패했습니다.");
    },
  });

  // 프로필 저장
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail || null,
          department: profileDepartment || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "프로필 저장에 실패했습니다.");
      }

      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("프로필이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
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
        {activeSection === "profile" && (
          <button
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="btn-primary flex items-center gap-2"
          >
            {isSavingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            저장
          </button>
        )}
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
                      이름 <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="input w-full"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      아이디
                    </label>
                    <input
                      type="text"
                      value={session?.user?.username || ""}
                      className="input w-full bg-[var(--gray-100)]"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="input w-full"
                      placeholder="이메일을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      부서
                    </label>
                    <input
                      type="text"
                      value={profileDepartment}
                      onChange={(e) => setProfileDepartment(e.target.value)}
                      className="input w-full"
                      placeholder="부서를 입력하세요"
                    />
                  </div>
                </div>

                {/* 비밀번호 변경 */}
                <div className="pt-6 border-t border-[var(--glass-border)]">
                  <h3 className="font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    비밀번호 변경
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="btn-primary flex items-center gap-2 mt-4"
                  >
                    {isChangingPassword && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    비밀번호 변경
                  </button>
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

          {/* Integrations Section - ADMIN only */}
          {activeSection === "integrations" && isAdmin && (
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

              {/* 백업 설정 및 상태 대시보드 */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    백업 설정 및 현황
                  </h2>
                  <button
                    onClick={() => setShowBackupSettingsModal(true)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    상세 설정
                  </button>
                </div>

                {settingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : backupSettingsData ? (
                  <div className="space-y-6">
                    {/* 상태 카드 그리드 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 자동 백업 상태 */}
                      <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-[var(--text-muted)]">자동 백업</span>
                          <button
                            onClick={() => updateBackupSettingsMutation.mutate({
                              autoBackupEnabled: !backupSettingsData.settings.autoBackupEnabled
                            })}
                            disabled={updateBackupSettingsMutation.isPending}
                            className="text-[var(--primary)]"
                          >
                            {backupSettingsData.settings.autoBackupEnabled ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-[var(--text-muted)]" />
                            )}
                          </button>
                        </div>
                        <p className={`text-sm font-medium ${backupSettingsData.settings.autoBackupEnabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                          {backupSettingsData.settings.autoBackupEnabled ? '활성화됨' : '비활성화'}
                        </p>
                        {backupSettingsData.settings.autoBackupEnabled && (
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {backupSettingsData.settings.backupFrequency === 'HOURLY' ? '매시간' :
                             backupSettingsData.settings.backupFrequency === 'DAILY' ? '매일' : '매주'}
                            {' '}{backupSettingsData.settings.backupTime}
                          </p>
                        )}
                      </div>

                      {/* 백업 파일 수 */}
                      <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Archive className="w-4 h-4 text-[var(--primary)]" />
                          <span className="text-sm text-[var(--text-muted)]">백업 파일</span>
                        </div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {backupSettingsData.diskUsage.backup.fileCount}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          최대 {backupSettingsData.settings.maxBackupCount}개 보관
                        </p>
                      </div>

                      {/* 디스크 사용량 */}
                      <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive className="w-4 h-4 text-[var(--info)]" />
                          <span className="text-sm text-[var(--text-muted)]">백업 용량</span>
                        </div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {backupSettingsData.diskUsage.backup.totalSizeFormatted}
                        </p>
                        <div className="mt-2">
                          <div className="w-full h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                backupSettingsData.diskUsage.threshold.isOverThreshold
                                  ? 'bg-[var(--danger)]'
                                  : backupSettingsData.diskUsage.threshold.usagePercent > 80
                                    ? 'bg-[var(--warning)]'
                                    : 'bg-[var(--success)]'
                              }`}
                              style={{ width: `${Math.min(backupSettingsData.diskUsage.threshold.usagePercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {backupSettingsData.diskUsage.threshold.usagePercent}% / {backupSettingsData.diskUsage.threshold.limitGb}GB
                          </p>
                        </div>
                      </div>

                      {/* 클라우드 백업 */}
                      <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          {backupSettingsData.settings.cloudBackupEnabled ? (
                            <Cloud className="w-4 h-4 text-[var(--success)]" />
                          ) : (
                            <CloudOff className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                          <span className="text-sm text-[var(--text-muted)]">클라우드</span>
                        </div>
                        <p className={`text-sm font-medium ${backupSettingsData.settings.cloudBackupEnabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                          {backupSettingsData.settings.cloudBackupEnabled
                            ? 'R2 연결됨'
                            : '미설정'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {backupSettingsData.settings.encryptionEnabled ? '암호화 활성' : '암호화 비활성'}
                        </p>
                      </div>
                    </div>

                    {/* 최근 백업 히스토리 */}
                    {backupSettingsData.history.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                          <History className="w-4 h-4" />
                          최근 백업 이력
                        </h3>
                        <div className="space-y-2">
                          {backupSettingsData.history.slice(0, 5).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-[var(--gray-50)] border border-[var(--gray-200)]"
                            >
                              <div className="flex items-center gap-3">
                                {item.status === 'COMPLETED' ? (
                                  <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                                ) : item.status === 'FAILED' ? (
                                  <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
                                ) : (
                                  <Loader2 className="w-4 h-4 text-[var(--info)] animate-spin" />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">
                                    {item.fileName}
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {new Date(item.createdAt).toLocaleString('ko-KR')}
                                    {item.duration && ` · ${item.duration}ms`}
                                  </p>
                                </div>
                              </div>
                              <span className={`badge text-xs ${
                                item.backupType === 'STARTUP' ? 'badge-info' :
                                item.backupType === 'SCHEDULED' ? 'badge-success' :
                                item.backupType === 'PRE_RESTORE' ? 'badge-warning' :
                                'badge-secondary'
                              }`}>
                                {item.backupType === 'STARTUP' ? '시작' :
                                 item.backupType === 'SCHEDULED' ? '자동' :
                                 item.backupType === 'PRE_RESTORE' ? '복원전' :
                                 item.backupType === 'MANUAL' ? '수동' : item.backupType}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 백업 관리 */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    백업 파일 목록
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
                ) : backupsError ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-[var(--warning)]" />
                    <p className="text-[var(--text-secondary)]">
                      {backupsError instanceof Error ? backupsError.message : "백업 목록을 불러오는데 실패했습니다."}
                    </p>
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["backups"] })}
                      className="mt-3 text-sm text-[var(--primary)] hover:underline"
                    >
                      다시 시도
                    </button>
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
                            onClick={() => {
                              setCompareBackup(backup.fileName);
                              setShowCompareModal(true);
                            }}
                            className="p-2 hover:bg-[var(--gray-100)] rounded-lg transition-colors"
                            title="현재 DB와 비교"
                          >
                            <GitCompare className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
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

          {/* Upload Logs Section */}
          {activeSection === "upload-logs" && <UploadLogsContent />}
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

      {/* 백업 상세 설정 모달 */}
      <Modal
        isOpen={showBackupSettingsModal}
        onClose={() => setShowBackupSettingsModal(false)}
        title="백업 상세 설정"
        size="lg"
      >
        {backupSettingsData?.settings && (
          <div className="space-y-6">
            {/* 자동 백업 설정 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Timer className="w-4 h-4" />
                자동 백업 설정
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    백업 주기
                  </label>
                  <select
                    className="input w-full"
                    value={backupSettingsData.settings.backupFrequency}
                    onChange={(e) => updateBackupSettingsMutation.mutate({ backupFrequency: e.target.value })}
                  >
                    <option value="HOURLY">매시간</option>
                    <option value="DAILY">매일</option>
                    <option value="WEEKLY">매주</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    백업 시간
                  </label>
                  <input
                    type="time"
                    className="input w-full"
                    value={backupSettingsData.settings.backupTime}
                    onChange={(e) => updateBackupSettingsMutation.mutate({ backupTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    보관 기간 (일)
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={backupSettingsData.settings.retentionDays}
                    onChange={(e) => updateBackupSettingsMutation.mutate({ retentionDays: parseInt(e.target.value) })}
                    min={1}
                    max={365}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    최대 백업 수
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={backupSettingsData.settings.maxBackupCount}
                    onChange={(e) => updateBackupSettingsMutation.mutate({ maxBackupCount: parseInt(e.target.value) })}
                    min={1}
                    max={100}
                  />
                </div>
              </div>
            </div>

            {/* 클라우드 백업 설정 */}
            <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                클라우드 백업
              </h3>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">클라우드 백업 활성화</p>
                  <p className="text-sm text-[var(--text-muted)]">Cloudflare R2로 백업 (10GB 무료)</p>
                </div>
                <button
                  onClick={() => updateBackupSettingsMutation.mutate({
                    cloudBackupEnabled: !backupSettingsData.settings.cloudBackupEnabled
                  })}
                  disabled={updateBackupSettingsMutation.isPending}
                  className="text-[var(--primary)]"
                >
                  {backupSettingsData.settings.cloudBackupEnabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>

              {backupSettingsData.settings.cloudBackupEnabled && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[var(--info-50)] border border-[var(--info-200)]">
                    <p className="text-sm font-medium text-[var(--info-700)]">Cloudflare R2 설정 필요</p>
                    <p className="text-xs text-[var(--info-600)] mt-1">
                      환경 변수에 R2 인증 정보를 설정해야 합니다:
                    </p>
                    <ul className="text-xs text-[var(--info-600)] mt-2 space-y-1 font-mono">
                      <li>• R2_ACCOUNT_ID</li>
                      <li>• R2_ACCESS_KEY_ID</li>
                      <li>• R2_SECRET_ACCESS_KEY</li>
                      <li>• R2_BUCKET_NAME</li>
                    </ul>
                  </div>
                  <input
                    type="hidden"
                    value="r2"
                    onChange={(e) => updateBackupSettingsMutation.mutate({ cloudProvider: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* 암호화 및 알림 설정 */}
            <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-4 h-4" />
                보안 및 알림
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">백업 암호화</p>
                    <p className="text-sm text-[var(--text-muted)]">AES-256-GCM 암호화 적용</p>
                  </div>
                  <button
                    onClick={() => updateBackupSettingsMutation.mutate({
                      encryptionEnabled: !backupSettingsData.settings.encryptionEnabled
                    })}
                    disabled={updateBackupSettingsMutation.isPending}
                    className="text-[var(--primary)]"
                  >
                    {backupSettingsData.settings.encryptionEnabled ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">성공 알림</p>
                    <p className="text-sm text-[var(--text-muted)]">백업 성공 시 Slack 알림</p>
                  </div>
                  <button
                    onClick={() => updateBackupSettingsMutation.mutate({
                      notifyOnSuccess: !backupSettingsData.settings.notifyOnSuccess
                    })}
                    disabled={updateBackupSettingsMutation.isPending}
                    className="text-[var(--primary)]"
                  >
                    {backupSettingsData.settings.notifyOnSuccess ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">실패 알림</p>
                    <p className="text-sm text-[var(--text-muted)]">백업 실패 시 Slack 알림</p>
                  </div>
                  <button
                    onClick={() => updateBackupSettingsMutation.mutate({
                      notifyOnFailure: !backupSettingsData.settings.notifyOnFailure
                    })}
                    disabled={updateBackupSettingsMutation.isPending}
                    className="text-[var(--primary)]"
                  >
                    {backupSettingsData.settings.notifyOnFailure ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 디스크 임계값 설정 */}
            <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                디스크 관리
              </h3>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  디스크 사용량 임계값 (GB)
                </label>
                <input
                  type="number"
                  className="input w-full max-w-xs"
                  value={backupSettingsData.settings.diskThresholdGb}
                  onChange={(e) => updateBackupSettingsMutation.mutate({ diskThresholdGb: parseInt(e.target.value) })}
                  min={1}
                  max={100}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  이 용량을 초과하면 경고가 표시됩니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setShowBackupSettingsModal(false)}
                className="btn-primary"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 백업 비교 모달 */}
      <Modal
        isOpen={showCompareModal}
        onClose={() => {
          setShowCompareModal(false);
          setCompareBackup(null);
        }}
        title="백업 비교"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <GitCompare className="w-4 h-4" />
            현재 DB와 <span className="font-mono text-[var(--primary)]">{compareBackup}</span> 백업을 비교합니다.
          </div>

          {compareLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : compareData ? (
            <div className="space-y-4">
              {/* 요약 통계 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-[var(--success-50)] border border-[var(--success)]/20">
                  <p className="text-sm text-[var(--text-muted)]">추가됨</p>
                  <p className="text-2xl font-bold text-[var(--success)]">
                    +{compareData.summary?.totalAdded || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--warning-50)] border border-[var(--warning)]/20">
                  <p className="text-sm text-[var(--text-muted)]">수정됨</p>
                  <p className="text-2xl font-bold text-[var(--warning)]">
                    ~{compareData.summary?.totalModified || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--danger-50)] border border-[var(--danger)]/20">
                  <p className="text-sm text-[var(--text-muted)]">삭제됨</p>
                  <p className="text-2xl font-bold text-[var(--danger)]">
                    -{compareData.summary?.totalDeleted || 0}
                  </p>
                </div>
              </div>

              {/* 테이블별 변경 내역 */}
              {compareData.differences && Object.keys(compareData.differences).length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-medium text-[var(--text-secondary)]">테이블별 변경 내역</h4>
                  {Object.entries(compareData.differences).map(([table, diff]: [string, unknown]) => {
                    const tableDiff = diff as { added?: number; modified?: number; deleted?: number };
                    return (
                      <div
                        key={table}
                        className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]"
                      >
                        <span className="font-mono text-sm text-[var(--text-primary)]">{table}</span>
                        <div className="flex items-center gap-3 text-sm">
                          {tableDiff.added !== undefined && tableDiff.added > 0 && (
                            <span className="text-[var(--success)]">+{tableDiff.added}</span>
                          )}
                          {tableDiff.modified !== undefined && tableDiff.modified > 0 && (
                            <span className="text-[var(--warning)]">~{tableDiff.modified}</span>
                          )}
                          {tableDiff.deleted !== undefined && tableDiff.deleted > 0 && (
                            <span className="text-[var(--danger)]">-{tableDiff.deleted}</span>
                          )}
                          {(tableDiff.added === 0 || tableDiff.added === undefined) &&
                           (tableDiff.modified === 0 || tableDiff.modified === undefined) &&
                           (tableDiff.deleted === 0 || tableDiff.deleted === undefined) && (
                            <span className="text-[var(--text-muted)]">변경 없음</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[var(--success)]" />
                  <p>현재 DB와 백업 파일이 동일합니다.</p>
                </div>
              )}

              {/* 메타 정보 */}
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[var(--text-muted)]">현재 DB 레코드</p>
                    <p className="font-mono text-[var(--text-primary)]">
                      {compareData.current?.totalRecords?.toLocaleString() || 0}개
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">백업 DB 레코드</p>
                    <p className="font-mono text-[var(--text-primary)]">
                      {compareData.backup?.totalRecords?.toLocaleString() || 0}개
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              비교 데이터를 불러올 수 없습니다.
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={() => {
                setShowCompareModal(false);
                setCompareBackup(null);
              }}
              className="btn-primary"
            >
              닫기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

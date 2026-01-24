"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Bell,
  Database,
  Shield,
  Link,
  Save,
  Globe,
} from "lucide-react";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
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
  const [activeSection, setActiveSection] = useState("profile");
  const [language, setLanguage] = useState("ko");
  const [notifications, setNotifications] = useState({
    email: true,
    lowStock: true,
    orderStatus: true,
    mrpAlerts: false,
  });

  const handleSave = () => {
    // TODO: Implement settings save
    console.log("Save settings");
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
        <div className="lg:col-span-3">
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
                  { key: "lowStock", label: "저재고 알림", desc: "부품 재고가 안전재고 이하일 때 알림을 받습니다." },
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
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                시스템 정보
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">버전</p>
                    <p className="font-medium text-[var(--text-primary)]">2.0.0</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">프레임워크</p>
                    <p className="font-medium text-[var(--text-primary)]">Next.js 15</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">데이터베이스</p>
                    <p className="font-medium text-[var(--text-primary)]">SQLite + Prisma</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--glass-bg)]">
                    <p className="text-sm text-[var(--text-muted)]">마지막 업데이트</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {new Date().toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--glass-border)]">
                  <h3 className="font-medium text-[var(--text-primary)] mb-4">데이터 관리</h3>
                  <div className="flex gap-4">
                    <button className="btn-secondary">데이터 백업</button>
                    <button className="btn-secondary">데이터 복원</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

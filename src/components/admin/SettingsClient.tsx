"use client";

import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { Toast } from "@/components/Toast";
import { adminFetch } from "@/lib/admin-fetch";

interface SettingRow {
  key: string;
  source: "settings" | "env" | "none";
  maskedValue: string;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "editor" | "contributor" | "reader";
  active: boolean;
}

const SETTING_LABELS: Record<string, string> = {
  GEMINI_API_KEYS: "Gemini API Keys (pisahkan dengan koma)",
  GEMINI_MODEL_PRIMARY: "Gemini Model Utama",
  GEMINI_MODEL_FALLBACK: "Gemini Model Fallback",
  OPENROUTER_API_KEY: "OpenRouter API Key",
};

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor">("editor");
  const [creatingUser, setCreatingUser] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadSettings() {
    const res = await adminFetch("/api/admin/settings");
    const body = await res.json().catch(() => null);
    if (res.ok) setSettings(body.data);
  }

  async function loadUsers() {
    const res = await adminFetch("/api/admin/users");
    const body = await res.json().catch(() => null);
    if (res.ok) setUsers(body.data);
  }

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  async function saveSetting(key: string) {
    const value = drafts[key]?.trim();
    if (!value) return;
    setSavingKey(key);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        showToast("Pengaturan disimpan.");
        setDrafts((d) => ({ ...d, [key]: "" }));
        loadSettings();
      } else {
        const body = await res.json().catch(() => null);
        showToast(body?.error?.message ?? "Gagal menyimpan.");
      }
    } catch {
      showToast("Gagal menyimpan. Periksa koneksi Anda.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newDisplayName || undefined, role: newRole }),
      });
      if (res.ok) {
        showToast("Akun dibuat.");
        setNewEmail("");
        setNewPassword("");
        setNewDisplayName("");
        setNewRole("editor");
        loadUsers();
      } else {
        const body = await res.json().catch(() => null);
        showToast(body?.error?.message ?? "Gagal membuat akun.");
      }
    } catch {
      showToast("Gagal membuat akun. Periksa koneksi Anda.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setTogglingId(id);
    try {
      const res = await adminFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (res.ok) {
        loadUsers();
      } else {
        const body = await res.json().catch(() => null);
        showToast(body?.error?.message ?? "Gagal mengubah status akun.");
      }
    } catch {
      showToast("Gagal mengubah status akun.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted">Hanya admin yang bisa mengubah pengaturan ini.</p>

      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Pengaturan API LLM</h2>
        <p className="mt-1 text-xs text-muted">
          Nilai lama ditampilkan termasking. Kosongkan kotak kalau tidak ingin mengubah — hanya field yang diisi yang disimpan.
        </p>
        <div className="mt-3 space-y-3">
          {settings === null ? (
            <p className="text-sm text-muted">Memuat...</p>
          ) : (
            settings.map((s) => (
              <div key={s.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    {SETTING_LABELS[s.key] ?? s.key}{" "}
                    <span className="text-muted">
                      ({s.source === "settings" ? "dari Settings" : s.source === "env" ? "dari .env" : "belum diisi"}
                      {s.maskedValue ? `: ${s.maskedValue}` : ""})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={drafts[s.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                    placeholder="Nilai baru..."
                    className="w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={() => saveSetting(s.key)}
                  disabled={savingKey === s.key || !drafts[s.key]?.trim()}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingKey === s.key ? "..." : "Simpan"}
                </button>
              </div>
            ))
          )}
        </div>
      </AdminCard>

      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Manajemen Pengguna</h2>

        <div className="mt-3">
          {users === null ? (
            <p className="text-sm text-muted">Memuat...</p>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      {u.email} <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs capitalize text-muted">{u.role}</span>
                    </p>
                    {u.displayName ? <p className="text-xs text-muted">{u.displayName}</p> : null}
                  </div>
                  <button
                    onClick={() => toggleActive(u.id, !u.active)}
                    disabled={togglingId === u.id}
                    className={`rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                      u.active ? "border-border text-foreground hover:bg-background" : "border-accent text-accent hover:bg-accent/10"
                    }`}
                  >
                    {togglingId === u.id ? "..." : u.active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleCreateUser} className="mt-4 space-y-3 rounded-lg border border-dashed border-border p-3 text-sm">
          <p className="text-sm font-medium text-foreground">Buat akun baru</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full rounded border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Password awal</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nama (opsional)</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full rounded border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "editor")} className="w-full rounded border border-border px-2 py-1.5 text-sm">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creatingUser}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {creatingUser ? "Membuat..." : "Buat Akun"}
          </button>
        </form>
      </AdminCard>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

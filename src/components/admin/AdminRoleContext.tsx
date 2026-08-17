"use client";

import { createContext, useContext } from "react";

/// Meneruskan role staf (admin/editor) dari session server ke komponen client bersarang
/// (PaperListClient, PaperAdminDetail, dst) TANPA fetch tambahan — dipasang sekali di
/// (protected)/layout.tsx membungkus {children}.
const AdminRoleContext = createContext<string | null>(null);

export function AdminRoleProvider({ role, children }: { role: string; children: React.ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole(): string | null {
  return useContext(AdminRoleContext);
}

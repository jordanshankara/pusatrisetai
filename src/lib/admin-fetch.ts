/// Pembungkus fetch untuk panggilan admin — kalau sesi kedaluwarsa (401), arahkan ke
/// /admin/login alih-alih cuma menampilkan toast generik "gagal simpan" yang membingungkan
/// (staf mengira ada bug, padahal cuma perlu login ulang). Dipakai di komponen client admin
/// sebagai pengganti langsung `fetch()` biasa.
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
  }
  return res;
}

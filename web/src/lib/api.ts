let activeTrip = "";
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export function setActiveTrip(id: string) {
  activeTrip = id;
}

export function apiBase() {
  return API_BASE;
}

export function apiUrl(path: string) {
  const scoped =
    /^\/(trip$|expenses|receipts|documents|packing|events|preparation|invites)/.test(
      path,
    );
  if (scoped) {
    if (!activeTrip) throw new Error("请先选择行程");
    return `${API_BASE}/api/trips/${activeTrip}${path === "/trip" ? "/data" : path}`;
  }
  return `${API_BASE}/api${path}`;
}

export function fileUrl(id: string, download = false) {
  return `${API_BASE}/api/files/${id}${download ? "?download=1" : ""}`;
}

export function avatarUrl(id: string, version?: number) {
  return `${API_BASE}/api/avatars/${encodeURIComponent(id)}?v=${version ?? 0}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  resolvedUrl?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(resolvedUrl ?? apiUrl(path), {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("网络连接失败，请检查网络后重试", 0);
  }
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.error ?? "操作失败，请重试", response.status);
  return data;
}

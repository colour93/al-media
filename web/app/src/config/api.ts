/** API 基础地址，开发时通过 rsbuild 代理 /api 到后端 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
export const COMMON_API = `${API_BASE}/common`;
export const ADMIN_API = `${API_BASE}/admin`;
export const AUTH_API = `${API_BASE}/auth`;

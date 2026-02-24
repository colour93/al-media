/** API 基础地址，开发时如需代理可在 rsbuild 配置 dev.proxy */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
export const ADMIN_API = `${API_BASE}/admin`;
export const AUTH_API = `${API_BASE}/auth`;

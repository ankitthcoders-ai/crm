import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@crm/shared';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (err: unknown) => void;
}> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(api(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const newAccessToken = data.data?.accessToken;
        const newRefreshToken = data.data?.refreshToken;
        if (newAccessToken) localStorage.setItem('accessToken', newAccessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);

        failedQueue.forEach((prom) => prom.resolve());
        failedQueue = [];

        if (originalRequest.headers && newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        failedQueue.forEach((prom) => prom.reject(refreshError));
        failedQueue = [];
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> };
    if (data?.errors) {
      const details = Object.values(data.errors)
        .flat()
        .join(', ');
      return details || data.message || 'Validation failed';
    }
    return data?.message || error.message || 'Something went wrong';
  }
  return 'Something went wrong';
}

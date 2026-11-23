import axios from 'axios';
import { showToast } from './alerts';

// Ambil base URL endpoint dari environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Axios instance terkonfigurasi untuk Pegadaian Smart Vault
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor:
 * Otomatis menyematkan Authorization Bearer Token dari localStorage di setiap request
 */
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pegadaian_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor:
 * Menangani respon sukses dan sentralisasi penanganan error seperti token kedaluwarsa (401),
 * izin ditolak (403), atau server error.
 */
apiClient.interceptors.response.use(
  (response) => {
    // Kembalikan data dari API jika berformat standar { success: true, ... }
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || error.message || 'Terjadi kesalahan pada server';

      // Jika sesi login expired atau unauthorized
      if (status === 401 && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
          localStorage.removeItem('pegadaian_token');
          localStorage.removeItem('pegadaian_user');
          showToast.error('Sesi login telah kedaluwarsa. Silakan login kembali.');
          window.location.href = '/login';
        }
      }

      // Jika role akses ditolak
      if (status === 403) {
        showToast.error(message || 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.');
      }

      const customError = new Error(message);
      customError.status = status;
      customError.data = data;
      return Promise.reject(customError);
    } else if (error.request) {
      const networkError = new Error('Gagal terhubung ke server backend API. Pastikan service backend aktif.');
      return Promise.reject(networkError);
    }

    return Promise.reject(error);
  }
);

/**
 * Wrapper seragam apiRequest menggunakan Axios
 * Mendukung kompatibilitas signature: apiRequest(endpoint, { method, body/data, params, headers })
 */
export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const data = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : options.data;

  return apiClient.request({
    url: endpoint,
    method,
    data,
    params: options.params,
    headers: options.headers,
  });
}

export default apiClient;

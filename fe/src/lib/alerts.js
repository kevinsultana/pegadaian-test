import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

/**
 * Custom styled SweetAlert2 theme matching Pegadaian Vault Dark Enterprise Theme
 */
export const VaultSwal = Swal.mixin({
  background: '#0f172a', // Slate 900
  color: '#f8fafc',      // Slate 50
  confirmButtonColor: '#10b981', // Emerald 500
  cancelButtonColor: '#334155',  // Slate 700
  customClass: {
    popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur font-sans',
    title: 'text-lg font-bold text-white',
    htmlContainer: 'text-xs text-slate-300',
    confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-emerald-500 hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-400',
    cancelButton: 'px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700',
  },
  buttonsStyling: true,
});

/**
 * Confirmation dialog helper
 * @param {string} title - Judul konfirmasi
 * @param {string} text - Penjelasan
 * @param {string} confirmText - Teks tombol konfirmasi
 * @returns {Promise<boolean>}
 */
export const confirmAction = async (
  title = 'Konfirmasi Aksi',
  text = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan'
) => {
  const result = await VaultSwal.fire({
    title,
    text,
    icon: 'warning',
    iconColor: '#f59e0b',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Batal',
    reverseButtons: true,
  });

  return result.isConfirmed;
};

/**
 * SweetAlert Success Popup
 */
export const alertSuccess = (title = 'Berhasil!', text = '') => {
  return VaultSwal.fire({
    title,
    text,
    icon: 'success',
    iconColor: '#10b981',
    timer: 2500,
    showConfirmButton: false,
  });
};

/**
 * SweetAlert Error Popup
 */
export const alertError = (title = 'Terjadi Kesalahan', text = '') => {
  return VaultSwal.fire({
    title,
    text,
    icon: 'error',
    iconColor: '#ef4444',
    confirmButtonText: 'Mengerti',
  });
};

/**
 * React Hot Toast Helpers with consistent styling
 */
export const showToast = {
  success: (msg) =>
    toast.success(msg, {
      style: {
        background: '#0f172a',
        color: '#f8fafc',
        border: '1px solid #10b981',
        fontSize: '13px',
      },
      iconTheme: {
        primary: '#10b981',
        secondary: '#0f172a',
      },
    }),

  error: (msg) =>
    toast.error(msg, {
      style: {
        background: '#0f172a',
        color: '#f8fafc',
        border: '1px solid #ef4444',
        fontSize: '13px',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#0f172a',
      },
    }),

  loading: (msg) =>
    toast.loading(msg, {
      style: {
        background: '#0f172a',
        color: '#f8fafc',
        border: '1px solid #3b82f6',
        fontSize: '13px',
      },
    }),

  dismiss: (id) => toast.dismiss(id),
};

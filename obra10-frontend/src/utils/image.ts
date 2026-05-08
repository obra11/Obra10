export const getImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseURL = import.meta.env.VITE_API_URL ?? '';
  return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
};

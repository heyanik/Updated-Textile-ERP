export function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);

  try {
    if (typeof navigator !== "undefined" && "msSaveBlob" in navigator) {
      const msSaveBlob = (navigator as Navigator & { msSaveBlob?: (blob: Blob, filename: string) => void }).msSaveBlob;
      if (msSaveBlob) {
        msSaveBlob(blob, filename);
        return;
      }
    }

    link.click();
  } finally {
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

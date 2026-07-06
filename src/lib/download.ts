export async function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const mimeType = blob.type || "application/octet-stream";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const payload = btoa(binary);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/download";
  form.style.display = "none";

  const filenameInput = document.createElement("input");
  filenameInput.name = "filename";
  filenameInput.value = filename;
  form.appendChild(filenameInput);

  const mimeTypeInput = document.createElement("input");
  mimeTypeInput.name = "mimeType";
  mimeTypeInput.value = mimeType;
  form.appendChild(mimeTypeInput);

  const contentInput = document.createElement("input");
  contentInput.name = "content";
  contentInput.value = payload;
  form.appendChild(contentInput);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

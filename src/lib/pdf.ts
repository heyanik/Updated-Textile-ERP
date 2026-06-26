import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo.png";

export const COMPANY_NAME = "Textile Printing Co.";

export async function loadLogoDataUrl(): Promise<string> {
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export function newDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

export { autoTable };

/** Draw a faded centered logo as a watermark background. */
export function drawWatermark(doc: jsPDF, logoDataUrl: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const size = 300;

  // Save the current graphics state (so opacity doesn't leak to text or other images)
  doc.saveGraphicsState();

  // Set the global alpha / opacity (0.0 to 1.0)
  // 0.08 gives a nice, subtle faded look without hiding the text over it
  doc.setGState(new (doc.GState as any)({ opacity: 0.08 }));

  // Draw the faded watermark logo in the center
  doc.addImage(logoDataUrl, "PNG", (w - size) / 2, (h - size) / 2, size, size);

  // Restore back to original settings (100% opacity for everything else)
  doc.restoreGraphicsState();
}
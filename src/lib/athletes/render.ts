// Canvas renderer. Draws the whole graphic at the export format's real pixel
// size, so the on-screen preview and the exported file come from exactly the
// same code path — what you see is what gets published.

import { flagEmoji } from "./countries";
import { planLayout } from "./layout";
import type { CardTemplate } from "./templates";
import type { ExportFormat } from "./exportFormats";
import { OLYMPIA_STATUS_LABEL, type Athlete } from "./types";

export interface RenderCard {
  athlete: Athlete;
  imageUrl: string | null;
}

export interface RenderOptions {
  cards: RenderCard[];
  template: CardTemplate;
  format: ExportFormat;
  showCoach: boolean;
  showStatus: boolean;
}

/** Template metrics are authored against a 1080px-wide canvas. */
const REFERENCE_WIDTH = 1080;

/** Canvas needs a quoted family plus a fallback, unlike CSS shorthand. */
function fontSpec(size: number, family: string): string {
  return `${size}px "${family}", sans-serif`;
}

/**
 * Canvas silently falls back to a default serif if a webfont has not finished
 * loading, which would strip the brand typography out of every export. Force
 * the template's families to load before drawing anything.
 */
async function ensureFontsLoaded(template: CardTemplate): Promise<void> {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(fontSpec(100, template.headingFont)),
      document.fonts.load(fontSpec(100, template.bodyFont)),
    ]);
    await document.fonts.ready;
  } catch {
    // A missing family is not fatal — the fallback still renders.
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws an image cropped to fill the box, preserving aspect ratio. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  // Bias vertically toward the top — faces sit in the upper part of a photo.
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) * 0.25;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, font: string): number {
  let size = startSize;
  ctx.font = fontSpec(size, font);
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 1;
    ctx.font = fontSpec(size, font);
  }
  return size;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderGraphic(canvas: HTMLCanvasElement, options: RenderOptions): Promise<void> {
  const { cards, template, format, showCoach, showStatus } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");

  await ensureFontsLoaded(template);

  canvas.width = format.width;
  canvas.height = format.height;

  // Scale template metrics from the 1080 reference to this format's width.
  const s = format.width / REFERENCE_WIDTH;
  const padding = template.padding * s;
  const spacing = template.spacing * s;

  /* ---------------------------------------------------------- background */
  if (template.backgroundGradient) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, template.background);
    gradient.addColorStop(1, template.backgroundGradient);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = template.background;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (template.gridOverlay) {
    ctx.strokeStyle = "rgba(245,245,245,0.05)";
    ctx.lineWidth = 1;
    const step = 48 * s;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  /* --------------------------------------------------------------- title */
  let contentTop = padding;
  if (template.showTitle && template.title.trim()) {
    const titleSize = fitText(ctx, template.title, canvas.width - padding * 2, 54 * s, template.headingFont);
    ctx.fillStyle = template.titleColor;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = fontSpec(titleSize, template.headingFont);
    ctx.fillText(template.title, padding, contentTop);

    const barY = contentTop + titleSize * 1.15;
    ctx.fillStyle = template.accentColor;
    ctx.fillRect(padding, barY, canvas.width - padding * 2, template.accentBarHeight * s);
    contentTop = barY + template.accentBarHeight * s + 28 * s;
  }

  /* -------------------------------------------------------------- footer */
  const logoSize = 22 * s;
  const hasLogo = template.logoPlacement !== "none" && template.logoText.trim().length > 0;
  const footerReserve = hasLogo && template.logoPlacement.startsWith("bottom") ? logoSize + 26 * s : 0;

  const contentBottom = canvas.height - padding - footerReserve;
  const contentHeight = Math.max(80 * s, contentBottom - contentTop);
  const contentWidth = canvas.width - padding * 2;

  /* --------------------------------------------------------- card grid */
  const plan = planLayout(cards.length);
  const rowHeight = plan.rows > 0 ? (contentHeight - spacing * (plan.rows - 1)) / plan.rows : contentHeight;

  const images = await Promise.all(cards.map((c) => (c.imageUrl ? loadImage(c.imageUrl) : Promise.resolve(null))));

  let index = 0;
  for (let row = 0; row < plan.perRow.length; row++) {
    const inRow = plan.perRow[row];
    const cardWidth = (contentWidth - spacing * (inRow - 1)) / inRow;
    // Center a short final row instead of left-aligning it.
    const rowWidth = cardWidth * inRow + spacing * (inRow - 1);
    const rowLeft = padding + (contentWidth - rowWidth) / 2;
    const rowTop = contentTop + row * (rowHeight + spacing);

    for (let col = 0; col < inRow; col++) {
      const card = cards[index];
      if (!card) break;
      drawCard(ctx, {
        card,
        image: images[index],
        x: rowLeft + col * (cardWidth + spacing),
        y: rowTop,
        w: cardWidth,
        h: rowHeight,
        template,
        scale: s,
        showCoach,
        showStatus,
      });
      index++;
    }
  }

  /* ---------------------------------------------------------------- logo */
  if (hasLogo) {
    ctx.font = fontSpec(logoSize, template.bodyFont);
    ctx.fillStyle = template.logoColor;
    ctx.textBaseline = "alphabetic";
    const isRight = template.logoPlacement.endsWith("right");
    const isTop = template.logoPlacement.startsWith("top");
    ctx.textAlign = isRight ? "right" : "left";
    const lx = isRight ? canvas.width - padding : padding;
    const ly = isTop ? padding + logoSize : canvas.height - padding * 0.5;
    ctx.fillText(template.logoText, lx, ly);
  }
}

interface DrawCardArgs {
  card: RenderCard;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  w: number;
  h: number;
  template: CardTemplate;
  scale: number;
  showCoach: boolean;
  showStatus: boolean;
}

function drawCard(ctx: CanvasRenderingContext2D, args: DrawCardArgs) {
  const { card, image, x, y, w, h, template, scale, showCoach, showStatus } = args;
  const { athlete } = card;
  const radius = template.cornerRadius * scale;

  /* Card surface + shadow */
  ctx.save();
  if (template.shadowBlur > 0) {
    ctx.shadowBlur = template.shadowBlur * scale;
    ctx.shadowColor = template.shadowColor;
  }
  ctx.fillStyle = template.cardBackground;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  /* Measure the text block up front so the photo can absorb any leftover
     height. Without this, tall cards leave a large dead gap under the text. */
  const displayNameMeasured = template.uppercaseNames ? athlete.full_name.toUpperCase() : athlete.full_name;
  const padXMeasure = w * 0.07;
  const nameSizeMeasured = fitText(
    ctx,
    displayNameMeasured,
    w - padXMeasure * 2,
    w * template.nameSize,
    template.headingFont
  );
  const divisionLine = [athlete.division, athlete.country].filter(Boolean).join("  ·  ") || flagEmoji(athlete.country);
  const metaSizeMeasured = Math.max(11, w * 0.038);
  const subSize = Math.max(12, w * 0.045);

  let textBlockHeight = nameSizeMeasured * 1.12;
  if (divisionLine) textBlockHeight += subSize * 1.4;
  if (showCoach && athlete.coach) textBlockHeight += metaSizeMeasured * 1.35;
  if (showStatus && athlete.olympia_status !== "unknown") textBlockHeight += metaSizeMeasured * 1.35;

  const verticalPad = h * 0.045;
  // imageRatio acts as a floor; the photo grows to push text to the bottom.
  const imageHeight = Math.max(h * template.imageRatio, h - textBlockHeight - verticalPad * 2);
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (image) {
    // Second clip to the photo band: cover-fit overflows its box by design, and
    // with only the card clip the overflow would bleed behind the name text.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, imageHeight);
    ctx.clip();
    drawImageCover(ctx, image, x, y, w, imageHeight);
    ctx.restore();
    // Gradient scrim so text over the photo edge stays readable.
    const scrim = ctx.createLinearGradient(0, y + imageHeight * 0.55, 0, y + imageHeight);
    scrim.addColorStop(0, "rgba(0,0,0,0)");
    scrim.addColorStop(1, template.cardBackground);
    ctx.fillStyle = scrim;
    ctx.fillRect(x, y + imageHeight * 0.55, w, imageHeight * 0.45);
  } else {
    ctx.fillStyle = "rgba(245,245,245,0.06)";
    ctx.fillRect(x, y, w, imageHeight);
    ctx.fillStyle = "rgba(245,245,245,0.25)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = fontSpec(Math.round(w * 0.07), template.bodyFont);
    ctx.fillText("Kein Bild", x + w / 2, y + imageHeight / 2);
  }
  ctx.restore();

  /* Text block, bottom-anchored inside the card */
  const padX = w * 0.07;
  const textLeft = x + padX;
  let cursorY = y + h - verticalPad - textBlockHeight;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.font = fontSpec(nameSizeMeasured, template.headingFont);
  ctx.fillStyle = template.nameColor;
  ctx.fillText(displayNameMeasured, textLeft, cursorY);
  cursorY += nameSizeMeasured * 1.12;

  /* Division + flag */
  const flag = flagEmoji(athlete.country);
  if (divisionLine) {
    ctx.font = fontSpec(subSize, template.bodyFont);
    ctx.fillStyle = template.divisionColor;
    const parts = [athlete.division, athlete.country].filter(Boolean).join("  ·  ");
    ctx.fillText(flag ? `${flag}  ${parts}`.trim() : parts, textLeft, cursorY);
    cursorY += subSize * 1.4;
  }

  /* Optional coach + status */
  ctx.font = fontSpec(metaSizeMeasured, template.bodyFont);
  ctx.fillStyle = template.metaColor;

  if (showCoach && athlete.coach) {
    ctx.fillText(`Coach: ${athlete.coach}`, textLeft, cursorY);
    cursorY += metaSizeMeasured * 1.35;
  }
  if (showStatus && athlete.olympia_status !== "unknown") {
    ctx.fillText(OLYMPIA_STATUS_LABEL[athlete.olympia_status], textLeft, cursorY);
  }

  /* Border last so it sits above the photo */
  if (template.borderWidth > 0) {
    ctx.strokeStyle = template.borderColor;
    ctx.lineWidth = template.borderWidth * scale;
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export fehlgeschlagen."));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

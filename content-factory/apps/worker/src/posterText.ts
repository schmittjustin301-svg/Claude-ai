/**
 * Lays out the poster headline for a generated video.
 *
 * Anton is a tall condensed display face, so it takes many more characters
 * per line than a normal sans at the same size. These numbers are tuned for
 * a 1080px-wide frame with side padding.
 */

const MAX_LINES = 4;
const SIZES = [150, 132, 112, 94] as const;
const SMALLEST = SIZES[SIZES.length - 1];

interface PosterLayout {
  text: string;
  fontSize: number;
  lineSpacing: number;
}

/**
 * Roughly how many Anton characters fit on one line at each size. Anton
 * averages ~0.46em advance, so 150px type fits ~13.8 characters edge to
 * edge; these sit one under that so the headline keeps a margin instead of
 * touching the frame edges.
 */
const CHARS_PER_LINE: Record<number, number> = {
  150: 12,
  132: 14,
  112: 17,
  94: 20,
};

/** Greedy word wrap. Never breaks inside a word — see fitByShrinking. */
function wrap(words: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Splits a word too long for any line, so it can never overflow the frame. */
function hardBreak(word: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < word.length; i += maxChars) {
    pieces.push(word.slice(i, i + maxChars));
  }
  return pieces;
}

function withEllipsis(line: string, maxChars: number): string {
  const trimmed = line.length + 1 > maxChars ? line.slice(0, maxChars - 1) : line;
  return `${trimmed.replace(/[\s.]+$/, "")}…`;
}

function layout(text: string, fontSize: number): PosterLayout {
  return { text, fontSize, lineSpacing: Math.round(fontSize * 0.12) };
}

/**
 * Picks the largest size at which the whole headline fits within MAX_LINES
 * on word boundaries. A word wider than the line is a reason to shrink the
 * type, not to break the word — "TRANSFORMATION" should get smaller, never
 * become "TRANSFORMATI / ON".
 *
 * Anton has no lowercase personality to speak of, so the text is upper-cased
 * for the poster look.
 */
export function layoutPosterText(rawTitle: string): PosterLayout {
  const title = rawTitle.trim().toUpperCase().replace(/\s+/g, " ");
  const words = title ? title.split(" ") : ["UNTITLED"];

  for (const size of SIZES) {
    const maxChars = CHARS_PER_LINE[size];
    if (words.some((word) => word.length > maxChars)) continue;
    const lines = wrap(words, maxChars);
    if (lines.length <= MAX_LINES) return layout(lines.join("\n"), size);
  }

  // Doesn't fit even at the smallest size. Hard-break anything still too wide,
  // then truncate to MAX_LINES rather than letting it run off the frame.
  const maxChars = CHARS_PER_LINE[SMALLEST];
  const broken = words.flatMap((word) => (word.length > maxChars ? hardBreak(word, maxChars) : [word]));
  const lines = wrap(broken, maxChars);
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES;
    lines[MAX_LINES - 1] = withEllipsis(lines[MAX_LINES - 1], maxChars);
  }
  return layout(lines.join("\n"), SMALLEST);
}

/**
 * Escapes a path for use inside an ffmpeg filtergraph value. The headline
 * text itself is passed via `textfile=` instead of `text=` precisely so that
 * arbitrary clip names — apostrophes, colons, percent signs, commas — never
 * have to survive filtergraph quoting.
 */
export function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

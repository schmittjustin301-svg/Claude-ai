export interface EngineClip {
  id: string;
  tags: string[];
  priority: number;
}

export interface EngineOptions {
  targetCount: number;
  allowRepeats: boolean;
  useTagAffinity: boolean;
  usePriorityWeighting: boolean;
  /** keys of already-existing (hookId|mainId|ctaId) combos to avoid re-creating, unless allowRepeats */
  existingKeys: Set<string>;
}

export interface EngineCandidate {
  key: string;
  hookClipId: string;
  mainClipId: string;
  ctaClipId: string;
  brollClipId: string | null;
  outroClipId: string | null;
  score: number;
}

export interface EngineResult {
  candidates: EngineCandidate[];
  requestedCount: number;
  possibleCount: number;
  capped: boolean;
}

const TAG_AFFINITY_BOOST = 4;

function comboKey(hookId: string, mainId: string, ctaId: string): string {
  return `${hookId}|${mainId}|${ctaId}`;
}

function tagOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  return a.some((t) => setB.has(t));
}

function weightedPick<T extends { priority: number }>(
  items: T[],
  usePriorityWeighting: boolean,
  bonusFn?: (item: T) => number,
): T {
  const weights = items.map((item) => {
    const base = usePriorityWeighting ? Math.max(item.priority, 1) : 1;
    const bonus = bonusFn ? bonusFn(item) : 1;
    return base * bonus;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickOptional(pool: EngineClip[] | undefined): EngineClip | null {
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateCombinations(
  hooks: EngineClip[],
  mains: EngineClip[],
  ctas: EngineClip[],
  brolls: EngineClip[] | undefined,
  outros: EngineClip[] | undefined,
  options: EngineOptions,
): EngineResult {
  const possibleCount = hooks.length * mains.length * ctas.length;
  const usedKeys = new Set(options.allowRepeats ? [] : options.existingKeys);
  const remainingUnique = options.allowRepeats
    ? options.targetCount
    : Math.max(possibleCount - usedKeys.size, 0);
  const targetCount = options.allowRepeats
    ? options.targetCount
    : Math.min(options.targetCount, remainingUnique);
  const capped = targetCount < options.targetCount;

  const candidates: EngineCandidate[] = [];
  const maxAttempts = Math.max(targetCount * 30, 200);
  let attempts = 0;

  while (candidates.length < targetCount && attempts < maxAttempts) {
    attempts++;

    const hook = weightedPick(hooks, options.usePriorityWeighting);
    const main = weightedPick(mains, options.usePriorityWeighting, (m) =>
      options.useTagAffinity && tagOverlap(hook.tags, m.tags) ? TAG_AFFINITY_BOOST : 1,
    );
    const cta = weightedPick(ctas, options.usePriorityWeighting, (c) =>
      options.useTagAffinity && (tagOverlap(main.tags, c.tags) || tagOverlap(hook.tags, c.tags))
        ? TAG_AFFINITY_BOOST
        : 1,
    );

    const key = comboKey(hook.id, main.id, cta.id);
    if (!options.allowRepeats && usedKeys.has(key)) continue;

    const broll = pickOptional(brolls);
    const outro = pickOptional(outros);

    let score = 1;
    if (tagOverlap(hook.tags, main.tags)) score += 1;
    if (tagOverlap(main.tags, cta.tags) || tagOverlap(hook.tags, cta.tags)) score += 1;

    usedKeys.add(key);
    candidates.push({
      key,
      hookClipId: hook.id,
      mainClipId: main.id,
      ctaClipId: cta.id,
      brollClipId: broll?.id ?? null,
      outroClipId: outro?.id ?? null,
      score,
    });
  }

  return { candidates, requestedCount: options.targetCount, possibleCount, capped };
}

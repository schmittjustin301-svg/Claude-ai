// IndexedDB storage for the athlete database.
//
// Images are the reason this is not localStorage: a handful of athlete photos
// blows past the ~5MB string quota immediately, and localStorage would force
// base64 (a further ~33% size penalty). IndexedDB stores Blobs natively and
// has a quota in the hundreds of MB.

import type { Athlete, AthleteImage, AthleteImageRef, ImageCategory } from "./types";
import type { CardTemplate } from "./templates";

const DB_NAME = "grind-empire-athletes";
const DB_VERSION = 1;
const STORE_ATHLETES = "athletes";
const STORE_IMAGES = "images";
const STORE_TEMPLATES = "templates";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ATHLETES)) {
        db.createObjectStore(STORE_ATHLETES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        const images = db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
        images.createIndex("athlete_id", "athlete_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB-Fehler"));
      })
  );
}

/* ------------------------------------------------------------- athletes */

export function getAllAthletes(): Promise<Athlete[]> {
  return tx<Athlete[]>(STORE_ATHLETES, "readonly", (s) => s.getAll());
}

export function getAthlete(id: string): Promise<Athlete | undefined> {
  return tx<Athlete | undefined>(STORE_ATHLETES, "readonly", (s) => s.get(id));
}

export function putAthlete(athlete: Athlete): Promise<unknown> {
  return tx(STORE_ATHLETES, "readwrite", (s) => s.put(athlete));
}

export async function deleteAthlete(id: string): Promise<void> {
  const images = await getImagesForAthlete(id);
  await Promise.all(images.map((img) => deleteImage(img.id)));
  await tx(STORE_ATHLETES, "readwrite", (s) => s.delete(id));
}

/* --------------------------------------------------------------- images */

export function putImage(image: AthleteImage): Promise<unknown> {
  return tx(STORE_IMAGES, "readwrite", (s) => s.put(image));
}

export function deleteImage(id: string): Promise<unknown> {
  return tx(STORE_IMAGES, "readwrite", (s) => s.delete(id));
}

export function getImagesForAthlete(athleteId: string): Promise<AthleteImage[]> {
  return openDb().then(
    (db) =>
      new Promise<AthleteImage[]>((resolve, reject) => {
        const request = db
          .transaction(STORE_IMAGES, "readonly")
          .objectStore(STORE_IMAGES)
          .index("athlete_id")
          .getAll(athleteId);
        request.onsuccess = () => resolve(request.result as AthleteImage[]);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB-Fehler"));
      })
  );
}

/**
 * Object URLs created here stay alive for the page session. Callers that
 * render many images should revoke via releaseImageRefs when swapping sets.
 */
export async function getImageRefs(athleteId: string): Promise<AthleteImageRef[]> {
  const images = await getImagesForAthlete(athleteId);
  return images.map(({ blob, ...rest }) => ({ ...rest, url: URL.createObjectURL(blob) }));
}

export function releaseImageRefs(refs: AthleteImageRef[]): void {
  refs.forEach((r) => URL.revokeObjectURL(r.url));
}

/** Picks the best image to feature on a card, preferring portrait-style shots. */
export function pickPrimaryImage(refs: AthleteImageRef[]): AthleteImageRef | null {
  if (refs.length === 0) return null;
  const order: ImageCategory[] = ["portrait", "stage", "front_pose", "side_pose", "back_pose", "progress"];
  for (const category of order) {
    const match = refs.find((r) => r.category === category);
    if (match) return match;
  }
  return refs[0];
}

/* ------------------------------------------------------------ templates */

export function getAllTemplates(): Promise<CardTemplate[]> {
  return tx<CardTemplate[]>(STORE_TEMPLATES, "readonly", (s) => s.getAll());
}

export function putTemplate(template: CardTemplate): Promise<unknown> {
  return tx(STORE_TEMPLATES, "readwrite", (s) => s.put(template));
}

export function deleteTemplate(id: string): Promise<unknown> {
  return tx(STORE_TEMPLATES, "readwrite", (s) => s.delete(id));
}

/* ---------------------------------------------------------------- utils */

export async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
      img.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function estimateUsage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMb: usage / 1024 / 1024, quotaMb: quota / 1024 / 1024 };
}

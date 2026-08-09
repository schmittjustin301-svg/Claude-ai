import type { Chapter, ContentPost, Ebook, PlatformConnection } from './types'

export const ebook: Ebook = {
  title: 'Schlank & Scharf im Kopf',
  subtitle: 'Der Ernährungs- und Energie-Guide für vielbeschäftigte Führungskräfte',
  targetAudience: 'Business-Leader & Selbstständige, 30–55, wenig Zeit, viel Stress, will nachhaltig abnehmen',
  chapters: [
    { id: 'c1', title: 'Warum Diäten für Manager scheitern', status: 'final', words: 1850, targetWords: 1800 },
    { id: 'c2', title: 'Das 80/20-Ernährungssystem für den Kalender voller Meetings', status: 'final', words: 2100, targetWords: 2000 },
    { id: 'c3', title: 'Reisen, Dinner-Termine & Alkohol ohne Ausrede', status: 'draft', words: 1200, targetWords: 2000 },
    { id: 'c4', title: 'Schlaf & Cortisol: Der unterschätzte Abnehm-Hebel', status: 'draft', words: 900, targetWords: 1800 },
    { id: 'c5', title: 'Krafttraining in 3×30 Minuten pro Woche', status: 'outline', words: 250, targetWords: 1800 },
    { id: 'c6', title: 'Mentale Energie: Fokus statt Willenskraft', status: 'outline', words: 100, targetWords: 1600 },
    { id: 'c7', title: 'Die 30-Tage-Roadmap für Führungskräfte', status: 'idea', words: 0, targetWords: 2200 },
    { id: 'c8', title: 'Nachhaltig bleiben nach dem Zielgewicht', status: 'idea', words: 0, targetWords: 1500 },
  ],
}

export const chapters: Chapter[] = ebook.chapters

export const platformConnections: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@leanlead.exec', followers: 4820, autoPostEnabled: true },
  { platform: 'tiktok', connected: true, handle: '@leanlead', followers: 12300, autoPostEnabled: false },
  { platform: 'youtube', connected: false, handle: '', followers: 0, autoPostEnabled: false },
  { platform: 'linkedin', connected: true, handle: 'LeanLead Business Health', followers: 2140, autoPostEnabled: true },
]

export const contentPosts: ContentPost[] = [
  { id: 'p1', platform: 'instagram', format: 'Reel', title: '3 Fehler, die CEOs beim Abnehmen machen', caption: 'Warum Kalorienzählen bei 80h-Wochen nicht funktioniert...', status: 'published', date: '2026-08-01', metrics: { views: 18400, likes: 1120, comments: 64, shares: 41 } },
  { id: 'p2', platform: 'linkedin', format: 'Artikel', title: 'Warum Fitness eine Führungskompetenz ist', caption: 'Ein Beitrag über Energie-Management statt Zeit-Management...', status: 'published', date: '2026-08-02', metrics: { views: 5200, likes: 310, comments: 28, shares: 19 } },
  { id: 'p3', platform: 'tiktok', format: 'Short', title: 'Business-Lunch Hack in 15 Sekunden', caption: 'So bestellst du im Restaurant, ohne aus der Reihe zu tanzen...', status: 'published', date: '2026-08-03', metrics: { views: 44100, likes: 3900, comments: 210, shares: 380 } },
  { id: 'p4', platform: 'instagram', format: 'Carousel', title: 'Die 80/20-Regel erklärt', caption: '5 Slides: Was du wirklich tracken musst...', status: 'scheduled', date: '2026-08-11', metrics: undefined },
  { id: 'p5', platform: 'youtube', format: 'Short', title: 'Cortisol & Bauchfett – 60 Sekunden Erklärung', caption: 'Kurzfassung aus Kapitel 4 des Ebooks...', status: 'scheduled', date: '2026-08-12' },
  { id: 'p6', platform: 'tiktok', format: 'Video', title: 'Ein Tag Ernährung als CFO', caption: 'Day-in-the-life Format, Rohschnitt aus Kapitel 2...', status: 'draft', date: '2026-08-14' },
  { id: 'p7', platform: 'linkedin', format: 'Post', title: 'Zitat-Grafik: "Energie ist die neue Zeit"', caption: 'Teaser-Zitat aus dem Ebook mit Launch-Link...', status: 'draft', date: '2026-08-15' },
  { id: 'p8', platform: 'instagram', format: 'Story', title: 'Countdown: Ebook-Launch in 5 Tagen', caption: 'Story-Sticker mit Link zur Warteliste...', status: 'idea', date: '2026-08-17' },
  { id: 'p9', platform: 'youtube', format: 'Long-form', title: 'Interview: Wie ein CEO 18kg verloren hat', caption: 'Case-Study-Video, Skript wird aus Kapitel 8 generiert...', status: 'idea', date: '2026-08-20' },
  { id: 'p10', platform: 'tiktok', format: 'Short', title: 'Mythos: "Frühstück ist die wichtigste Mahlzeit"', caption: 'Kontroverser Hook, KI-Skript-Entwurf...', status: 'idea', date: '2026-08-21' },
]

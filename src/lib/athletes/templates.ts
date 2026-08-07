// Editable design templates. Every visual property the renderer reads lives
// here, so a new brand look is a data change rather than a code change.

export type LogoPlacement = "none" | "top_left" | "top_right" | "bottom_left" | "bottom_right";

export interface CardTemplate {
  id: string;
  name: string;

  /* Canvas */
  background: string;
  backgroundGradient?: string; // optional second stop; enables a vertical gradient
  gridOverlay: boolean;

  /* Card surface */
  cardBackground: string;
  cornerRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowBlur: number;
  shadowColor: string;

  /* Typography */
  headingFont: string;
  bodyFont: string;
  nameColor: string;
  divisionColor: string;
  metaColor: string;
  nameSize: number; // relative to card width, 0..1
  uppercaseNames: boolean;

  /* Layout */
  padding: number; // outer canvas padding, px at 1080 reference width
  spacing: number; // gap between cards
  imageRatio: number; // portion of card height used by the photo, 0..1

  /* Accents */
  accentColor: string;
  accentBarHeight: number;

  /* Branding */
  logoPlacement: LogoPlacement;
  logoText: string;
  logoColor: string;

  /* Header */
  showTitle: boolean;
  title: string;
  titleColor: string;
}

export const DEFAULT_TEMPLATES: CardTemplate[] = [
  {
    id: "full-access-weekly",
    name: "Full Access Weekly",
    background: "#050505",
    backgroundGradient: "#140406",
    gridOverlay: true,
    cardBackground: "#0d0d0d",
    cornerRadius: 24,
    borderWidth: 2,
    borderColor: "#FF1432",
    shadowBlur: 40,
    shadowColor: "rgba(255,20,50,0.35)",
    headingFont: "Anton",
    bodyFont: "Inter",
    nameColor: "#F5F5F5",
    divisionColor: "#FF1432",
    metaColor: "rgba(245,245,245,0.65)",
    nameSize: 0.11,
    uppercaseNames: true,
    padding: 56,
    spacing: 28,
    imageRatio: 0.72,
    accentColor: "#FF1432",
    accentBarHeight: 6,
    logoPlacement: "bottom_right",
    logoText: "FULL ACCESS",
    logoColor: "rgba(245,245,245,0.5)",
    showTitle: true,
    title: "FULL ACCESS WEEKLY",
    titleColor: "#F5F5F5",
  },
  {
    id: "female-bodybuilding",
    name: "Female Bodybuilding Channel",
    background: "#0a0410",
    backgroundGradient: "#1d0733",
    gridOverlay: false,
    cardBackground: "#140a1f",
    cornerRadius: 32,
    borderWidth: 2,
    borderColor: "#C879FF",
    shadowBlur: 48,
    shadowColor: "rgba(200,121,255,0.4)",
    headingFont: "Anton",
    bodyFont: "Inter",
    nameColor: "#FFFFFF",
    divisionColor: "#C879FF",
    metaColor: "rgba(255,255,255,0.6)",
    nameSize: 0.105,
    uppercaseNames: true,
    padding: 60,
    spacing: 30,
    imageRatio: 0.74,
    accentColor: "#C879FF",
    accentBarHeight: 6,
    logoPlacement: "bottom_left",
    logoText: "FEMALE BODYBUILDING",
    logoColor: "rgba(255,255,255,0.45)",
    showTitle: true,
    title: "ATHLETE SPOTLIGHT",
    titleColor: "#FFFFFF",
  },
  {
    id: "muscle-media-tv",
    name: "Muscle Media TV",
    background: "#08120c",
    backgroundGradient: "#04231a",
    gridOverlay: true,
    cardBackground: "#0b1a13",
    cornerRadius: 16,
    borderWidth: 3,
    borderColor: "#39FF88",
    shadowBlur: 36,
    shadowColor: "rgba(57,255,136,0.35)",
    headingFont: "Anton",
    bodyFont: "Inter",
    nameColor: "#F5F5F5",
    divisionColor: "#39FF88",
    metaColor: "rgba(245,245,245,0.6)",
    nameSize: 0.1,
    uppercaseNames: true,
    padding: 52,
    spacing: 24,
    imageRatio: 0.7,
    accentColor: "#39FF88",
    accentBarHeight: 8,
    logoPlacement: "top_right",
    logoText: "MUSCLE MEDIA TV",
    logoColor: "rgba(57,255,136,0.75)",
    showTitle: true,
    title: "MUSCLE MEDIA TV",
    titleColor: "#39FF88",
  },
  {
    id: "olympia-coverage",
    name: "Olympia Coverage",
    background: "#0b0a04",
    backgroundGradient: "#241d05",
    gridOverlay: false,
    cardBackground: "#15120a",
    cornerRadius: 20,
    borderWidth: 3,
    borderColor: "#FFD24A",
    shadowBlur: 52,
    shadowColor: "rgba(255,210,74,0.4)",
    headingFont: "Anton",
    bodyFont: "Inter",
    nameColor: "#FFFFFF",
    divisionColor: "#FFD24A",
    metaColor: "rgba(255,255,255,0.65)",
    nameSize: 0.115,
    uppercaseNames: true,
    padding: 64,
    spacing: 26,
    imageRatio: 0.73,
    accentColor: "#FFD24A",
    accentBarHeight: 8,
    logoPlacement: "bottom_right",
    logoText: "OLYMPIA",
    logoColor: "rgba(255,210,74,0.6)",
    showTitle: true,
    title: "OLYMPIA COVERAGE",
    titleColor: "#FFD24A",
  },
];

export function cloneTemplate(template: CardTemplate, name: string): CardTemplate {
  return { ...template, id: crypto.randomUUID(), name };
}

"""Schneidet die einzelnen Maskottchen-Motive aus dem offiziellen Konzeptbild.

Quelle: assets/mascot/ironcore-mascot-sheet.png (1536×1024, nicht Teil der App).
Ziel:   public/images/mascot/<name>.webp – unverändert zugeschnitten, ohne Filter.
Aufruf: python3 scripts/mascot-crop.py   (benötigt Pillow)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/mascot/ironcore-mascot-sheet.png'
OUT = ROOT / 'public/images/mascot'

# Bereiche (links, oben, rechts, unten) – ohne Beschriftungen und Rahmen der Kacheln
CROPS = {
    # Reihe „Ausdrücke“
    'neutral': (14, 418, 156, 572),
    'friendly': (168, 418, 310, 572),
    'motivated': (322, 418, 464, 572),
    'focused': (474, 418, 610, 572),
    'happy': (620, 418, 758, 572),
    'thinking': (914, 418, 1050, 572),
    'determined': (1060, 418, 1198, 572),
    'supportive': (1208, 418, 1344, 572),
    'celebrating': (1354, 418, 1526, 572),
    # Reihe „Bereiche“
    'workout': (6, 620, 216, 800),
    'nutrition': (228, 620, 414, 800),
    'supplements': (428, 620, 616, 800),
    'water': (628, 620, 820, 800),
    'goals': (834, 620, 1052, 800),
    'shopping': (1064, 620, 1274, 800),
    # „App Tutorial“ ohne die Sprechblase mit Text
    'explaining': (1288, 640, 1416, 800),
    # Hauptmotiv (zeigt auf dich) ohne Schriftzug, Porträt ohne Rahmen
    'welcome': (308, 8, 560, 405),
    'portrait': (1190, 20, 1520, 362),
}

def main():
    im = Image.open(SRC).convert('RGB')
    OUT.mkdir(parents=True, exist_ok=True)
    for name, box in CROPS.items():
        im.crop(box).save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
        print(name, box)

if __name__ == '__main__':
    main()

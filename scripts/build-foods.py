"""Erzeugt public/js/fooddb.js aus der kuratierten Auswahl und der USDA-Nährwertdatenbank SR28.

Quelle: USDA, Agricultural Research Service, Nutrient Data Laboratory.
        USDA National Nutrient Database for Standard Reference, Release 28 (2015, Stand 2016).
        Gemeinfrei (Werk der US-Regierung). Die Datei ABBREV.txt stammt aus dem npm-Paket
        fda-nutrient-database@1.0.2 (SHA-256 siehe unten).

Aufruf:  python3 scripts/build-foods.py <Pfad zu ABBREV.txt>
Auswahl: assets/foods/usda-selection.tsv  (ndb, name, state, category, portion, legacy, usda_desc)

Umrechnungen (dokumentiert, keine Schätzung):
- Kohlenhydrate: USDA gibt Kohlenhydrate „by difference“ inkl. Ballaststoffe an. Die App zählt wie
  deutsche Nährwerttabellen ohne Ballaststoffe → c = Kohlenhydrate − Ballaststoffe (nicht unter 0).
- Energie in kJ: kcal × 4,184.
- Salz: Natrium (mg) × 2,5 / 1000 (EU-Formel aus der LMIV).
Fehlt ein Wert in der Quelle, bleibt er leer (null) – nie 0.
"""
import csv, hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEL = ROOT / 'assets/foods/usda-selection.tsv'
OUT = ROOT / 'public/js/fooddb.js'
EXPECTED_SHA = '4c42235a001efd5e94ce38001682138056aa1b755427b8a8d315c2b02cd2b85b'

def num(v):
    v = v.strip()
    return None if v == '' else float(v)

def r(v, d=1):
    return None if v is None else round(v, d)

def main(abbrev):
    sha = hashlib.sha256(Path(abbrev).read_bytes()).hexdigest()
    if sha != EXPECTED_SHA:
        sys.exit(f'ABBREV.txt hat eine andere Prüfsumme ({sha}) – bitte Quelle prüfen')
    rows = {}
    for line in open(abbrev, encoding='latin-1'):
        f = line.rstrip('\r\n').split('^')
        rows[f[0].strip('~')] = f
    out, names = [], set()
    with open(SEL, encoding='utf-8') as fh:
        for s in csv.DictReader(fh, delimiter='\t'):
            ndb = s['ndb'].strip().zfill(5)
            f = rows.get(ndb)
            if not f:
                sys.exit(f'NDB {ndb} ({s["name"]}) fehlt in der Quelle')
            name = s['name'].strip()
            if name.lower() in names:
                sys.exit(f'Doppelter Name: {name}')
            names.add(name.lower())
            kcal, p, fat, carb, fib, sug, na, sat = (num(f[i]) for i in (3, 4, 5, 7, 8, 9, 15, 44))
            if kcal is None or p is None or fat is None or carb is None:
                sys.exit(f'Grundwerte fehlen für {ndb} {name}')
            c = max(0.0, carb - fib) if fib is not None else carb
            out.append([
                'usda:' + ndb, name, s['state'].strip(), s['category'].strip(), int(float(s['portion'] or 100)),
                round(kcal), r(p), r(c), r(fat), r(fib), r(sug), r(sat), r(na * 2.5 / 1000, 2) if na is not None else None,
                s.get('legacy', '').strip(),
            ])
    head = (
        '// Automatisch erzeugt von scripts/build-foods.py – nicht von Hand bearbeiten.\n'
        '// Quelle: USDA National Nutrient Database for Standard Reference, Release 28 (gemeinfrei).\n'
        '// Werte je 100 g. Kohlenhydrate ohne Ballaststoffe, Salz = Natrium × 2,5. null = in der Quelle nicht angegeben.\n'
        '// Spalten: ref, name, state, category, portion, kcal, p, c, f, fiber, sugar, satFat, salt, legacy\n'
    )
    body = 'export const USDA_FOODS = [\n' + ''.join('  ' + json.dumps(x, ensure_ascii=False) + ',\n' for x in out) + '];\n'
    OUT.write_text(head + body, encoding='utf-8')
    print(f'{len(out)} Lebensmittel → {OUT.relative_to(ROOT)}')

if __name__ == '__main__':
    main(sys.argv[1])

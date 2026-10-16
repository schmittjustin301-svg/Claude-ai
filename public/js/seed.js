// Startdaten: Übungsbibliothek, Lebensmittel, Plan-Vorlagen.
// Alles ist in der App frei änderbar – das hier ist nur der Ausgangspunkt.

export const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Beinbeuger', 'Gesäß', 'Waden', 'Bauch', 'Unterarme', 'Sonstiges'];
export const EQUIPMENT = ['Langhantel', 'Kurzhantel', 'Kabel', 'Maschine', 'Körpergewicht', 'SZ-Stange', 'Sonstiges'];

// [Name, Muskel, Gerät, Ausführung]
const EX = [
  ['Bankdrücken', 'Brust', 'Langhantel', 'Schulterblätter zurück und runter, Füße fest am Boden. Stange kontrolliert zur unteren Brust, Ellbogen ca. 45° vom Körper, explosiv hochdrücken.'],
  ['Schrägbankdrücken (KH)', 'Brust', 'Kurzhantel', 'Bank auf 30–45°. Hanteln seitlich der oberen Brust absenken, über der Brust zusammenführen, ohne sie anzuschlagen.'],
  ['Schrägbankdrücken (LH)', 'Brust', 'Langhantel', 'Bank auf 30°. Stange zur oberen Brust, Handgelenke gerade, Schulterblätter fixiert.'],
  ['Fliegende am Kabel', 'Brust', 'Kabel', 'Leicht gebeugte, fixierte Ellbogen. Bogen nach vorn-unten, Brust anspannen, langsam zurück in die Dehnung.'],
  ['Butterfly (Maschine)', 'Brust', 'Maschine', 'Sitzhöhe so, dass die Griffe auf Brusthöhe sind. Kontrolliert zusammenführen, kurz halten.'],
  ['Dips', 'Brust', 'Körpergewicht', 'Oberkörper leicht nach vorn für mehr Brust. Bis Oberarme etwa parallel zum Boden absenken, Schultern unten halten.'],
  ['Liegestütze', 'Brust', 'Körpergewicht', 'Körper bildet eine Linie, Bauch fest. Brust bis knapp über den Boden, Ellbogen nicht ganz seitlich.'],
  ['Klimmzüge', 'Rücken', 'Körpergewicht', 'Schulterbreit bis etwas weiter greifen. Zuerst Schulterblätter runterziehen, dann Brust zur Stange. Kontrolliert ablassen.'],
  ['Latzug', 'Rücken', 'Kabel', 'Leicht zurücklehnen, Stange zur oberen Brust ziehen, Ellbogen nach unten führen. Nicht mit Schwung arbeiten.'],
  ['Langhantelrudern', 'Rücken', 'Langhantel', 'Hüfte nach hinten, Rücken gerade, Oberkörper ca. 45°. Stange zum Bauchnabel ziehen, Schulterblätter zusammen.'],
  ['Kurzhantelrudern einarmig', 'Rücken', 'Kurzhantel', 'Hand und Knie auf der Bank abstützen. Hantel Richtung Hüfte ziehen, Ellbogen nah am Körper.'],
  ['Kabelrudern', 'Rücken', 'Kabel', 'Aufrecht sitzen, Brust raus. Griff zum Bauch ziehen, Schulterblätter zusammen, langsam nach vorn in die Dehnung.'],
  ['T-Bar-Rudern', 'Rücken', 'Langhantel', 'Rücken neutral, Knie leicht gebeugt. Griff zur Brust ziehen, oben kurz halten.'],
  ['Kreuzheben', 'Rücken', 'Langhantel', 'Stange über Mittelfuß, Rücken neutral, Lats anspannen. Mit den Beinen vom Boden drücken, Hüfte und Schultern steigen gleichzeitig.'],
  ['Face Pulls', 'Schultern', 'Kabel', 'Seil auf Augenhöhe. Zum Gesicht ziehen, Hände dabei auseinander, Ellbogen hoch. Hintere Schulter und oberer Rücken.'],
  ['Schulterdrücken (KH)', 'Schultern', 'Kurzhantel', 'Sitzend oder stehend, Bauch fest. Hanteln von Schulterhöhe über den Kopf drücken, nicht ins Hohlkreuz.'],
  ['Schulterdrücken (LH)', 'Schultern', 'Langhantel', 'Stehend, Gesäß und Bauch fest. Stange vor dem Gesicht nach oben, Kopf durch die Arme nach vorn.'],
  ['Seitheben', 'Schultern', 'Kurzhantel', 'Leicht gebeugte Ellbogen. Arme seitlich bis Schulterhöhe heben, Ellbogen führen. Ohne Schwung, langsam ablassen.'],
  ['Seitheben am Kabel', 'Schultern', 'Kabel', 'Kabel unten, Griff mit der entfernten Hand. Konstante Spannung, bis Schulterhöhe.'],
  ['Reverse Butterfly', 'Schultern', 'Maschine', 'Brust an das Polster, Arme leicht gebeugt nach hinten führen. Hintere Schulter.'],
  ['Langhantel-Curls', 'Bizeps', 'Langhantel', 'Ellbogen fest am Körper, ohne Schwung. Voll strecken, oben kurz anspannen.'],
  ['SZ-Curls', 'Bizeps', 'SZ-Stange', 'Wie Langhantel-Curls, angenehmer für die Handgelenke.'],
  ['Kurzhantel-Curls', 'Bizeps', 'Kurzhantel', 'Abwechselnd oder gleichzeitig, Handgelenk beim Hochgehen nach außen drehen.'],
  ['Hammer Curls', 'Bizeps', 'Kurzhantel', 'Neutraler Griff (Daumen oben). Trifft auch Brachialis und Unterarm.'],
  ['Schrägbank-Curls', 'Bizeps', 'Kurzhantel', 'Bank auf ca. 60°, Arme hängen hinter dem Körper – große Dehnung des Bizeps.'],
  ['Trizepsdrücken am Kabel', 'Trizeps', 'Kabel', 'Ellbogen fest an der Seite. Seil oder Stange nach unten drücken, unten Hände auseinander.'],
  ['Überkopf-Trizepsstrecken', 'Trizeps', 'Kabel', 'Rücken zum Kabel, Arme über dem Kopf. Ellbogen zeigen nach vorn, nur Unterarme bewegen.'],
  ['French Press (SZ)', 'Trizeps', 'SZ-Stange', 'Liegend, Stange Richtung Stirn/hinter den Kopf absenken, Ellbogen bleiben eng.'],
  ['Enges Bankdrücken', 'Trizeps', 'Langhantel', 'Griff etwa schulterbreit, Ellbogen nah am Körper. Stange zur unteren Brust.'],
  ['Kniebeugen', 'Quadrizeps', 'Langhantel', 'Stange auf dem oberen Rücken, Bauch fest. Hüfte nach hinten-unten, Knie über die Zehen, mindestens parallel. Über den ganzen Fuß hochdrücken.'],
  ['Frontkniebeugen', 'Quadrizeps', 'Langhantel', 'Stange vorn auf den Schultern, Ellbogen hoch. Oberkörper bleibt aufrecht.'],
  ['Beinpresse', 'Quadrizeps', 'Maschine', 'Füße schulterbreit, Rücken bleibt am Polster. Tief, aber ohne dass das Becken abkippt. Knie nicht durchstrecken.'],
  ['Hackenschmidt-Kniebeuge', 'Quadrizeps', 'Maschine', 'Rücken am Polster, kontrolliert tief. Sehr quadrizepslastig.'],
  ['Beinstrecker', 'Quadrizeps', 'Maschine', 'Polster über dem Sprunggelenk. Oben kurz halten, langsam ablassen.'],
  ['Bulgarische Split Squats', 'Quadrizeps', 'Kurzhantel', 'Hinterer Fuß auf der Bank. Vorderes Bein trägt, senkrecht nach unten bis das hintere Knie fast den Boden berührt.'],
  ['Ausfallschritte', 'Quadrizeps', 'Kurzhantel', 'Großer Schritt, beide Knie ca. 90°. Vorderes Knie stabil über dem Fuß.'],
  ['Rumänisches Kreuzheben', 'Beinbeuger', 'Langhantel', 'Knie leicht gebeugt, Hüfte weit nach hinten. Stange nah an den Beinen bis zur Dehnung der Beinbeuger, Rücken gerade.'],
  ['Beinbeuger liegend', 'Beinbeuger', 'Maschine', 'Hüfte bleibt am Polster. Ferse zum Gesäß, kontrolliert zurück.'],
  ['Beinbeuger sitzend', 'Beinbeuger', 'Maschine', 'Oberschenkel fest fixiert. Volle Bewegung, unten kurz halten.'],
  ['Hip Thrust', 'Gesäß', 'Langhantel', 'Oberer Rücken an der Bank, Stange auf der Hüfte. Hüfte strecken, oben Gesäß maximal anspannen, Kinn zur Brust.'],
  ['Abduktoren-Maschine', 'Gesäß', 'Maschine', 'Oberkörper leicht nach vorn. Beine kontrolliert nach außen drücken.'],
  ['Wadenheben stehend', 'Waden', 'Maschine', 'Ganz tief in die Dehnung, kurz halten, dann maximal auf die Zehen.'],
  ['Wadenheben sitzend', 'Waden', 'Maschine', 'Für den Schollenmuskel. Langsam, volle Bewegung.'],
  ['Crunches am Kabel', 'Bauch', 'Kabel', 'Kniend, Seil am Kopf. Wirbelsäule einrollen, Ellbogen Richtung Knie. Nicht aus der Hüfte ziehen.'],
  ['Hängendes Beinheben', 'Bauch', 'Körpergewicht', 'An der Stange hängen, Becken einrollen und Beine heben. Ohne Schwung.'],
  ['Plank', 'Bauch', 'Körpergewicht', 'Unterarmstütz, Körper in einer Linie, Gesäß und Bauch fest. Zeit statt Wiederholungen eintragen.'],
];

export const SEED_EXERCISES = EX.map(([name, muscle, equipment, instructions]) => ({ name, muscle, equipment, instructions, notes: '' }));

// Nährwerte je 100 g (Richtwerte – bitte mit der Verpackung abgleichen). portion = Standardmenge in g.
export const SEED_FOODS = [
  ['Haferflocken', 370, 13.5, 58.7, 7, 60],
  ['Magerquark', 67, 12, 4, 0.3, 250],
  ['Skyr natur', 63, 11, 4, 0.2, 150],
  ['Körniger Frischkäse', 98, 12.3, 2.6, 4.3, 200],
  ['Hähnchenbrust (roh)', 110, 23.5, 0, 1.5, 200],
  ['Putenbrust (roh)', 105, 24, 0, 1, 200],
  ['Rinderhack 5 % (roh)', 125, 21, 0, 5, 125],
  ['Lachs (roh)', 200, 20, 0, 13, 125],
  ['Thunfisch (Dose, Wasser)', 110, 25, 0, 1, 130],
  ['Ei (Größe M ≈ 60 g)', 140, 12.5, 0.7, 10, 60],
  ['Eiklar', 50, 11, 0.7, 0.2, 100],
  ['Whey Protein', 380, 75, 8, 6, 30],
  ['Milch 1,5 %', 47, 3.4, 4.8, 1.5, 250],
  ['Mozzarella light', 165, 20, 1, 9, 125],
  ['Reis (roh)', 350, 7, 78, 0.6, 80],
  ['Nudeln (roh)', 355, 12.5, 70, 1.5, 100],
  ['Kartoffeln', 77, 2, 17, 0.1, 300],
  ['Vollkornbrot', 220, 7.5, 40, 1.5, 50],
  ['Reiswaffeln', 385, 8, 81, 3, 20],
  ['Banane', 93, 1.1, 20, 0.2, 120],
  ['Apfel', 54, 0.3, 12, 0.2, 150],
  ['Beeren (TK)', 45, 1, 8, 0.4, 150],
  ['Brokkoli', 34, 3.8, 2.7, 0.4, 200],
  ['Gemüse gemischt', 30, 1.5, 4.5, 0.3, 200],
  ['Olivenöl', 884, 0, 0, 100, 10],
  ['Erdnussbutter', 600, 25, 15, 50, 15],
  ['Mandeln', 600, 21, 6, 52, 25],
].map(([name, kcal, p, c, f, portion]) => ({ name, kcal, p, c, f, portion }));

// Plan-Vorlagen: Tage mit [Übungsname, Sätze, Wdh., Pause s]
export const PLAN_TEMPLATES = {
  ppl: {
    name: 'Push / Pull / Beine',
    days: [
      ['Push', [1, 4], [['Bankdrücken', 4, '6-8', 150], ['Schrägbankdrücken (KH)', 3, '8-10', 120], ['Schulterdrücken (KH)', 3, '8-10', 120], ['Seitheben', 3, '12-15', 60], ['Dips', 3, '8-12', 90], ['Trizepsdrücken am Kabel', 3, '10-12', 60]]],
      ['Pull', [2, 5], [['Klimmzüge', 4, '6-10', 150], ['Langhantelrudern', 3, '8-10', 120], ['Latzug', 3, '10-12', 90], ['Face Pulls', 3, '15', 60], ['Langhantel-Curls', 3, '10-12', 60], ['Hammer Curls', 3, '10-12', 60]]],
      ['Beine', [3, 6], [['Kniebeugen', 4, '6-8', 180], ['Rumänisches Kreuzheben', 3, '8-10', 150], ['Beinpresse', 3, '10-12', 120], ['Beinbeuger liegend', 3, '10-12', 90], ['Ausfallschritte', 3, '10', 90], ['Wadenheben stehend', 4, '12-15', 60]]],
    ],
  },
  ul: {
    name: 'Ober / Unter',
    days: [
      ['Oberkörper A', [1], [['Bankdrücken', 4, '6-8', 150], ['Langhantelrudern', 4, '6-8', 150], ['Schulterdrücken (KH)', 3, '8-10', 120], ['Latzug', 3, '10-12', 90], ['Seitheben', 3, '12-15', 60], ['Trizepsdrücken am Kabel', 3, '10-12', 60]]],
      ['Unterkörper A', [2], [['Kniebeugen', 4, '6-8', 180], ['Rumänisches Kreuzheben', 3, '8-10', 150], ['Beinpresse', 3, '10-12', 120], ['Beinbeuger liegend', 3, '10-12', 90], ['Wadenheben stehend', 4, '12-15', 60]]],
      ['Oberkörper B', [4], [['Schrägbankdrücken (KH)', 4, '8-10', 120], ['Klimmzüge', 4, '6-10', 150], ['Kabelrudern', 3, '10-12', 90], ['Dips', 3, '8-12', 90], ['Langhantel-Curls', 3, '10-12', 60], ['Face Pulls', 3, '15', 60]]],
      ['Unterkörper B', [5], [['Kreuzheben', 3, '5', 180], ['Bulgarische Split Squats', 3, '8-10', 120], ['Beinstrecker', 3, '12-15', 90], ['Beinbeuger sitzend', 3, '12-15', 90], ['Wadenheben sitzend', 4, '15', 60]]],
    ],
  },
};

export const DEFAULT_MEASURE_FIELDS = [
  { key: 'chest', label: 'Brust' },
  { key: 'waist', label: 'Taille' },
  { key: 'hips', label: 'Hüfte' },
  { key: 'arms', label: 'Arme' },
  { key: 'thighs', label: 'Oberschenkel' },
];

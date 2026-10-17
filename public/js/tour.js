// Inhalte für Tour, Seitenhilfe und Tipps. Nur reine Daten – erklärt werden ausschließlich vorhandene Funktionen.
// Ziele (target) verweisen auf data-tour="…"-Attribute in den Ansichten. Fehlt ein Ziel, wird nichts hervorgehoben.

export const TOUR = [
  { id: 'dashboard', view: 'home', target: 'cockpit', mascot: 'friendly', title: 'Deine Kommandozentrale',
    text: 'Hier siehst du auf einen Blick, was heute ansteht: dein Training, deine Einheiten der Woche und den Start-Knopf. Darunter folgen Ernährung, Gewicht, Supplements und Rekorde.' },
  { id: 'quick', view: 'home', target: 'quick', mascot: 'explaining', title: 'Schnellzugriff',
    text: 'Gewicht, Essen und Tagesplan sind einen Tipp entfernt. Die Karte „Als Nächstes“ zeigt dir die nächste geplante Mahlzeit oder Einnahme.' },
  { id: 'training', view: 'train', params: { tab: 'plan' }, target: 'train-plan', mascot: 'workout', title: 'Training',
    text: 'Hier liegen deine Pläne und Trainingstage. Im Training trägst du Gewicht und Wiederholungen ein, hakst jeden Satz ab, und der Pausen-Timer startet. „Verlauf“ und „Analyse“ zeigen deine Entwicklung.' },
  { id: 'nutrition', view: 'food', params: { tab: 'today' }, target: 'food-summary', mascot: 'nutrition', title: 'Ernährung',
    text: 'Trag deine Mahlzeiten ein und sieh, wie viele Kalorien und Makros du schon hast und was heute noch übrig ist. Mengen änderst du jederzeit mit einem Tipp auf den Eintrag.' },
  { id: 'meals', view: 'day', target: 'timeline', mascot: 'explaining', title: 'Essenszeiten & Tagesplan',
    text: 'Jede Mahlzeit hat eine eigene Uhrzeit. Der Tagesplan zeigt Mahlzeiten und Supplements der Reihe nach: abhaken, überspringen oder die Uhrzeit antippen und für heute verschieben.' },
  { id: 'plan', view: 'food', params: { tab: 'plan' }, target: 'week-plan', mascot: 'thinking', title: 'Wochenplan',
    text: 'Plane deine Mahlzeiten für die ganze Woche, mit Zutaten und Mengen. „Wie geplant gegessen“ übernimmt sie später mit einem Tipp ins Tagebuch.' },
  { id: 'shopping', view: 'food', params: { tab: 'shop' }, target: 'shop', mascot: 'shopping', title: 'Einkaufsliste',
    text: 'Aus dem Wochenplan entsteht per Knopfdruck deine Einkaufsliste. Gleiche Zutaten werden zusammengezählt. Du kannst Mengen ändern, Gekauftes abhaken und markieren, was schon da ist.' },
  { id: 'supps', view: 'supps', target: 'supps', mascot: 'supplements', title: 'Supplements',
    text: 'Du entscheidest selbst, welche Produkte du einträgst, wie viel und wann. IRONCORE erinnert nur an deinen Plan und empfiehlt nichts. Genommen? Abhaken, Einnahmetreue und Vorrat rechnen mit.' },
  { id: 'water', view: 'home', target: 'water', mascot: 'water', title: 'Wasser & Dose',
    text: 'Mit jedem Eintrag füllt sich deine Dose bis zum Tagesziel. Tipp auf die Dose, um ihre Farbe zu wechseln. Deine Werte bleiben dabei unverändert.' },
  { id: 'goals', view: 'goals', target: 'level', mascot: 'goals', title: 'Ziele, XP & Level',
    text: 'Setz dir eigene Ziele und sieh in Prozent, wie weit du bist. XP gibt es für Beständigkeit wie Trainings, erreichte Tagesziele und Rekorde, nie für Menge. Dazu kommen Erfolge und Serien.' },
  { id: 'missions', view: 'goals', target: 'missions', mascot: 'motivated', title: 'Tagesmissionen',
    text: 'Deine wichtigsten Aufgaben für heute, berechnet aus deinen Einträgen. Erledigtes hakt sich selbst ab und bringt XP. Du musst nicht alles auf einmal schaffen.' },
  { id: 'progress', view: 'progress', target: 'progress', mascot: 'focused', title: 'Fortschritt',
    text: 'Gewicht mit 7-Tage-Trend für Woche, Monat und Jahr, dazu Maße und private Fortschrittsfotos. Kraftentwicklung und Rekorde findest du unter Training → Analyse.' },
  { id: 'settings', view: 'settings', target: 'help', mascot: 'neutral', title: 'Einstellungen',
    text: 'Name, Kalorien & Makros, Tageswerte, Supplements, Erinnerungen, Essenszeiten, Backup und CSV-Export. Unter „Tutorial & Hilfe“ startest du diese Tour jederzeit neu.' },
  { id: 'done', view: null, mascot: 'celebrating', title: 'Stark!',
    text: 'Jetzt kennst du die wichtigsten Bereiche von IRONCORE. Du musst nicht jeden Tag alles perfekt machen. Bleib dran, mach deine Fortschritte sichtbar und konzentrier dich auf den nächsten Schritt. Auf geht’s!' },
];

export const WELCOME = {
  title: 'Willkommen bei IRONCORE!',
  lines: [
    'Ich bin dein persönlicher Fitness-Coach. Gemeinsam behalten wir dein Training, deine Ernährung und deine Fortschritte im Blick.',
    'Ich zeige dir jetzt Schritt für Schritt, wie alles funktioniert. Bereit? Dann legen wir los!',
  ],
};

/** Seitenhilfe für den Hilfe-Knopf: Ansicht (ggf. mit Tab) → Tour-Schritt oder eigener Text. */
const EXTRA = {
  session: { mascot: 'focused', title: 'Training läuft', text: 'Gewicht und Wiederholungen eintragen, Satz abhaken, und der Pausen-Timer startet. Jede Eingabe wird sofort gespeichert. „Beenden“ speichert die abgehakten Sätze.' },
  plan: { mascot: 'workout', title: 'Plan-Editor', text: 'Trainingstage anlegen, Wochentage festlegen und pro Übung Sätze, Wiederholungen, Ziel-kg und Pause einstellen.' },
  foods: { mascot: 'nutrition', title: 'Lebensmittel', text: 'Deine eigene Lebensmittel-Liste mit Nährwerten pro 100 g. Favoriten erscheinen beim Eintragen oben.' },
  reminders: { mascot: 'explaining', title: 'Erinnerungen', text: 'Erinnerungen für deine Supplements und Mahlzeiten. Ohne Push-Server meldet sich eine Web-App nur, solange sie geöffnet ist. Für feste Alarme gibt es den Kalender-Export.' },
  calc: { mascot: 'thinking', title: 'Makro-Rechner', text: 'Aus deinen Profilangaben berechnet IRONCORE ein Kalorien- und Makroziel. Du kannst die Werte danach selbst anpassen.' },
  help: { mascot: 'friendly', title: 'Tutorial & Hilfe', text: 'Hier startest du die Tour neu, schaust dir einzelne Bereiche an und stellst ein, wie oft ich mich melde.' },
};
export function pageHelp(view, params = {}) {
  const map = { home: 'dashboard', train: 'training', day: 'meals', supps: 'supps', goals: 'goals', progress: 'progress', settings: 'settings',
    food: params.tab === 'plan' ? 'plan' : params.tab === 'shop' ? 'shopping' : 'nutrition' };
  const step = TOUR.find((s) => s.id === map[view]);
  return step ? { ...step, step: step.id } : EXTRA[view] ? { ...EXTRA[view], step: null } : { mascot: 'neutral', title: 'IRONCORE', text: 'Tipp auf „Komplette Tour“, wenn du alle Bereiche noch einmal sehen willst.', step: null };
}

/** Tipps zu einzelnen Bedienelementen, je Ansicht. */
const TIP = {
  startWorkout: { target: 'start-workout', mascot: 'workout', title: 'Training starten', text: 'Startet den geplanten Trainingstag. Alles wird sofort gespeichert, auch wenn du die App zwischendurch schließt.' },
  logWater: { target: 'log-water', mascot: 'water', title: 'Wasser eintragen', text: '+250 oder +500 ml pro Tipp. Vertippt? Mit „− 250 ml“ korrigierst du.' },
  canColor: { target: 'can-color', mascot: 'friendly', title: 'Dosenfarbe ändern', text: 'Tipp auf die Dose und wähl eine von sieben Farben.' },
  progressTab: { target: 'tab-progress', mascot: 'focused', title: 'Fortschritt ansehen', text: 'Gewichtstrend, Maße und Fotos findest du hier.' },
  addFood: { target: 'add-food', mascot: 'nutrition', title: 'Essen hinzufügen', text: 'Lebensmittel suchen, Barcode scannen oder nur Makros eintragen. Die Menge legst du im nächsten Schritt fest.' },
  mealTime: { target: 'meal-time', mascot: 'explaining', title: 'Essenszeit festlegen', text: 'Tipp auf die Uhrzeit, um sie nur für diesen Tag zu verschieben. Feste Zeiten stellst du unter „Mahlzeiten verwalten“ ein.' },
  genList: { target: 'gen-list', mascot: 'shopping', title: 'Einkaufsliste erstellen', text: 'Fasst alle Zutaten deines Wochenplans zusammen. Eigene Artikel und Haken bleiben beim Aktualisieren erhalten.' },
  addSupp: { target: 'add-supp', mascot: 'supplements', title: 'Supplement anlegen', text: 'Name, Menge, Uhrzeit und Wochentage legst du selbst fest. IRONCORE schlägt keine Dosierung vor.' },
  newGoal: { target: 'new-goal', mascot: 'goals', title: 'Ziel erstellen', text: 'Wähl eine Zielart, zum Beispiel Trainings, Protein-Tage oder ein Kraftziel. Der Fortschritt wird aus deinen Einträgen berechnet.' },
  restart: { target: 'help', mascot: 'neutral', title: 'Tutorial neu starten', text: 'Startet die Tour von vorn. Deine Trainings- und Ernährungsdaten bleiben unberührt.' },
};
export function tipsFor(view, params = {}) {
  const t = TIP;
  if (view === 'home') return [t.startWorkout, t.logWater, t.canColor, t.progressTab];
  if (view === 'train') return [t.startWorkout];
  if (view === 'food') return params.tab === 'shop' ? [t.genList] : params.tab === 'plan' ? [] : [t.addFood, t.mealTime];
  if (view === 'supps') return [t.addSupp];
  if (view === 'goals') return [t.newGoal];
  if (view === 'settings') return [t.restart];
  return [];
}
export const ALL_TIPS = Object.values(TIP);

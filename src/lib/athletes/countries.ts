// Country name → ISO-3166 alpha-2, used to derive flag emoji for the cards.
// Covers the nations that show up most in international bodybuilding lineups,
// plus common aliases and the codes themselves so "USA", "United States" and
// "US" all resolve.

const COUNTRY_CODES: Record<string, string> = {
  usa: "US", "united states": "US", "united states of america": "US", america: "US", us: "US",
  uk: "GB", "united kingdom": "GB", england: "GB", scotland: "GB", wales: "GB", britain: "GB", gb: "GB",
  germany: "DE", deutschland: "DE", de: "DE",
  austria: "AT", österreich: "AT", oesterreich: "AT", at: "AT",
  switzerland: "CH", schweiz: "CH", ch: "CH",
  france: "FR", fr: "FR",
  italy: "IT", italia: "IT", it: "IT",
  spain: "ES", españa: "ES", espana: "ES", es: "ES",
  netherlands: "NL", holland: "NL", nl: "NL",
  belgium: "BE", be: "BE",
  poland: "PL", polska: "PL", pl: "PL",
  ukraine: "UA", ua: "UA",
  russia: "RU", ru: "RU",
  romania: "RO", ro: "RO",
  hungary: "HU", hu: "HU",
  czechia: "CZ", "czech republic": "CZ", cz: "CZ",
  slovakia: "SK", sk: "SK",
  sweden: "SE", se: "SE",
  norway: "NO", no: "NO",
  denmark: "DK", dk: "DK",
  finland: "FI", fi: "FI",
  iceland: "IS", is: "IS",
  ireland: "IE", ie: "IE",
  portugal: "PT", pt: "PT",
  greece: "GR", gr: "GR",
  turkey: "TR", türkiye: "TR", turkiye: "TR", tr: "TR",
  canada: "CA", ca: "CA",
  mexico: "MX", méxico: "MX", mx: "MX",
  brazil: "BR", brasil: "BR", br: "BR",
  argentina: "AR", ar: "AR",
  colombia: "CO", co: "CO",
  chile: "CL", cl: "CL",
  venezuela: "VE", ve: "VE",
  peru: "PE", pe: "PE",
  ecuador: "EC", ec: "EC",
  australia: "AU", au: "AU",
  "new zealand": "NZ", nz: "NZ",
  japan: "JP", jp: "JP",
  china: "CN", cn: "CN",
  "south korea": "KR", korea: "KR", kr: "KR",
  india: "IN", in: "IN",
  thailand: "TH", th: "TH",
  philippines: "PH", ph: "PH",
  indonesia: "ID", id: "ID",
  vietnam: "VN", vn: "VN",
  malaysia: "MY", my: "MY",
  singapore: "SG", sg: "SG",
  "south africa": "ZA", za: "ZA",
  egypt: "EG", eg: "EG",
  morocco: "MA", ma: "MA",
  nigeria: "NG", ng: "NG",
  kenya: "KE", ke: "KE",
  israel: "IL", il: "IL",
  iran: "IR", ir: "IR",
  iraq: "IQ", iq: "IQ",
  "saudi arabia": "SA", sa: "SA",
  uae: "AE", "united arab emirates": "AE", ae: "AE",
  kuwait: "KW", kw: "KW",
  qatar: "QA", qa: "QA",
  lebanon: "LB", lb: "LB",
  kazakhstan: "KZ", kz: "KZ",
  croatia: "HR", hr: "HR",
  serbia: "RS", rs: "RS",
  slovenia: "SI", si: "SI",
  bulgaria: "BG", bg: "BG",
  lithuania: "LT", lt: "LT",
  latvia: "LV", lv: "LV",
  estonia: "EE", ee: "EE",
  belarus: "BY", by: "BY",
  cuba: "CU", cu: "CU",
  jamaica: "JM", jm: "JM",
  "puerto rico": "PR", pr: "PR",
  "dominican republic": "DO", do: "DO",
};

export function countryCode(country: string | undefined): string | null {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  if (!key) return null;
  return COUNTRY_CODES[key] ?? (/^[a-z]{2}$/.test(key) ? key.toUpperCase() : null);
}

/** ISO code → regional-indicator flag emoji. */
export function flagEmoji(country: string | undefined): string {
  const code = countryCode(country);
  if (!code) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

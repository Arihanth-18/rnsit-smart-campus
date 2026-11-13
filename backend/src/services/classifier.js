// Issue intelligence. Ported 1:1 from the React prototype so server results match
// what the UI previously computed (keyword order matters: first match wins).

export const routes = {
  IT: 'IT Support',
  NETWORK: 'Network / IT Support',
  ELECTRICAL: 'Electrical Maintenance',
  FACILITY: 'Facilities / Maintenance',
  EXAMINATION: 'Examination Section',
  LIBRARY: 'Library',
  TRANSPORT: 'Transport Office',
  HOUSEKEEPING: 'Housekeeping',
  CANTEEN: 'Canteen Management',
  PLACEMENT: 'Placement Cell',
  UNKNOWN: 'Campus Service Team',
};

export const categoryNames = {
  IT: 'IT',
  NETWORK: 'Network',
  ELECTRICAL: 'Electrical',
  FACILITY: 'Facilities',
  EXAMINATION: 'Examination',
  LIBRARY: 'Library',
  TRANSPORT: 'Transport',
  HOUSEKEEPING: 'Housekeeping',
  CANTEEN: 'Canteen',
  PLACEMENT: 'Placement',
  UNKNOWN: 'Needs clarification',
};

const keywordTests = [
  ['NETWORK', ['wifi', 'wi-fi', 'internet', 'network', 'connection']],
  ['IT', ['projector', 'computer', 'computer lab', 'printer', 'system', 'laptop', 'software']],
  ['ELECTRICAL', ['fan', 'light', 'electric', 'power', 'switch', 'socket']],
  ['FACILITY', ['leak', 'water', 'broken', 'repair', 'washroom', 'classroom', 'furniture']],
  ['EXAMINATION', ['exam', 'timetable', 'hall ticket', 'result', 'marks']],
  ['LIBRARY', ['book', 'library', 'reading room']],
  ['TRANSPORT', ['bus', 'transport', 'route', 'vehicle']],
  ['HOUSEKEEPING', ['clean', 'garbage', 'dust', 'washroom']],
  ['CANTEEN', ['canteen', 'food', 'meal']],
  ['PLACEMENT', ['placement', 'company', 'interview', 'job drive']],
];

const locationPatterns = [
  'library', 'canteen', 'main gate', 'hostel', 'parking', 'auditorium',
  'cse block', 'ece block', 'me block', 'eee block', 'room 302', 'room 204',
];

export function classify(text) {
  const t = String(text).toLowerCase();
  const found = keywordTests.find(([, words]) => words.some((w) => t.includes(w)));
  return found ? found[0] : 'UNKNOWN';
}

export function getLocation(text) {
  const t = String(text).toLowerCase();
  const hit = locationPatterns.find((p) => t.includes(p));
  return hit ? hit.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Not specified';
}

export function getUrgency(text) {
  const t = String(text);
  if (/urgent|immediately|asap|class in \d+|safety|danger|smoke|fire/i.test(t)) return 5;
  if (/today|soon|not working/i.test(t)) return 4;
  return 3;
}

export function priorityFor(severity, impact, urgency) {
  const score = +(severity * 0.4 + impact * 0.35 + urgency * 0.25).toFixed(2);
  const priority = score >= 3.7 ? 'HIGH' : score >= 2.5 ? 'MEDIUM' : 'LOW';
  return { score, priority };
}

/** Full assessment used by both the live preview and issue creation. */
export function assess(description, severity = 3, impact = 3) {
  const category = classify(description);
  const location = getLocation(description);
  const urgency = getUrgency(description);
  const { score, priority } = priorityFor(severity, impact, urgency);
  return {
    category,
    category_label: categoryNames[category],
    location,
    urgency,
    score,
    priority,
    assigned_to: routes[category],
  };
}

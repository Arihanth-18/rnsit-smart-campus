import { classify, getLocation, routes, categoryNames } from './classifier.js';
import { campusInfo } from '../data/campusInfo.js';

const INFO_CATEGORIES = ['EXAMINATION', 'LIBRARY', 'PLACEMENT', 'TRANSPORT', 'CANTEEN'];

export const GREETING =
  "Hello! I'm your RNSIT Smart Campus Assistant. I can help with campus information or guide you through reporting a service issue. What can I help you with today?";

/** Rule-based campus assistant (same behaviour as the prototype). */
export function answer(message) {
  const category = classify(message);
  const location = getLocation(message);

  if (category === 'UNKNOWN') {
    return {
      answer:
        "I couldn't confidently identify the campus service category. Could you share a little more detail? You can also submit it through Report an Issue.",
      analysis: { category, category_label: categoryNames[category], location, team: routes[category] },
    };
  }

  let text;
  if (INFO_CATEGORIES.includes(category)) {
    const key = category === 'EXAMINATION' ? 'exam' : category.toLowerCase();
    const info = campusInfo.find((x) => x.key === key)?.text
      || 'Please contact the concerned campus office for the latest information.';
    text = `This appears to be a ${categoryNames[category].toLowerCase()}-related query. ${info}`;
  } else {
    text =
      `I understand this may be a ${categoryNames[category].toLowerCase()} service issue` +
      `${location !== 'Not specified' ? ` near ${location}` : ''}. ` +
      `The suggested team is ${routes[category]}. You can submit a report so the issue can be tracked.`;
  }

  return {
    answer: text,
    analysis: { category, category_label: categoryNames[category], location, team: routes[category] },
  };
}

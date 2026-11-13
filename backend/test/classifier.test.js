import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, getLocation, getUrgency, priorityFor, assess } from '../src/services/classifier.js';
import { answer } from '../src/services/assistant.js';

test('classifies the prototype sample issues', () => {
  assert.equal(classify('Wi-Fi is not working in the library reading area.'), 'NETWORK');
  assert.equal(classify('Projector in CSE Room 302 is not displaying anything.'), 'IT');
  assert.equal(classify('Water leakage near the ECE block washroom.'), 'FACILITY');
  assert.equal(classify('Classroom fan is making noise in ME 204.'), 'ELECTRICAL');
  assert.equal(classify('Need clarification about the examination timetable.'), 'EXAMINATION');
  assert.equal(classify('College bus route 4 arrived late today.'), 'TRANSPORT');
  assert.equal(classify('hello there'), 'UNKNOWN');
});

test('extracts location', () => {
  assert.equal(getLocation('Wi-Fi down in the library'), 'Library');
  assert.equal(getLocation('leak near ECE block'), 'Ece Block');
  assert.equal(getLocation('something somewhere'), 'Not specified');
});

test('urgency and priority scoring match the UI', () => {
  assert.equal(getUrgency('Projector broken, class in 10 minutes'), 5);
  assert.equal(getUrgency('wifi not working'), 4);
  assert.equal(getUrgency('the light flickers'), 3);
  assert.deepEqual(priorityFor(4, 4, 5), { score: 4.25, priority: 'HIGH' });
  assert.deepEqual(priorityFor(3, 3, 3), { score: 3, priority: 'MEDIUM' });
  assert.deepEqual(priorityFor(1, 1, 1), { score: 1, priority: 'LOW' });
});

test('assess routes to the right team', () => {
  const a = assess('Wi-Fi is not working in the library reading area.', 4, 4);
  assert.equal(a.category, 'NETWORK');
  assert.equal(a.assigned_to, 'Network / IT Support');
  assert.equal(a.location, 'Library');
  assert.equal(a.priority, 'HIGH');
});

test('assistant answers', () => {
  assert.match(answer('Where can I find the examination timetable?').answer, /examination-related query/);
  assert.match(answer('Projector in CSE Room 302 not working').answer, /suggested team is IT Support/);
  assert.match(answer('blah').answer, /couldn't confidently identify/);
});

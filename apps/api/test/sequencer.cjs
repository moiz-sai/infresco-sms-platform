// Runs the destructive backup/restore/reset suite (§T14) last, so its global wipes
// cannot disturb other suites that share the test database.
const Sequencer = require('@jest/test-sequencer').default;
module.exports = class extends Sequencer {
  sort(tests) {
    const score = (t) => (t.path.includes('backup.e2e') ? 1 : 0);
    return [...tests].sort((a, b) => score(a) - score(b) || a.path.localeCompare(b.path));
  }
};

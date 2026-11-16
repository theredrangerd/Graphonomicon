// A frozen graph as data: which page, and the raw control state to redraw it from. No
// geometry, so records survive chart changes and can later be saved or shared. `v` lets
// old records be migrated when the state shape changes.

export const SNAPSHOT_VERSION = 1;

const NUMBER_FIELDS = ['demand', 'supply', 'slopeD', 'slopeS', 'controlPrice'];

export function createSnapshot({ page, state }) {
  return { v: SNAPSHOT_VERSION, page, name: '', state: { ...state } };
}

function validState(state) {
  return Boolean(state) && typeof state === 'object'
    && NUMBER_FIELDS.every((k) => Number.isFinite(state[k]))
    && typeof state.on === 'boolean'
    && (state.view === 'ib' || state.view === 'explorer')
    && (state.focus === null || typeof state.focus === 'string');
}

// Returns a current-version record, or null for anything it can't safely draw.
export function migrateSnapshot(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.v !== SNAPSHOT_VERSION) return null;
  if (typeof record.page !== 'string' || !record.page) return null;
  if (!validState(record.state)) return null;
  return { v: SNAPSHOT_VERSION, page: record.page, name: typeof record.name === 'string' ? record.name : '', state: { ...record.state } };
}

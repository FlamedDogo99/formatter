import {compare, applyPatch} from 'https://esm.sh/fast-json-patch@3.1.0';

const LIMIT = 200;

// Each entry: { forward, inverse } patch arrays.
// patches[0] is the diff from snapshot 0 → 1, etc.
const patches = [];

// base is the oldest snapshot still reachable (patches[0] is applied on top of it).
let base = null;

// cursor points to the current state index (0 = base, 1 = base+patches[0], …)
let cursor = 0;

// True for the entire duration of an undo/redo + render cycle.
// Prevents blur events fired by render() from snapshotting the restored state.
let isRestoring = false;

export function historySnapshot(nextState) {
    if (isRestoring) return;

    if (base === null) {
        // First snapshot — just store the base; nothing to diff against yet.
        base = structuredClone(nextState);
        cursor = 0;
        patches.length = 0;
        return;
    }

    // Reconstruct current state by replaying patches up to cursor.
    const current = _stateAt(cursor);

    const forward = compare(current, nextState);
    if (forward.length === 0) return; // no change

    const inverse = compare(nextState, current);

    // Truncate any redo history ahead of cursor.
    patches.splice(cursor);

    patches.push({forward, inverse});

    // Enforce LIMIT: drop the oldest entry and advance base.
    if (patches.length > LIMIT) {
        base = applyPatch(base, patches[0].forward, false, false).newDocument;
        patches.shift();
    }

    cursor = patches.length;
}

export function historyUndo(onRestore) {
    if (cursor <= 0) return;
    cursor--;
    isRestoring = true;
    try {
        onRestore(_stateAt(cursor));
    } finally {
        isRestoring = false;
    }
}

export function historyRedo(onRestore) {
    if (cursor >= patches.length) return;
    cursor++;
    isRestoring = true;
    try {
        onRestore(_stateAt(cursor));
    } finally {
        isRestoring = false;
    }
}

// Rebuild state at index i by replaying forward patches from base.
function _stateAt(i) {
    let s = structuredClone(base);
    for (let k = 0; k < i; k++) {
        s = applyPatch(s, patches[k].forward, false, false).newDocument;
    }
    return s;
}
import {historyRedo, historySnapshot, historyUndo} from './history.js';
import {parseInline} from './parser.js';

// Converts a plain state string to a string or _fmt array for build.js.
function applyInlineText(text) {
    if (typeof text !== 'string') return text; // already a _fmt object (shouldn't happen in state)
    const parts = parseInline(text);
    if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
    return parts.map(p => {
        switch (p.type) {
            case 'text':
                return p.text;
            case 'bold':
                return {_fmt: 'bold', text: p.text};
            case 'italic':
                return {_fmt: 'italic', text: p.text};
            case 'boldItalic':
                return {_fmt: 'boldItalic', text: p.text};
            case 'underline':
                return {_fmt: 'underline', text: p.text};
            case 'color':
                return {_fmt: 'color', color: p.color, text: p.text};
            case 'italicColor':
                return {_fmt: 'italicColor', color: p.color, text: p.text};
            default:
                return p.text ?? '';
        }
    });
}

// Converts a table cell state string to a plain string, _fmt array, or _cellBg object.
function applyInlineCell(cell) {
    if (typeof cell !== 'string') return cell; // already a structured object (shouldn't happen in state)
    const parts = parseInline(cell);
    if (parts.length === 1) {
        const p = parts[0];
        if (p.type === 'pending') return {
            _cellBg: 'FFF3CD', content: {_fmt: 'italicColor', color: '92400E', text: p.text}
        };
        if (p.type === 'gap') return {_cellBg: 'FFEBEE', content: {_fmt: 'italicColor', color: 'C62828', text: p.text}};
        if (p.type === 'cellBg') return {_cellBg: p.color, content: applyInlineText(p.text)};
        if (p.type === 'text') return p.text;
    }
    return applyInlineText(cell);
}

let state = {
    title: {
        label: 'POLICY MEMORANDUM',
        rows: [{key: 'DATE', value: 'May 28, 2026'}, {key: 'SUBJECT', value: 'Delegation of Authority'},],
    }, body: [{type: 'Section', text: 'Purpose'}, {
        type: 'Paragraph',
        text: 'This DOA matrix establishes a formal governance framework defining who has authority to approve decisions at Bridger Aerospace.'
    }, {type: 'List', items: ['Financial decisions', 'Contracts and legal', 'Operations and safety']}, {
        type: 'Table',
        title: 'Action / Decision Type Matrix',
        headers: ['Action / Decision Type', 'Dollar Threshold', 'Authorized Role(s)'],
        widths: [2144, 1435, 1787],
        rows: [['**Vendor payment / invoice approval**', '$0 – $5,000', 'Accounts Payable'],],
        landscape: false,
    },],
};

const root = document.getElementById('editor');
historySnapshot(state); // capture initial state so undo can return to it
render();

export function doUndo() {
    historyUndo(s => {
        state = s;
        render();
    });
}

export function doRedo() {
    historyRedo(s => {
        state = s;
        render();
    });
}

export function doImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                state = JSON.parse(e.target.result);
                commit();
            } catch {
                alert('Invalid file — expected a JSON state export.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export function doExportState() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
    a.download = 'document-state.json';
    a.click();
}

function commit() {
    historySnapshot(state);
    render();
}

// For text edits: record history without re-rendering (avoids focus loss).
function snapshot() {
    historySnapshot(state);
}

export function stateToComponents() {
    const {title, body} = state;
    const components = [];

    components.push({
        _type: 'Title',
        label: title.label,
        rows: title.rows.map(r => ({_type: 'TitleRow', key: r.key, value: r.value})),
    });

    body.forEach(comp => {
        switch (comp.type) {
            case 'Section':
            case 'Subsection':
            case 'Paragraph':
                components.push({_type: comp.type, text: applyInlineText(comp.text)});
                break;
            case 'List':
                components.push({_type: 'List', items: comp.items.map(applyInlineText)});
                break;
            case 'Table':
                components.push({
                    _type: 'Table',
                    title: comp.title || 'Table',
                    headers: [...comp.headers],
                    widths: comp.widths ? [...comp.widths] : null,
                    rows: comp.rows.map(r => r.map(applyInlineCell)),
                    landscape: comp.landscape,
                });
                break;
        }
    });

    return components;
}

function render() {
    root.replaceChildren()
    root.appendChild(renderTitle());
    root.appendChild(renderBody());
}

function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'cls') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v !== null) e.setAttribute(k, v);
    }
    for (const c of children) {
        if (c == null) continue;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
}

function editable(value, onchange, attrs = {}) {
    const s = el('span', {...attrs, contenteditable: 'true', spellcheck: 'false'});
    s.textContent = value;
    s.addEventListener('input', () => onchange(s.textContent));
    s.addEventListener('blur', () => snapshot());
    s.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            s.blur();
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const all = Array.from(document.querySelectorAll('[contenteditable]'));
            const i = all.indexOf(s);
            const next = all[e.shiftKey ? i - 1 : i + 1];
            if (next) {
                next.focus();
                selectAll(next);
            }
        }
    });
    return s;
}

function selectAll(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
}

function field(label, ...contents) {
    return el('div', {cls: 'field'}, el('div', {cls: 'field-label'}, label), el('div', {cls: 'field-body'}, ...contents),);
}

function insertStrip(onInsert, idx) {
    return el('div', {cls: 'insert-strip'}, el('button', {
        cls: 'insert-btn', onclick: () => onInsert(idx)
    }, '+ insert'),);
}

function itemControls(idx, onUp, onDown, onDelete) {
    return el('span', {cls: 'item-controls'}, el('button', {
        cls: 'ctrl-btn', onclick: onUp
    }, '↑'), el('button', {cls: 'ctrl-btn', onclick: onDown}, '↓'), el('button', {
        cls: 'ctrl-btn ctrl-del', onclick: onDelete
    }, '×'),);
}

function itemRow(idx, total, content, onInsert, onUp, onDown, onDelete) {
    const row = el('div', {cls: 'item-row'}, el('div', {cls: 'item-inner'}, itemControls(idx, onUp, onDown, onDelete), content,),);
    return [insertStrip(onInsert, idx), row];
}

function emptyList(onInsert) {
    return el('div', {cls: 'empty-list'}, el('button', {cls: 'insert-btn', onclick: () => onInsert(0)}, '+ insert'),);
}

function renderTitle() {
    const {title} = state;

    const labelField = field('label', editable(title.label, v => {
        state.title.label = v;
    }),)
    labelField.id = "title"

    let rowsContent;
    if (title.rows.length === 0) {
        rowsContent = [emptyList(i => insertTitleRow(i))];
    } else {
        rowsContent = title.rows.flatMap((row, idx) => renderTitleRow(row, idx));
        rowsContent.push(insertStrip(i => insertTitleRow(i), title.rows.length));
    }

    const rowsField = field('rows', ...rowsContent);

    return el('div', {cls: 'component-block'}, el('div', {cls: 'block-label'}, 'Title'), labelField, rowsField,);
}

function renderTitleRow(row, idx) {
    const {rows} = state.title;
    const total = rows.length;

    const keySpan = editable(row.key, v => {
        state.title.rows[idx].key = v;
    }, {cls: 'row-key'});
    const valSpan = editable(row.value, v => {
        state.title.rows[idx].value = v;
    }, {cls: 'row-value'});

    const content = el('span', {cls: 'title-row-content'}, keySpan, ': ', valSpan);

    return itemRow(idx, total, content, i => insertTitleRow(i), () => moveTitleRow(idx, -1), () => moveTitleRow(idx, +1), () => deleteTitleRow(idx),);
}

function insertTitleRow(idx) {
    state.title.rows.splice(idx, 0, {key: 'KEY', value: ''});
    commit();
}

function deleteTitleRow(idx) {
    state.title.rows.splice(idx, 1);
    commit();
}

function moveTitleRow(idx, dir) {
    const rows = state.title.rows;
    const swap = idx + dir;
    if (swap < 0 || swap >= rows.length) return;
    [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
    commit();
}

function renderBody() {
    const {body} = state;

    let items;
    if (body.length === 0) {
        items = [emptyList(i => insertBodyComp(i))];
    } else {
        items = body.flatMap((comp, idx) => renderBodyComp(comp, idx));
        items.push(insertStrip(i => insertBodyComp(i), body.length));
    }

    return el('div', {cls: 'component-block'}, el('div', {cls: 'block-label'}, 'Body'), el('div', {cls: 'body-list'}, ...items),);
}

function renderBodyComp(comp, idx) {
    let content;
    switch (comp.type) {
        case 'Section':
            content = renderSectionComp(comp, idx);
            break;
        case 'Subsection':
            content = renderSubsectionComp(comp, idx);
            break;
        case 'Paragraph':
            content = renderParagraphComp(comp, idx);
            break;
        case 'List':
            content = renderListComp(comp, idx);
            break;
        case 'Table':
            content = renderTableComp(comp, idx);
            break;
        default:
            content = el('span', {}, '(unknown)');
    }

    const typeSelect = el('select', {
        cls: 'type-select', onchange: e => changeBodyType(idx, e.target.value)
    });
    ['Section', 'Subsection', 'Paragraph', 'List', 'Table'].forEach(t => {
        const opt = el('option', {}, t);
        if (t === comp.type) opt.setAttribute('selected', '');
        typeSelect.appendChild(opt);
    });

    const header = el('div', {cls: 'comp-header'}, typeSelect);
    const block = el('div', {cls: 'comp-block'}, header, content);

    const controls = el('div', {cls: 'body-item-controls'}, el('button', {
        cls: 'ctrl-btn', onclick: () => moveBodyComp(idx, -1)
    }, '↑'), el('button', {cls: 'ctrl-btn', onclick: () => moveBodyComp(idx, +1)}, '↓'), el('button', {
        cls: 'ctrl-btn', onclick: () => deleteBodyComp(idx)
    }, '×'),);

    const row = el('div', {cls: 'item-row body-item-row'}, controls, block);
    return [insertStrip(i => insertBodyComp(i), idx), row];
}

function changeBodyType(idx, newType) {
    const defaults = {
        Section: {type: 'Section', text: ''},
        Subsection: {type: 'Subsection', text: ''},
        Paragraph: {type: 'Paragraph', text: ''},
        List: {type: 'List', items: []},
        Table: {type: 'Table', title: '', headers: ['Column 1'], widths: null, rows: [['cell']], landscape: false},
    };
    state.body[idx] = defaults[newType];
    commit();
}

function insertBodyComp(idx) {
    state.body.splice(idx, 0, {type: 'Paragraph', text: ''});
    commit();
}

function deleteBodyComp(idx) {
    state.body.splice(idx, 1);
    commit();
}

function moveBodyComp(idx, dir) {
    const swap = idx + dir;
    if (swap < 0 || swap >= state.body.length) return;
    [state.body[idx], state.body[swap]] = [state.body[swap], state.body[idx]];
    commit();
}

// ── Section / Subsection ──────────────────────────────────────────────────────
function renderSectionComp(comp, idx) {
    return field('text', editable(comp.text, v => {
        state.body[idx].text = v;
    }));
}

const renderSubsectionComp = renderSectionComp;

function renderParagraphComp(comp, idx) {
    const s = document.createElement('span');
    s.className = 'para-editable';
    s.contentEditable = 'true';
    s.spellcheck = false;
    s.textContent = comp.text;
    s.addEventListener('input', () => {
        state.body[idx].text = s.textContent;
    });
    s.addEventListener('blur', () => snapshot());
    return field('text', s);
}

function renderListComp(comp, idx) {
    const items = comp.items;
    let content;
    if (items.length === 0) {
        content = [emptyList(i => insertListItem(idx, i))];
    } else {
        content = items.flatMap((item, ii) => renderListItem(idx, item, ii, items.length));
        content.push(insertStrip(i => insertListItem(idx, i), items.length));
    }
    return field('items', ...content);
}

function renderListItem(compIdx, item, ii, total) {
    const content = editable(item, v => {
        state.body[compIdx].items[ii] = v;
    }, {cls: 'list-item-text'});
    return itemRow(ii, total, content, i => insertListItem(compIdx, i), () => moveListItem(compIdx, ii, -1), () => moveListItem(compIdx, ii, +1), () => deleteListItem(compIdx, ii),); // returns [strip, row]
}

function insertListItem(compIdx, ii) {
    state.body[compIdx].items.splice(ii, 0, '');
    commit();
}

function deleteListItem(compIdx, ii) {
    state.body[compIdx].items.splice(ii, 1);
    commit();
}

function moveListItem(compIdx, ii, dir) {
    const items = state.body[compIdx].items;
    const swap = ii + dir;
    if (swap < 0 || swap >= items.length) return;
    [items[ii], items[swap]] = [items[swap], items[ii]];
    commit();
}


function renderTableComp(comp, idx) {
    const landscapeChk = el('label', {cls: 'landscape-label'}, el('input', {
        type: 'checkbox', ...(comp.landscape ? {checked: ''} : {}), onchange: e => {
            state.body[idx].landscape = e.target.checked;
            commit();
        }
    }), ' landscape',);

    const colCount = comp.headers.length;

    const ctrlCells = comp.headers.map((_, hi) => {
        return el('th', {cls: 'col-ctrl-cell'}, el('button', {
            cls: 'ctrl-btn ctrl-del', onclick: () => deleteTableHeader(idx, hi)
        }, '×'), el('button', {
            cls: 'ctrl-btn', onclick: () => moveTableHeader(idx, hi, -1)
        }, '←'), el('button', {cls: 'ctrl-btn', onclick: () => moveTableHeader(idx, hi, +1)}, '→'),);
    });

    const hdrCells = comp.headers.map((h, hi) => {
        const m = h.match(/^(.*):(\d+)$/);
        const headerText = m ? m[1] : h;
        const headerWidth = m ? m[2] : String(comp.widths?.[hi] ?? '');
        const textSpan = editable(headerText, v => updateTableHeader(idx, hi, v, widthSpan.textContent), {cls: 'hdr-text'});
        const widthSpan = editable(headerWidth, v => updateTableHeader(idx, hi, textSpan.textContent, v), {cls: 'hdr-width'});

        const isLast = hi === comp.headers.length - 1;
        return el('th', {cls: 'hdr-cell'}, el('div', {cls: 'hdr-fields'}, el('button', {
            cls: 'insert-col-btn', onclick: () => insertTableHeader(idx, hi)
        }, '+'), el('div', {cls: 'hdr-field'}, el('span', {cls: 'hdr-field-label'}, 'heading'), textSpan,), el('div', {cls: 'hdr-field'}, el('span', {cls: 'hdr-field-label'}, 'width'), widthSpan,), ...(isLast ? [el('button', {
            cls: 'insert-col-btn', onclick: () => insertTableHeader(idx, hi + 1)
        }, '+')] : []),),);
    });

    const thead = el('thead', {});
    if (colCount === 0) {
        thead.appendChild(el('tr', {}, el('th', {cls: 'row-ctrl-th'}), el('th', {}, el('button', {
            cls: 'insert-col-btn', onclick: () => insertTableHeader(idx, 0)
        }, '+ column'),),));
    } else {
        const ctrlRow = el('tr', {cls: 'col-ctrl-row'}, el('th', {cls: 'row-ctrl-th'}),  // spacer for row-controls column
            ...ctrlCells,);
        const hdrRow = el('tr', {cls: 'hdr-row'}, el('th', {cls: 'row-ctrl-th'}),  // spacer
            ...hdrCells,);
        thead.appendChild(ctrlRow);
        thead.appendChild(hdrRow);
    }

    const tbody = el('tbody', {});

    if (comp.rows.length === 0) {
        tbody.appendChild(insertTr(idx, 0, colCount));
    } else {
        comp.rows.forEach((row, ri) => {
            tbody.appendChild(insertTr(idx, ri, colCount));
            tbody.appendChild(dataTr(idx, row, ri, comp));
        });
        tbody.appendChild(insertTr(idx, comp.rows.length, colCount));
    }

    return el('div', {cls: 'table-comp'}, el('div', {cls: 'table-toolbar'}, el('label', {cls: 'table-title-label'}, 'title\u00a0'), editable(comp.title ?? '', v => {
        state.body[idx].title = v;
    }, {cls: 'table-title-input'}), el('span', {cls: 'tb-sep'}), landscapeChk,), el('table', {cls: 'tbl-editor'}, thead, tbody),);
}

function insertTr(tIdx, ri, colCount) {
    return el('tr', {cls: 'tbl-insert-row'}, el('td', {cls: 'row-ctrl-td'}),  // spacer
        el('td', {colspan: String(Math.max(colCount, 1))}, el('button', {
            cls: 'insert-btn', onclick: () => insertTableRow(tIdx, ri)
        }, '+ row'),),);
}

function dataTr(tIdx, row, ri, comp) {
    const colCount = comp.headers.length;

    const ctrlTd = el('td', {cls: 'row-ctrl-td'}, el('button', {
        cls: 'ctrl-btn', onclick: () => moveTableRow(tIdx, ri, -1)
    }, '↑'), el('button', {cls: 'ctrl-btn', onclick: () => moveTableRow(tIdx, ri, +1)}, '↓'), el('button', {
        cls: 'ctrl-btn ctrl-del', onclick: () => deleteTableRow(tIdx, ri)
    }, '×'),);

    const cellTds = Array.from({length: colCount}, (_, ci) => {
        const val = row[ci] ?? '';
        return el('td', {}, editable(val, v => {
            state.body[tIdx].rows[ri][ci] = v;
        }, {cls: 'cell-text'}));
    });

    return el('tr', {cls: 'tbl-data-row'}, ctrlTd, ...cellTds);
}

function updateTableHeader(tIdx, hi, text, width) {
    state.body[tIdx].headers[hi] = text.replace(/:(\d+)$/, '');
    const comp = state.body[tIdx];
    const parsed = parseInt(width.trim(), 10);
    if (!isNaN(parsed)) {
        if (!comp.widths) comp.widths = Array(comp.headers.length).fill(0);
        comp.widths[hi] = parsed;
    } else if (comp.widths) {
        comp.widths[hi] = 0;
    }
}

function insertTableHeader(tIdx, hi) {
    const comp = state.body[tIdx];
    comp.headers.splice(hi, 0, 'Column');
    if (comp.widths) comp.widths.splice(hi, 0, 1);
    comp.rows.forEach(r => r.splice(hi, 0, ''));
    commit();
}

function deleteTableHeader(tIdx, hi) {
    const comp = state.body[tIdx];
    comp.headers.splice(hi, 1);
    if (comp.widths) comp.widths.splice(hi, 1);
    comp.rows.forEach(r => r.splice(hi, 1));
    commit();
}

function moveTableHeader(tIdx, hi, dir) {
    const comp = state.body[tIdx];
    const swap = hi + dir;
    if (swap < 0 || swap >= comp.headers.length) return;
    [comp.headers[hi], comp.headers[swap]] = [comp.headers[swap], comp.headers[hi]];
    if (comp.widths) [comp.widths[hi], comp.widths[swap]] = [comp.widths[swap], comp.widths[hi]];
    comp.rows.forEach(r => {
        [r[hi], r[swap]] = [r[swap], r[hi]];
    });
    commit();
}

function insertTableRow(tIdx, ri) {
    const colCount = state.body[tIdx].headers.length;
    state.body[tIdx].rows.splice(ri, 0, Array(colCount).fill(''));
    commit();
}

function deleteTableRow(tIdx, ri) {
    state.body[tIdx].rows.splice(ri, 1);
    commit();
}

function moveTableRow(tIdx, ri, dir) {
    const rows = state.body[tIdx].rows;
    const swap = ri + dir;
    if (swap < 0 || swap >= rows.length) return;
    [rows[ri], rows[swap]] = [rows[swap], rows[ri]];
    commit();
}
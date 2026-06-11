const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    Tab,
    Table,
    TableRow,
    TableCell,
    Header,
    Footer,
    AlignmentType,
    PageOrientation,
    BorderStyle,
    WidthType,
    ShadingType,
    VerticalAlign,
    PageNumber,
    UnderlineType,
    LevelFormat,
} = window.docx;

// Loaded once at startup via loadAssets() before any build() call.
let STYLES_XML = '';
let LOGO_BUFFER = null;

export async function loadAssets(stylesUrl, logoUrl) {
    const [stylesText, logoArrayBuffer] = await Promise.all([fetch(stylesUrl).then(r => r.text()), fetch(logoUrl).then(r => r.arrayBuffer()),]);
    STYLES_XML = stylesText
        .replace(/<w:docDefaults[\s\S]*?<\/w:docDefaults>\s*/g, '')
        .replace(/<w:latentStyles[\s\S]*?<\/w:latentStyles>\s*/g, '');
    LOGO_BUFFER = logoArrayBuffer;
}

// DXA units: 1440 DXA = 1 inch
const PORTRAIT_W = 12240;
const PORTRAIT_H = 15840;
const PORTRAIT_MARGIN = 1440;
const LANDSCAPE_MARGIN = 1080;
// Content widths = page width − 2 * margin
const PORTRAIT_CONTENT = PORTRAIT_W - 2 * PORTRAIT_MARGIN; // 9360
const LANDSCAPE_CONTENT = PORTRAIT_H - 2 * LANDSCAPE_MARGIN; // 13680 (long edge)

const FONT = 'Calibri';
const SIZE = 20; // half-points → 10 pt


function toRuns(content, baseOpts = {}) {
    const segments = (typeof content === 'string' || !Array.isArray(content)) ? [content] : content;

    return segments.map(seg => {
        if (seg && typeof seg === 'object' && seg._fmt === undefined && seg._type === undefined) {
            // Already a docx primitive, so pass through
            return seg;
        }

        const text = typeof seg === 'string' ? seg : (seg?.text ?? '');
        const fmt = typeof seg === 'object' ? seg?._fmt : undefined;

        const extra = {};
        if (fmt === 'bold' || fmt === 'boldItalic') {
            extra.bold = true;
            extra.boldComplexScript = true;
        }
        if (fmt === 'italic' || fmt === 'boldItalic') {
            extra.italics = true;
            extra.italicsComplexScript = true;
        }
        if (fmt === 'underline') {
            extra.underline = {type: UnderlineType.SINGLE};
        }
        if (fmt === 'color' || fmt === 'italicColor') {
            extra.color = seg.color;
        }
        if (fmt === 'italicColor') {
            extra.italics = true;
            extra.italicsComplexScript = true;
        }

        return new TextRun({text, ...baseOpts, ...extra});
    });
}

// <w:tab/> is only valid as a child of <w:r>, never as a bare paragraph child!
function tab(opts = {}) {
    return new TextRun({children: [new Tab()], ...opts});
}

// Inserted automatically between every component.
function spacer() {
    return new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: {line: 240, lineRule: 'auto'},
        children: [],
        run: {font: FONT, size: SIZE},
    });
}

function renderTitle(comp) {
    const out = [];

    out.push(new Paragraph({
        style: 'DocumentLabel', children: [new ImageRun({
            data: LOGO_BUFFER, transformation: {width: 240, height: 79}, type: 'jpeg',
        }),],
    }));

    out.push(new Paragraph({
        style: 'DocumentLabel', children: [new TextRun({text: comp.label, font: FONT, size: SIZE})],
    }));

    out.push(new Paragraph({
        style: 'MessageHeaderFirst',
        spacing: {before: 0, after: 0, line: 240, lineRule: 'auto'},
        indent: {left: 0, firstLine: 0},
        run: {font: FONT, size: SIZE},
        children: [],
    }));

    comp.rows.forEach((row, i) => {
        const isFirst = i === 0;

        if (!isFirst) {
            out.push(new Paragraph({
                style: 'MessageHeader',
                spacing: {after: 0, line: 240, lineRule: 'auto'},
                alignment: AlignmentType.BOTH,
                run: {font: FONT, size: SIZE},
                children: [],
            }));
        }

        if (isFirst) {
            out.push(new Paragraph({
                style: 'MessageHeaderFirst',
                spacing: {before: 0, after: 0, line: 240, lineRule: 'auto'},
                indent: {left: 0, firstLine: 0},
                alignment: AlignmentType.BOTH,
                run: {font: FONT, size: SIZE},
                children: [new TextRun({
                    text: row.key + ':', style: 'MessageHeaderLabel', font: FONT, size: SIZE
                }), tab({font: FONT, size: SIZE}), tab({font: FONT, size: SIZE}), new TextRun({
                    text: row.value, font: FONT, size: SIZE
                }),],
            }));
        } else {
            // FIXME: actually calculate text length for correct number of tabs
            const tabCount = row.key.length <= 8 ? 2 : 1;
            const tabs = Array.from({length: tabCount}, () => tab({font: FONT, size: SIZE}));
            out.push(new Paragraph({
                style: 'MessageHeader',
                spacing: {after: 0, line: 240, lineRule: 'auto'},
                alignment: AlignmentType.BOTH,
                run: {font: FONT, size: SIZE},
                children: [new TextRun({
                    text: row.key + ':', style: 'MessageHeaderLabel', font: FONT, size: SIZE
                }), ...tabs, new TextRun({
                    text: row.value, font: FONT, size: SIZE
                }),],
            }));
        }
    });

    out.push(new Paragraph({
        style: 'MessageHeaderLast',
        spacing: {before: 0, after: 0, line: 20, lineRule: 'exact'},
        indent: {left: 0, firstLine: 0},
        alignment: AlignmentType.BOTH,
        run: {font: FONT, size: 20},
        children: [],
    }));

    return out;
}

function renderSection(comp) {
    const runOpts = {
        font: FONT, size: SIZE, color: '000000', underline: {type: UnderlineType.SINGLE},
    };
    const pMarkOpts = {font: FONT, size: SIZE, color: '000000', underline: {type: UnderlineType.SINGLE}};
    const pBase = {style: 'Heading1', spacing: {before: 0, after: 0}, alignment: AlignmentType.BOTH, run: pMarkOpts};
    return [new Paragraph({...pBase, children: []}), new Paragraph({...pBase, children: toRuns(comp.text, runOpts)}),];
}

function renderSubsection(comp) {
    return [new Paragraph({
        alignment: AlignmentType.BOTH,
        children: toRuns(comp.text, {font: FONT, size: SIZE, bold: true, boldComplexScript: true}),
    }),];
}

function renderParagraph(comp) {
    return [new Paragraph({
        alignment: AlignmentType.BOTH, children: toRuns(comp.text, {font: FONT, size: SIZE}),
    }),];
}

function renderList(comp) {
    return comp.items.map(item => new Paragraph({
        style: 'ListParagraph',
        numbering: {reference: 'bullets', level: 0},
        alignment: AlignmentType.BOTH,
        children: toRuns(item, {font: FONT, size: SIZE}),
    }));
}

function calcWidths(ratios, totalWidth, colCount) {
    const r = ratios ?? Array(colCount).fill(1);
    const sum = r.reduce((a, b) => a + b, 0);
    const widths = r.map(v => Math.floor((v / sum) * totalWidth));
    // Assign any rounding remainder to the first column
    widths[0] += totalWidth - widths.reduce((a, b) => a + b, 0);
    return widths;
}

const cellBorder = {style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC'};
const cellBorders = {top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder};
const cellMargins = {top: 80, bottom: 80, left: 120, right: 120, marginUnitType: WidthType.DXA};

function makeCell(children, fill, colWidth, extras = {}) {
    return new TableCell({
        children,
        shading: {fill, type: ShadingType.CLEAR, color: 'auto'},
        borders: cellBorders,
        margins: cellMargins,
        width: {size: colWidth, type: WidthType.DXA}, ...extras,
    });
}

function renderTable(comp, isLandscape) {
    const contentWidth = isLandscape ? LANDSCAPE_CONTENT : PORTRAIT_CONTENT;
    const colWidths = calcWidths(comp.widths, contentWidth, comp.headers.length);
    const colCount = comp.headers.length;

    const titleRow = new TableRow({
        children: [makeCell([new Paragraph({
            children: toRuns(comp.title, {
                font: FONT, size: SIZE, color: 'FFFFFF', bold: true, boldComplexScript: true
            })
        })], '1A3A6B', contentWidth, {columnSpan: colCount},),],
    });

    const headerRow = new TableRow({
        tableHeader: true, children: comp.headers.map((h, i) => makeCell([new Paragraph({
            children: toRuns(h, {
                font: FONT, size: SIZE, color: 'FFFFFF', bold: true, boldComplexScript: true
            })
        })], '2B5EA7', colWidths[i], {verticalAlign: VerticalAlign.CENTER},)),
    });

    const dataRows = comp.rows.map(row => new TableRow({
        children: row.map((cell, i) => {
            const isFirst = i === 0;
            const hasCellBg = cell && typeof cell === 'object' && cell._cellBg !== undefined;
            const cellContent = hasCellBg ? cell.content : cell;
            const cellFill = hasCellBg ? cell._cellBg : (isFirst ? 'EFF4FC' : 'FFFFFF');
            // Only apply isFirst bold on plain string cells; _cellBg cells carry their own formatting.
            const runBase = {font: FONT, size: SIZE, color: '000000'};
            if (isFirst && !hasCellBg) {
                runBase.bold = true;
                runBase.boldComplexScript = true;
            }
            return makeCell([new Paragraph({children: toRuns(cellContent, runBase)})], cellFill, colWidths[i],);
        }),
    }));

    return [new Table({
        width: {size: contentWidth, type: WidthType.DXA},
        columnWidths: colWidths,
        rows: [titleRow, headerRow, ...dataRows],
    }),];
}

function renderComponent(comp, isLandscape) {
    switch (comp._type) {
        case 'Title':
            return renderTitle(comp);
        case 'Section':
            return renderSection(comp);
        case 'Subsection':
            return renderSubsection(comp);
        case 'Paragraph':
            return renderParagraph(comp);
        case 'List':
            return renderList(comp);
        case 'Table':
            return renderTable(comp, isLandscape);
        default:
            throw new Error(`doa-builder: unknown component type "${comp._type}"`);
    }
}

function groupByOrientation(components) {
    const groups = [];
    let current = null;
    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        // A Section (or other non-table) immediately before a landscape table should
        // be placed into the landscape section rather than its own portrait section,
        // to avoid a spurious page break between the heading and its table.
        const nextComp = components[i + 1];
        const nextIsLandscape = nextComp && nextComp._type === 'Table' && nextComp.landscape;
        const isLandscape = comp._type === 'Table' ? comp.landscape : (nextIsLandscape ? true : (current ? current.landscape : false));
        if (!current || current.landscape !== isLandscape) {
            current = {landscape: isLandscape, components: []};
            groups.push(current);
        }
        current.components.push(comp);
    }
    return groups;
}

function logoHeader() {
    return new Header({
        children: [new Paragraph({
            style: 'Header', children: [new ImageRun({
                data: LOGO_BUFFER, transformation: {width: 240, height: 79}, type: 'jpeg',
            }),],
        }),],
    });
}

function emptyHeader() {
    return new Header({children: [new Paragraph({children: []})]});
}

function standardFooter() {
    const r = (opts) => new TextRun({font: FONT, size: SIZE, ...opts});
    return new Footer({
        children: [new Paragraph({
            style: 'Footer', children: [r({text: 'Confidential', italics: true, italicsComplexScript: true}), tab({
                font: FONT, size: SIZE
            }), r({text: 'Page ', bold: true, boldComplexScript: true}), r({
                children: [PageNumber.CURRENT], bold: true, boldComplexScript: true
            }), r({text: ' of ', bold: true, boldComplexScript: true}), r({
                children: [PageNumber.TOTAL_PAGES], bold: true, boldComplexScript: true
            }),],
        }),],
    });
}

function emptyFooter() {
    return new Footer({children: [new Paragraph({children: []})]});
}

async function build(components) {
    const groups = groupByOrientation(components);
    const sections = [];

    groups.forEach((group, groupIdx) => {
        const {landscape} = group;
        const isFirstSection = groupIdx === 0;

        // Build children: components interleaved with spacers
        const children = [];
        group.components.forEach((comp, i) => {
            const prevComp = i > 0 ? group.components[i - 1] : null;
            if (i > 0 && prevComp._type !== 'Title' && comp._type !== 'Section') children.push(spacer());
            children.push(...renderComponent(comp, landscape));
        });
        // Trailing spacer before every section break
        children.push(spacer());

        const pageSize = {
            width: PORTRAIT_W, height: PORTRAIT_H, ...(landscape ? {orientation: PageOrientation.LANDSCAPE} : {}),
        };
        const margin = landscape ? {
            top: LANDSCAPE_MARGIN,
            right: LANDSCAPE_MARGIN,
            bottom: LANDSCAPE_MARGIN,
            left: LANDSCAPE_MARGIN,
            header: 560,
            footer: 560
        } : {
            top: PORTRAIT_MARGIN,
            right: PORTRAIT_MARGIN,
            bottom: PORTRAIT_MARGIN,
            left: PORTRAIT_MARGIN,
            header: 708,
            footer: 708
        };

        sections.push({
            properties: {
                page: {
                    size: pageSize, margin
                }, // titlePage suppresses the header on page 1 (cover page has logo in body instead)
                ...(isFirstSection && !landscape ? {titlePage: true} : {}),
            }, headers: {
                default: logoHeader(), ...(isFirstSection && !landscape ? {first: emptyHeader()} : {}),
            }, footers: {
                default: standardFooter(), ...(isFirstSection && !landscape ? {first: standardFooter()} : {}),
            }, children,
        });
    });

    const doc = new Document({
        externalStyles: STYLES_XML, numbering: {
            config: [{
                reference: 'bullets', levels: [{
                    level: 0, format: LevelFormat.BULLET, text: '\u2022', // •
                    alignment: AlignmentType.LEFT, style: {
                        paragraph: {indent: {left: 720, hanging: 360}},
                    },
                }],
            }],
        }, sections,
    });

    return Packer.toBlob(doc);
}

export function setAssets(stylesXml, logoBuffer) {
    STYLES_XML = stylesXml;
    LOGO_BUFFER = logoBuffer;
}

export {build};
import {build} from './build.js';

const bold = text => ({_fmt: 'bold', text: String(text)});
const italic = text => ({_fmt: 'italic', text: String(text)});
const boldItalic = text => ({_fmt: 'boldItalic', text: String(text)});
const color = (hex, text) => ({_fmt: 'color', color: hex, text: String(text)});
const italicColor = (hex, text) => ({_fmt: 'italicColor', color: hex, text: String(text)});

const cellBg = (hex, content) => ({_cellBg: hex, content});

const TitleRow = (key, value) => ({_type: 'TitleRow', key: String(key), value: String(value)});
const Title = (label, rows) => ({_type: 'Title', label: String(label), rows});

const Section = text => ({_type: 'Section', text});
const Subsection = text => ({_type: 'Subsection', text});
const Paragraph = text => ({_type: 'Paragraph', text});

const List = items => ({_type: 'List', items});

const Table = (title, headers, rows, options = {}) => ({
    _type: 'Table', title, headers, rows, widths: options.widths ?? null, landscape: options.landscape ?? false,
});

const Document = components => build(components);

export {
    Document,
    Title,
    TitleRow,
    Section,
    Subsection,
    Paragraph,
    List,
    Table,
    bold,
    italic,
    boldItalic,
    color,
    italicColor,
    cellBg,
};
// Parses inline formatting syntax into a parts array.
// Used by preview.js to translate state text into docx formatter objects.

export function parseInline(text) {
    const parts = [];
    let i = 0;
    while (i < text.length) {
        if (text.startsWith('[PENDING:', i)) {
            const end = text.lastIndexOf(']');
            if (end > i) {
                let inner = text.slice(i + 9, end);
                const m = inner.match(/^\{i#[0-9A-Fa-f]+\|(.+)\}$/s);
                if (m) inner = m[1];
                parts.push({type: 'pending', text: inner}); i = end + 1; continue;
            }
        }
        if (text.startsWith('[GAP:', i)) {
            const end = text.lastIndexOf(']');
            if (end > i) {
                let inner = text.slice(i + 5, end);
                const m = inner.match(/^\{i#[0-9A-Fa-f]+\|(.+)\}$/s);
                if (m) inner = m[1];
                parts.push({type: 'gap', text: inner}); i = end + 1; continue;
            }
        }
        if (text.startsWith('**_', i)) {
            const end = text.indexOf('_**', i + 3);
            if (end !== -1) { parts.push({type: 'boldItalic', text: text.slice(i + 3, end)}); i = end + 3; continue; }
        }
        if (text.startsWith('**', i)) {
            const end = text.indexOf('**', i + 2);
            if (end !== -1) { parts.push({type: 'bold', text: text.slice(i + 2, end)}); i = end + 2; continue; }
        }
        if (text.startsWith('__', i)) {
            const end = text.indexOf('__', i + 2);
            if (end !== -1) { parts.push({type: 'underline', text: text.slice(i + 2, end)}); i = end + 2; continue; }
        }
        if (text[i] === '*' && text[i + 1] !== '*') {
            const end = text.indexOf('*', i + 1);
            if (end !== -1) { parts.push({type: 'italic', text: text.slice(i + 1, end)}); i = end + 1; continue; }
        }
        if (text.startsWith('[BG:', i)) {
            const barPos = text.indexOf('|', i);
            const endPos = text.lastIndexOf(']');
            if (barPos !== -1 && endPos > barPos) {
                const bgColor = text.slice(i + 4, barPos);
                const inner   = text.slice(barPos + 1, endPos);
                parts.push({type: 'cellBg', color: bgColor, text: inner});
                i = endPos + 1; continue;
            }
        }
        if (text[i] === '{') {
            const closeBar = text.indexOf('|', i);
            const closeBrace = text.indexOf('}', i);
            if (closeBar !== -1 && closeBrace !== -1 && closeBar < closeBrace) {
                const spec = text.slice(i + 1, closeBar);
                const inner = text.slice(closeBar + 1, closeBrace);
                if (spec.startsWith('i#'))     parts.push({type: 'italicColor', color: spec.slice(2), text: inner});
                else if (spec.startsWith('#')) parts.push({type: 'color', color: spec.slice(1), text: inner});
                i = closeBrace + 1; continue;
            }
        }
        if (parts.length && parts[parts.length - 1].type === 'text') parts[parts.length - 1].text += text[i];
        else parts.push({type: 'text', text: text[i]});
        i++;
    }
    return parts;
}
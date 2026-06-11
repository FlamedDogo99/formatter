# JSON Format

The document is a single JSON object with two keys: `title` and `body`.

```json
{
  "title": { ... },
  "body": [ ... ]
}
```

## title

```json
"title": {
  "label": "POLICY MEMORANDUM",
  "rows": [
    { "key": "DATE",        "value": "May 28, 2026" },
    { "key": "SUBJECT",     "value": "Delegation of Authority" },
    { "key": "PREPARED BY", "value": "Jane Smith" }
  ]
}
```

Renders a cover block with the label and a key/value header table. There is exactly one title per document.

## body

An array of component objects. Each has a `type` field.

### Section

```json
{ "type": "Section", "text": "Purpose" }
```

Renders as an underlined heading.

### Subsection

```json
{ "type": "Subsection", "text": "Role-Based Authority" }
```

Renders as a bold paragraph with no special spacing.

### Paragraph

```json
{ "type": "Paragraph", "text": "Body copy goes here." }
```

### List

```json
{
  "type": "List",
  "items": [
    "First item",
    "Second item"
  ]
}
```

Renders as a bulleted list.

### Table

```json
{
  "type": "Table",
  "title": "Optional table title",
  "headers": ["Column A:2160", "Column B:3600", "Column C:3600"],
  "widths": [2160, 3600, 3600],
  "rows": [
    ["Cell 1", "Cell 2", "Cell 3"]
  ],
  "landscape": false
}
```

Header strings use the format `"Label:width"` where width is in DXA units (1440 DXA = 1 inch). The `widths` array must match the number of headers. Setting `landscape: true` rotates the page for that section.

The first cell in each data row renders bold with a light blue background by default. Other cells have a white background.

## Inline formatting

These markers work in any text field including table cells.

| Syntax              | Result                      |
|---------------------|-----------------------------|
| `**text**`          | bold                        |
| `*text*`            | italic                      |
| `**_text_**`        | bold italic                 |
| `__text__`          | underline                   |
| `{#RRGGBB\|text}`   | colored text                |
| `{i#RRGGBB\|text}`  | italic colored text         |
| `[BG:RRGGBB\|text]` | cell background color       |
| `[PENDING: text]`   | pending placeholder styling |
| `[GAP: text]`       | gap/missing control styling |
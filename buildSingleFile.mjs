import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Minify docx.iife.js ───────────────────────────────────────────────────
const docxMinified = await esbuild.transform(
    fs.readFileSync(path.join(__dirname, 'docx.iife.js'), 'utf8'),
    { minify: true, target: 'es2020' }
);
const script1 = `<script>${docxMinified.code.trimEnd()}</script>`;

// ── 2. Embed styles.xml and logo.jpeg as globals ─────────────────────────────
const stylesRaw = fs.readFileSync(path.join(__dirname, 'styles.xml'), 'utf8');
const stylesEscaped = stylesRaw
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');

const logoB64 = fs.readFileSync(path.join(__dirname, 'logo.jpeg')).toString('base64');
const script2 = `<script>const __STYLES_XML_RAW__='${stylesEscaped}',__LOGO_B64__="${logoB64}"</script>`;

// ── 3. Bundle the app JS ──────────────────────────────────────────────────────
// Strategy: bundle as ESM (no TLA — esbuild handles async inside functions),
// then wrap the output in  !async function(){ <bundle body> }()
//
// The patched entry replaces loadAssets() with direct global reads and uses
// an async IIFE internally (not top-level await) so esbuild is happy with
// format:'esm' + no TLA support.
const patchedEntry = `
import { Document } from './index.js';
import { doUndo, doRedo, doImport, doExportState, stateToComponents } from './main.js';

// Called by the outer !async wrapper
export async function __run__() {
  // Replace loadAssets(): read from globals set by script2
  await (async function() {
    const stylesText = __STYLES_XML_RAW__;
    STYLES_XML = stylesText
      .replace(/<w:docDefaults[\\s\\S]*?<\\/w:docDefaults>\\s*/g, '')
      .replace(/<w:latentStyles[\\s\\S]*?<\\/w:latentStyles>\\s*/g, '');
    LOGO_BUFFER = (function(b64) {
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return buf.buffer;
    })(__LOGO_B64__);
  })();

  Object.assign(window, { doUndo, doRedo, doImport, doExportState, doExport });

  async function doExport() {
    const exportButton = document.getElementById('export-btn');
    const titleElement = document.querySelector("#title > div.field-body > span");
    const title = titleElement.textContent ? titleElement.textContent : 'document';
    exportButton.disabled = true;
    exportButton.textContent = 'building\u2026';
    try {
      const blob = await Document(stateToComponents());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title + '.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = 'export .docx';
    }
  }
}
`;

const entryPath = path.join(__dirname, '_bundle_entry.js');
fs.writeFileSync(entryPath, patchedEntry);

const bundleResult = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    write: false,
    logLevel: 'warning',
});

fs.unlinkSync(entryPath);

// ESM output looks like:
//   var STYLES_XML="",LOGO_BUFFER=null;...
//   async function __run__(){...}
//   export { __run__ };
//
// Strip the `export { __run__ };` line and call __run__() inside the wrapper.
let bundleCode = bundleResult.outputFiles[0].text.trim();

// Remove the ESM export statement at the end
bundleCode = bundleCode.replace(/\nexport\s*\{[^}]*\}\s*;?\s*$/, '');
bundleCode = bundleCode.trim();

// Wrap in !async function(){...}() and call __run__()
const script3 = `<script>!async function(){${bundleCode};await __run__()}()</script>`;

// ── 4. Build the HTML ─────────────────────────────────────────────────────────
const css = fs.readFileSync(path.join(__dirname, 'editor.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Editor</title>
    <style>
${css}    </style>
</head>
<body>

<div id="toolbar">
    <div class="tb-group">
        <button onclick="doUndo()">&#x21A9; undo</button>
        <button onclick="doRedo()">&#x21AA; redo</button>
    </div>
    <div class="tb-sep"></div>
    <div class="tb-group">
        <button id="export-btn" onclick="doExport()">export .docx</button>
        <button onclick="doExportState()">save</button>
        <button onclick="doImport()">load</button>
    </div>
    <span id="status"></span>
</div>

<div id="editor"></div>

${script1}
${script2}
${script3}

</body>
</html>`;

const outPath = path.join(__dirname, 'single_file.html');
fs.writeFileSync(outPath, html);
const size = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Built: ${outPath} (${size} KB)`);
console.log(`Target: 669.7 KB`);

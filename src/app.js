import {loadAssets} from './build.js';
import {Document} from './index.js';
import {doUndo, doRedo, doImport, doExportState, stateToComponents} from './main.js';

await loadAssets('./styles.xml', './logo.jpeg');

Object.assign(window, {doUndo, doRedo, doImport, doExportState, doExport});

async function doExport() {
    const exportButton = document.getElementById('export-btn');
    const titleElement = document.querySelector("#title > div.field-body > span")
    const title = titleElement.textContent ? titleElement.textContent : 'document';
    exportButton.disabled = true;
    exportButton.textContent = 'building…';
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

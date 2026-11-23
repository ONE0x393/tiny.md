// Check types on dragover: the files list is protected until the drop event.
function carriesFiles(transfer) {
  return !!transfer && (Array.from(transfer.types ?? []).includes('Files') || transfer.files?.length > 0);
}

export function bindFileDrop(window, {openFile, reject, highlight}) {
  const capture = true; // Intercept file drops before CodeMirror handles the event.
  window.addEventListener('dragover', event => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    highlight(true);
  }, capture);
  window.addEventListener('dragleave', event => {
    if (!event.relatedTarget || !window.document.contains(event.relatedTarget)) highlight(false);
  }, capture);
  window.addEventListener('dragend', () => highlight(false), capture);
  window.addEventListener('drop', event => {
    highlight(false);
    const transfer = event.dataTransfer;
    if (!carriesFiles(transfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (transfer.files.length !== 1) {
      reject('Drop one Markdown or plain-text file at a time.');
      return;
    }
    openFile(transfer.files[0]);
  }, capture);
}

const MAX_ENTRIES = 5000;
const MAX_DEPTH = 48;
const textFile = /\.(md|markdown|mdown|mkd|txt)$/iu;
const tooLarge = () => new Error('Folder is too large or too deeply nested. Choose a smaller subfolder.');

function branch(name) {
  return {name, folders:new Map(), files:[]};
}
function add(root, parts, load) {
  const name = parts.at(-1);
  if (!textFile.test(name)) return;
  if (parts.length > MAX_DEPTH) throw tooLarge();
  let parent = root;
  for (const part of parts.slice(0,-1)) {
    if (!parent.folders.has(part)) parent.folders.set(part,branch(part));
    parent = parent.folders.get(part);
  }
  parent.files.push({name,load});
}

export function fromFolderPicker(files) {
  if (files.length > MAX_ENTRIES) throw tooLarge();
  let root;
  for (const file of files) {
    const [name,...parts] = (file.webkitRelativePath || '').split('/');
    if (!name || !parts.length) continue;
    root ??= branch(name);
    if (name !== root.name) throw new Error('Choose one folder at a time.');
    add(root,parts,() => file);
  }
  return root ?? branch('Selected folder');
}

export async function fromDroppedFolder(entry, isCurrent = () => true) {
  const root = branch(entry.name);
  let count = 0;
  async function walk(folder, path) {
    if (path.length >= MAX_DEPTH) throw tooLarge();
    const reader = folder.createReader();
    while (isCurrent()) {
      const entries = await new Promise((resolve,reject) => reader.readEntries(resolve,reject));
      if (!entries.length || !isCurrent()) return;
      count += entries.length;
      if (count > MAX_ENTRIES) throw tooLarge();
      for (const entry of entries) {
        if (!isCurrent()) return;
        const parts = [...path,entry.name];
        if (entry.isDirectory) await walk(entry,parts);
        else if (entry.isFile) add(root,parts,() => new Promise((resolve,reject) => entry.file(resolve,reject)));
      }
    }
  }
  await walk(entry,[]);
  return root;
}

export function renderFolder(nav, root, open) {
  const doc = nav.ownerDocument;
  const byName = (a,b) => a.name.localeCompare(b.name,undefined,{numeric:true});
  function list(folder) {
    const ul = doc.createElement('ul');
    for (const child of [...folder.folders.values()].sort(byName)) {
      const li = doc.createElement('li');
      const details = doc.createElement('details');
      const summary = doc.createElement('summary');
      summary.textContent = child.name;
      details.append(summary,list(child));
      li.append(details);
      ul.append(li);
    }
    for (const item of [...folder.files].sort(byName)) {
      const li = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = item.name;
      button.addEventListener('click', () => open(item.load));
      li.append(button);
      ul.append(li);
    }
    return ul;
  }
  if (!root.folders.size && !root.files.length) {
    const empty = doc.createElement('p');
    empty.textContent = 'No Markdown or plain-text files in this folder.';
    nav.replaceChildren(empty);
  } else {
    nav.replaceChildren(list(root));
  }
}

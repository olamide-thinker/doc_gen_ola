const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');

function checkTags(text) {
  const tagPattern = /<(\/?)(div|section|table|thead|tbody|tr|th|td|span)([^>]*?)>/g;
  const stack = [];
  let match;
  const lines = text.split('\n');

  lines.forEach((line, lineNum) => {
    let tagMatch;
    while ((tagMatch = tagPattern.exec(line)) !== null) {
      const isClosing = tagMatch[1] === '/';
      const tagName = tagMatch[2];
      const attributes = tagMatch[3];
      const isSelfClosing = attributes.endsWith('/');

      if (isSelfClosing) continue;

      if (!isClosing) {
        stack.push({ tag: tagName, line: lineNum + 1 });
      } else {
        if (stack.length === 0) {
          console.log(`Error: Extra closing tag </${tagName}> at line ${lineNum + 1}`);
        } else {
          const last = stack.pop();
          if (last.tag !== tagName) {
            console.log(`Error: Mismatched closing tag </${tagName}> at line ${lineNum + 1}, expected </${last.tag}> (opened at line ${last.line})`);
          }
        }
      }
    }
  });

  while (stack.length > 0) {
    const last = stack.pop();
    console.log(`Error: Unclosed tag <${last.tag}> opened at line ${last.line}`);
  }
}

console.log("Checking App.jsx tags...");
checkTags(content);
console.log("Check complete.");

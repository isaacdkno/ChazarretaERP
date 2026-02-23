import fs from 'fs';

const file = './components/OrderCenterView.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const newLines = [...lines.slice(0, 564), ...lines.slice(1109)];
fs.writeFileSync(file, newLines.join('\n'));
console.log('Fixed OrderCenterView.tsx');

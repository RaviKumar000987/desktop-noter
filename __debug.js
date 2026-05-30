const e = require('electron');
console.log('keys:', Object.keys(e).join(', '));
console.log('app:', typeof e.app);
process.exit(0);
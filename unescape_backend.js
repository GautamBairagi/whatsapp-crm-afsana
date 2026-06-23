const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
    if (filePath.endsWith('.js')) {
        let originalCode = fs.readFileSync(filePath, 'utf8');
        let code = originalCode;
        
        // Unescape \` and \$
        code = code.replace(/\\`/g, '`');
        code = code.replace(/\\\$/g, '$');
        
        if (code !== originalCode) {
            fs.writeFileSync(filePath, code);
            console.log(`Unescaped ${filePath}`);
        }
    }
});

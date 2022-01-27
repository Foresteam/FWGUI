const fwgui = require('fwgui')();
const path = require('path');
const RELEASE = true;

const SVLog = text => console.log(`Log: ${text}`);

(async () => {
    if (!await fwgui.start({
        webdir: 'wgui',
        serverPort: 8080,
        clientPort: RELEASE ? 8080 : 8000,
    }))
        console.log('Failed to open GUI');
    await fwgui.expose(SVLog);
    await fwgui.endExpose();
    fwgui.emit('time to print', 'text');
    fwgui.Alert('Message!');
})();
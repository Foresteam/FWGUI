const FWGUI = require('fwgui');
const RELEASE = true;

const SVLog = text => console.log(`Log: ${text}`);

(async () => {
    if (!await FWGUI.start({
        webdir: 'wgui',
        serverPort: 8889,
        clientPort: RELEASE ? 8889 : 8080,
    }))
        console.log('Failed to open GUI');
    await FWGUI.expose(SVLog);
    await FWGUI.endExpose();
    FWGUI.emit('time to print', 'text');
    FWGUI.Alert('Message!');
})();
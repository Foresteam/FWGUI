# FWGUI
This library is a liteweight React Electron cross-platform alternative, small and easy to use. It uses system installed Chromium as frontend engine, so the distribution won't take much disk space (while Electron's will). You can pack it with [nexe](https://github.com/nexe/nexe) or whatever ([F0Talk](https://github.com/foresteam/F0Talk) is an example).

[Python "version" of this library](https://github.com/ChrisKnott/Eel)

**My project in which i used this library as GUI frontend: [F0Talk](https://github.com/foresteam/F0Talk)**
## Installation
```sh
yarn add fwgui
```
or
```sh
npm i fwgui
```
## Example
### Server
```js
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
    // error function, frontend uses this in some cases. We can customize it.
    await fwgui.expose('error', text => {

    });
    await fwgui.endExpose();
    fwgui.emit('time to print', 'text');
    fwgui.Alert('Message!');
})();
```
### Client
```js
(async () => {
    fwgui.expose('Alert', text => alert(text));
    fwgui.on('time to print', text => fwgui.SVLog(text));
    await fwgui.exposeEnd();
    fwgui.SVLog('Functions are now certainly ready, so we can use them freely');
})();
```
* *Don't forget to include the clientside script **fwgui_cl.js** in your HTML file.*
* When using separate frontend server, the clientside lib (node_modules/fwgui/frontend/fwgui_cl.js) is be basically unavaliable. Solutions:
    1. Put the file directly in your HTML folder
    2. Create a symlink
    3. Enter full path to the script (host + port)
    4. ...
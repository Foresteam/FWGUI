# FWGUI [(NPM)](https://www.npmjs.com/package/fwgui)
[Source of inspiration (Python "implementation")](https://github.com/ChrisKnott/Eel)

This library is a liteweight React Electron cross-platform alternative, small and easy to use. It uses system installed Chromium as frontend engine, so the distribution won't take much disk space (while Electron's will). You can pack it with [nexe](https://github.com/nexe/nexe) or whatever ([F0Talk](https://github.com/foresteam/F0Talk) is an example).

Unlike its "older brother", the library just starts a Chromium instance with your web page opened, and provides message excanging with the frontend through JS functions, that are exposed from server to client and vice versa. Like:

Instead of
```js
FWGUI.send('anAction', ['data'])
```
We just use (though serverside's still able to emit events)
```js
FWGUI.anAction(['data'])
```

**An example (my project), slightly outdated: [F0Talk](https://github.com/foresteam/F0Talk)**
## Installation
```sh
pnpm add fwgui
```
or
```sh
yarn add fwgui
```
or
```sh
npm i fwgui
```
## Example
### index.js
```js
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
```
### wgui/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <script src="fwgui_cl.js"></script>
    <script>
        (async () => {
            fwgui.expose('Alert', text => alert(text));
            fwgui.on('time to print', text => fwgui.SVLog(text));
            await fwgui.exposeEnd();
            fwgui.SVLog('Functions are now certainly ready, so we can use them with ease');
        })();
    </script>
</head>
</html>
```
* *Don't forget to include the clientside script **fwgui_cl.js** in your HTML file.*
* When using separate frontend server, the clientside lib (node_modules/fwgui/frontend/fwgui_cl.js) is basically unavaliable. Solutions:
    1. Put the file directly in your HTML folder
    2. Create a symlink
    3. Enter full path to the script (host + port)
    4. ...

const path = require('path');
const fs = require('fs');
const { launch: chrome } = require('chrome-launcher');

const express = require('express');
const { promisify } = require('util');
const app = express();
require('express-ws')(app);

const node_functions = {};

const fwgui = {
    Waiting: class Waiting {},
    waitingForReply: {},
    async start({ startPage = '', webdir = 'wgui', closeOnExit = true, serverPort = 8080, clientPort, chromePath }) {
        if (!webdir)
            return false;
        if (!clientPort)
            clientPort = serverPort;
        let sv = serve(webdir, serverPort);

        // setting up websocket server and running chrome
        const url = `http://localhost:${clientPort}/` + startPage;
        let success = false;
        await chrome({ chromeFlags: [`--app=${url}`, '--window-size=1280,720'], chromePath: chromePath || undefined }).then(instance => {
            if (closeOnExit) {
                process.addListener('exit', () => instance ? instance.kill() : null);
                instance.process.addListener('exit', () => process.exit())
            }
            success = instance;
            return sv;
        }).catch(() =>
            console.log('Couldn\'t find Google Chrome. Please, install it properly or set the path manually through "set chrome_path <path>", then restart FTalk.')
        );
        return success;
    },
    async expose(funcname, func) {
        if (!funcname)
            return;
        if (!func) {
            func = funcname;
            funcname = funcname.name;
        }
        node_functions[funcname] = func;
        while (!this.ws)
            await promisify(setTimeout)(50);
        this.ws.send(JSON.stringify({
            func: funcname,
            expose: true
        }));
    },
    async endExpose() {
        while (!this.ws || !fwgui.endInit)
            await promisify(setTimeout)(50);
        this.ws.send(JSON.stringify({
            endExpose: true
        }));
    },
    async emit(event, ...args) {
        if (!this.ws)
            return;
        this.ws.send(JSON.stringify({
            event,
            args
        }));
    }
};

const serve = (dir, serverPort) => new Promise(resolve => {
    app.use(express.static(dir));
    app.ws('/', async (ws, rq) => {
        fwgui.ws = ws;
        ws.on('message', msg => {
            try {
                msg = JSON.parse(msg);
                // console.log(msg);
                if (msg.endInit) {
                    fwgui.endInit = true;
                    resolve();
                }
                else if (msg.expose) {
                    fwgui[msg.func] = async (...args) => {
                        let fid = `${Date.now().toString(16)}${Math.random().toString(16)}`;
                        console.log(fid);
                        ws.send(JSON.stringify({ func: msg.func, args, fid }));
                        fwgui.waitingForReply[fid] = new fwgui.Waiting();
                        while (fwgui.waitingForReply[fid] instanceof fwgui.Waiting)
                            await promisify(setTimeout)(5);
                        let rs = fwgui.waitingForReply[fid];
                        delete fwgui.waitingForReply[fid];
                        return rs;
                    };
                }
                else if ('reply' in msg)
                    fwgui.waitingForReply[msg.fid] = msg.reply;
                else
                    (async () => ws.send(JSON.stringify({
                        reply: await (node_functions[msg.func])(...msg.args) || null,
                        fid: msg.fid
                    })))();
            }
            catch (e) {
                node_functions.error('Serverside error: ' + e.stack);
            }
        });
        ws.on('close', () => delete fwgui.ws);
    });
    let server = app.listen(serverPort);
    process.addListener('exit', () => server.close() );
    fwgui.expose(function error(...text) { console.log('\x1b[31m', ...text); });
});

module.exports = fwgui;
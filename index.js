const path = require('path');
const fs = require('fs');
const { launch: chrome } = require('chrome-launcher');

const express = require('express');
const { promisify } = require('util');
const app = express();
require('express-ws')(app);

const node_functions = {};

class FWGUI {
    static #Waiting = class Waiting {};
    #waitingForReply = {};

    #serve(dir, serverPort) {
        return new Promise(resolve => {
            app.use(express.static(dir));
            app.use(express.static('node_modules/fwgui/frontend'));
            app.ws('/', async ws => {
                this.ws = ws;
                ws.on('message', msg => {
                    try {
                        msg = JSON.parse(msg);
                        // console.log(msg);
                        if (msg.endInit) {
                            this.endInit = true;
                            resolve();
                        }
                        else if (msg.expose) {
                            this[msg.func] = async (...args) => {
                                let fid = `${Date.now().toString(16)}${Math.random().toString(16)}`;
                                console.log(fid);
                                ws.send(JSON.stringify({ func: msg.func, args, fid }));
                                this.#waitingForReply[fid] = new FWGUI.#Waiting();
                                while (this.#waitingForReply[fid] instanceof FWGUI.#Waiting)
                                    await promisify(setTimeout)(5);
                                let rs = this.#waitingForReply[fid];
                                delete this.#waitingForReply[fid];
                                return rs;
                            };
                        }
                        else if ('reply' in msg)
                            this.#waitingForReply[msg.fid] = msg.reply;
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
                ws.on('close', () => delete this.ws);
            });
            let server = app.listen(serverPort);
            process.addListener('exit', () => server.close());
            this.expose(function error(...text) { console.log('\x1b[31m', ...text); });
        })
    }

    constructor() {}

    /**
     * Start Express server, that will be backend
     * @param {string} startPage Start page, e.g. index.html
     * @param {string} webdir Directory where frontend resides
     * @param {boolean} closeOnExit
     * @param {number} serverPort
     * @param {number} clientPort Useful when your HTTP and Websocket server is not the same thing. See my F0Talk repo for example of usage
     * @param {string} chromePath Chromium should be found automatically, but if not, you can pass the path here
     * @returns Chromium instance or false
     */
    async start({ startPage = '', webdir = 'wgui', closeOnExit = true, serverPort = 8080, clientPort, chromePath }) {
        if (!webdir)
            return false;
        if (!clientPort)
            clientPort = serverPort;
        let sv = this.#serve(webdir, serverPort);

        // setting up websocket server and running chrome
        const url = `http://localhost:${clientPort}/` + startPage;
        let success = false;
        await chrome({
            chromeFlags: [`--app=${url}`, '--window-size=1280,720'],
            chromePath: chromePath || undefined,
            ignoreDefaultFlags: true
        }).then(instance => {
            if (closeOnExit) {
                process.addListener('exit', () => instance ? instance.kill() : null);
                instance.process.addListener('exit', () => process.exit())
            }
            success = instance;
            return sv;
        });
        return success;
    }
    /**
     * Expose backend function to frontend
     * @param {function|string} funcname JS function or frontend alias
     * @param {function} func JS function, if alias was passed before
     */
    async expose(funcname, func = null) {
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
    }
    /**
     * Tell the frontend that all functions are defined
     */
    async endExpose() {
        while (!this.ws || !this.endInit)
            await promisify(setTimeout)(50);
        this.ws.send(JSON.stringify({
            endExpose: true
        }));
    }
    /**
     * AKA publish (the frontend is the subscriber)
     * @param {string} event Function name
     * @param  {...any} args
     */
    async emit(event, ...args) {
        if (!this.ws)
            return;
        this.ws.send(JSON.stringify({
            event,
            args
        }));
    }
};

module.exports = () => new FWGUI();
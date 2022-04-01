import { launch as chrome, LaunchedChrome } from 'chrome-launcher';

import express from 'express';
import { promisify } from 'util';
import expressWs, { WebsocketRequestHandler } from 'express-ws';
import WS from 'ws';

const app = expressWs(express()).app;

const node_functions: {
	[index: string]: CallableFunction,
	/** Logs error to console */
	error?: (...text: any[]) => void;
} = {};

interface Message {
	reply?: any;
	fid?: string;
	func?: string;
	args?: any[];
	endInit?: boolean;
	expose?: boolean;
}
interface StartParams {
	/** Start page, e.g. index.html */
	startPage?: string,
	/** Directory where frontend resides */
	webdir?: string,
	closeOnExit?: boolean,
	serverPort?: number,
	/** Port where your frontend server is on. Useful when your HTTP and Websocket server is not the same thing. See my F0Talk repo for example of usage */
	clientPort?: number,
	/** Chromium should be found automatically, but if not, you can pass the path here */
	chromiumPath?: string
}
class FWGUI {
	[index: string]: any;
    static #Waiting = class Waiting {};

    #waitingForReply: { [index: string]: any } = {};
	ws: WS;
	endInit: boolean;

    #serve(dir: string, serverPort: number) {
        return new Promise<void>(resolve => {
            app.use(express.static(dir));
            app.use(express.static('node_modules/fwgui/frontend'));
            app.ws('/', async ws => {
                this.ws = ws;
                ws.on('message', (_msg: any) => {
                    try {
                        const msg: Message = JSON.parse(_msg);
                        // console.log(msg);
                        if (msg.endInit) {
                            this.endInit = true;
                            resolve();
                        }
                        else if (msg.expose) {
                            this[msg.func] = async (...args: any[]) => {
                                let fid = `${Date.now().toString(16)}${Math.random().toString(16)}`;
                                console.log(fid);
								ws.send(JSON.stringify(<Message>{ func: msg.func, args, fid }));
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
							(async () => ws.send(JSON.stringify(<Message>{
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
            this.expose(function error(...text: any[]) { console.log('\x1b[31m', ...text); });
        })
    }

    constructor() {}

    async start({ startPage = '', webdir = 'wgui', closeOnExit = true, serverPort = 8080, clientPort, chromiumPath }: StartParams): Promise<boolean | LaunchedChrome> {
        if (!webdir)
            return false;
        if (!clientPort)
            clientPort = serverPort;
        let sv = this.#serve(webdir, serverPort);

        // setting up websocket server and running chrome
        const url = `http://localhost:${clientPort}/` + startPage;
        let success: LaunchedChrome | boolean = false;
        await chrome({
            chromeFlags: [`--app=${url}`, '--window-size=1280,720'],
            chromePath: chromiumPath || undefined,
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
     * @param funcname JS function or frontend alias
     * @param func JS function, if alias was passed before
     */
    async expose(funcname: CallableFunction | string, func: CallableFunction | null = null) {
        if (!funcname)
            return;
        if (!func) {
            func = funcname as CallableFunction;
            funcname = (funcname as CallableFunction).name;
        }
        node_functions[funcname as string] = func;
        while (!this.ws)
            await promisify(setTimeout)(50);
        this.ws.send(JSON.stringify(<Message>{
            func: funcname,
            expose: true
        }));
    }
    /** Tell the frontend that all functions are defined */
    async endExpose() {
        while (!this.ws || !this.endInit)
            await promisify(setTimeout)(50);
        this.ws.send(JSON.stringify(<Message>{
            endExpose: true
        }));
    }
    /**
     * AKA publish (the frontend is the subscriber)
     * @param event Name
     * @param args The arguments
     */
    async emit(event: string, ...args: any[]) {
        if (!this.ws)
            return;
		this.ws.send(JSON.stringify(<Message>{
            event,
            args
        }));
    }
}
export default () => new FWGUI();
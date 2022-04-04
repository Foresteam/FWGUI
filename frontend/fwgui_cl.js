class FWGUI {
	static #Waiting = class Waiting {};
	static #waitingForReply = {};
	static #exposed = {};
	static #exposeEnd = false;
	static #subscribes = {};

	static #resolve(name) {
		this[name] = async (...args) => await this.#svExec(name, ...args);
	};
	static async #svExec(func, ...args) {
		let fid = `${Date.now().toString(16)}${Math.random().toString(16)}`;
		this.ws.send(JSON.stringify({ func, args, fid }));
		this.#waitingForReply[fid] = new FWGUI.#Waiting();
		while (this.#waitingForReply[fid] instanceof FWGUI.#Waiting)
			await new Promise(resolve => setTimeout(resolve, 10));
		let rs = this.#waitingForReply[fid];
		delete this.#waitingForReply[fid];
		return rs;
	};

	// initializer is now where it should be
	static {
		this.ws = new WebSocket('ws://localhost:8889');
		this.ws.connected = false;
		this.ws.onopen = () => {
			this.ws.connected = true;
			for (const func in this.#exposed)
				this.ws.send(JSON.stringify({ expose: true, func }));
			this.ws.send(JSON.stringify({ endInit: true }));
		};
		this.ws.onmessage = async ({ data: msg }) => {
			try {
				msg = JSON.parse(msg);
				let f = this.#exposed[msg.func];
				if (msg.expose)
					return this.#resolve(msg.func);
				if ('reply' in msg)
					return this.#waitingForReply[msg.fid] = msg.reply;
				if (msg.endExpose)
					return this.#exposeEnd = true;
				if (msg.event) {
					for (let sub of (this.#subscribes[msg.event] || []))
						sub(...msg.args);
					return;
				}
				if (f)
					return this.ws.send(JSON.stringify({
						reply: await f(...msg.args) || null,
						fid: msg.fid
					}));
				this.error(`function '${msg.func}' not found`);
			}
			catch (e) {
				this.error(`Clientside error: ${e.stack}`);
			}
		};
	}

	/**
	 * Await this to assure that functions you call exist
	 */
	static async exposeEnd() {
		while (!this.#exposeEnd)
			await new Promise(resolve => setTimeout(resolve, 50));
		await new Promise(resolve => setTimeout(resolve, 150)); // just to be sure...
	};
	/**
	 * Expose frontend function to backend
	 * @param {function|string} funcname JS function or backend alias
	 * @param {function} func JS function, if alias was passed before
	 */
	static expose(funcname, func = null) {
		if (!funcname)
			return;
		if (!func) {
			func = funcname;
			funcname = funcname.name;
		}
		this.#exposed[funcname] = func;
		if (this.ws.connected)
			this.ws.send(JSON.stringify({ expose: true, func: funcname }));
	};
	/**
	 * Subscribe on an event
	 * @param {string} eventName 
	 * @param {function} callback 
	 */
	static on(eventName, callback) {
		if (!this.#subscribes[eventName])
			this.#subscribes[eventName] = [];
		this.#subscribes[eventName].push(callback);
	};
};
// aliases
FWGUI.prototype.On = FWGUI.on;
FWGUI.prototype.Expose = FWGUI.expose;
FWGUI.prototype.ExposeEnd = FWGUI.exposeEnd;
const fwgui = FWGUI;
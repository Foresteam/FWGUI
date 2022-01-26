var fwgui = {
	Waiting: class Waiting {},
	waitingForReply: {},
	exposed: {},
	_exposeEnd: false,
	subscribes: {},
	/**
	 * Await this to assure that functions you call exist
	 */
	async exposeEnd() {
		while (!this._exposeEnd)
			await new Promise(resolve => setTimeout(resolve, 50));
		await new Promise(resolve => setTimeout(resolve, 150)); // just to be sure...
	},
	/**
	 * Expose frontend function to backend
	 * @param {function|string} funcname JS function or backend alias
	 * @param {function} func JS function, if alias was passed before
	 */
	expose(funcname, func = null) {
		if (!funcname)
			return;
		if (!func) {
			func = funcname;
			funcname = funcname.name;
		}
		this.exposed[funcname] = func;
		if (this.ws.connected)
			this.ws.send(JSON.stringify({ expose: true, func: funcname }));
	},
	_resolve(name) {
		this[name] = async (...args) => await this._svExec(name, ...args);
	},
	async _svExec(func, ...args) {
		let fid = `${Date.now().toString(16)}${Math.random().toString(16)}`;
		this.ws.send(JSON.stringify({ func, args, fid }));
		this.waitingForReply[fid] = new fwgui.Waiting();
		// fwgui.whoIsGay().then(console.log)
		while (this.waitingForReply[fid] instanceof fwgui.Waiting)
			await new Promise(resolve => setTimeout(resolve, 10));
		let rs = this.waitingForReply[fid];
		delete this.waitingForReply[fid];
		return rs;
	},
	/**
	 * Subscribe on an event
	 * @param {string} eventName 
	 * @param {function} callback 
	 */
	on(eventName, callback) {
		if (!this.subscribes[eventName])
			this.subscribes[eventName] = [];
		this.subscribes[eventName].push(callback);
	},
	start() {
		this.ws = new WebSocket('ws://localhost:8080');
		this.ws.connected = false;
		this.ws.onopen = () => {
			this.ws.connected = true;
			for (const func in this.exposed)
				this.ws.send(JSON.stringify({ expose: true, func }));
			this.ws.send(JSON.stringify({ endInit: true }));
		};
		this.ws.onmessage = async ({ data: msg }) => {
			try {
				msg = JSON.parse(msg);
				console.log(msg);
				let f = this.exposed[msg.func];
				if (msg.expose)
					return this._resolve(msg.func);
				if ('reply' in msg)
					return this.waitingForReply[msg.fid] = msg.reply;
				if (msg.endExpose)
					return this._exposeEnd = true;
				if (msg.event) {
					for (let sub of (this.subscribes[msg.event] || []))
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
};
fwgui.start();
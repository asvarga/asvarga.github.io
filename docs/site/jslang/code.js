

////////

function Env(d, snv, dnv) {
	this.d = d;
	this.snv = snv;
	this.dnv = dnv;
}

function Closure(args, body, nv) {
	this.args = args;
	this.body = body;
	this.nv = nv;
}

////////

function egetq(nv, key) { return eget(nv, key.val) }
function eget(nv, key) {
	if (!nv) { return null }
	if (key.val in nv.d) { return nv.d[key.val] }
	return eget(nv.snv, key);
}
function eletq(nv, key, val) { return elet(nv, key.val, val) }
function elet(nv, key, val) { nv.d[key.val] = val }
function esetq(nv, key, val) { return eset(nv, key.val, val) }
function eset(nv, key, val) {
	if (!nv) { return null }
	if (key.val in nv.d) { nv.d[key.val] = val }
	eset(nv.snv, key, val);
}

function first() { return arguments[0]; }
function last() { return arguments[arguments.length-1]; }
function list() { return arguments; }
function dict() {
	var ret = {};
	for (var i=0; i<arguments.length; i+=2) {
		ret[arguments[i].val.val] = arguments[i+1];
	}
	return ret;
}

BASE_d = {
	"+": (x, y) => x+y,
	"*": (x, y) => x*y,
	"-": (x, y) => x-y,
	"/": (x, y) => x/y,
	"%": (x, y) => x%y,

	"==": (x, y) => x==y,
	"!=": (x, y) => x!=y,
	">": (x, y) => x>y,
	"<": (x, y) => x<y,
	">=": (x, y) => x>=y,
	"<=": (x, y) => x<=y,

	"_&&": (x, y) => x&&y,
	"_||": (x, y) => x||y,
	"_->": (x, y) => !x||y,
	"_if": (x, y, z) => x?y:z,
	"dget": (x, y) => x[y.val.val],
	"dset": (x, y, z) => {x[y.val.val] = z},

	"eget": egetq,
	"elet": eletq,
	"eset": esetq,

	"noop": () => null,
	"first": first,
	"last": last,
	"list": list,
	"dict": dict,

	"Quote": (x) => new Quote(x),
	"Env": (d, snv, dnv) => new Env(d, snv, dnv),
	"Closure": (args, body, nv) => new Closure(args, body, nv),

	"e-d": (e) => e.d,
	"e-snv": (e) => e.snv,
	"e-dnv": (e) => e.dnv,
	"c-args": (e) => e.args,
	"c-body": (e) => e.body,
	"c-nv": (e) => e.nv,

	"date": () => new Date(),
	"json": (x) => {
		try { return JSON.stringify(x); }
		catch(err) { return x; }
	},

	"keys": Object.keys,
	"secret": () => {window.alert("this secret is currently uninteresting")},
	
}
var BASE = new Env(BASE_d, null, null);
BASE_d["base"] = BASE;
var USER = new Env({}, BASE, null);


////////

function runs(s, nv) {
	if (typeof(nv)==='undefined') { nv = new Env({}, BASE, null) }
	return run(parser.parse(s), nv);
}
function runq(x, nv) { return run(x.val, nv); }
function run(x, nv) {
	switch (x.constructor.name) {
		case "Expression":
			var ran = x.val.map(xi => run(xi, nv));
			var head = ran[0];
			var args = ran.slice(1);
			if (head instanceof Closure) { return appClos(head, args, nv); }
			return head.apply(null, args);
		case "Hook":
			switch (x.val) {
				case "run": return runq;
				case "nv": 	return nv;
				case "snv": return nv.snv;
				case "dnv": return nv.dnv;
			}
		case "Identifier": return eget(nv, x);
	}
	return x;
}
function appClos(c, args, nv) {
	var d = {};
	for (var i=0; i<args.length; i++) {
		d[c.args.val.val[i].val] = args[i];
	}
	return run(c.body.val, new Env(d, c.nv, nv));
}

////////

function go(input) {
	var output = input.container.parentNode.getElementsByClassName("output")[0];
	var result = input.container.parentNode.getElementsByClassName("result")[0];

	output.innerHTML = "";
	result.innerHTML = "running...";

	USER.d["print"] = (x) => { output.innerHTML += x; return x; };
	USER.d["println"] = (x) => { output.innerHTML += x+"<br>"; return x; };

	try {
		result.innerHTML = runs(input.getValue(), USER);
	} catch(err) {
		if (err.name == "SyntaxError") {
			result.innerHTML = "FAILED: Parse Error";
		} else {
			result.innerHTML = "FAILED: Runtime Error";
		}
	}
}










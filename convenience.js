
function log(x) {
	console.log(x);
}

function get(o, key, def) {
	return (key in o) ? o[key] : def;
}

function any(O) {
	for (var k in O) {
	    return O[k];
	}
}

function anyKey(O) {
	for (var k in O) {
	    return k;
	}
}

function isString(x) {
	return (typeof x == 'string' || x instanceof String);
}

function make(x) {
	// prepend "$" iff string
	return isNaN(x) ? "$"+x : x;
}

// null -> "~"
// number: 123 -> "#123"
// bool: true -> "#1"
// string: "$foo"
// local token: "@123"
// global token: "v", "123"
// unconfirmed global token: "%123"
// node id: "!123"
function toKey(x) {
	if (x instanceof Node) {			// node
		return x.nid;
	} else if (x == null) {				// null
		return "~";
	} else if (isNaN(x)) {				// string
		return x;
	} else {							// num/bool
		return '#'+(x | 0).toString();		
	}
}

function isNumber(n) {
    // Infinity is a number
    return !isNaN(parseFloat(n));// && isFinite(n);
}

/////

// function insert(element, array, ) {
//     array.splice(locationOf(element, array) + 1, 0, element);
//     return array;
// }

function firstEQ(a, b) {
	return a[0] === b[0];
}

function firstGT(a, b) {
	return a[0] > b[0];
}

function getFirstIndex(el, arr, start, end) {
	return getFirstIndex2(el, arr, function(a, b) { return a === b; }, function(a, b) { return a > b; }, start, end);
}

function getFirstIndex2(el, arr, eq, gt, start, end) {
	if (arr.length == 0) { return 0; }
	start = start || 0;
    end = end || arr.length;
    //if (eq(arr[piv], el)) return piv;
    if (end - start <= 1) {
    	return gt(el, arr[start]) ? end : start;
    }
    var piv = Math.round((start + end) / 2);
    if (gt(el, arr[piv])) {
        return getFirstIndex2(el, arr, eq, gt, piv, end);
    } else {
        return getFirstIndex2(el, arr, eq, gt, start, piv);
    }
}

function getLastIndex(el, arr, start, end) {
	return getLastIndex2(el, arr, function(a, b) { return a === b; }, function(a, b) { return a > b; }, start, end);
}

function getLastIndex2(el, arr, eq, gt, start, end) {
	if (arr.length == 0) { return 0; }
	start = start || 0;
    end = end || arr.length;
    //if (eq(arr[piv], el)) return piv;
    // log([start,end]);
    if (end - start <= 1) {
    	if (end == arr.length) { return gt(el, arr[start]) ? end : start; }
    	return gt(arr[end], el) ? start : end;
    }
    var piv = Math.round((start + end) / 2);
    if (gt(arr[piv], el)) {
    	return getLastIndex2(el, arr, eq, gt, start, piv);
    } else {
        return getLastIndex2(el, arr, eq, gt, piv, end);
    }
}

/////////

function map(o, fn) {
	var ret = {};
	for (var key in o) {
		var val = fn(o[key]);
		ret[toKey(val)] = val;
	}
	return ret;
}

function mapKeys(o, fn) {
	var ret = {};
	for (var key in o) {
		var val = fn(key);
		ret[key] = val;
	}
	return ret;
}

// folds the values of an object or array
function fold(o, fn, start) {
	var ret = start;
	for (var key in o) {
		ret = fn(ret, o[key]);
	}
	return ret;
}

// folds the keys of an object or array
function fold(o, fn, start) {
	var ret = start;
	for (var key in o) {
		ret = fn(ret, key);
	}
	return ret;
}

function copyMap(set) {
	var ret = {};
	for (var key in set) {
		ret[key] = set[key];
	}
	return ret;
}

function union(sets) {
	var ret = {};
	for (var i in sets) {
		var set = sets[i];
		for (var key in set) {
			ret[key] = set[key];
		}
	}
	return ret;
}

function combineInto(a, b) {
	for (var key in a) {
		b[key] = a[key];
	}
}

function difference(a, b) {
	var ret = copyMap(a);
	for (var key in b) {
		delete ret[key];
	}
	return ret;
}

function toSet(list) {
	var ret = {};
	for (var i=0; i<list.length; i++) {
		var val = list[i];
		ret[toKey(val)] = true;
	}
	return ret;
}

function filter(set, f) {
	var ret = {};
	for (var key in set) {
		if (f(set[key])) {
			ret[key] = set[key];
		}
	}
}






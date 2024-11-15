var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a2, b2) => (typeof require !== "undefined" ? require : a2)[b2]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/web-streams-polyfill/dist/ponyfill.mjs
var e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? Symbol : (e2) => `Symbol(${e2})`;
function t() {
}
function r(e2) {
  return "object" == typeof e2 && null !== e2 || "function" == typeof e2;
}
var o = t;
function n(e2, t2) {
  try {
    Object.defineProperty(e2, "name", { value: t2, configurable: true });
  } catch (e3) {
  }
}
var a = Promise;
var i = Promise.prototype.then;
var l = Promise.resolve.bind(a);
var s = Promise.reject.bind(a);
function u(e2) {
  return new a(e2);
}
function c(e2) {
  return l(e2);
}
function d(e2) {
  return s(e2);
}
function f(e2, t2, r2) {
  return i.call(e2, t2, r2);
}
function b(e2, t2, r2) {
  f(f(e2, t2, r2), void 0, o);
}
function h(e2, t2) {
  b(e2, t2);
}
function _(e2, t2) {
  b(e2, void 0, t2);
}
function p(e2, t2, r2) {
  return f(e2, t2, r2);
}
function m(e2) {
  f(e2, void 0, o);
}
var y = (e2) => {
  if ("function" == typeof queueMicrotask) y = queueMicrotask;
  else {
    const e3 = c(void 0);
    y = (t2) => f(e3, t2);
  }
  return y(e2);
};
function g(e2, t2, r2) {
  if ("function" != typeof e2) throw new TypeError("Argument is not a function");
  return Function.prototype.apply.call(e2, t2, r2);
}
function w(e2, t2, r2) {
  try {
    return c(g(e2, t2, r2));
  } catch (e3) {
    return d(e3);
  }
}
var S = class {
  constructor() {
    this._cursor = 0, this._size = 0, this._front = { _elements: [], _next: void 0 }, this._back = this._front, this._cursor = 0, this._size = 0;
  }
  get length() {
    return this._size;
  }
  push(e2) {
    const t2 = this._back;
    let r2 = t2;
    16383 === t2._elements.length && (r2 = { _elements: [], _next: void 0 }), t2._elements.push(e2), r2 !== t2 && (this._back = r2, t2._next = r2), ++this._size;
  }
  shift() {
    const e2 = this._front;
    let t2 = e2;
    const r2 = this._cursor;
    let o2 = r2 + 1;
    const n2 = e2._elements, a2 = n2[r2];
    return 16384 === o2 && (t2 = e2._next, o2 = 0), --this._size, this._cursor = o2, e2 !== t2 && (this._front = t2), n2[r2] = void 0, a2;
  }
  forEach(e2) {
    let t2 = this._cursor, r2 = this._front, o2 = r2._elements;
    for (; !(t2 === o2.length && void 0 === r2._next || t2 === o2.length && (r2 = r2._next, o2 = r2._elements, t2 = 0, 0 === o2.length)); ) e2(o2[t2]), ++t2;
  }
  peek() {
    const e2 = this._front, t2 = this._cursor;
    return e2._elements[t2];
  }
};
var v = e("[[AbortSteps]]");
var R = e("[[ErrorSteps]]");
var T = e("[[CancelSteps]]");
var q = e("[[PullSteps]]");
var C = e("[[ReleaseSteps]]");
function E(e2, t2) {
  e2._ownerReadableStream = t2, t2._reader = e2, "readable" === t2._state ? O(e2) : "closed" === t2._state ? function(e3) {
    O(e3), j(e3);
  }(e2) : B(e2, t2._storedError);
}
function P(e2, t2) {
  return Gt(e2._ownerReadableStream, t2);
}
function W(e2) {
  const t2 = e2._ownerReadableStream;
  "readable" === t2._state ? A(e2, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : function(e3, t3) {
    B(e3, t3);
  }(e2, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")), t2._readableStreamController[C](), t2._reader = void 0, e2._ownerReadableStream = void 0;
}
function k(e2) {
  return new TypeError("Cannot " + e2 + " a stream using a released reader");
}
function O(e2) {
  e2._closedPromise = u((t2, r2) => {
    e2._closedPromise_resolve = t2, e2._closedPromise_reject = r2;
  });
}
function B(e2, t2) {
  O(e2), A(e2, t2);
}
function A(e2, t2) {
  void 0 !== e2._closedPromise_reject && (m(e2._closedPromise), e2._closedPromise_reject(t2), e2._closedPromise_resolve = void 0, e2._closedPromise_reject = void 0);
}
function j(e2) {
  void 0 !== e2._closedPromise_resolve && (e2._closedPromise_resolve(void 0), e2._closedPromise_resolve = void 0, e2._closedPromise_reject = void 0);
}
var z = Number.isFinite || function(e2) {
  return "number" == typeof e2 && isFinite(e2);
};
var L = Math.trunc || function(e2) {
  return e2 < 0 ? Math.ceil(e2) : Math.floor(e2);
};
function F(e2, t2) {
  if (void 0 !== e2 && ("object" != typeof (r2 = e2) && "function" != typeof r2)) throw new TypeError(`${t2} is not an object.`);
  var r2;
}
function I(e2, t2) {
  if ("function" != typeof e2) throw new TypeError(`${t2} is not a function.`);
}
function D(e2, t2) {
  if (!/* @__PURE__ */ function(e3) {
    return "object" == typeof e3 && null !== e3 || "function" == typeof e3;
  }(e2)) throw new TypeError(`${t2} is not an object.`);
}
function $(e2, t2, r2) {
  if (void 0 === e2) throw new TypeError(`Parameter ${t2} is required in '${r2}'.`);
}
function M(e2, t2, r2) {
  if (void 0 === e2) throw new TypeError(`${t2} is required in '${r2}'.`);
}
function Y(e2) {
  return Number(e2);
}
function Q(e2) {
  return 0 === e2 ? 0 : e2;
}
function N(e2, t2) {
  const r2 = Number.MAX_SAFE_INTEGER;
  let o2 = Number(e2);
  if (o2 = Q(o2), !z(o2)) throw new TypeError(`${t2} is not a finite number`);
  if (o2 = function(e3) {
    return Q(L(e3));
  }(o2), o2 < 0 || o2 > r2) throw new TypeError(`${t2} is outside the accepted range of 0 to ${r2}, inclusive`);
  return z(o2) && 0 !== o2 ? o2 : 0;
}
function H(e2) {
  if (!r(e2)) return false;
  if ("function" != typeof e2.getReader) return false;
  try {
    return "boolean" == typeof e2.locked;
  } catch (e3) {
    return false;
  }
}
function x(e2) {
  if (!r(e2)) return false;
  if ("function" != typeof e2.getWriter) return false;
  try {
    return "boolean" == typeof e2.locked;
  } catch (e3) {
    return false;
  }
}
function V(e2, t2) {
  if (!Vt(e2)) throw new TypeError(`${t2} is not a ReadableStream.`);
}
function U(e2, t2) {
  e2._reader._readRequests.push(t2);
}
function G(e2, t2, r2) {
  const o2 = e2._reader._readRequests.shift();
  r2 ? o2._closeSteps() : o2._chunkSteps(t2);
}
function X(e2) {
  return e2._reader._readRequests.length;
}
function J(e2) {
  const t2 = e2._reader;
  return void 0 !== t2 && !!K(t2);
}
var ReadableStreamDefaultReader = class {
  constructor(e2) {
    if ($(e2, 1, "ReadableStreamDefaultReader"), V(e2, "First parameter"), Ut(e2)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
    E(this, e2), this._readRequests = new S();
  }
  get closed() {
    return K(this) ? this._closedPromise : d(ee("closed"));
  }
  cancel(e2) {
    return K(this) ? void 0 === this._ownerReadableStream ? d(k("cancel")) : P(this, e2) : d(ee("cancel"));
  }
  read() {
    if (!K(this)) return d(ee("read"));
    if (void 0 === this._ownerReadableStream) return d(k("read from"));
    let e2, t2;
    const r2 = u((r3, o2) => {
      e2 = r3, t2 = o2;
    });
    return function(e3, t3) {
      const r3 = e3._ownerReadableStream;
      r3._disturbed = true, "closed" === r3._state ? t3._closeSteps() : "errored" === r3._state ? t3._errorSteps(r3._storedError) : r3._readableStreamController[q](t3);
    }(this, { _chunkSteps: (t3) => e2({ value: t3, done: false }), _closeSteps: () => e2({ value: void 0, done: true }), _errorSteps: (e3) => t2(e3) }), r2;
  }
  releaseLock() {
    if (!K(this)) throw ee("releaseLock");
    void 0 !== this._ownerReadableStream && function(e2) {
      W(e2);
      const t2 = new TypeError("Reader was released");
      Z(e2, t2);
    }(this);
  }
};
function K(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_readRequests") && e2 instanceof ReadableStreamDefaultReader);
}
function Z(e2, t2) {
  const r2 = e2._readRequests;
  e2._readRequests = new S(), r2.forEach((e3) => {
    e3._errorSteps(t2);
  });
}
function ee(e2) {
  return new TypeError(`ReadableStreamDefaultReader.prototype.${e2} can only be used on a ReadableStreamDefaultReader`);
}
Object.defineProperties(ReadableStreamDefaultReader.prototype, { cancel: { enumerable: true }, read: { enumerable: true }, releaseLock: { enumerable: true }, closed: { enumerable: true } }), n(ReadableStreamDefaultReader.prototype.cancel, "cancel"), n(ReadableStreamDefaultReader.prototype.read, "read"), n(ReadableStreamDefaultReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableStreamDefaultReader.prototype, e.toStringTag, { value: "ReadableStreamDefaultReader", configurable: true });
var te = class {
  constructor(e2, t2) {
    this._ongoingPromise = void 0, this._isFinished = false, this._reader = e2, this._preventCancel = t2;
  }
  next() {
    const e2 = () => this._nextSteps();
    return this._ongoingPromise = this._ongoingPromise ? p(this._ongoingPromise, e2, e2) : e2(), this._ongoingPromise;
  }
  return(e2) {
    const t2 = () => this._returnSteps(e2);
    return this._ongoingPromise ? p(this._ongoingPromise, t2, t2) : t2();
  }
  _nextSteps() {
    if (this._isFinished) return Promise.resolve({ value: void 0, done: true });
    const e2 = this._reader;
    return void 0 === e2 ? d(k("iterate")) : f(e2.read(), (e3) => {
      var t2;
      return this._ongoingPromise = void 0, e3.done && (this._isFinished = true, null === (t2 = this._reader) || void 0 === t2 || t2.releaseLock(), this._reader = void 0), e3;
    }, (e3) => {
      var t2;
      throw this._ongoingPromise = void 0, this._isFinished = true, null === (t2 = this._reader) || void 0 === t2 || t2.releaseLock(), this._reader = void 0, e3;
    });
  }
  _returnSteps(e2) {
    if (this._isFinished) return Promise.resolve({ value: e2, done: true });
    this._isFinished = true;
    const t2 = this._reader;
    if (void 0 === t2) return d(k("finish iterating"));
    if (this._reader = void 0, !this._preventCancel) {
      const r2 = t2.cancel(e2);
      return t2.releaseLock(), p(r2, () => ({ value: e2, done: true }));
    }
    return t2.releaseLock(), c({ value: e2, done: true });
  }
};
var re = { next() {
  return oe(this) ? this._asyncIteratorImpl.next() : d(ne("next"));
}, return(e2) {
  return oe(this) ? this._asyncIteratorImpl.return(e2) : d(ne("return"));
} };
function oe(e2) {
  if (!r(e2)) return false;
  if (!Object.prototype.hasOwnProperty.call(e2, "_asyncIteratorImpl")) return false;
  try {
    return e2._asyncIteratorImpl instanceof te;
  } catch (e3) {
    return false;
  }
}
function ne(e2) {
  return new TypeError(`ReadableStreamAsyncIterator.${e2} can only be used on a ReadableSteamAsyncIterator`);
}
"symbol" == typeof e.asyncIterator && Object.defineProperty(re, e.asyncIterator, { value() {
  return this;
}, writable: true, configurable: true });
var ae = Number.isNaN || function(e2) {
  return e2 != e2;
};
function ie(e2, t2, r2, o2, n2) {
  new Uint8Array(e2).set(new Uint8Array(r2, o2, n2), t2);
}
function le(e2) {
  const t2 = function(e3, t3, r2) {
    if (e3.slice) return e3.slice(t3, r2);
    const o2 = r2 - t3, n2 = new ArrayBuffer(o2);
    return ie(n2, 0, e3, t3, o2), n2;
  }(e2.buffer, e2.byteOffset, e2.byteOffset + e2.byteLength);
  return new Uint8Array(t2);
}
function se(e2) {
  const t2 = e2._queue.shift();
  return e2._queueTotalSize -= t2.size, e2._queueTotalSize < 0 && (e2._queueTotalSize = 0), t2.value;
}
function ue(e2, t2, r2) {
  if ("number" != typeof (o2 = r2) || ae(o2) || o2 < 0 || r2 === 1 / 0) throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
  var o2;
  e2._queue.push({ value: t2, size: r2 }), e2._queueTotalSize += r2;
}
function ce(e2) {
  e2._queue = new S(), e2._queueTotalSize = 0;
}
var ReadableStreamBYOBRequest = class {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
  get view() {
    if (!fe(this)) throw Be("view");
    return this._view;
  }
  respond(e2) {
    if (!fe(this)) throw Be("respond");
    if ($(e2, 1, "respond"), e2 = N(e2, "First parameter"), void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
    this._view.buffer, function(e3, t2) {
      const r2 = e3._pendingPullIntos.peek();
      if ("closed" === e3._controlledReadableByteStream._state) {
        if (0 !== t2) throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
      } else {
        if (0 === t2) throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
        if (r2.bytesFilled + t2 > r2.byteLength) throw new RangeError("bytesWritten out of range");
      }
      r2.buffer = r2.buffer, qe(e3, t2);
    }(this._associatedReadableByteStreamController, e2);
  }
  respondWithNewView(e2) {
    if (!fe(this)) throw Be("respondWithNewView");
    if ($(e2, 1, "respondWithNewView"), !ArrayBuffer.isView(e2)) throw new TypeError("You can only respond with array buffer views");
    if (void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
    e2.buffer, function(e3, t2) {
      const r2 = e3._pendingPullIntos.peek();
      if ("closed" === e3._controlledReadableByteStream._state) {
        if (0 !== t2.byteLength) throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
      } else if (0 === t2.byteLength) throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
      if (r2.byteOffset + r2.bytesFilled !== t2.byteOffset) throw new RangeError("The region specified by view does not match byobRequest");
      if (r2.bufferByteLength !== t2.buffer.byteLength) throw new RangeError("The buffer of view has different capacity than byobRequest");
      if (r2.bytesFilled + t2.byteLength > r2.byteLength) throw new RangeError("The region specified by view is larger than byobRequest");
      const o2 = t2.byteLength;
      r2.buffer = t2.buffer, qe(e3, o2);
    }(this._associatedReadableByteStreamController, e2);
  }
};
Object.defineProperties(ReadableStreamBYOBRequest.prototype, { respond: { enumerable: true }, respondWithNewView: { enumerable: true }, view: { enumerable: true } }), n(ReadableStreamBYOBRequest.prototype.respond, "respond"), n(ReadableStreamBYOBRequest.prototype.respondWithNewView, "respondWithNewView"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableStreamBYOBRequest.prototype, e.toStringTag, { value: "ReadableStreamBYOBRequest", configurable: true });
var ReadableByteStreamController = class {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
  get byobRequest() {
    if (!de(this)) throw Ae("byobRequest");
    return function(e2) {
      if (null === e2._byobRequest && e2._pendingPullIntos.length > 0) {
        const t2 = e2._pendingPullIntos.peek(), r2 = new Uint8Array(t2.buffer, t2.byteOffset + t2.bytesFilled, t2.byteLength - t2.bytesFilled), o2 = Object.create(ReadableStreamBYOBRequest.prototype);
        !function(e3, t3, r3) {
          e3._associatedReadableByteStreamController = t3, e3._view = r3;
        }(o2, e2, r2), e2._byobRequest = o2;
      }
      return e2._byobRequest;
    }(this);
  }
  get desiredSize() {
    if (!de(this)) throw Ae("desiredSize");
    return ke(this);
  }
  close() {
    if (!de(this)) throw Ae("close");
    if (this._closeRequested) throw new TypeError("The stream has already been closed; do not close it again!");
    const e2 = this._controlledReadableByteStream._state;
    if ("readable" !== e2) throw new TypeError(`The stream (in ${e2} state) is not in the readable state and cannot be closed`);
    !function(e3) {
      const t2 = e3._controlledReadableByteStream;
      if (e3._closeRequested || "readable" !== t2._state) return;
      if (e3._queueTotalSize > 0) return void (e3._closeRequested = true);
      if (e3._pendingPullIntos.length > 0) {
        if (e3._pendingPullIntos.peek().bytesFilled > 0) {
          const t3 = new TypeError("Insufficient bytes to fill elements in the given buffer");
          throw Pe(e3, t3), t3;
        }
      }
      Ee(e3), Xt(t2);
    }(this);
  }
  enqueue(e2) {
    if (!de(this)) throw Ae("enqueue");
    if ($(e2, 1, "enqueue"), !ArrayBuffer.isView(e2)) throw new TypeError("chunk must be an array buffer view");
    if (0 === e2.byteLength) throw new TypeError("chunk must have non-zero byteLength");
    if (0 === e2.buffer.byteLength) throw new TypeError("chunk's buffer must have non-zero byteLength");
    if (this._closeRequested) throw new TypeError("stream is closed or draining");
    const t2 = this._controlledReadableByteStream._state;
    if ("readable" !== t2) throw new TypeError(`The stream (in ${t2} state) is not in the readable state and cannot be enqueued to`);
    !function(e3, t3) {
      const r2 = e3._controlledReadableByteStream;
      if (e3._closeRequested || "readable" !== r2._state) return;
      const o2 = t3.buffer, n2 = t3.byteOffset, a2 = t3.byteLength, i2 = o2;
      if (e3._pendingPullIntos.length > 0) {
        const t4 = e3._pendingPullIntos.peek();
        t4.buffer, 0, Re(e3), t4.buffer = t4.buffer, "none" === t4.readerType && ge(e3, t4);
      }
      if (J(r2)) if (function(e4) {
        const t4 = e4._controlledReadableByteStream._reader;
        for (; t4._readRequests.length > 0; ) {
          if (0 === e4._queueTotalSize) return;
          We(e4, t4._readRequests.shift());
        }
      }(e3), 0 === X(r2)) me(e3, i2, n2, a2);
      else {
        e3._pendingPullIntos.length > 0 && Ce(e3);
        G(r2, new Uint8Array(i2, n2, a2), false);
      }
      else Le(r2) ? (me(e3, i2, n2, a2), Te(e3)) : me(e3, i2, n2, a2);
      be(e3);
    }(this, e2);
  }
  error(e2) {
    if (!de(this)) throw Ae("error");
    Pe(this, e2);
  }
  [T](e2) {
    he(this), ce(this);
    const t2 = this._cancelAlgorithm(e2);
    return Ee(this), t2;
  }
  [q](e2) {
    const t2 = this._controlledReadableByteStream;
    if (this._queueTotalSize > 0) return void We(this, e2);
    const r2 = this._autoAllocateChunkSize;
    if (void 0 !== r2) {
      let t3;
      try {
        t3 = new ArrayBuffer(r2);
      } catch (t4) {
        return void e2._errorSteps(t4);
      }
      const o2 = { buffer: t3, bufferByteLength: r2, byteOffset: 0, byteLength: r2, bytesFilled: 0, elementSize: 1, viewConstructor: Uint8Array, readerType: "default" };
      this._pendingPullIntos.push(o2);
    }
    U(t2, e2), be(this);
  }
  [C]() {
    if (this._pendingPullIntos.length > 0) {
      const e2 = this._pendingPullIntos.peek();
      e2.readerType = "none", this._pendingPullIntos = new S(), this._pendingPullIntos.push(e2);
    }
  }
};
function de(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_controlledReadableByteStream") && e2 instanceof ReadableByteStreamController);
}
function fe(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_associatedReadableByteStreamController") && e2 instanceof ReadableStreamBYOBRequest);
}
function be(e2) {
  const t2 = function(e3) {
    const t3 = e3._controlledReadableByteStream;
    if ("readable" !== t3._state) return false;
    if (e3._closeRequested) return false;
    if (!e3._started) return false;
    if (J(t3) && X(t3) > 0) return true;
    if (Le(t3) && ze(t3) > 0) return true;
    if (ke(e3) > 0) return true;
    return false;
  }(e2);
  if (!t2) return;
  if (e2._pulling) return void (e2._pullAgain = true);
  e2._pulling = true;
  b(e2._pullAlgorithm(), () => (e2._pulling = false, e2._pullAgain && (e2._pullAgain = false, be(e2)), null), (t3) => (Pe(e2, t3), null));
}
function he(e2) {
  Re(e2), e2._pendingPullIntos = new S();
}
function _e(e2, t2) {
  let r2 = false;
  "closed" === e2._state && (r2 = true);
  const o2 = pe(t2);
  "default" === t2.readerType ? G(e2, o2, r2) : function(e3, t3, r3) {
    const o3 = e3._reader._readIntoRequests.shift();
    r3 ? o3._closeSteps(t3) : o3._chunkSteps(t3);
  }(e2, o2, r2);
}
function pe(e2) {
  const t2 = e2.bytesFilled, r2 = e2.elementSize;
  return new e2.viewConstructor(e2.buffer, e2.byteOffset, t2 / r2);
}
function me(e2, t2, r2, o2) {
  e2._queue.push({ buffer: t2, byteOffset: r2, byteLength: o2 }), e2._queueTotalSize += o2;
}
function ye(e2, t2, r2, o2) {
  let n2;
  try {
    n2 = t2.slice(r2, r2 + o2);
  } catch (t3) {
    throw Pe(e2, t3), t3;
  }
  me(e2, n2, 0, o2);
}
function ge(e2, t2) {
  t2.bytesFilled > 0 && ye(e2, t2.buffer, t2.byteOffset, t2.bytesFilled), Ce(e2);
}
function we(e2, t2) {
  const r2 = t2.elementSize, o2 = t2.bytesFilled - t2.bytesFilled % r2, n2 = Math.min(e2._queueTotalSize, t2.byteLength - t2.bytesFilled), a2 = t2.bytesFilled + n2, i2 = a2 - a2 % r2;
  let l2 = n2, s2 = false;
  i2 > o2 && (l2 = i2 - t2.bytesFilled, s2 = true);
  const u2 = e2._queue;
  for (; l2 > 0; ) {
    const r3 = u2.peek(), o3 = Math.min(l2, r3.byteLength), n3 = t2.byteOffset + t2.bytesFilled;
    ie(t2.buffer, n3, r3.buffer, r3.byteOffset, o3), r3.byteLength === o3 ? u2.shift() : (r3.byteOffset += o3, r3.byteLength -= o3), e2._queueTotalSize -= o3, Se(e2, o3, t2), l2 -= o3;
  }
  return s2;
}
function Se(e2, t2, r2) {
  r2.bytesFilled += t2;
}
function ve(e2) {
  0 === e2._queueTotalSize && e2._closeRequested ? (Ee(e2), Xt(e2._controlledReadableByteStream)) : be(e2);
}
function Re(e2) {
  null !== e2._byobRequest && (e2._byobRequest._associatedReadableByteStreamController = void 0, e2._byobRequest._view = null, e2._byobRequest = null);
}
function Te(e2) {
  for (; e2._pendingPullIntos.length > 0; ) {
    if (0 === e2._queueTotalSize) return;
    const t2 = e2._pendingPullIntos.peek();
    we(e2, t2) && (Ce(e2), _e(e2._controlledReadableByteStream, t2));
  }
}
function qe(e2, t2) {
  const r2 = e2._pendingPullIntos.peek();
  Re(e2);
  "closed" === e2._controlledReadableByteStream._state ? function(e3, t3) {
    "none" === t3.readerType && Ce(e3);
    const r3 = e3._controlledReadableByteStream;
    if (Le(r3)) for (; ze(r3) > 0; ) _e(r3, Ce(e3));
  }(e2, r2) : function(e3, t3, r3) {
    if (Se(0, t3, r3), "none" === r3.readerType) return ge(e3, r3), void Te(e3);
    if (r3.bytesFilled < r3.elementSize) return;
    Ce(e3);
    const o2 = r3.bytesFilled % r3.elementSize;
    if (o2 > 0) {
      const t4 = r3.byteOffset + r3.bytesFilled;
      ye(e3, r3.buffer, t4 - o2, o2);
    }
    r3.bytesFilled -= o2, _e(e3._controlledReadableByteStream, r3), Te(e3);
  }(e2, t2, r2), be(e2);
}
function Ce(e2) {
  return e2._pendingPullIntos.shift();
}
function Ee(e2) {
  e2._pullAlgorithm = void 0, e2._cancelAlgorithm = void 0;
}
function Pe(e2, t2) {
  const r2 = e2._controlledReadableByteStream;
  "readable" === r2._state && (he(e2), ce(e2), Ee(e2), Jt(r2, t2));
}
function We(e2, t2) {
  const r2 = e2._queue.shift();
  e2._queueTotalSize -= r2.byteLength, ve(e2);
  const o2 = new Uint8Array(r2.buffer, r2.byteOffset, r2.byteLength);
  t2._chunkSteps(o2);
}
function ke(e2) {
  const t2 = e2._controlledReadableByteStream._state;
  return "errored" === t2 ? null : "closed" === t2 ? 0 : e2._strategyHWM - e2._queueTotalSize;
}
function Oe(e2, t2, r2) {
  const o2 = Object.create(ReadableByteStreamController.prototype);
  let n2, a2, i2;
  n2 = void 0 !== t2.start ? () => t2.start(o2) : () => {
  }, a2 = void 0 !== t2.pull ? () => t2.pull(o2) : () => c(void 0), i2 = void 0 !== t2.cancel ? (e3) => t2.cancel(e3) : () => c(void 0);
  const l2 = t2.autoAllocateChunkSize;
  if (0 === l2) throw new TypeError("autoAllocateChunkSize must be greater than 0");
  !function(e3, t3, r3, o3, n3, a3, i3) {
    t3._controlledReadableByteStream = e3, t3._pullAgain = false, t3._pulling = false, t3._byobRequest = null, t3._queue = t3._queueTotalSize = void 0, ce(t3), t3._closeRequested = false, t3._started = false, t3._strategyHWM = a3, t3._pullAlgorithm = o3, t3._cancelAlgorithm = n3, t3._autoAllocateChunkSize = i3, t3._pendingPullIntos = new S(), e3._readableStreamController = t3, b(c(r3()), () => (t3._started = true, be(t3), null), (e4) => (Pe(t3, e4), null));
  }(e2, o2, n2, a2, i2, r2, l2);
}
function Be(e2) {
  return new TypeError(`ReadableStreamBYOBRequest.prototype.${e2} can only be used on a ReadableStreamBYOBRequest`);
}
function Ae(e2) {
  return new TypeError(`ReadableByteStreamController.prototype.${e2} can only be used on a ReadableByteStreamController`);
}
function je(e2, t2) {
  e2._reader._readIntoRequests.push(t2);
}
function ze(e2) {
  return e2._reader._readIntoRequests.length;
}
function Le(e2) {
  const t2 = e2._reader;
  return void 0 !== t2 && !!Fe(t2);
}
Object.defineProperties(ReadableByteStreamController.prototype, { close: { enumerable: true }, enqueue: { enumerable: true }, error: { enumerable: true }, byobRequest: { enumerable: true }, desiredSize: { enumerable: true } }), n(ReadableByteStreamController.prototype.close, "close"), n(ReadableByteStreamController.prototype.enqueue, "enqueue"), n(ReadableByteStreamController.prototype.error, "error"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableByteStreamController.prototype, e.toStringTag, { value: "ReadableByteStreamController", configurable: true });
var ReadableStreamBYOBReader = class {
  constructor(e2) {
    if ($(e2, 1, "ReadableStreamBYOBReader"), V(e2, "First parameter"), Ut(e2)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
    if (!de(e2._readableStreamController)) throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
    E(this, e2), this._readIntoRequests = new S();
  }
  get closed() {
    return Fe(this) ? this._closedPromise : d(De("closed"));
  }
  cancel(e2) {
    return Fe(this) ? void 0 === this._ownerReadableStream ? d(k("cancel")) : P(this, e2) : d(De("cancel"));
  }
  read(e2) {
    if (!Fe(this)) return d(De("read"));
    if (!ArrayBuffer.isView(e2)) return d(new TypeError("view must be an array buffer view"));
    if (0 === e2.byteLength) return d(new TypeError("view must have non-zero byteLength"));
    if (0 === e2.buffer.byteLength) return d(new TypeError("view's buffer must have non-zero byteLength"));
    if (e2.buffer, void 0 === this._ownerReadableStream) return d(k("read from"));
    let t2, r2;
    const o2 = u((e3, o3) => {
      t2 = e3, r2 = o3;
    });
    return function(e3, t3, r3) {
      const o3 = e3._ownerReadableStream;
      o3._disturbed = true, "errored" === o3._state ? r3._errorSteps(o3._storedError) : function(e4, t4, r4) {
        const o4 = e4._controlledReadableByteStream;
        let n2 = 1;
        t4.constructor !== DataView && (n2 = t4.constructor.BYTES_PER_ELEMENT);
        const a2 = t4.constructor, i2 = t4.buffer, l2 = { buffer: i2, bufferByteLength: i2.byteLength, byteOffset: t4.byteOffset, byteLength: t4.byteLength, bytesFilled: 0, elementSize: n2, viewConstructor: a2, readerType: "byob" };
        if (e4._pendingPullIntos.length > 0) return e4._pendingPullIntos.push(l2), void je(o4, r4);
        if ("closed" !== o4._state) {
          if (e4._queueTotalSize > 0) {
            if (we(e4, l2)) {
              const t5 = pe(l2);
              return ve(e4), void r4._chunkSteps(t5);
            }
            if (e4._closeRequested) {
              const t5 = new TypeError("Insufficient bytes to fill elements in the given buffer");
              return Pe(e4, t5), void r4._errorSteps(t5);
            }
          }
          e4._pendingPullIntos.push(l2), je(o4, r4), be(e4);
        } else {
          const e5 = new a2(l2.buffer, l2.byteOffset, 0);
          r4._closeSteps(e5);
        }
      }(o3._readableStreamController, t3, r3);
    }(this, e2, { _chunkSteps: (e3) => t2({ value: e3, done: false }), _closeSteps: (e3) => t2({ value: e3, done: true }), _errorSteps: (e3) => r2(e3) }), o2;
  }
  releaseLock() {
    if (!Fe(this)) throw De("releaseLock");
    void 0 !== this._ownerReadableStream && function(e2) {
      W(e2);
      const t2 = new TypeError("Reader was released");
      Ie(e2, t2);
    }(this);
  }
};
function Fe(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_readIntoRequests") && e2 instanceof ReadableStreamBYOBReader);
}
function Ie(e2, t2) {
  const r2 = e2._readIntoRequests;
  e2._readIntoRequests = new S(), r2.forEach((e3) => {
    e3._errorSteps(t2);
  });
}
function De(e2) {
  return new TypeError(`ReadableStreamBYOBReader.prototype.${e2} can only be used on a ReadableStreamBYOBReader`);
}
function $e(e2, t2) {
  const { highWaterMark: r2 } = e2;
  if (void 0 === r2) return t2;
  if (ae(r2) || r2 < 0) throw new RangeError("Invalid highWaterMark");
  return r2;
}
function Me(e2) {
  const { size: t2 } = e2;
  return t2 || (() => 1);
}
function Ye(e2, t2) {
  F(e2, t2);
  const r2 = null == e2 ? void 0 : e2.highWaterMark, o2 = null == e2 ? void 0 : e2.size;
  return { highWaterMark: void 0 === r2 ? void 0 : Y(r2), size: void 0 === o2 ? void 0 : Qe(o2, `${t2} has member 'size' that`) };
}
function Qe(e2, t2) {
  return I(e2, t2), (t3) => Y(e2(t3));
}
function Ne(e2, t2, r2) {
  return I(e2, r2), (r3) => w(e2, t2, [r3]);
}
function He(e2, t2, r2) {
  return I(e2, r2), () => w(e2, t2, []);
}
function xe(e2, t2, r2) {
  return I(e2, r2), (r3) => g(e2, t2, [r3]);
}
function Ve(e2, t2, r2) {
  return I(e2, r2), (r3, o2) => w(e2, t2, [r3, o2]);
}
Object.defineProperties(ReadableStreamBYOBReader.prototype, { cancel: { enumerable: true }, read: { enumerable: true }, releaseLock: { enumerable: true }, closed: { enumerable: true } }), n(ReadableStreamBYOBReader.prototype.cancel, "cancel"), n(ReadableStreamBYOBReader.prototype.read, "read"), n(ReadableStreamBYOBReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableStreamBYOBReader.prototype, e.toStringTag, { value: "ReadableStreamBYOBReader", configurable: true });
var Ue = "function" == typeof AbortController;
var WritableStream = class {
  constructor(e2 = {}, t2 = {}) {
    void 0 === e2 ? e2 = null : D(e2, "First parameter");
    const r2 = Ye(t2, "Second parameter"), o2 = function(e3, t3) {
      F(e3, t3);
      const r3 = null == e3 ? void 0 : e3.abort, o3 = null == e3 ? void 0 : e3.close, n3 = null == e3 ? void 0 : e3.start, a3 = null == e3 ? void 0 : e3.type, i2 = null == e3 ? void 0 : e3.write;
      return { abort: void 0 === r3 ? void 0 : Ne(r3, e3, `${t3} has member 'abort' that`), close: void 0 === o3 ? void 0 : He(o3, e3, `${t3} has member 'close' that`), start: void 0 === n3 ? void 0 : xe(n3, e3, `${t3} has member 'start' that`), write: void 0 === i2 ? void 0 : Ve(i2, e3, `${t3} has member 'write' that`), type: a3 };
    }(e2, "First parameter");
    var n2;
    (n2 = this)._state = "writable", n2._storedError = void 0, n2._writer = void 0, n2._writableStreamController = void 0, n2._writeRequests = new S(), n2._inFlightWriteRequest = void 0, n2._closeRequest = void 0, n2._inFlightCloseRequest = void 0, n2._pendingAbortRequest = void 0, n2._backpressure = false;
    if (void 0 !== o2.type) throw new RangeError("Invalid type is specified");
    const a2 = Me(r2);
    !function(e3, t3, r3, o3) {
      const n3 = Object.create(WritableStreamDefaultController.prototype);
      let a3, i2, l2, s2;
      a3 = void 0 !== t3.start ? () => t3.start(n3) : () => {
      };
      i2 = void 0 !== t3.write ? (e4) => t3.write(e4, n3) : () => c(void 0);
      l2 = void 0 !== t3.close ? () => t3.close() : () => c(void 0);
      s2 = void 0 !== t3.abort ? (e4) => t3.abort(e4) : () => c(void 0);
      !function(e4, t4, r4, o4, n4, a4, i3, l3) {
        t4._controlledWritableStream = e4, e4._writableStreamController = t4, t4._queue = void 0, t4._queueTotalSize = void 0, ce(t4), t4._abortReason = void 0, t4._abortController = function() {
          if (Ue) return new AbortController();
        }(), t4._started = false, t4._strategySizeAlgorithm = l3, t4._strategyHWM = i3, t4._writeAlgorithm = o4, t4._closeAlgorithm = n4, t4._abortAlgorithm = a4;
        const s3 = bt(t4);
        nt(e4, s3);
        const u2 = r4();
        b(c(u2), () => (t4._started = true, dt(t4), null), (r5) => (t4._started = true, Ze(e4, r5), null));
      }(e3, n3, a3, i2, l2, s2, r3, o3);
    }(this, o2, $e(r2, 1), a2);
  }
  get locked() {
    if (!Ge(this)) throw _t("locked");
    return Xe(this);
  }
  abort(e2) {
    return Ge(this) ? Xe(this) ? d(new TypeError("Cannot abort a stream that already has a writer")) : Je(this, e2) : d(_t("abort"));
  }
  close() {
    return Ge(this) ? Xe(this) ? d(new TypeError("Cannot close a stream that already has a writer")) : rt(this) ? d(new TypeError("Cannot close an already-closing stream")) : Ke(this) : d(_t("close"));
  }
  getWriter() {
    if (!Ge(this)) throw _t("getWriter");
    return new WritableStreamDefaultWriter(this);
  }
};
function Ge(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_writableStreamController") && e2 instanceof WritableStream);
}
function Xe(e2) {
  return void 0 !== e2._writer;
}
function Je(e2, t2) {
  var r2;
  if ("closed" === e2._state || "errored" === e2._state) return c(void 0);
  e2._writableStreamController._abortReason = t2, null === (r2 = e2._writableStreamController._abortController) || void 0 === r2 || r2.abort(t2);
  const o2 = e2._state;
  if ("closed" === o2 || "errored" === o2) return c(void 0);
  if (void 0 !== e2._pendingAbortRequest) return e2._pendingAbortRequest._promise;
  let n2 = false;
  "erroring" === o2 && (n2 = true, t2 = void 0);
  const a2 = u((r3, o3) => {
    e2._pendingAbortRequest = { _promise: void 0, _resolve: r3, _reject: o3, _reason: t2, _wasAlreadyErroring: n2 };
  });
  return e2._pendingAbortRequest._promise = a2, n2 || et(e2, t2), a2;
}
function Ke(e2) {
  const t2 = e2._state;
  if ("closed" === t2 || "errored" === t2) return d(new TypeError(`The stream (in ${t2} state) is not in the writable state and cannot be closed`));
  const r2 = u((t3, r3) => {
    const o3 = { _resolve: t3, _reject: r3 };
    e2._closeRequest = o3;
  }), o2 = e2._writer;
  var n2;
  return void 0 !== o2 && e2._backpressure && "writable" === t2 && Et(o2), ue(n2 = e2._writableStreamController, lt, 0), dt(n2), r2;
}
function Ze(e2, t2) {
  "writable" !== e2._state ? tt(e2) : et(e2, t2);
}
function et(e2, t2) {
  const r2 = e2._writableStreamController;
  e2._state = "erroring", e2._storedError = t2;
  const o2 = e2._writer;
  void 0 !== o2 && it(o2, t2), !function(e3) {
    if (void 0 === e3._inFlightWriteRequest && void 0 === e3._inFlightCloseRequest) return false;
    return true;
  }(e2) && r2._started && tt(e2);
}
function tt(e2) {
  e2._state = "errored", e2._writableStreamController[R]();
  const t2 = e2._storedError;
  if (e2._writeRequests.forEach((e3) => {
    e3._reject(t2);
  }), e2._writeRequests = new S(), void 0 === e2._pendingAbortRequest) return void ot(e2);
  const r2 = e2._pendingAbortRequest;
  if (e2._pendingAbortRequest = void 0, r2._wasAlreadyErroring) return r2._reject(t2), void ot(e2);
  b(e2._writableStreamController[v](r2._reason), () => (r2._resolve(), ot(e2), null), (t3) => (r2._reject(t3), ot(e2), null));
}
function rt(e2) {
  return void 0 !== e2._closeRequest || void 0 !== e2._inFlightCloseRequest;
}
function ot(e2) {
  void 0 !== e2._closeRequest && (e2._closeRequest._reject(e2._storedError), e2._closeRequest = void 0);
  const t2 = e2._writer;
  void 0 !== t2 && St(t2, e2._storedError);
}
function nt(e2, t2) {
  const r2 = e2._writer;
  void 0 !== r2 && t2 !== e2._backpressure && (t2 ? function(e3) {
    Rt(e3);
  }(r2) : Et(r2)), e2._backpressure = t2;
}
Object.defineProperties(WritableStream.prototype, { abort: { enumerable: true }, close: { enumerable: true }, getWriter: { enumerable: true }, locked: { enumerable: true } }), n(WritableStream.prototype.abort, "abort"), n(WritableStream.prototype.close, "close"), n(WritableStream.prototype.getWriter, "getWriter"), "symbol" == typeof e.toStringTag && Object.defineProperty(WritableStream.prototype, e.toStringTag, { value: "WritableStream", configurable: true });
var WritableStreamDefaultWriter = class {
  constructor(e2) {
    if ($(e2, 1, "WritableStreamDefaultWriter"), function(e3, t3) {
      if (!Ge(e3)) throw new TypeError(`${t3} is not a WritableStream.`);
    }(e2, "First parameter"), Xe(e2)) throw new TypeError("This stream has already been locked for exclusive writing by another writer");
    this._ownerWritableStream = e2, e2._writer = this;
    const t2 = e2._state;
    if ("writable" === t2) !rt(e2) && e2._backpressure ? Rt(this) : qt(this), gt(this);
    else if ("erroring" === t2) Tt(this, e2._storedError), gt(this);
    else if ("closed" === t2) qt(this), gt(r2 = this), vt(r2);
    else {
      const t3 = e2._storedError;
      Tt(this, t3), wt(this, t3);
    }
    var r2;
  }
  get closed() {
    return at(this) ? this._closedPromise : d(mt("closed"));
  }
  get desiredSize() {
    if (!at(this)) throw mt("desiredSize");
    if (void 0 === this._ownerWritableStream) throw yt("desiredSize");
    return function(e2) {
      const t2 = e2._ownerWritableStream, r2 = t2._state;
      if ("errored" === r2 || "erroring" === r2) return null;
      if ("closed" === r2) return 0;
      return ct(t2._writableStreamController);
    }(this);
  }
  get ready() {
    return at(this) ? this._readyPromise : d(mt("ready"));
  }
  abort(e2) {
    return at(this) ? void 0 === this._ownerWritableStream ? d(yt("abort")) : function(e3, t2) {
      return Je(e3._ownerWritableStream, t2);
    }(this, e2) : d(mt("abort"));
  }
  close() {
    if (!at(this)) return d(mt("close"));
    const e2 = this._ownerWritableStream;
    return void 0 === e2 ? d(yt("close")) : rt(e2) ? d(new TypeError("Cannot close an already-closing stream")) : Ke(this._ownerWritableStream);
  }
  releaseLock() {
    if (!at(this)) throw mt("releaseLock");
    void 0 !== this._ownerWritableStream && function(e2) {
      const t2 = e2._ownerWritableStream, r2 = new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
      it(e2, r2), function(e3, t3) {
        "pending" === e3._closedPromiseState ? St(e3, t3) : function(e4, t4) {
          wt(e4, t4);
        }(e3, t3);
      }(e2, r2), t2._writer = void 0, e2._ownerWritableStream = void 0;
    }(this);
  }
  write(e2) {
    return at(this) ? void 0 === this._ownerWritableStream ? d(yt("write to")) : function(e3, t2) {
      const r2 = e3._ownerWritableStream, o2 = r2._writableStreamController, n2 = function(e4, t3) {
        try {
          return e4._strategySizeAlgorithm(t3);
        } catch (t4) {
          return ft(e4, t4), 1;
        }
      }(o2, t2);
      if (r2 !== e3._ownerWritableStream) return d(yt("write to"));
      const a2 = r2._state;
      if ("errored" === a2) return d(r2._storedError);
      if (rt(r2) || "closed" === a2) return d(new TypeError("The stream is closing or closed and cannot be written to"));
      if ("erroring" === a2) return d(r2._storedError);
      const i2 = function(e4) {
        return u((t3, r3) => {
          const o3 = { _resolve: t3, _reject: r3 };
          e4._writeRequests.push(o3);
        });
      }(r2);
      return function(e4, t3, r3) {
        try {
          ue(e4, t3, r3);
        } catch (t4) {
          return void ft(e4, t4);
        }
        const o3 = e4._controlledWritableStream;
        if (!rt(o3) && "writable" === o3._state) {
          nt(o3, bt(e4));
        }
        dt(e4);
      }(o2, t2, n2), i2;
    }(this, e2) : d(mt("write"));
  }
};
function at(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_ownerWritableStream") && e2 instanceof WritableStreamDefaultWriter);
}
function it(e2, t2) {
  "pending" === e2._readyPromiseState ? Ct(e2, t2) : function(e3, t3) {
    Tt(e3, t3);
  }(e2, t2);
}
Object.defineProperties(WritableStreamDefaultWriter.prototype, { abort: { enumerable: true }, close: { enumerable: true }, releaseLock: { enumerable: true }, write: { enumerable: true }, closed: { enumerable: true }, desiredSize: { enumerable: true }, ready: { enumerable: true } }), n(WritableStreamDefaultWriter.prototype.abort, "abort"), n(WritableStreamDefaultWriter.prototype.close, "close"), n(WritableStreamDefaultWriter.prototype.releaseLock, "releaseLock"), n(WritableStreamDefaultWriter.prototype.write, "write"), "symbol" == typeof e.toStringTag && Object.defineProperty(WritableStreamDefaultWriter.prototype, e.toStringTag, { value: "WritableStreamDefaultWriter", configurable: true });
var lt = {};
var WritableStreamDefaultController = class {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
  get abortReason() {
    if (!st(this)) throw pt("abortReason");
    return this._abortReason;
  }
  get signal() {
    if (!st(this)) throw pt("signal");
    if (void 0 === this._abortController) throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
    return this._abortController.signal;
  }
  error(e2) {
    if (!st(this)) throw pt("error");
    "writable" === this._controlledWritableStream._state && ht(this, e2);
  }
  [v](e2) {
    const t2 = this._abortAlgorithm(e2);
    return ut(this), t2;
  }
  [R]() {
    ce(this);
  }
};
function st(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_controlledWritableStream") && e2 instanceof WritableStreamDefaultController);
}
function ut(e2) {
  e2._writeAlgorithm = void 0, e2._closeAlgorithm = void 0, e2._abortAlgorithm = void 0, e2._strategySizeAlgorithm = void 0;
}
function ct(e2) {
  return e2._strategyHWM - e2._queueTotalSize;
}
function dt(e2) {
  const t2 = e2._controlledWritableStream;
  if (!e2._started) return;
  if (void 0 !== t2._inFlightWriteRequest) return;
  if ("erroring" === t2._state) return void tt(t2);
  if (0 === e2._queue.length) return;
  const r2 = e2._queue.peek().value;
  r2 === lt ? function(e3) {
    const t3 = e3._controlledWritableStream;
    (function(e4) {
      e4._inFlightCloseRequest = e4._closeRequest, e4._closeRequest = void 0;
    })(t3), se(e3);
    const r3 = e3._closeAlgorithm();
    ut(e3), b(r3, () => (function(e4) {
      e4._inFlightCloseRequest._resolve(void 0), e4._inFlightCloseRequest = void 0, "erroring" === e4._state && (e4._storedError = void 0, void 0 !== e4._pendingAbortRequest && (e4._pendingAbortRequest._resolve(), e4._pendingAbortRequest = void 0)), e4._state = "closed";
      const t4 = e4._writer;
      void 0 !== t4 && vt(t4);
    }(t3), null), (e4) => (function(e5, t4) {
      e5._inFlightCloseRequest._reject(t4), e5._inFlightCloseRequest = void 0, void 0 !== e5._pendingAbortRequest && (e5._pendingAbortRequest._reject(t4), e5._pendingAbortRequest = void 0), Ze(e5, t4);
    }(t3, e4), null));
  }(e2) : function(e3, t3) {
    const r3 = e3._controlledWritableStream;
    !function(e4) {
      e4._inFlightWriteRequest = e4._writeRequests.shift();
    }(r3);
    b(e3._writeAlgorithm(t3), () => {
      !function(e4) {
        e4._inFlightWriteRequest._resolve(void 0), e4._inFlightWriteRequest = void 0;
      }(r3);
      const t4 = r3._state;
      if (se(e3), !rt(r3) && "writable" === t4) {
        const t5 = bt(e3);
        nt(r3, t5);
      }
      return dt(e3), null;
    }, (t4) => ("writable" === r3._state && ut(e3), function(e4, t5) {
      e4._inFlightWriteRequest._reject(t5), e4._inFlightWriteRequest = void 0, Ze(e4, t5);
    }(r3, t4), null));
  }(e2, r2);
}
function ft(e2, t2) {
  "writable" === e2._controlledWritableStream._state && ht(e2, t2);
}
function bt(e2) {
  return ct(e2) <= 0;
}
function ht(e2, t2) {
  const r2 = e2._controlledWritableStream;
  ut(e2), et(r2, t2);
}
function _t(e2) {
  return new TypeError(`WritableStream.prototype.${e2} can only be used on a WritableStream`);
}
function pt(e2) {
  return new TypeError(`WritableStreamDefaultController.prototype.${e2} can only be used on a WritableStreamDefaultController`);
}
function mt(e2) {
  return new TypeError(`WritableStreamDefaultWriter.prototype.${e2} can only be used on a WritableStreamDefaultWriter`);
}
function yt(e2) {
  return new TypeError("Cannot " + e2 + " a stream using a released writer");
}
function gt(e2) {
  e2._closedPromise = u((t2, r2) => {
    e2._closedPromise_resolve = t2, e2._closedPromise_reject = r2, e2._closedPromiseState = "pending";
  });
}
function wt(e2, t2) {
  gt(e2), St(e2, t2);
}
function St(e2, t2) {
  void 0 !== e2._closedPromise_reject && (m(e2._closedPromise), e2._closedPromise_reject(t2), e2._closedPromise_resolve = void 0, e2._closedPromise_reject = void 0, e2._closedPromiseState = "rejected");
}
function vt(e2) {
  void 0 !== e2._closedPromise_resolve && (e2._closedPromise_resolve(void 0), e2._closedPromise_resolve = void 0, e2._closedPromise_reject = void 0, e2._closedPromiseState = "resolved");
}
function Rt(e2) {
  e2._readyPromise = u((t2, r2) => {
    e2._readyPromise_resolve = t2, e2._readyPromise_reject = r2;
  }), e2._readyPromiseState = "pending";
}
function Tt(e2, t2) {
  Rt(e2), Ct(e2, t2);
}
function qt(e2) {
  Rt(e2), Et(e2);
}
function Ct(e2, t2) {
  void 0 !== e2._readyPromise_reject && (m(e2._readyPromise), e2._readyPromise_reject(t2), e2._readyPromise_resolve = void 0, e2._readyPromise_reject = void 0, e2._readyPromiseState = "rejected");
}
function Et(e2) {
  void 0 !== e2._readyPromise_resolve && (e2._readyPromise_resolve(void 0), e2._readyPromise_resolve = void 0, e2._readyPromise_reject = void 0, e2._readyPromiseState = "fulfilled");
}
Object.defineProperties(WritableStreamDefaultController.prototype, { abortReason: { enumerable: true }, signal: { enumerable: true }, error: { enumerable: true } }), "symbol" == typeof e.toStringTag && Object.defineProperty(WritableStreamDefaultController.prototype, e.toStringTag, { value: "WritableStreamDefaultController", configurable: true });
var Pt = "undefined" != typeof DOMException ? DOMException : void 0;
var Wt = function(e2) {
  if ("function" != typeof e2 && "object" != typeof e2) return false;
  try {
    return new e2(), true;
  } catch (e3) {
    return false;
  }
}(Pt) ? Pt : function() {
  const e2 = function(e3, t2) {
    this.message = e3 || "", this.name = t2 || "Error", Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
  };
  return e2.prototype = Object.create(Error.prototype), Object.defineProperty(e2.prototype, "constructor", { value: e2, writable: true, configurable: true }), e2;
}();
function kt(e2, t2, r2, o2, n2, a2) {
  const i2 = e2.getReader(), l2 = t2.getWriter();
  Vt(e2) && (e2._disturbed = true);
  let s2, _2, g2, w2 = false, S2 = false, v2 = "readable", R2 = "writable", T2 = false, q2 = false;
  const C2 = u((e3) => {
    g2 = e3;
  });
  let E2 = Promise.resolve(void 0);
  return u((P2, W2) => {
    let k2;
    function O2() {
      if (w2) return;
      const e3 = u((e4, t3) => {
        !function r3(o3) {
          o3 ? e4() : f(function() {
            if (w2) return c(true);
            return f(l2.ready, () => f(i2.read(), (e5) => !!e5.done || (E2 = l2.write(e5.value), m(E2), false)));
          }(), r3, t3);
        }(false);
      });
      m(e3);
    }
    function B2() {
      return v2 = "closed", r2 ? L2() : z2(() => (Ge(t2) && (T2 = rt(t2), R2 = t2._state), T2 || "closed" === R2 ? c(void 0) : "erroring" === R2 || "errored" === R2 ? d(_2) : (T2 = true, l2.close())), false, void 0), null;
    }
    function A2(e3) {
      return w2 || (v2 = "errored", s2 = e3, o2 ? L2(true, e3) : z2(() => l2.abort(e3), true, e3)), null;
    }
    function j2(e3) {
      return S2 || (R2 = "errored", _2 = e3, n2 ? L2(true, e3) : z2(() => i2.cancel(e3), true, e3)), null;
    }
    if (void 0 !== a2 && (k2 = () => {
      const e3 = void 0 !== a2.reason ? a2.reason : new Wt("Aborted", "AbortError"), t3 = [];
      o2 || t3.push(() => "writable" === R2 ? l2.abort(e3) : c(void 0)), n2 || t3.push(() => "readable" === v2 ? i2.cancel(e3) : c(void 0)), z2(() => Promise.all(t3.map((e4) => e4())), true, e3);
    }, a2.aborted ? k2() : a2.addEventListener("abort", k2)), Vt(e2) && (v2 = e2._state, s2 = e2._storedError), Ge(t2) && (R2 = t2._state, _2 = t2._storedError, T2 = rt(t2)), Vt(e2) && Ge(t2) && (q2 = true, g2()), "errored" === v2) A2(s2);
    else if ("erroring" === R2 || "errored" === R2) j2(_2);
    else if ("closed" === v2) B2();
    else if (T2 || "closed" === R2) {
      const e3 = new TypeError("the destination writable stream closed before all data could be piped to it");
      n2 ? L2(true, e3) : z2(() => i2.cancel(e3), true, e3);
    }
    function z2(e3, t3, r3) {
      function o3() {
        return "writable" !== R2 || T2 ? n3() : h(function() {
          let e4;
          return c(function t4() {
            if (e4 !== E2) return e4 = E2, p(E2, t4, t4);
          }());
        }(), n3), null;
      }
      function n3() {
        return e3 ? b(e3(), () => F2(t3, r3), (e4) => F2(true, e4)) : F2(t3, r3), null;
      }
      w2 || (w2 = true, q2 ? o3() : h(C2, o3));
    }
    function L2(e3, t3) {
      z2(void 0, e3, t3);
    }
    function F2(e3, t3) {
      return S2 = true, l2.releaseLock(), i2.releaseLock(), void 0 !== a2 && a2.removeEventListener("abort", k2), e3 ? W2(t3) : P2(void 0), null;
    }
    w2 || (b(i2.closed, B2, A2), b(l2.closed, function() {
      return S2 || (R2 = "closed"), null;
    }, j2)), q2 ? O2() : y(() => {
      q2 = true, g2(), O2();
    });
  });
}
function Ot(e2, t2) {
  return function(e3) {
    try {
      return e3.getReader({ mode: "byob" }).releaseLock(), true;
    } catch (e4) {
      return false;
    }
  }(e2) ? function(e3) {
    let t3, r2, o2, n2, a2, i2 = e3.getReader(), l2 = false, s2 = false, d2 = false, f2 = false, h2 = false, p2 = false;
    const m2 = u((e4) => {
      a2 = e4;
    });
    function y2(e4) {
      _(e4.closed, (t4) => (e4 !== i2 || (o2.error(t4), n2.error(t4), h2 && p2 || a2(void 0)), null));
    }
    function g2() {
      l2 && (i2.releaseLock(), i2 = e3.getReader(), y2(i2), l2 = false), b(i2.read(), (e4) => {
        var t4, r3;
        if (d2 = false, f2 = false, e4.done) return h2 || o2.close(), p2 || n2.close(), null === (t4 = o2.byobRequest) || void 0 === t4 || t4.respond(0), null === (r3 = n2.byobRequest) || void 0 === r3 || r3.respond(0), h2 && p2 || a2(void 0), null;
        const l3 = e4.value, u2 = l3;
        let c2 = l3;
        if (!h2 && !p2) try {
          c2 = le(l3);
        } catch (e5) {
          return o2.error(e5), n2.error(e5), a2(i2.cancel(e5)), null;
        }
        return h2 || o2.enqueue(u2), p2 || n2.enqueue(c2), s2 = false, d2 ? S2() : f2 && v2(), null;
      }, () => (s2 = false, null));
    }
    function w2(t4, r3) {
      l2 || (i2.releaseLock(), i2 = e3.getReader({ mode: "byob" }), y2(i2), l2 = true);
      const u2 = r3 ? n2 : o2, c2 = r3 ? o2 : n2;
      b(i2.read(t4), (e4) => {
        var t5;
        d2 = false, f2 = false;
        const o3 = r3 ? p2 : h2, n3 = r3 ? h2 : p2;
        if (e4.done) {
          o3 || u2.close(), n3 || c2.close();
          const r4 = e4.value;
          return void 0 !== r4 && (o3 || u2.byobRequest.respondWithNewView(r4), n3 || null === (t5 = c2.byobRequest) || void 0 === t5 || t5.respond(0)), o3 && n3 || a2(void 0), null;
        }
        const l3 = e4.value;
        if (n3) o3 || u2.byobRequest.respondWithNewView(l3);
        else {
          let e5;
          try {
            e5 = le(l3);
          } catch (e6) {
            return u2.error(e6), c2.error(e6), a2(i2.cancel(e6)), null;
          }
          o3 || u2.byobRequest.respondWithNewView(l3), c2.enqueue(e5);
        }
        return s2 = false, d2 ? S2() : f2 && v2(), null;
      }, () => (s2 = false, null));
    }
    function S2() {
      if (s2) return d2 = true, c(void 0);
      s2 = true;
      const e4 = o2.byobRequest;
      return null === e4 ? g2() : w2(e4.view, false), c(void 0);
    }
    function v2() {
      if (s2) return f2 = true, c(void 0);
      s2 = true;
      const e4 = n2.byobRequest;
      return null === e4 ? g2() : w2(e4.view, true), c(void 0);
    }
    function R2(e4) {
      if (h2 = true, t3 = e4, p2) {
        const e5 = [t3, r2], o3 = i2.cancel(e5);
        a2(o3);
      }
      return m2;
    }
    function T2(e4) {
      if (p2 = true, r2 = e4, h2) {
        const e5 = [t3, r2], o3 = i2.cancel(e5);
        a2(o3);
      }
      return m2;
    }
    const q2 = new ReadableStream({ type: "bytes", start(e4) {
      o2 = e4;
    }, pull: S2, cancel: R2 }), C2 = new ReadableStream({ type: "bytes", start(e4) {
      n2 = e4;
    }, pull: v2, cancel: T2 });
    return y2(i2), [q2, C2];
  }(e2) : function(e3, t3) {
    const r2 = e3.getReader();
    let o2, n2, a2, i2, l2, s2 = false, d2 = false, f2 = false, h2 = false;
    const p2 = u((e4) => {
      l2 = e4;
    });
    function m2() {
      return s2 ? (d2 = true, c(void 0)) : (s2 = true, b(r2.read(), (e4) => {
        if (d2 = false, e4.done) return f2 || a2.close(), h2 || i2.close(), f2 && h2 || l2(void 0), null;
        const t4 = e4.value, r3 = t4, o3 = t4;
        return f2 || a2.enqueue(r3), h2 || i2.enqueue(o3), s2 = false, d2 && m2(), null;
      }, () => (s2 = false, null)), c(void 0));
    }
    function y2(e4) {
      if (f2 = true, o2 = e4, h2) {
        const e5 = [o2, n2], t4 = r2.cancel(e5);
        l2(t4);
      }
      return p2;
    }
    function g2(e4) {
      if (h2 = true, n2 = e4, f2) {
        const e5 = [o2, n2], t4 = r2.cancel(e5);
        l2(t4);
      }
      return p2;
    }
    const w2 = new ReadableStream({ start(e4) {
      a2 = e4;
    }, pull: m2, cancel: y2 }), S2 = new ReadableStream({ start(e4) {
      i2 = e4;
    }, pull: m2, cancel: g2 });
    return _(r2.closed, (e4) => (a2.error(e4), i2.error(e4), f2 && h2 || l2(void 0), null)), [w2, S2];
  }(e2);
}
var ReadableStreamDefaultController = class {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
  get desiredSize() {
    if (!Bt(this)) throw Dt("desiredSize");
    return Lt(this);
  }
  close() {
    if (!Bt(this)) throw Dt("close");
    if (!Ft(this)) throw new TypeError("The stream is not in a state that permits close");
    !function(e2) {
      if (!Ft(e2)) return;
      const t2 = e2._controlledReadableStream;
      e2._closeRequested = true, 0 === e2._queue.length && (jt(e2), Xt(t2));
    }(this);
  }
  enqueue(e2) {
    if (!Bt(this)) throw Dt("enqueue");
    if (!Ft(this)) throw new TypeError("The stream is not in a state that permits enqueue");
    return function(e3, t2) {
      if (!Ft(e3)) return;
      const r2 = e3._controlledReadableStream;
      if (Ut(r2) && X(r2) > 0) G(r2, t2, false);
      else {
        let r3;
        try {
          r3 = e3._strategySizeAlgorithm(t2);
        } catch (t3) {
          throw zt(e3, t3), t3;
        }
        try {
          ue(e3, t2, r3);
        } catch (t3) {
          throw zt(e3, t3), t3;
        }
      }
      At(e3);
    }(this, e2);
  }
  error(e2) {
    if (!Bt(this)) throw Dt("error");
    zt(this, e2);
  }
  [T](e2) {
    ce(this);
    const t2 = this._cancelAlgorithm(e2);
    return jt(this), t2;
  }
  [q](e2) {
    const t2 = this._controlledReadableStream;
    if (this._queue.length > 0) {
      const r2 = se(this);
      this._closeRequested && 0 === this._queue.length ? (jt(this), Xt(t2)) : At(this), e2._chunkSteps(r2);
    } else U(t2, e2), At(this);
  }
  [C]() {
  }
};
function Bt(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_controlledReadableStream") && e2 instanceof ReadableStreamDefaultController);
}
function At(e2) {
  const t2 = function(e3) {
    const t3 = e3._controlledReadableStream;
    if (!Ft(e3)) return false;
    if (!e3._started) return false;
    if (Ut(t3) && X(t3) > 0) return true;
    if (Lt(e3) > 0) return true;
    return false;
  }(e2);
  if (!t2) return;
  if (e2._pulling) return void (e2._pullAgain = true);
  e2._pulling = true;
  b(e2._pullAlgorithm(), () => (e2._pulling = false, e2._pullAgain && (e2._pullAgain = false, At(e2)), null), (t3) => (zt(e2, t3), null));
}
function jt(e2) {
  e2._pullAlgorithm = void 0, e2._cancelAlgorithm = void 0, e2._strategySizeAlgorithm = void 0;
}
function zt(e2, t2) {
  const r2 = e2._controlledReadableStream;
  "readable" === r2._state && (ce(e2), jt(e2), Jt(r2, t2));
}
function Lt(e2) {
  const t2 = e2._controlledReadableStream._state;
  return "errored" === t2 ? null : "closed" === t2 ? 0 : e2._strategyHWM - e2._queueTotalSize;
}
function Ft(e2) {
  return !e2._closeRequested && "readable" === e2._controlledReadableStream._state;
}
function It(e2, t2, r2, o2) {
  const n2 = Object.create(ReadableStreamDefaultController.prototype);
  let a2, i2, l2;
  a2 = void 0 !== t2.start ? () => t2.start(n2) : () => {
  }, i2 = void 0 !== t2.pull ? () => t2.pull(n2) : () => c(void 0), l2 = void 0 !== t2.cancel ? (e3) => t2.cancel(e3) : () => c(void 0), function(e3, t3, r3, o3, n3, a3, i3) {
    t3._controlledReadableStream = e3, t3._queue = void 0, t3._queueTotalSize = void 0, ce(t3), t3._started = false, t3._closeRequested = false, t3._pullAgain = false, t3._pulling = false, t3._strategySizeAlgorithm = i3, t3._strategyHWM = a3, t3._pullAlgorithm = o3, t3._cancelAlgorithm = n3, e3._readableStreamController = t3, b(c(r3()), () => (t3._started = true, At(t3), null), (e4) => (zt(t3, e4), null));
  }(e2, n2, a2, i2, l2, r2, o2);
}
function Dt(e2) {
  return new TypeError(`ReadableStreamDefaultController.prototype.${e2} can only be used on a ReadableStreamDefaultController`);
}
function $t(e2, t2, r2) {
  return I(e2, r2), (r3) => w(e2, t2, [r3]);
}
function Mt(e2, t2, r2) {
  return I(e2, r2), (r3) => w(e2, t2, [r3]);
}
function Yt(e2, t2, r2) {
  return I(e2, r2), (r3) => g(e2, t2, [r3]);
}
function Qt(e2, t2) {
  if ("bytes" !== (e2 = `${e2}`)) throw new TypeError(`${t2} '${e2}' is not a valid enumeration value for ReadableStreamType`);
  return e2;
}
function Nt(e2, t2) {
  if ("byob" !== (e2 = `${e2}`)) throw new TypeError(`${t2} '${e2}' is not a valid enumeration value for ReadableStreamReaderMode`);
  return e2;
}
function Ht(e2, t2) {
  F(e2, t2);
  const r2 = null == e2 ? void 0 : e2.preventAbort, o2 = null == e2 ? void 0 : e2.preventCancel, n2 = null == e2 ? void 0 : e2.preventClose, a2 = null == e2 ? void 0 : e2.signal;
  return void 0 !== a2 && function(e3, t3) {
    if (!function(e4) {
      if ("object" != typeof e4 || null === e4) return false;
      try {
        return "boolean" == typeof e4.aborted;
      } catch (e5) {
        return false;
      }
    }(e3)) throw new TypeError(`${t3} is not an AbortSignal.`);
  }(a2, `${t2} has member 'signal' that`), { preventAbort: Boolean(r2), preventCancel: Boolean(o2), preventClose: Boolean(n2), signal: a2 };
}
function xt(e2, t2) {
  F(e2, t2);
  const r2 = null == e2 ? void 0 : e2.readable;
  M(r2, "readable", "ReadableWritablePair"), function(e3, t3) {
    if (!H(e3)) throw new TypeError(`${t3} is not a ReadableStream.`);
  }(r2, `${t2} has member 'readable' that`);
  const o2 = null == e2 ? void 0 : e2.writable;
  return M(o2, "writable", "ReadableWritablePair"), function(e3, t3) {
    if (!x(e3)) throw new TypeError(`${t3} is not a WritableStream.`);
  }(o2, `${t2} has member 'writable' that`), { readable: r2, writable: o2 };
}
Object.defineProperties(ReadableStreamDefaultController.prototype, { close: { enumerable: true }, enqueue: { enumerable: true }, error: { enumerable: true }, desiredSize: { enumerable: true } }), n(ReadableStreamDefaultController.prototype.close, "close"), n(ReadableStreamDefaultController.prototype.enqueue, "enqueue"), n(ReadableStreamDefaultController.prototype.error, "error"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableStreamDefaultController.prototype, e.toStringTag, { value: "ReadableStreamDefaultController", configurable: true });
var ReadableStream = class {
  constructor(e2 = {}, t2 = {}) {
    void 0 === e2 ? e2 = null : D(e2, "First parameter");
    const r2 = Ye(t2, "Second parameter"), o2 = function(e3, t3) {
      F(e3, t3);
      const r3 = e3, o3 = null == r3 ? void 0 : r3.autoAllocateChunkSize, n3 = null == r3 ? void 0 : r3.cancel, a2 = null == r3 ? void 0 : r3.pull, i2 = null == r3 ? void 0 : r3.start, l2 = null == r3 ? void 0 : r3.type;
      return { autoAllocateChunkSize: void 0 === o3 ? void 0 : N(o3, `${t3} has member 'autoAllocateChunkSize' that`), cancel: void 0 === n3 ? void 0 : $t(n3, r3, `${t3} has member 'cancel' that`), pull: void 0 === a2 ? void 0 : Mt(a2, r3, `${t3} has member 'pull' that`), start: void 0 === i2 ? void 0 : Yt(i2, r3, `${t3} has member 'start' that`), type: void 0 === l2 ? void 0 : Qt(l2, `${t3} has member 'type' that`) };
    }(e2, "First parameter");
    var n2;
    if ((n2 = this)._state = "readable", n2._reader = void 0, n2._storedError = void 0, n2._disturbed = false, "bytes" === o2.type) {
      if (void 0 !== r2.size) throw new RangeError("The strategy for a byte stream cannot have a size function");
      Oe(this, o2, $e(r2, 0));
    } else {
      const e3 = Me(r2);
      It(this, o2, $e(r2, 1), e3);
    }
  }
  get locked() {
    if (!Vt(this)) throw Kt("locked");
    return Ut(this);
  }
  cancel(e2) {
    return Vt(this) ? Ut(this) ? d(new TypeError("Cannot cancel a stream that already has a reader")) : Gt(this, e2) : d(Kt("cancel"));
  }
  getReader(e2) {
    if (!Vt(this)) throw Kt("getReader");
    return void 0 === function(e3, t2) {
      F(e3, t2);
      const r2 = null == e3 ? void 0 : e3.mode;
      return { mode: void 0 === r2 ? void 0 : Nt(r2, `${t2} has member 'mode' that`) };
    }(e2, "First parameter").mode ? new ReadableStreamDefaultReader(this) : function(e3) {
      return new ReadableStreamBYOBReader(e3);
    }(this);
  }
  pipeThrough(e2, t2 = {}) {
    if (!H(this)) throw Kt("pipeThrough");
    $(e2, 1, "pipeThrough");
    const r2 = xt(e2, "First parameter"), o2 = Ht(t2, "Second parameter");
    if (this.locked) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
    if (r2.writable.locked) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
    return m(kt(this, r2.writable, o2.preventClose, o2.preventAbort, o2.preventCancel, o2.signal)), r2.readable;
  }
  pipeTo(e2, t2 = {}) {
    if (!H(this)) return d(Kt("pipeTo"));
    if (void 0 === e2) return d("Parameter 1 is required in 'pipeTo'.");
    if (!x(e2)) return d(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
    let r2;
    try {
      r2 = Ht(t2, "Second parameter");
    } catch (e3) {
      return d(e3);
    }
    return this.locked ? d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")) : e2.locked ? d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")) : kt(this, e2, r2.preventClose, r2.preventAbort, r2.preventCancel, r2.signal);
  }
  tee() {
    if (!H(this)) throw Kt("tee");
    if (this.locked) throw new TypeError("Cannot tee a stream that already has a reader");
    return Ot(this);
  }
  values(e2) {
    if (!H(this)) throw Kt("values");
    return function(e3, t2) {
      const r2 = e3.getReader(), o2 = new te(r2, t2), n2 = Object.create(re);
      return n2._asyncIteratorImpl = o2, n2;
    }(this, function(e3, t2) {
      F(e3, t2);
      const r2 = null == e3 ? void 0 : e3.preventCancel;
      return { preventCancel: Boolean(r2) };
    }(e2, "First parameter").preventCancel);
  }
};
function Vt(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_readableStreamController") && e2 instanceof ReadableStream);
}
function Ut(e2) {
  return void 0 !== e2._reader;
}
function Gt(e2, r2) {
  if (e2._disturbed = true, "closed" === e2._state) return c(void 0);
  if ("errored" === e2._state) return d(e2._storedError);
  Xt(e2);
  const o2 = e2._reader;
  if (void 0 !== o2 && Fe(o2)) {
    const e3 = o2._readIntoRequests;
    o2._readIntoRequests = new S(), e3.forEach((e4) => {
      e4._closeSteps(void 0);
    });
  }
  return p(e2._readableStreamController[T](r2), t);
}
function Xt(e2) {
  e2._state = "closed";
  const t2 = e2._reader;
  if (void 0 !== t2 && (j(t2), K(t2))) {
    const e3 = t2._readRequests;
    t2._readRequests = new S(), e3.forEach((e4) => {
      e4._closeSteps();
    });
  }
}
function Jt(e2, t2) {
  e2._state = "errored", e2._storedError = t2;
  const r2 = e2._reader;
  void 0 !== r2 && (A(r2, t2), K(r2) ? Z(r2, t2) : Ie(r2, t2));
}
function Kt(e2) {
  return new TypeError(`ReadableStream.prototype.${e2} can only be used on a ReadableStream`);
}
function Zt(e2, t2) {
  F(e2, t2);
  const r2 = null == e2 ? void 0 : e2.highWaterMark;
  return M(r2, "highWaterMark", "QueuingStrategyInit"), { highWaterMark: Y(r2) };
}
Object.defineProperties(ReadableStream.prototype, { cancel: { enumerable: true }, getReader: { enumerable: true }, pipeThrough: { enumerable: true }, pipeTo: { enumerable: true }, tee: { enumerable: true }, values: { enumerable: true }, locked: { enumerable: true } }), n(ReadableStream.prototype.cancel, "cancel"), n(ReadableStream.prototype.getReader, "getReader"), n(ReadableStream.prototype.pipeThrough, "pipeThrough"), n(ReadableStream.prototype.pipeTo, "pipeTo"), n(ReadableStream.prototype.tee, "tee"), n(ReadableStream.prototype.values, "values"), "symbol" == typeof e.toStringTag && Object.defineProperty(ReadableStream.prototype, e.toStringTag, { value: "ReadableStream", configurable: true }), "symbol" == typeof e.asyncIterator && Object.defineProperty(ReadableStream.prototype, e.asyncIterator, { value: ReadableStream.prototype.values, writable: true, configurable: true });
var er = (e2) => e2.byteLength;
n(er, "size");
var ByteLengthQueuingStrategy = class {
  constructor(e2) {
    $(e2, 1, "ByteLengthQueuingStrategy"), e2 = Zt(e2, "First parameter"), this._byteLengthQueuingStrategyHighWaterMark = e2.highWaterMark;
  }
  get highWaterMark() {
    if (!rr(this)) throw tr("highWaterMark");
    return this._byteLengthQueuingStrategyHighWaterMark;
  }
  get size() {
    if (!rr(this)) throw tr("size");
    return er;
  }
};
function tr(e2) {
  return new TypeError(`ByteLengthQueuingStrategy.prototype.${e2} can only be used on a ByteLengthQueuingStrategy`);
}
function rr(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_byteLengthQueuingStrategyHighWaterMark") && e2 instanceof ByteLengthQueuingStrategy);
}
Object.defineProperties(ByteLengthQueuingStrategy.prototype, { highWaterMark: { enumerable: true }, size: { enumerable: true } }), "symbol" == typeof e.toStringTag && Object.defineProperty(ByteLengthQueuingStrategy.prototype, e.toStringTag, { value: "ByteLengthQueuingStrategy", configurable: true });
var or = () => 1;
n(or, "size");
var CountQueuingStrategy = class {
  constructor(e2) {
    $(e2, 1, "CountQueuingStrategy"), e2 = Zt(e2, "First parameter"), this._countQueuingStrategyHighWaterMark = e2.highWaterMark;
  }
  get highWaterMark() {
    if (!ar(this)) throw nr("highWaterMark");
    return this._countQueuingStrategyHighWaterMark;
  }
  get size() {
    if (!ar(this)) throw nr("size");
    return or;
  }
};
function nr(e2) {
  return new TypeError(`CountQueuingStrategy.prototype.${e2} can only be used on a CountQueuingStrategy`);
}
function ar(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_countQueuingStrategyHighWaterMark") && e2 instanceof CountQueuingStrategy);
}
function ir(e2, t2, r2) {
  return I(e2, r2), (r3) => w(e2, t2, [r3]);
}
function lr(e2, t2, r2) {
  return I(e2, r2), (r3) => g(e2, t2, [r3]);
}
function sr(e2, t2, r2) {
  return I(e2, r2), (r3, o2) => w(e2, t2, [r3, o2]);
}
Object.defineProperties(CountQueuingStrategy.prototype, { highWaterMark: { enumerable: true }, size: { enumerable: true } }), "symbol" == typeof e.toStringTag && Object.defineProperty(CountQueuingStrategy.prototype, e.toStringTag, { value: "CountQueuingStrategy", configurable: true });
var TransformStream = class {
  constructor(e2 = {}, t2 = {}, r2 = {}) {
    void 0 === e2 && (e2 = null);
    const o2 = Ye(t2, "Second parameter"), n2 = Ye(r2, "Third parameter"), a2 = function(e3, t3) {
      F(e3, t3);
      const r3 = null == e3 ? void 0 : e3.flush, o3 = null == e3 ? void 0 : e3.readableType, n3 = null == e3 ? void 0 : e3.start, a3 = null == e3 ? void 0 : e3.transform, i3 = null == e3 ? void 0 : e3.writableType;
      return { flush: void 0 === r3 ? void 0 : ir(r3, e3, `${t3} has member 'flush' that`), readableType: o3, start: void 0 === n3 ? void 0 : lr(n3, e3, `${t3} has member 'start' that`), transform: void 0 === a3 ? void 0 : sr(a3, e3, `${t3} has member 'transform' that`), writableType: i3 };
    }(e2, "First parameter");
    if (void 0 !== a2.readableType) throw new RangeError("Invalid readableType specified");
    if (void 0 !== a2.writableType) throw new RangeError("Invalid writableType specified");
    const i2 = $e(n2, 0), l2 = Me(n2), s2 = $e(o2, 1), f2 = Me(o2);
    let b2;
    !function(e3, t3, r3, o3, n3, a3) {
      function i3() {
        return t3;
      }
      function l3(t4) {
        return function(e4, t5) {
          const r4 = e4._transformStreamController;
          if (e4._backpressure) {
            return p(e4._backpressureChangePromise, () => {
              if ("erroring" === (Ge(e4._writable) ? e4._writable._state : e4._writableState)) throw Ge(e4._writable) ? e4._writable._storedError : e4._writableStoredError;
              return pr(r4, t5);
            });
          }
          return pr(r4, t5);
        }(e3, t4);
      }
      function s3(t4) {
        return function(e4, t5) {
          return cr(e4, t5), c(void 0);
        }(e3, t4);
      }
      function u2() {
        return function(e4) {
          const t4 = e4._transformStreamController, r4 = t4._flushAlgorithm();
          return hr(t4), p(r4, () => {
            if ("errored" === e4._readableState) throw e4._readableStoredError;
            gr(e4) && wr(e4);
          }, (t5) => {
            throw cr(e4, t5), e4._readableStoredError;
          });
        }(e3);
      }
      function d2() {
        return function(e4) {
          return fr(e4, false), e4._backpressureChangePromise;
        }(e3);
      }
      function f3(t4) {
        return dr(e3, t4), c(void 0);
      }
      e3._writableState = "writable", e3._writableStoredError = void 0, e3._writableHasInFlightOperation = false, e3._writableStarted = false, e3._writable = function(e4, t4, r4, o4, n4, a4, i4) {
        return new WritableStream({ start(r5) {
          e4._writableController = r5;
          try {
            const t5 = r5.signal;
            void 0 !== t5 && t5.addEventListener("abort", () => {
              "writable" === e4._writableState && (e4._writableState = "erroring", t5.reason && (e4._writableStoredError = t5.reason));
            });
          } catch (e5) {
          }
          return p(t4(), () => (e4._writableStarted = true, Cr(e4), null), (t5) => {
            throw e4._writableStarted = true, Rr(e4, t5), t5;
          });
        }, write: (t5) => (function(e5) {
          e5._writableHasInFlightOperation = true;
        }(e4), p(r4(t5), () => (function(e5) {
          e5._writableHasInFlightOperation = false;
        }(e4), Cr(e4), null), (t6) => {
          throw function(e5, t7) {
            e5._writableHasInFlightOperation = false, Rr(e5, t7);
          }(e4, t6), t6;
        })), close: () => (function(e5) {
          e5._writableHasInFlightOperation = true;
        }(e4), p(o4(), () => (function(e5) {
          e5._writableHasInFlightOperation = false;
          "erroring" === e5._writableState && (e5._writableStoredError = void 0);
          e5._writableState = "closed";
        }(e4), null), (t5) => {
          throw function(e5, t6) {
            e5._writableHasInFlightOperation = false, e5._writableState, Rr(e5, t6);
          }(e4, t5), t5;
        })), abort: (t5) => (e4._writableState = "errored", e4._writableStoredError = t5, n4(t5)) }, { highWaterMark: a4, size: i4 });
      }(e3, i3, l3, u2, s3, r3, o3), e3._readableState = "readable", e3._readableStoredError = void 0, e3._readableCloseRequested = false, e3._readablePulling = false, e3._readable = function(e4, t4, r4, o4, n4, a4) {
        return new ReadableStream({ start: (r5) => (e4._readableController = r5, t4().catch((t5) => {
          Sr(e4, t5);
        })), pull: () => (e4._readablePulling = true, r4().catch((t5) => {
          Sr(e4, t5);
        })), cancel: (t5) => (e4._readableState = "closed", o4(t5)) }, { highWaterMark: n4, size: a4 });
      }(e3, i3, d2, f3, n3, a3), e3._backpressure = void 0, e3._backpressureChangePromise = void 0, e3._backpressureChangePromise_resolve = void 0, fr(e3, true), e3._transformStreamController = void 0;
    }(this, u((e3) => {
      b2 = e3;
    }), s2, f2, i2, l2), function(e3, t3) {
      const r3 = Object.create(TransformStreamDefaultController.prototype);
      let o3, n3;
      o3 = void 0 !== t3.transform ? (e4) => t3.transform(e4, r3) : (e4) => {
        try {
          return _r(r3, e4), c(void 0);
        } catch (e5) {
          return d(e5);
        }
      };
      n3 = void 0 !== t3.flush ? () => t3.flush(r3) : () => c(void 0);
      !function(e4, t4, r4, o4) {
        t4._controlledTransformStream = e4, e4._transformStreamController = t4, t4._transformAlgorithm = r4, t4._flushAlgorithm = o4;
      }(e3, r3, o3, n3);
    }(this, a2), void 0 !== a2.start ? b2(a2.start(this._transformStreamController)) : b2(void 0);
  }
  get readable() {
    if (!ur(this)) throw yr("readable");
    return this._readable;
  }
  get writable() {
    if (!ur(this)) throw yr("writable");
    return this._writable;
  }
};
function ur(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_transformStreamController") && e2 instanceof TransformStream);
}
function cr(e2, t2) {
  Sr(e2, t2), dr(e2, t2);
}
function dr(e2, t2) {
  hr(e2._transformStreamController), function(e3, t3) {
    e3._writableController.error(t3);
    "writable" === e3._writableState && Tr(e3, t3);
  }(e2, t2), e2._backpressure && fr(e2, false);
}
function fr(e2, t2) {
  void 0 !== e2._backpressureChangePromise && e2._backpressureChangePromise_resolve(), e2._backpressureChangePromise = u((t3) => {
    e2._backpressureChangePromise_resolve = t3;
  }), e2._backpressure = t2;
}
Object.defineProperties(TransformStream.prototype, { readable: { enumerable: true }, writable: { enumerable: true } }), "symbol" == typeof e.toStringTag && Object.defineProperty(TransformStream.prototype, e.toStringTag, { value: "TransformStream", configurable: true });
var TransformStreamDefaultController = class {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
  get desiredSize() {
    if (!br(this)) throw mr("desiredSize");
    return vr(this._controlledTransformStream);
  }
  enqueue(e2) {
    if (!br(this)) throw mr("enqueue");
    _r(this, e2);
  }
  error(e2) {
    if (!br(this)) throw mr("error");
    var t2;
    t2 = e2, cr(this._controlledTransformStream, t2);
  }
  terminate() {
    if (!br(this)) throw mr("terminate");
    !function(e2) {
      const t2 = e2._controlledTransformStream;
      gr(t2) && wr(t2);
      const r2 = new TypeError("TransformStream terminated");
      dr(t2, r2);
    }(this);
  }
};
function br(e2) {
  return !!r(e2) && (!!Object.prototype.hasOwnProperty.call(e2, "_controlledTransformStream") && e2 instanceof TransformStreamDefaultController);
}
function hr(e2) {
  e2._transformAlgorithm = void 0, e2._flushAlgorithm = void 0;
}
function _r(e2, t2) {
  const r2 = e2._controlledTransformStream;
  if (!gr(r2)) throw new TypeError("Readable side is not in a state that permits enqueue");
  try {
    !function(e3, t3) {
      e3._readablePulling = false;
      try {
        e3._readableController.enqueue(t3);
      } catch (t4) {
        throw Sr(e3, t4), t4;
      }
    }(r2, t2);
  } catch (e3) {
    throw dr(r2, e3), r2._readableStoredError;
  }
  const o2 = function(e3) {
    return !function(e4) {
      if (!gr(e4)) return false;
      if (e4._readablePulling) return true;
      if (vr(e4) > 0) return true;
      return false;
    }(e3);
  }(r2);
  o2 !== r2._backpressure && fr(r2, true);
}
function pr(e2, t2) {
  return p(e2._transformAlgorithm(t2), void 0, (t3) => {
    throw cr(e2._controlledTransformStream, t3), t3;
  });
}
function mr(e2) {
  return new TypeError(`TransformStreamDefaultController.prototype.${e2} can only be used on a TransformStreamDefaultController`);
}
function yr(e2) {
  return new TypeError(`TransformStream.prototype.${e2} can only be used on a TransformStream`);
}
function gr(e2) {
  return !e2._readableCloseRequested && "readable" === e2._readableState;
}
function wr(e2) {
  e2._readableState = "closed", e2._readableCloseRequested = true, e2._readableController.close();
}
function Sr(e2, t2) {
  "readable" === e2._readableState && (e2._readableState = "errored", e2._readableStoredError = t2), e2._readableController.error(t2);
}
function vr(e2) {
  return e2._readableController.desiredSize;
}
function Rr(e2, t2) {
  "writable" !== e2._writableState ? qr(e2) : Tr(e2, t2);
}
function Tr(e2, t2) {
  e2._writableState = "erroring", e2._writableStoredError = t2, !function(e3) {
    return e3._writableHasInFlightOperation;
  }(e2) && e2._writableStarted && qr(e2);
}
function qr(e2) {
  e2._writableState = "errored";
}
function Cr(e2) {
  "erroring" === e2._writableState && qr(e2);
}
Object.defineProperties(TransformStreamDefaultController.prototype, { enqueue: { enumerable: true }, error: { enumerable: true }, terminate: { enumerable: true }, desiredSize: { enumerable: true } }), n(TransformStreamDefaultController.prototype.enqueue, "enqueue"), n(TransformStreamDefaultController.prototype.error, "error"), n(TransformStreamDefaultController.prototype.terminate, "terminate"), "symbol" == typeof e.toStringTag && Object.defineProperty(TransformStreamDefaultController.prototype, e.toStringTag, { value: "TransformStreamDefaultController", configurable: true });

// ../../node_modules/formdata-node/lib/esm/isFunction.js
var isFunction = (value) => typeof value === "function";

// ../../node_modules/formdata-node/lib/esm/blobHelpers.js
var CHUNK_SIZE = 65536;
async function* clonePart(part) {
  const end = part.byteOffset + part.byteLength;
  let position = part.byteOffset;
  while (position !== end) {
    const size = Math.min(end - position, CHUNK_SIZE);
    const chunk = part.buffer.slice(position, position + size);
    position += chunk.byteLength;
    yield new Uint8Array(chunk);
  }
}
async function* consumeNodeBlob(blob) {
  let position = 0;
  while (position !== blob.size) {
    const chunk = blob.slice(position, Math.min(blob.size, position + CHUNK_SIZE));
    const buffer = await chunk.arrayBuffer();
    position += buffer.byteLength;
    yield new Uint8Array(buffer);
  }
}
async function* consumeBlobParts(parts, clone = false) {
  for (const part of parts) {
    if (ArrayBuffer.isView(part)) {
      if (clone) {
        yield* clonePart(part);
      } else {
        yield part;
      }
    } else if (isFunction(part.stream)) {
      yield* part.stream();
    } else {
      yield* consumeNodeBlob(part);
    }
  }
}
function* sliceBlob(blobParts, blobSize, start = 0, end) {
  end !== null && end !== void 0 ? end : end = blobSize;
  let relativeStart = start < 0 ? Math.max(blobSize + start, 0) : Math.min(start, blobSize);
  let relativeEnd = end < 0 ? Math.max(blobSize + end, 0) : Math.min(end, blobSize);
  const span = Math.max(relativeEnd - relativeStart, 0);
  let added = 0;
  for (const part of blobParts) {
    if (added >= span) {
      break;
    }
    const partSize = ArrayBuffer.isView(part) ? part.byteLength : part.size;
    if (relativeStart && partSize <= relativeStart) {
      relativeStart -= partSize;
      relativeEnd -= partSize;
    } else {
      let chunk;
      if (ArrayBuffer.isView(part)) {
        chunk = part.subarray(relativeStart, Math.min(partSize, relativeEnd));
        added += chunk.byteLength;
      } else {
        chunk = part.slice(relativeStart, Math.min(partSize, relativeEnd));
        added += chunk.size;
      }
      relativeEnd -= partSize;
      relativeStart = 0;
      yield chunk;
    }
  }
}

// ../../node_modules/formdata-node/lib/esm/Blob.js
var __classPrivateFieldGet = function(receiver, state, kind, f2) {
  if (kind === "a" && !f2) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f2 : kind === "a" ? f2.call(receiver) : f2 ? f2.value : state.get(receiver);
};
var __classPrivateFieldSet = function(receiver, state, value, kind, f2) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f2) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f2.call(receiver, value) : f2 ? f2.value = value : state.set(receiver, value), value;
};
var _Blob_parts;
var _Blob_type;
var _Blob_size;
var Blob = class _Blob {
  constructor(blobParts = [], options = {}) {
    _Blob_parts.set(this, []);
    _Blob_type.set(this, "");
    _Blob_size.set(this, 0);
    options !== null && options !== void 0 ? options : options = {};
    if (typeof blobParts !== "object" || blobParts === null) {
      throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");
    }
    if (!isFunction(blobParts[Symbol.iterator])) {
      throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");
    }
    if (typeof options !== "object" && !isFunction(options)) {
      throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");
    }
    const encoder = new TextEncoder();
    for (const raw of blobParts) {
      let part;
      if (ArrayBuffer.isView(raw)) {
        part = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
      } else if (raw instanceof ArrayBuffer) {
        part = new Uint8Array(raw.slice(0));
      } else if (raw instanceof _Blob) {
        part = raw;
      } else {
        part = encoder.encode(String(raw));
      }
      __classPrivateFieldSet(this, _Blob_size, __classPrivateFieldGet(this, _Blob_size, "f") + (ArrayBuffer.isView(part) ? part.byteLength : part.size), "f");
      __classPrivateFieldGet(this, _Blob_parts, "f").push(part);
    }
    const type = options.type === void 0 ? "" : String(options.type);
    __classPrivateFieldSet(this, _Blob_type, /^[\x20-\x7E]*$/.test(type) ? type : "", "f");
  }
  static [(_Blob_parts = /* @__PURE__ */ new WeakMap(), _Blob_type = /* @__PURE__ */ new WeakMap(), _Blob_size = /* @__PURE__ */ new WeakMap(), Symbol.hasInstance)](value) {
    return Boolean(value && typeof value === "object" && isFunction(value.constructor) && (isFunction(value.stream) || isFunction(value.arrayBuffer)) && /^(Blob|File)$/.test(value[Symbol.toStringTag]));
  }
  get type() {
    return __classPrivateFieldGet(this, _Blob_type, "f");
  }
  get size() {
    return __classPrivateFieldGet(this, _Blob_size, "f");
  }
  slice(start, end, contentType) {
    return new _Blob(sliceBlob(__classPrivateFieldGet(this, _Blob_parts, "f"), this.size, start, end), {
      type: contentType
    });
  }
  async text() {
    const decoder = new TextDecoder();
    let result = "";
    for await (const chunk of consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"))) {
      result += decoder.decode(chunk, { stream: true });
    }
    result += decoder.decode();
    return result;
  }
  async arrayBuffer() {
    const view = new Uint8Array(this.size);
    let offset = 0;
    for await (const chunk of consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"))) {
      view.set(chunk, offset);
      offset += chunk.length;
    }
    return view.buffer;
  }
  stream() {
    const iterator = consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"), true);
    return new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) {
          return queueMicrotask(() => controller.close());
        }
        controller.enqueue(value);
      },
      async cancel() {
        await iterator.return();
      }
    });
  }
  get [Symbol.toStringTag]() {
    return "Blob";
  }
};
Object.defineProperties(Blob.prototype, {
  type: { enumerable: true },
  size: { enumerable: true },
  slice: { enumerable: true },
  stream: { enumerable: true },
  text: { enumerable: true },
  arrayBuffer: { enumerable: true }
});

// ../../node_modules/formdata-node/lib/esm/File.js
var __classPrivateFieldSet2 = function(receiver, state, value, kind, f2) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f2) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f2.call(receiver, value) : f2 ? f2.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet2 = function(receiver, state, kind, f2) {
  if (kind === "a" && !f2) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f2 : kind === "a" ? f2.call(receiver) : f2 ? f2.value : state.get(receiver);
};
var _File_name;
var _File_lastModified;
var File = class extends Blob {
  constructor(fileBits, name, options = {}) {
    super(fileBits, options);
    _File_name.set(this, void 0);
    _File_lastModified.set(this, 0);
    if (arguments.length < 2) {
      throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`);
    }
    __classPrivateFieldSet2(this, _File_name, String(name), "f");
    const lastModified = options.lastModified === void 0 ? Date.now() : Number(options.lastModified);
    if (!Number.isNaN(lastModified)) {
      __classPrivateFieldSet2(this, _File_lastModified, lastModified, "f");
    }
  }
  static [(_File_name = /* @__PURE__ */ new WeakMap(), _File_lastModified = /* @__PURE__ */ new WeakMap(), Symbol.hasInstance)](value) {
    return value instanceof Blob && value[Symbol.toStringTag] === "File" && typeof value.name === "string";
  }
  get name() {
    return __classPrivateFieldGet2(this, _File_name, "f");
  }
  get lastModified() {
    return __classPrivateFieldGet2(this, _File_lastModified, "f");
  }
  get webkitRelativePath() {
    return "";
  }
  get [Symbol.toStringTag]() {
    return "File";
  }
};

// ../../node_modules/formdata-node/lib/esm/isFile.js
var isFile = (value) => value instanceof File;

export {
  __require,
  __commonJS,
  __export,
  __toESM,
  isFunction,
  Blob,
  File,
  isFile
};
/*! Bundled license information:

web-streams-polyfill/dist/ponyfill.mjs:
  (**
   * @license
   * web-streams-polyfill v4.0.0-beta.3
   * Copyright 2021 Mattias Buelens, Diwank Singh Tomer and other contributors.
   * This code is released under the MIT license.
   * SPDX-License-Identifier: MIT
   *)

formdata-node/lib/esm/blobHelpers.js:
  (*! Based on fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> & David Frank *)

formdata-node/lib/esm/Blob.js:
  (*! Based on fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> & David Frank *)
*/
//# sourceMappingURL=chunk-DHRFIOY6.js.map
// Copyright 2018 Kristopher Kowal
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const timeoutError = new Error("context expired");
timeoutError.cancel = true;

const cancelError = new Error("context cancelled");
cancelError.cancel = true;

const noop = () => {};
const parents = new WeakMap();

// Context when threaded through function calls, facilitates deadlines for
// asynchronous work, cancelling an asynchronous call graph, and context-keyed
// storage.
class Context {

    constructor(cancelled) {
        this.cancelled = cancelled;
        Object.freeze(this);
    }

    // create returns a new context that inherits the parent context's
    // cancellation, but serves as a new token for any context-keyed storage.
    create() {
        let context = new Context(this.cancelled);
        parents.set(context, this);
        return context;
    }

    // withCancel returns {new context, and cancel function}.
    // The cancel function cancels the child context and any of its
    // descendants.
    // The child context will also be cancelled if the parent context gets
    // cancelled.
    withCancel() {
        let cancel, cancelled = new Promise((r) => cancel = r);
        let context = new Context(cancelled);
        parents.set(context, this);
        this.cancelled.then((error) => cancel(error || cancelError), noop);
        return {context, cancel};
    }

    // withTimeout returns a new context that will be cancelled
    // with a timeout error.
    withTimeout(ms) {
        let {context, cancel} = this.withCancel();
        this.delay(ms).then(() => cancel(timeoutError), noop);
        return context;
    }

    // delay returns a promise that will resolve (without a value) after the
    // given delay in milliseconds, or reject with a cancellation error if the
    // context is cancelled first.
    delay(ms) {
        return new Promise((resolve, reject) => {
            let handle = setTimeout(resolve, ms);
            this.cancelled.then((error) => {
                clearTimeout(handle);
                reject(error || timeoutError);
            }, noop);
        });
    }

    // get searches a map for this context as a token, or any of its parents,
    // returning the corresponding value.
    // Rather than treating a context as a shared global name space,
    // use a WeakMap to associate contexts with corresponding data.
    get(map) {
        let token = this;
        do {
            if (map.has(token)) {
                return map.get(token);
            }
            token = parents.get(token);
        } while (token != null);
    }

}

module.exports = new Context(new Promise(() => {}));

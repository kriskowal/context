# context

Context is a JavaScript solution to cancelling asynchronous work with promises.
Pass a context forward as an argument, return a promise for the result.

Contexts can be attenuated with a timeout, `context = context.withTimeout(ms)`.

```js
let context = require("@kriskowal/context");

async function main() {
    try {
        await count(context.withTimeout(100), 10);
    } catch (error) {
        console.error(error.message);
    }
}

async function count(context, ms) {
    let n = 0;
    for (;;) {
        console.log(n++);
        await context.delay(ms);
    }
}

main()
```

Output:

```
0
1
2
3
4
5
6
7
context expired
```

Cancel all work in a child context, `let cancel; ({context, cancel) =
context.withCancel()); cancel(new Error("please stop"))`.

```js
let context = require("@kriskowal/context");

async function main(context) {
    try {
        let cancel;
        ({context, cancel} = context.withCancel());
        monitor(context, cancel);
        await count(context, 10);
    } catch (error) {
        console.error(error.message);
    }
}

async function monitor(context, cancel) {
    await context.delay(100);
    cancel(new Error("deadline elapsed"));
}

async function count(context, ms) {
    let n = 0;
    for (;;) {
        console.log(n++);
        await context.delay(ms);
    }
}

main(context)
```

Run a timer in a context. `context.delay(ms)` returns a promise that will resolve
after `ms` or reject if the context times out or gets cancelled.

Contexts are immutable, to avoid name conflict hazards.
Contexts can be used as keys to WeakMaps, for "context scoped storage" (CSS).
To retrieve the value for a context or any of its parents, call `context.get(map)`.

```js
var context = require("@kriskowal/context");
var tokens = new WeakMap();

async function main(context) {
    tokens.set(context, "Hello, World!");
    context = context.create();
    try {
        await child(context);
    } catch (error) {
        console.error(error.message);
    }
}

async function child(context) {
    await context.delay(100);
    console.log(context.get(tokens));
    await context.delay(100);
}

main(context);
```

## Why are promises not cancellable?

Promises are not themselves directly cancellable because that would introduce a
hazard.

A promise is a contract between a single producer and possibly multiple
consumers.
If promises had a cancel method, one consumer would be able to interfere with
all other consumers by cancelling it.
This is particularly pernicious in the common pattern of a memoized async
function.

Alternatively to immediately stopping work when a promise was cancelled,
a promise might count as a single subscription, where cancellation
were unsubscription, and having zero subscribers triggered the cessation of
work.
To do so, every consumer would need a unique promise instance.
This could be facilitated by creating a fresh child promise for every consumer,
perhaps by calling `then` without arguments, but generally, the hazard would
remain since the necessity would be surprising.

The only way for a cancel method on a subscriber to work would be for the
promise to enforce that it only had one consumer, forcing an error on the
second attempt to register a subscriber.

```js
promise.then(onReturn2, onThrow2);
promise.then(onReturn2, onThrow2); // Throws an error
```

Such an object would not be a Promise as we have come to know JavaScript’s
Promise.
It might be an object by another name.

This solution, however, works well for Promises, using Promises.


## Prior Art

This library stems from a suggestion by Mark Miller that cancellation could be
effected through a `cancelled` promise that one threaded as an argument
throughout a call graph.

```js
let cancel, cancelled = new Promise((r) => cancel = r);
let handle = setTimeout(cancel, 1000);
cancelled.then(() => clearTimeout(handle));
return main(cancelled);
```

This in itself is sufficient for threading cancellation.

Secondly, the Go [context][GoContext] inspires the creation of a `Context`
object that serves the three twined purposes of cancellation, deadlines, and
context local storage.

[GoContext]: https://golang.org/pkg/context/

The Go context also provides a mechanism use the context itself as an arbitrary
but shallowly immutable key-value store, also discouraging name collisions
through the promotion of package-private-typed keys.

I again credit Mark Miller for teaching me the use of WeakMaps to associate and
gracefully release private data through immutable token objects.


## License

Copyright 2018 Kristopher Kowal

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

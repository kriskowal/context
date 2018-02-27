# context

Context is a JavaScript solution to cancelling asynchronous work with promises.
Pass a context forward as an argument, return a promise for the result.


## withTimeout

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

## withCancel

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


## delay

Run a timer in a context. `context.delay(ms)` returns a promise that will resolve
after `ms` or reject if the context times out or gets cancelled.


## get

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


## cancelled

Every context has a `cancelled` promise.
Use this promise to effect cancellation to third-party functions that have
their own cancellation interface.
For example, the context delay method uses `setTimeout` and `clearTimeout`.

```js
function delay(context, ms) {
    return new Promise((resolve, reject) => {
        let handle = setTimeout(resolve, ms);
        context.cancelled.then((error) => {
            clearTimeout(handle);
            reject(error);
        }, () => {});
    });
}
```

The DOM `fetch` function supports a cancellation signal.

```js
function fetchWithContext(context, path, options) {
    if (options == null) {
        options = {};
    }
    let abortController = new AbortController();
    options.signal = abortController.signal;
    context.cancelled.then(() => {
        abortController.abort();
    });
    return fetch(path, options);
}
```

The late XMLHttpRequest API (RIP) also had an API for cancellation.

```js
function xhr(context, method, location) {
    return new Promise((resolve, reject) {
        let request = new XMLHttpRequest();

        let onLoad = () => {
            if (xhrSuccess(request)) {
                resolve(request.responseText);
            } else {
                onError();
            }
        };

        let onError = () => {
            var error = new Error("Can't " + method + " " + JSON.stringify(location));
            if (request.status === 404 || request.status === 0) {
                error.code = "ENOENT";
                error.notFound = true;
            }
            reject(error);
        };

        // <<<<<<<<<<

        context.cancelled.then(() => {
            request.abort();
        }, () => {});

        // >>>>>>>>>>
        
        try {
            request.open(method, location, true);

            request.onreadystatechange = () => {
                if (request.readyState === 4) {
                    onLoad();
                }
            };
            request.onLoad = onLoad;
            request.onError = onError;

            request.send();

        } catch (exception) {
            reject(exception);
        }
    });
}

// Determine if an XMLHttpRequest was successful
// Some versions of WebKit return 0 for successful file:// URLs
function xhrSuccess(req) {
    return (req.status === 200 || (req.status === 0 && req.responseText));
}
```


## Cancel dangling work

Cancelling in a finally clause ensures that a function leaves no loose threads
running after it has returned.
In this example, two functions race to finish a job, and we can cancel the jobs
that lost the race.

```js
async function main(context) {
    try {
        await race(context);
    } catch (error) {
        console.error(error.stack);
    }
}

async function race(context) {
    let cancel;
    ({context, cancel} = context.withCancel());
    try {
        let tortoise = racer(context, "tortoise", 100, 1000);
        let hare = racer(context, "hare", 1000, 900);
        let winner = await Promise.race([tortoise, hare]);
        console.log(winner, "wins the race");
    } finally {
        cancel();
    }
}

async function racer(context, name, sleep, speed) {
    try {
        console.log(name, "takes a nap")
        await context.delay(sleep);
        console.log(name, "starts racing");
        await context.delay(speed);
        console.log(name, "crosses the finish line");
        return name;
    } catch (error) {
        console.log(name, "loses the race");
        throw error;
    }
}
```

Output:

```
tortoise takes a nap
hare takes a nap
tortoise starts racing
tortoise crosses the finish line
tortoise wins the race
hare loses the race
```

Note that the hare exits through an exception.


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

The Go context also provides a mechanism to use the context itself as an
arbitrary but shallowly immutable key-value store, also discouraging name
collisions through the promotion of package-private-typed keys.

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

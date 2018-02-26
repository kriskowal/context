
let context = require("../context");

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

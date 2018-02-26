
let context = require("../context");

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

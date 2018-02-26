
var context = require("../context");
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

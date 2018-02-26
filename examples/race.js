
let context = require("../context");

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

main(context)

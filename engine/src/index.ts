import { createClient, RedisClientType } from "redis";
import { Engine } from "./trade/Engine";
import { MessageFromApi } from "./types/fromApi";


async function main() {
    const engine = new Engine();

    const redisClient = createClient();
    redisClient.connect();
    console.log("redis client connected");


    while(true) {
        const response = await redisClient.rPop("message" as string);

        if(!response) {
            // console.log("no message recieved");
        } else {
            engine.process(JSON.parse(response));
        }
    }
}
main();

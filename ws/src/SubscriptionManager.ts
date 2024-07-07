import {createClient, RedisClientType} from "redis";
import { UserManager } from "./UserManager";

export class SubscriptionManager {
    private static instance: SubscriptionManager;
    private redisClient: RedisClientType;

    //userid -> [TATA_INR]
    private subscriptions: Map<string, string[]> = new Map();

    //TATA_INR  -> [userID]
    private reverseSubscriptions: Map<string, string[]> = new Map();

    private constructor() {
        this.redisClient = createClient();
        this.redisClient.connect();
    }

    public static getInstance() {
        if(!this.instance) {
            this.instance = new SubscriptionManager();
        }
        return this.instance;
    }

    public subscribe(userId: string, subscripton: string) {
        if(this.subscriptions.get(userId)?.includes(subscripton)){
            return;
        }
        this.subscriptions.set(userId, (this.subscriptions.get(userId) || []).concat(subscripton));
        this.reverseSubscriptions.set(subscripton, (this.reverseSubscriptions.get(subscripton) || []).concat(userId));

        if(this.reverseSubscriptions.get(subscripton)?.length === 1) {
            //subscribe to the pubSub
            this.redisClient.subscribe(subscripton, this.redisCallbackHandler);
            console.log("user subscribed to: ", subscripton);
        }
    }
    private redisCallbackHandler = (message: string, channel: string) => {
        const parsedMessage = JSON.parse(message);
        console.log("message recieved: ", parsedMessage);
        this.reverseSubscriptions.get(channel)?.forEach(s => UserManager.getInstance().getUser(s)?.emit(parsedMessage));
    }

    public unsubscribe(userId: string, subscription: string) {
        const subscriptions = this.subscriptions.get(userId);
        if(subscriptions) {
            this.subscriptions.set(userId, subscriptions?.filter(s => s !== subscription));
        }
        const reverseSubscriptions = this.reverseSubscriptions.get(subscription);
        if(reverseSubscriptions) {
            this.reverseSubscriptions.set(subscription, reverseSubscriptions?.filter(r => r !== userId));
            //unsubscribe to pubsub
            if (this.reverseSubscriptions.get(subscription)?.length === 0) {
                this.reverseSubscriptions.delete(subscription);
                this.redisClient.unsubscribe(subscription);
            }

        }

    }
    public userLeft(userId: string) {
        console.log("user left " + userId);
        this.subscriptions.get(userId)?.forEach(s => this.unsubscribe(userId, s));
    }
    
    getSubscriptions(userId: string) {
        return this.subscriptions.get(userId) || [];
    }
}
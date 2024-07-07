"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const redis_1 = require("redis");
const UserManager_1 = require("./UserManager");
class SubscriptionManager {
    constructor() {
        //userid -> [TATA_INR]
        this.subscriptions = new Map();
        //TATA_INR  -> [userID]
        this.reverseSubscriptions = new Map();
        this.redisCallbackHandler = (message, channel) => {
            var _a;
            const parsedMessage = JSON.parse(message);
            console.log("message recieved: ", parsedMessage);
            (_a = this.reverseSubscriptions.get(channel)) === null || _a === void 0 ? void 0 : _a.forEach(s => { var _a; return (_a = UserManager_1.UserManager.getInstance().getUser(s)) === null || _a === void 0 ? void 0 : _a.emit(parsedMessage); });
        };
        this.redisClient = (0, redis_1.createClient)();
        this.redisClient.connect();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new SubscriptionManager();
        }
        return this.instance;
    }
    subscribe(userId, subscripton) {
        var _a, _b;
        if ((_a = this.subscriptions.get(userId)) === null || _a === void 0 ? void 0 : _a.includes(subscripton)) {
            return;
        }
        this.subscriptions.set(userId, (this.subscriptions.get(userId) || []).concat(subscripton));
        this.reverseSubscriptions.set(subscripton, (this.reverseSubscriptions.get(subscripton) || []).concat(userId));
        if (((_b = this.reverseSubscriptions.get(subscripton)) === null || _b === void 0 ? void 0 : _b.length) === 1) {
            //subscribe to the pubSub
            this.redisClient.subscribe(subscripton, this.redisCallbackHandler);
            console.log("user subscribed to: ", subscripton);
        }
    }
    unsubscribe(userId, subscription) {
        var _a;
        const subscriptions = this.subscriptions.get(userId);
        if (subscriptions) {
            this.subscriptions.set(userId, subscriptions === null || subscriptions === void 0 ? void 0 : subscriptions.filter(s => s !== subscription));
        }
        const reverseSubscriptions = this.reverseSubscriptions.get(subscription);
        if (reverseSubscriptions) {
            this.reverseSubscriptions.set(subscription, reverseSubscriptions === null || reverseSubscriptions === void 0 ? void 0 : reverseSubscriptions.filter(r => r !== userId));
            //unsubscribe to pubsub
            if (((_a = this.reverseSubscriptions.get(subscription)) === null || _a === void 0 ? void 0 : _a.length) === 0) {
                this.reverseSubscriptions.delete(subscription);
                this.redisClient.unsubscribe(subscription);
            }
        }
    }
    userLeft(userId) {
        var _a;
        console.log("user left " + userId);
        (_a = this.subscriptions.get(userId)) === null || _a === void 0 ? void 0 : _a.forEach(s => this.unsubscribe(userId, s));
    }
    getSubscriptions(userId) {
        return this.subscriptions.get(userId) || [];
    }
}
exports.SubscriptionManager = SubscriptionManager;

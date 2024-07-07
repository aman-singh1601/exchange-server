"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = exports.BASE_CURRENCY = void 0;
const RedisManager_1 = require("../RedisManager");
const fromApi_1 = require("../types/fromApi");
const Orderbook_1 = require("./Orderbook");
exports.BASE_CURRENCY = "INR";
class Engine {
    constructor() {
        this.orderbooks = [];
        this.balances = new Map();
        this.orderbooks = [new Orderbook_1.Orderbook([], [], `TATA`, 0, 0)];
        this.setBaseBalances();
    }
    process({ message, clientId }) {
        console.log("test: ", message);
        switch (message.type) {
            case fromApi_1.CREATE_ORDER:
                try {
                    const { executedQty, fills, orderId } = this.createOrder(message.data.market, message.data.price, message.data.quantity, message.data.side, message.data.userId);
                    RedisManager_1.RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_PLACED",
                        payload: {
                            orderId,
                            executedQty,
                            fills
                        }
                    });
                }
                catch (e) {
                    console.log(e);
                    RedisManager_1.RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_CANCELLED",
                        payload: {
                            orderId: "",
                            executedQty: 0,
                            remainingQty: 0
                        }
                    });
                }
                break;
        }
    }
    addOrderbook(orderbook) {
        this.orderbooks.push(orderbook);
    }
    createOrder(market, price, quantity, side, userId) {
        const orderbook = this.orderbooks.find(o => o.ticker() === market);
        const baseAsset = market.split("_")[0];
        const quoteAsset = market.split("_")[1];
        if (!orderbook) {
            throw new Error("No orderbook found");
        }
        this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, quoteAsset, price, quantity);
        console.log("balances: after lock: ", this.balances);
        const order = {
            price: Number(price),
            quantity: Number(quantity),
            orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            filled: 0,
            side,
            userId
        };
        const { fills, executedQty } = orderbook.addOrder(order);
        this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty);
        console.log("balances: after orderplaced: ", this.balances);
        console.log("orderbook", this.orderbooks);
        return { executedQty, fills, orderId: order.orderId };
    }
    updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty) {
        if (side === "buy") {
            fills.forEach(fill => {
                var _a, _b, _c, _d;
                // Update quote asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].available = ((_a = this.balances.get(fill.otherUserId)) === null || _a === void 0 ? void 0 : _a[quoteAsset].available) + (fill.qty * fill.price);
                //@ts-ignore
                this.balances.get(userId)[quoteAsset].locked = ((_b = this.balances.get(userId)) === null || _b === void 0 ? void 0 : _b[quoteAsset].locked) - (fill.qty * fill.price);
                // Update base asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].locked = ((_c = this.balances.get(fill.otherUserId)) === null || _c === void 0 ? void 0 : _c[baseAsset].locked) - fill.qty;
                //@ts-ignore
                this.balances.get(userId)[baseAsset].available = ((_d = this.balances.get(userId)) === null || _d === void 0 ? void 0 : _d[baseAsset].available) + fill.qty;
            });
        }
        else {
            fills.forEach(fill => {
                var _a, _b, _c, _d;
                // Update quote asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].locked = ((_a = this.balances.get(fill.otherUserId)) === null || _a === void 0 ? void 0 : _a[quoteAsset].locked) - (fill.qty * fill.price);
                //@ts-ignore
                this.balances.get(userId)[quoteAsset].available = ((_b = this.balances.get(userId)) === null || _b === void 0 ? void 0 : _b[quoteAsset].available) + (fill.qty * fill.price);
                // Update base asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].available = ((_c = this.balances.get(fill.otherUserId)) === null || _c === void 0 ? void 0 : _c[baseAsset].available) + fill.qty;
                //@ts-ignore
                this.balances.get(userId)[baseAsset].locked = ((_d = this.balances.get(userId)) === null || _d === void 0 ? void 0 : _d[baseAsset].locked) - (fill.qty);
            });
        }
    }
    checkAndLockFunds(baseAsset, quoteAsset, side, userId, asset, price, quantity) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (side === "buy") {
            if ((((_b = (_a = this.balances.get(userId)) === null || _a === void 0 ? void 0 : _a[quoteAsset]) === null || _b === void 0 ? void 0 : _b.available) || 0) < Number(quantity) * Number(price)) {
                throw new Error("Insufficient funds");
            }
            //@ts-ignore
            this.balances.get(userId)[quoteAsset].available = ((_c = this.balances.get(userId)) === null || _c === void 0 ? void 0 : _c[quoteAsset].available) - (Number(quantity) * Number(price));
            //@ts-ignore
            this.balances.get(userId)[quoteAsset].locked = ((_d = this.balances.get(userId)) === null || _d === void 0 ? void 0 : _d[quoteAsset].locked) + (Number(quantity) * Number(price));
        }
        else {
            if ((((_f = (_e = this.balances.get(userId)) === null || _e === void 0 ? void 0 : _e[baseAsset]) === null || _f === void 0 ? void 0 : _f.available) || 0) < Number(quantity)) {
                throw new Error("Insufficient funds");
            }
            //@ts-ignore
            this.balances.get(userId)[baseAsset].available = ((_g = this.balances.get(userId)) === null || _g === void 0 ? void 0 : _g[baseAsset].available) - (Number(quantity));
            //@ts-ignore
            this.balances.get(userId)[baseAsset].locked = ((_h = this.balances.get(userId)) === null || _h === void 0 ? void 0 : _h[baseAsset].locked) + Number(quantity);
        }
    }
    setBaseBalances() {
        this.balances.set("1", {
            [exports.BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });
        this.balances.set("2", {
            [exports.BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });
        this.balances.set("5", {
            [exports.BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });
    }
}
exports.Engine = Engine;

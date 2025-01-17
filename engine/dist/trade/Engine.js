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
            case fromApi_1.CANCEL_ORDER:
                try {
                    const orderId = message.data.orderId;
                    const cancelMarket = message.data.market;
                    const cancelOrderbook = this.orderbooks.find(o => o.ticker() === cancelMarket);
                    const quoteAsset = cancelMarket.split("_")[1];
                    if (!cancelOrderbook) {
                        throw new Error("No orderbook found");
                    }
                    const order = cancelOrderbook.asks.find(o => o.orderId === orderId) || cancelOrderbook.bids.find(o => o.orderId === orderId);
                    if (!order) {
                        console.log("No order found");
                        throw new Error("No order found");
                    }
                    if (order.side === "buy") {
                        const price = cancelOrderbook.cancelBid(order);
                        const leftQuantity = (order.quantity - order.filled) * order.price;
                        //@ts-ignore
                        this.balances.get(order.userId)[exports.BASE_CURRENCY].available += leftQuantity;
                        //@ts-ignore
                        this.balances.get(order.userId)[exports.BASE_CURRENCY].locked -= leftQuantity;
                        if (price) {
                            this.sendUpdatedDepthAt(price.toString(), cancelMarket);
                        }
                    }
                    else {
                        const price = cancelOrderbook.cancelAsk(order);
                        const leftQuantity = order.quantity - order.filled;
                        //@ts-ignore
                        this.balances.get(order.userId)[quoteAsset].available += leftQuantity;
                        //@ts-ignore
                        this.balances.get(order.userId)[quoteAsset].locked -= leftQuantity;
                        if (price) {
                            this.sendUpdatedDepthAt(price.toString(), cancelMarket);
                        }
                    }
                    RedisManager_1.RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_CANCELLED",
                        payload: {
                            orderId,
                            executedQty: 0,
                            remainingQty: 0
                        }
                    });
                }
                catch (e) {
                    console.log("Error hwile cancelling order");
                    console.log(e);
                }
                break;
            case fromApi_1.GET_OPEN_ORDERS:
                try {
                    const openOrderbook = this.orderbooks.find(o => o.ticker() === message.data.market);
                    if (!openOrderbook) {
                        throw new Error("No orderbook found");
                    }
                    const openOrders = openOrderbook.getOpenOrders(message.data.userId);
                    RedisManager_1.RedisManager.getInstance().sendToApi(clientId, {
                        type: "OPEN_ORDERS",
                        payload: openOrders
                    });
                }
                catch (e) {
                    console.log(e);
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
        console.log("aks: ", this.orderbooks[0].asks);
        console.log("bids: ", this.orderbooks[0].bids);
        this.publisWsDepthUpdates(fills, price, side, market);
        return { executedQty, fills, orderId: order.orderId };
    }
    sendUpdatedDepthAt(price, market) {
        const orderbook = this.orderbooks.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        const depth = orderbook.getDepth();
        const updatedBids = depth === null || depth === void 0 ? void 0 : depth.bids.filter(x => x[0] === price);
        const updatedAsks = depth === null || depth === void 0 ? void 0 : depth.asks.filter(x => x[0] === price);
        RedisManager_1.RedisManager.getInstance().publishMessage(`depth@${market}`, {
            stream: `depth@${market}`,
            data: {
                a: updatedAsks.length ? updatedAsks : [[price, "0"]],
                b: updatedBids.length ? updatedBids : [[price, "0"]],
                e: "depth"
            }
        });
    }
    publisWsDepthUpdates(fills, price, side, market) {
        const orderbook = this.orderbooks.find(o => o.ticker() === market);
        if (!orderbook)
            return;
        const depth = orderbook.getDepth();
        if (side === "buy") {
            const updatedAsks = depth === null || depth === void 0 ? void 0 : depth.asks.filter(x => fills.map(f => f.price).includes(x[0].toString()));
            const updatedBid = depth === null || depth === void 0 ? void 0 : depth.bids.find(x => x[0] === price);
            console.log("publish ws depth updates");
            RedisManager_1.RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsks,
                    b: updatedBid ? [updatedBid] : [],
                    e: "depth"
                }
            });
        }
        if (side === "sell") {
            const updatedBids = depth === null || depth === void 0 ? void 0 : depth.bids.filter(x => fills.map(f => f.price).includes(x[0].toString()));
            const updatedAsk = depth === null || depth === void 0 ? void 0 : depth.asks.find(x => x[0] === price);
            console.log("publish ws depth updates");
            RedisManager_1.RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsk ? [updatedAsk] : [],
                    b: updatedBids,
                    e: "depth"
                }
            });
        }
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

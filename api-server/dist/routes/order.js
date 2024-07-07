"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = __importDefault(require("express"));
const RedisManager_1 = require("../RedisManager");
const types_1 = require("../types");
exports.orderRouter = (0, express_1.default)();
exports.orderRouter.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { market, price, quantity, side, userId } = req.body;
    //redis call to send data to engine
    const response = yield RedisManager_1.RedisManager.getInstance().sendMessageAndAwait({
        type: types_1.CREATE_ORDER,
        data: {
            market,
            price,
            quantity,
            side,
            userId
        }
    });
    res.json(response.payload);
}));
exports.orderRouter.delete("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, market } = req.body;
    const response = yield RedisManager_1.RedisManager.getInstance().sendMessageAndAwait({
        type: types_1.CANCEL_ORDER,
        data: {
            market,
            orderId
        }
    });
    return res.json(response.payload);
}));
exports.orderRouter.get("/open", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield RedisManager_1.RedisManager.getInstance().sendMessageAndAwait({
        type: types_1.GET_OPEN_ORDERS,
        data: {
            userId: req.query.userId,
            market: req.query.market
        }
    });
    res.json(response.payload);
}));

import Router from "express";
import { RedisManager } from "../RedisManager";
import { CANCEL_ORDER, CREATE_ORDER, GET_OPEN_ORDERS } from "../types";

export const orderRouter = Router();

orderRouter.post("/", async (req, res) => {
    const {market, price, quantity, side, userId} = req.body;

    //redis call to send data to engine
    const response = await RedisManager.getInstance().sendMessageAndAwait({
        type: CREATE_ORDER,
        data: {
            market,
            price,
            quantity,
            side,
            userId
        }
    });

    res.json(response.payload);
});

orderRouter.delete("/", async (req, res) => {
    const {orderId, market} = req.body;
    console.log(req.body);
    const response = await RedisManager.getInstance().sendMessageAndAwait({
        type: CANCEL_ORDER,
        data: {
            market,
            orderId
        }
    });

    return res.json(response.payload);
});

orderRouter.get("/open", async (req, res) => {
    const response = await RedisManager.getInstance().sendMessageAndAwait({
        type: GET_OPEN_ORDERS,
        data: {
            userId: req.query.userId as string,
            market: req.query.market as string
        }
    });
    res.json(response.payload);
});
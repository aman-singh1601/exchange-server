import Router from "express";
import { RedisManager } from "../RedisManager";
import { CREATE_ORDER } from "../types";

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
})
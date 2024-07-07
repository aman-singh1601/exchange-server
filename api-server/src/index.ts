import express from "express";
import cors from "cors";
import "dotenv/config";
import { orderRouter } from "./routes/order";

const PORT = process.env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/order", orderRouter);


app.listen(PORT, () => {
    console.log("API SERVER running on port : ", PORT);
});
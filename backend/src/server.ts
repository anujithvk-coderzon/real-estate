import "dotenv/config.js";

import app from "./app.js";
import { redisConnect } from "./lib/redis.js";

const PORT = process.env.PORT || 5001;
await redisConnect();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

const result = await client
  .db("StudioSpace")
  .collection("Studios")
  .deleteMany({ id: { $exists: true } });

console.log("deleted", result.deletedCount);

const remaining = await client.db("StudioSpace").collection("Studios").countDocuments();
console.log("remaining", remaining);

await client.close();

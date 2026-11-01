import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
const app = express();
const PORT = 8000;
app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectClient = await connectToMongoDB();
const db = connectClient.db("StudioSpace");
const studiosCollection = db.collection("Studios");
const bookingsCollection = db.collection("Bookings");

app.get("/", (req, res) => {
  res.send({ msg: "Hi from server" });
});

app.post("/studios", async (req, res) => {
  const studioData = req.body;
  const result = await studiosCollection.insertOne(studioData);
  res.send(result);
});

app.get("/studios", async (req, res) => {
  const result = await studiosCollection.find().toArray();
  res.send(result);
});

app.get("/featured", async (req, res) => {
  const result = await studiosCollection.find().toArray();
  res.send(result);
});

app.get("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );
  res.json(result);
});

app.delete("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.post("/my-bookings", async (req, res) => {
  const { studioId, userEmail, userName, date, start, end, hours, total } =
    req.body;
  const booking = {
    studioId,
    userEmail: userEmail.toLowerCase(),
    userName,
    date,
    start,
    end,
    hours,
    total,
    status: "pending",
    createdAt: new Date(),
  };
  const result = await bookingsCollection.insertOne(booking);
  res.send(result);
});

app.get("/my-bookings/:email", async (req, res) => {
  const email = req.params.email.toLowerCase();
  const result = await bookingsCollection
    .find({ userEmail: email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.delete("/my-bookings/:id", async (req, res) => {
  const { id } = req.params;
  const result = await bookingsCollection.deleteOne({
    _id: new ObjectId(id),
    status: { $in: ["pending", "declined"] },
  });
  if (result.deletedCount === 0) {
    return res
      .status(404)
      .send({ message: "Booking not found or can't be deleted." });
  }
  res.send({ success: true });
});

function toMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

app.patch("/my-bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, start, end } = req.body || {};

    if (!ObjectId.isValid(id) || !date || !start || !end) {
      return res.status(400).send({ message: "Missing booking details." });
    }

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) return res.status(404).send({ message: "Booking not found." });

    if (booking.status !== "pending") {
      return res
        .status(400)
        .send({ message: "Only pending bookings can be edited." });
    }

    const hours = (toMinutes(end) - toMinutes(start)) / 60;
    if (!(hours > 0)) {
      return res.status(400).send({ message: "End time must be after start time." });
    }

    
    const rate = booking.hours > 0 ? booking.total / booking.hours : 0;
    const total = Math.round(rate * hours * 100) / 100;

    await bookingsCollection.updateOne(
      { _id: booking._id },
      { $set: { date, start, end, hours, total } },
    );

    const updated = await bookingsCollection.findOne({ _id: booking._id });
    res.send(updated);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message || "Server error." });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

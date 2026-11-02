import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";
const app = express();
const PORT = 8000;
app.use(express.json());
app.use(
  cors(),
);

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
const getUserEmail = (req) =>
  String(req.user?.email || "")
    .trim()
    .toLowerCase();
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
};

app.get("/", (req, res) => {
  res.send({ msg: "Hi from server" });
});

app.post("/studios", verifyToken, async (req, res) => {
  const studioData = req.body;
  const result = await studiosCollection.insertOne(studioData);
  res.send(result);
});

app.get("/studios", async (req, res) => {
  const result = await studiosCollection.find().toArray();
  res.send(result);
});
app.get("/my-listings/:email", verifyToken, async (req, res) => {
  const email = req.params.email.toLowerCase();

  if (email !== String(req.user?.email || "").toLowerCase()) {
    return res.status(403).send({ msg: "Forbidden!" });
  }

  const result = await studiosCollection
    .find(
      { $or: [{ ownerEmail: email }, { hostEmail: email }] },
      { collation: { locale: "en", strength: 2 } },
    )
    .toArray();

  res.send(result);
});

app.get("/featured", async (req, res) => {
  try {
    const result = await studiosCollection
      .find({ status: "approved" })
      .sort({ rating: -1, createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("Failed to fetch featured studios:", error);

    res.status(500).send({
      message: "Failed to fetch featured studios",
    });
  }
});

app.get("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );
  res.json(result);
});

app.delete("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.post("/my-bookings", verifyToken, async (req, res) => {
  try {
    const { studioId, userName, date, start, end, total } = req.body;

    const userEmail = req.user?.email?.toLowerCase();

    const alreadyBooked = await bookingsCollection.findOne({
      studioId: String(studioId),
      date,
      status: { $in: ["pending", "confirmed"] },
      start: { $lt: end },
      end: { $gt: start },
    });

    if (alreadyBooked) {
      return res.status(409).send({
        message: "This studio is already booked for this time!",
      });
    }
    if (!userEmail) {
      return res.status(401).send({ message: "Unauthorized!" });
    }

  
    if (!studioId || !date || !start || !end) {
      return res.status(400).send({
        message: "Please provide all booking details.",
      });
    }

  
    const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timeFormat.test(start) || !timeFormat.test(end)) {
      return res.status(400).send({
        message: "Invalid time format.",
      });
    }

   
    if (toMinutes(end) <= toMinutes(start)) {
      return res.status(400).send({
        message: "End time must be after start time.",
      });
    }

   
  
    const booking = {
      studioId,
      userEmail,
      userName,
      date,
      start,
      end,
      hours: (toMinutes(end) - toMinutes(start)) / 60,
      total,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(booking);

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
      message: "Booking successful!",
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Something went wrong!",
    });
  }
});


app.get("/my-bookings/:email", verifyToken, async (req, res) => {
    try {
        const email = String(req.params.email || "").toLowerCase();
        const tokenEmail = String(req.user?.email || "").toLowerCase();

        
        if (!tokenEmail) {
            return res.status(401).send({
                message: "Unauthorized access",
            });
        }

      
        if (email !== tokenEmail) {
            return res.status(403).send({
                message: "You can only access your own bookings",
            });
        }

        const result = await bookingsCollection
            .find({
                userEmail: tokenEmail,
            })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).send(result);

    } catch (error) {
        console.error("My bookings error:", error);

        res.status(500).send({
            message: "Failed to fetch bookings",
        });
    }
});


app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = getUserEmail(req);

    if (!userEmail) {
      return res.status(401).send({ message: "Unauthorized!" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID." });
    }

    const result = await bookingsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail,
      status: { $in: ["pending", "declined"] },
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Booking not found or can't be deleted.",
      });
    }

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to delete booking." });
  }
});

function toMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

app.patch("/my-bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, start, end } = req.body || {};

    if (!ObjectId.isValid(id) || !date || !start || !end) {
      return res.status(400).send({ message: "Missing booking details." });
    }

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking)
      return res.status(404).send({ message: "Booking not found." });

    if (booking.status !== "pending") {
      return res
        .status(400)
        .send({ message: "Only pending bookings can be edited." });
    }

    const hours = (toMinutes(end) - toMinutes(start)) / 60;
    if (!(hours > 0)) {
      return res
        .status(400)
        .send({ message: "End time must be after start time." });
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

export default app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// JWT functions
function createToken(user) {
  const token = jwt.sign(
    {
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return token;
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  const verify = jwt.verify(token, process.env.JWT_SECRET);
  if (!verify?.email) {
    return res.send("You are not authorized");
  }
  req.user = verify.email;
  next();
}

// MongoDB connection
const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const ticketBookingDashboard = client.db("ticketBookingDashboard");
    const userCollection = ticketBookingDashboard.collection("users");
    const eventCollection = ticketBookingDashboard.collection("events");
    const bookingCollection = ticketBookingDashboard.collection("booking");

    // user
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      if (result.insertedCount === 1) {
        res.status(201).json({ message: "User added successfully" });
      } else {
        res.status(500).json({ message: "Failed to add user" });
      }
    });

    // Get all users
    app.get("/user", async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const user = await cursor.toArray();
      res.send(user);
    });

    //post booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      if (result.insertedCount === 1) {
        res.status(201).json({ message: "booking successful" });
      } else {
        res.status(500).json({ message: "Failed to book" });
      }
    });

    //Get Booking by ID
    app.get("/booking/:id", async (req, res) => {
      try {
        const bookingId = req.params.id;
        const booking = { id: bookingId };
        if (!booking) {
          return res.status(404).json({ error: "Booking not found" });
        }
        res.json(booking);
      } catch (error) {
        res.status(500).json({ error: "Failed to retrieve booking" });
      }
    });

    // Get All Events
    app.get("/events", async (req, res) => {
      const query = {};
      const cursor = eventCollection.find(query);
      const event = await cursor.toArray();
      res.send(event);
    });

    // Get Event by ID
    app.get("/events/:id", async (req, res) => {
      try {
        const eventId = new ObjectId(req.params.id);
        const event = await eventCollection.findOne({ _id: eventId });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        res.json(event);
      } catch (error) {
        console.error("Error retrieving event:", error);
        res.status(500).json({ error: "Failed to retrieve event" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { amount, currency } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: "Failed to create payment intent" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Route is working");
});

app.listen(port, (req, res) => {
  console.log("App is listening on port :", port);
});

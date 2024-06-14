const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

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
    const adminCollection = ticketBookingDashboard.collection("admin");

    // user
    // app.post("/user", async (req, res) => {
    //   const user = req.body;
    //   const result = await userCollection.insertOne(user);
    //   if (result.insertedCount === 1) {
    //     res.status(201).json({ message: "User added successfully" });
    //   } else {
    //     res.status(500).json({ message: "Failed to add user" });
    //   }
    // });

    app.post("/user", async (req, res) => {
      const user = req.body;

      const token = createToken(user);
      const isUserExist = await userCollection.findOne({ email: user?.email });
      if (isUserExist?._id) {
        return res.send({
          status: "success",
          message: "Login success",
          token,
        });
      }
      await userCollection.insertOne(user);
      return res.send({ token });
    });

    // admin
    app.post("/admin", async (req, res) => {
      const admin = req.body;
      const result = await adminCollection.insertOne(admin);
      if (result.insertedCount === 1) {
        res.status(201).json({ message: "admin added successfully" });
      } else {
        res.status(500).json({ message: "Failed to add admin" });
      }
    });

    // Get all users
    app.get("/user", async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const user = await cursor.toArray();
      res.send(user);
    });

    //get admin
    app.get("/admin", async (req, res) => {
      const query = {};
      const cursor = adminCollection.find(query);
      const admin = await cursor.toArray();
      res.send(admin);
    });

    // Get admin by user
    app.get("/admin/:email", async (req, res) => {
      const userEmail = req.params.email;
      const query = { "user.email": userEmail };
      const admin = await adminCollection.find(query).toArray();
      if (!admin || admin.length === 0) {
        return res
          .status(404)
          .json({ message: "No admins found for the user" });
      }
      res.json(admin);
    });

    //post booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);

      res.send(result);
    });

    // Get all bookings
    app.get("/booking", async (req, res) => {
      const query = {};
      const cursor = bookingCollection.find(query);
      const booking = await cursor.toArray();
      res.send(booking);
    });

    // Get bookings by user
    app.get("/bookings/:email", async (req, res) => {
      const userEmail = req.params.email;
      const query = { "user.email": userEmail };
      const bookings = await bookingCollection.find(query).toArray();
      if (!bookings || bookings.length === 0) {
        return res
          .status(404)
          .json({ message: "No bookings found for the user" });
      }
      res.json(bookings);
    });

    //Get Booking by ID
    app.get("/booking/:id", async (req, res) => {
      const bookingId = req.params.id;
      const booking = { id: bookingId };
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    });

    // event
    app.post("/event", async (req, res) => {
      const event = req.body;
      const result = await eventCollection.insertOne(event);
      if (result.insertedCount === 1) {
        res.status(201).json({ message: "event added successfully" });
      } else {
        res.status(500).json({ message: "Failed to add event  " });
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
      const eventId = new ObjectId(req.params.id);
      const event = await eventCollection.findOne({ _id: eventId });
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    });

    // Update Event by ID
    app.put("/events/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const result = await eventCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.modifiedCount === 1) {
          const updatedEvent = await eventCollection.findOne({
            _id: new ObjectId(id),
          });
          res.json(updatedEvent);
        } else {
          res.status(404).json({ message: "Event not found or not updated" });
        }
      } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event" });
      }
    });

    // Delete event
    app.delete("/events/:id", async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID" });
      }

      const result = await eventCollection.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Event not found" });
      }
      res.send({ message: "Event deleted successfully", result });
    });

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    app.post("/payment", async (req, res) => {
      const { token, event } = req.body;

      try {
        const charge = await stripe.charges.create({
          amount: event.price * 100,
          currency: "usd",
          description: `Payment for event: ${event.name}`,
          source: token.id,
          receipt_email: token.email,
        });

        const booking = {
          event,
          user: {
            email: token.email,
          },
          payment: {
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            receipt_url: charge.receipt_url,
          },
          date: new Date(),
        };

        const result = await bookingCollection.insertOne(booking);

        if (result.insertedCount === 1) {
          res
            .status(201)
            .json({ message: "Booking added successfully", booking });
        } else {
          res.status(500).json({ message: "Failed to add booking" });
        }
      } catch (error) {
        console.error("Stripe payment error:", error.message);
        res.status(500).json({ error: error.message });
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
    // Ensure proper cleanup or error handling here if necessary
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Route is working");
});

app.listen(port, (req, res) => {
  console.log("App is listening on port :", port);
});

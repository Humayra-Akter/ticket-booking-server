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
    const usersCollection = ticketBookingDashboard.collection("users");
    const eventsCollection = ticketBookingDashboard.collection("events");
    const bookingsCollection = ticketBookingDashboard.collection("bookings");

    // User registration
    app.post("/users/register", async (req, res) => {
      const { name, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = { name, email, password: hashedPassword };
      try {
        await usersCollection.insertOne(user);
        const token = createToken(user);
        res.send({ token, user: { id: user._id, name, email } });
      } catch (err) {
        res.status(400).send("Error registering user");
      }
    });

    // User login
    app.post("/users/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(400).send("Invalid email or password.");

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword)
        return res.status(400).send("Invalid email or password.");

      const token = createToken(user);
      res.send({ token, user: { id: user._id, name: user.name, email } });
    });

    // Create event
    app.post("/events", verifyToken, async (req, res) => {
      const { title, description, date, price } = req.body;
      const event = { title, description, date, price };
      await eventsCollection.insertOne(event);
      res.send(event);
    });

    // Get all events
    app.get("/events", async (req, res) => {
      const events = await eventsCollection.find().toArray();
      res.send(events);
    });

    // Get event details
    app.get("/events/:id", async (req, res) => {
      const event = await eventsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!event) return res.status(404).send("Event not found.");
      res.send(event);
    });

    // Update event
    app.patch("/events/:id", verifyToken, async (req, res) => {
      const updates = req.body;
      const result = await eventsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updates }
      );
      if (!result.matchedCount) return res.status(404).send("Event not found.");
      res.send({ message: "Event updated" });
    });

    // Delete event
    app.delete("/events/:id", verifyToken, async (req, res) => {
      const result = await eventsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      if (!result.deletedCount) return res.status(404).send("Event not found.");
      res.send({ message: "Event deleted" });
    });

    // Book tickets
    app.post("/events/:id/book", verifyToken, async (req, res) => {
      const { tickets, paid } = req.body;
      const event = await eventsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!event) return res.status(404).send("Event not found.");

      const booking = {
        user: new ObjectId(req.user.id),
        event: new ObjectId(event._id),
        tickets,
        paid,
      };
      await bookingsCollection.insertOne(booking);
      res.send(booking);
    });

    // Get bookings for an event
    app.get("/events/:id/bookings", verifyToken, async (req, res) => {
      const bookings = await bookingsCollection
        .find({ event: new ObjectId(req.params.id) })
        .toArray();
      res.send(bookings);
    });

    // Payment processing (Stripe)
    app.post("/payments", verifyToken, async (req, res) => {
      const { amount, paymentMethodId } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100,
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
        });

        res.send({ success: true, paymentIntent });
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });
  } finally {
  }
}

app.get("/", (req, res) => {
  res.send("Route is working");
});

app.listen(port, (req, res) => {
  console.log("App is listening on port :", port);
});

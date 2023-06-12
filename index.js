const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.vqc0wwo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Collect Database Collection
    const allClassCollection = client
      .db("SportsInstituteDB")
      .collection("allClass");
    const allInstructorCollection = client
      .db("SportsInstituteDB")
      .collection("allInstructor");
    const usersCollection = client.db("SportsInstituteDB").collection("users");
    const selectedClassCollection = client
      .db("SportsInstituteDB")
      .collection("selectedClass");
    const paymentCollection = client
      .db("SportsInstituteDB")
      .collection("payments");

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (price) {
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    // payment related api
    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const query = {
        _id: new ObjectId(payment.selectedPayment._id),
      };
      const updateQuery = {
        _id: new ObjectId(payment.selectedPayment.classItemId),
      };
      const updateSeat = await allClassCollection.updateOne(updateQuery, {
        $inc: { availableSeats: -1 },
      });

      const insertResult = await paymentCollection.insertOne(payment);
      const deleteResult = await selectedClassCollection.deleteOne(query);
      res.send({ result: insertResult, deleteResult, updateSeat });
    });

    // jwt related apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Class related apis
    app.get("/allClass", async (req, res) => {
      const result = await allClassCollection.find().toArray();
      res.send(result);
    });

    // app.get("/allClass", async (req, res) => {
    //   const { status } = req.query;

    //   let filter = {};
    //   if (status && ["pending", "approved", "denied"].includes(status)) {
    //     filter.status = status;
    //   }

    //   const result = await allClassCollection.find(filter).toArray();
    //   res.send(result);
    // });

    app.post("/allClass", async (req, res) => {
      const newClass = req.body;
      const result = await allClassCollection.insertOne(newClass);
      res.send(result);
    });

    // Instructor related apis
    app.get("/allInstructor", async (req, res) => {
      const result = await allInstructorCollection.find().toArray();
      res.send(result);
    });

    // user related apis
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "instructor" };
      res.send(result);
    });

    //selected class related apis
    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/selectedClass", async (req, res) => {
      const item = req.body;
      const result = await selectedClassCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sports Institute server is running !!!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

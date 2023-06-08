const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
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

    // Class related apis
    app.get("/allClass", async (req, res) => {
      const result = await allClassCollection.find().toArray();
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

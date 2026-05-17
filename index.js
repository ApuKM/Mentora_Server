const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors")
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();
const app = express();
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

app.use(cors())
app.use(express.json())

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const { authorization } = req?.headers;
  // console.log(authorization)
  if (!authorization) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authorization.split(" ")[1];
  // console.log(token);
  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    // console.log(req.user);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("mentoradb");
    const coursesCollection = db.collection("courses");
    const enrollmentCollection = db.collection("enrollments")

    app.get("/courses", async (req, res) => {
      const { query } = req.query;
      let cursor;
      if (query) {
        cursor = coursesCollection.find({ title: { $eq: query } });
      } else {
        cursor = coursesCollection.find({});
      }
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/courses/:courseId", verifyToken, async (req, res) => {
      const { courseId } = req.params;
      const result = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
      });
      res.send(result);
    });

    app.get("/featured", async (req, res) => {
      const cursor = coursesCollection.find().limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/enrollments/:userId", verifyToken, async(req, res) => {
      const {userId} = req.params;
      const result = await enrollmentCollection.find({userId: userId}).toArray();
      res.send(result)
    })

    app.patch("/enrollments/:courseId", verifyToken, async(req, res) => {
      const {courseId} = req.params;
      const enrollmentData = req.body
      console.log(enrollmentData)
      const course = await coursesCollection.findOne({_id: new ObjectId(courseId)})
      if(!course){
        return res.status(404).json({message: "Course not found!"})
      }
      await coursesCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
          $inc: {enrollCount: 1},
          $set: {
            lastEnrolledAt: new Date(),
          }
        }
      )
      const result = await enrollmentCollection.insertOne({
        ...enrollmentData,
        enrolledAt: new Date()
      })
      // console.log(result)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

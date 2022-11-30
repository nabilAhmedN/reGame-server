const express = require("express");
const cors = require("cors");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectID } = require("bson");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0byrl94.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
    console.log("token inside verifyJWT", req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send("unauthorized access");
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        const categoriesCollection = client
            .db("reGame")
            .collection("categories");

        const soloCategoriesCollection = client
            .db("reGame")
            .collection("solocategory");

        const bookingsGameCollection = client
            .db("reGame")
            .collection("bookingsGame");

        const userCollection = client.db("reGame").collection("userTable");

        const paymentsCollection = client.db("reGame").collection("payments");

        app.get("/categories", async (req, res) => {
            const query = {};
            const options = await categoriesCollection.find(query).toArray();
            res.send(options);
        });

        app.get("/category", async (req, res) => {
            let query = {};
            if (req.query.title) {
                query = {
                    title: req.query.title,
                };
            }

            const cursor = soloCategoriesCollection.find(query);
            result = await cursor.toArray();
            res.send(result);
        });

        app.get("/jwt", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
                    expiresIn: "1h",
                });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: "" });

            // console.log(user);
        });

        // post the modal data
        app.post("/bookingsgame", async (req, res) => {
            const bookingGame = req.body;
            console.log(bookingGame);
            const result = await bookingsGameCollection.insertOne(bookingGame);
            res.send(result);
        });

        app.get("/bookingsgame", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: "Forbidden asscess" });
            }
            const query = { email: email };
            const result = await bookingsGameCollection.find(query).toArray();
            res.send(result);
        });
        // add the product
        app.post("/addproduct", async (req, res) => {
            const addProduct = req.body;
            console.log(addProduct);
            const result = await soloCategoriesCollection.insertOne(addProduct);

            res.send(result);
        });

        //TODO: demo payment
        app.get("/bookings/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectID(id) };
            const booking = await bookingsGameCollection.findOne(query);
            res.send(booking);
        });

        // TODO: paymet
        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // TODO: payment
        app.post("/payments", async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = { _id: ObjectID(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                },
            };
            const updatedResult = await bookingsGameCollection.updateOne(
                filter,
                updatedDoc
            );
            res.send(result);
        });

        app.get("/users", async (req, res) => {
            let query = {};
            if (req.query.role) {
                query = {
                    role: req.query.role,
                };
            }
            const allUsers = await userCollection.find(query).toArray();
            res.send(allUsers);
        });

        // post the signup info in database
        app.post("/signup", async (req, res) => {
            const addUser = req.body;
            const result = await userCollection.insertOne(addUser);
            res.send(result);
        });

        // put the login info in database
        app.put("/login", async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };

            const option = { upsert: true };
            const updateUser = {
                $set: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            };
            const result = await userCollection.updateOne(
                filter,
                updateUser,
                option
            );

            res.send(result);
        });

        // show all user
        app.get("/allrole", async (req, res) => {
            let query = {};
            if (req.query.role) {
                query = {
                    role: req.query.role,
                };
            } else if (req.query.email) {
                query = {
                    email: req.query.email,
                };
            }
            const cursor = userCollection.find(query);
            const result = await cursor.toArray();

            res.send(result);

            // //
            // app.put("/allrole/admin/:id", verifyJWT, async (req, res) => {
            //     const decodedEmail = req.decoded?.email;
            //     const query = { email: decodedEmail };
            //     const user = await userCollection.findOne(query);
            //     if (user?.role !== "admin") {
            //         return res
            //             .status(403)
            //             .send({ message: "forbidden access" });
            //     }
            //     const id = req.params.id;
            //     const filter = { _id: ObjectID(id) };
            //     const options = { upsert: true };
            //     const updatedDoc = {
            //         $set: {
            //             role: "admin",
            //         },
            //     };
            //     const result = await userCollection.updateOne(
            //         filter,
            //         updatedDoc,
            //         options
            //     );
            //     res.send(result);
            // });

            // // admin
            // app.get("/users/admin/:email", async (req, res) => {
            //     const email = req.params.email;
            //     const query = { email };
            //     const user = await userCollection.findOne(query);
            //     res.send({ admin: user?.role === "admin" });
            // });
        });
        //
        app.put("/allrole/admin/:id", verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded?.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ message: "forbidden access" });
            }
            const id = req.params.id;
            const filter = { _id: ObjectID(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await userCollection.updateOne(
                filter,
                updatedDoc,
                options
            );
            res.send(result);
        });

        // admin
        app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await userCollection.findOne(query);
            res.send({ admin: user?.role === "admin" });
        });
        //seller
        app.get("/users/seller/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await userCollection.findOne(query);
            res.send({ seller: user?.role === "Seller" });
        });

        // buyer added product
        app.get("/mydata", async (req, res) => {
            let query = {};
            if (req.query.email) {
                query = {
                    email: req.query.email,
                };
            } else if (req.query.advertise) {
                query = {
                    advertise: req.query.advertise,
                };
            }
            const cursor = soloCategoriesCollection.find(query);
            const result = await cursor.toArray();

            res.send(result);
        });

        // advertise update
        app.patch("/advertiseupdate/:id", async (req, res) => {
            const id = req.params.id;
            const advertise = req.body.advertise;
            const query = { _id: ObjectID(id) };
            const updatedDoc = {
                $set: {
                    advertise: advertise,
                },
            };
            const result = await soloCategoriesCollection.updateOne(
                query,
                updatedDoc
            );
            res.send(result);
        });
    } 
    finally {
    }
}
run().catch(console.log);

app.get("/", async (req, res) => {
    res.send("reGame portal server is running");
});

app.listen(port, () => console.log(`reGame portal running on ${port}`));

const express = require('express');
const cors = require('cors');
// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
// console.log(stripe)

// App creation and port
const app = express();
const port = process.env.PORT || 5000;

// Middle Wares
app.use(cors());
app.use(express.json());

// JWT verification process
function verifyJwt(req, res, next) {
    // console.log('token inside verifyJwt', req.headers.authorization)
    const authHeader = req.headers.authorization
    if (!authHeader) {
        res.status(401).send("Unauthorized access")
    }
    const token = authHeader.split(' ')[1];
    // console.log(token)
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
        if (error) {
            res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded
        next()
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0byrl94.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});


async function run() {
    try {
        // all database collection
        const usersCollection = client.db('reGameDB').collection('users');
        // const newsLetterCollection = client.db('reGameDB').collection('newsLetter');
        const allProductsCollection = client.db('reGameDB').collection('allProducts');
        const productsCategoryCollection = client.db('reGameDB').collection('productsCategory');
        const bookedProductCollection = client.db('reGameDB').collection('bookedProduct');
        const productSoldCollection = client.db('reGameDB').collection('productSold');
        // const blogCollection = client.db('reGameDB').collection('blogs');
        // const allProductCollection = 

        // User verification via server Admin, Buyer & Seller
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access, your are not an Admin' })
            }
            next();
        }
        const verifyBuyer = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Buyer') {
                return res.status(403).send({ message: 'forbidden access, your are not anBuyer' })
            }
            next();
        }
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Seller') {
                return res.status(403).send({ message: 'forbidden access, your are not a Seller' })
            }
            next();
        }


        // jwt token issued from here
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "7d" })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        })
        app.get('/blog', async (req, res) => {
            const query = {}
            const blogs = await blogCollection.find(query).toArray()
            res.send(blogs)
        }) 
        // Payment route for Stripe Payment
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            // console.log(booking)
            const price = booking.resalePrice;
            const amount = price * 100
            // console.log(amount)
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await productSoldCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    status: "sold",
                    sold: "yes"
                }
            }
            const updatedProductsResult = await allProductsCollection.updateOne(filter, updatedDoc)
            const bookedProductFilter = {
                clientEmail: payment.email,
                product_Id: payment.bookingId
            }
            const updatedBookingResult = await bookedProductCollection.updateOne(bookedProductFilter, updatedDoc)
            res.send(result);
        })

        // newsLetter API, email collection
        app.post('/newsLetterEmails', async (req, res) => {
            const email = req.body;
            // console.log(email)
            const newsLetterEmail = await newsLetterCollection.insertOne(email)
            res.send(newsLetterEmail)
        })


        // User route for updating user of firebase inside server user database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: user?.name,
                    imageURL: user?.imageURL,
                },
            };
            const userData = await usersCollection.updateOne(user, updateDoc, options)
            // console.log(userData)
            res.send(userData)
        })


        // Problem in user data base using google login
        app.put('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: user?.name,
                    email: user?.email,
                    imageURL: user?.imageURL,
                    role: 'Buyer'
                },
            };
            const userData = await usersCollection.updateOne(query, updateDoc, options)
            // console.log(userData)
            res.send(userData)
        })

        app.get('/users', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {};
            const userData = await usersCollection.find(query).toArray();
            res.send(userData)
        })
        app.get('/userBuyer', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            // console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email, role: "Buyer" };
            const userData = await usersCollection.findOne(query);

            // console.log(userData)
            res.send(userData)
        })

        app.get('/users/sellers', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { role: "Seller" };
            const userData = await usersCollection.find(query).toArray();
            res.send(userData)
        })

        app.delete('/users/sellers/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })
        app.delete('/users/buyers/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })

        app.put('/users/sellers/:id', verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user.role !== "admin") {
                return res.status(403).send({ message: 'forbidden access, your not an Admin' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    verifySeller: "yes"
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })
        app.get('/users/sellers', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { role: "seller" };
            // console.log(result)
            const result = await usersCollection.find(query).toArray()
            // console.log(result)
            res.send(result)
        })

        app.get('/users/buyers', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { role: "Buyer" };
            const userData = await usersCollection.find(query).toArray();
            res.send(userData)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const adminUser = await usersCollection.findOne(query)
            res.send({ isAdmin: adminUser?.role === 'admin' });
        })
        app.get('/users/sellers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const adminUser = await usersCollection.findOne(query)
            res.send({ isSeller: adminUser?.role === 'Seller' });
        })
        app.get('/users/buyers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const adminUser = await usersCollection.findOne(query)
            res.send({ isBuyer: adminUser?.role === 'Buyer' });
        })

        // Admin making an Admin from usersCollection only buyer can e be an Admin
        app.put('/users/admin/:id', verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user.role !== "admin") {
                return res.status(403).send({ message: 'forbidden access, your not an Admin' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        app.get('/productsCategory', async (req, res) => {
            const query = {}
            const result = await productsCategoryCollection.find(query).toArray()
            res.send(result);
        })
        app.get('/productsCategory/:name', async (req, res) => {
            const category = req.params.name
            const filter = { categoryName: category }
            const result = await productsCategoryCollection.findOne(filter)
            // console.log(result)
            res.send(result);
        })
        app.get('/productsPerCategory', async (req, res) => {
            const id = req.params.id;
            const category = req.query.name
            // console.log(category)
            const filter = { category: category, paid: false }
            const result = await allProductsCollection.find(filter).toArray()
            // console.log(result)
            res.send(result);
        })

        app.post('/allProducts', verifyJwt, verifySeller, async (req, res) => {
            const productDetails = req.body;
            const newPostedProduct = await allProductsCollection.insertOne(productDetails)
            res.send(newPostedProduct);
        })

        app.put('/allProducts/:id', verifyJwt, verifyBuyer, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    reportedProduct: "yes"
                }
            }
            const reported = await allProductsCollection.updateOne(query, updateDoc, options)
            // console.log(reported)
            res.send(reported)
        })
        app.get('/reportedItems', verifyJwt, verifyAdmin, async (req, res) => {
            const query = { reportedProduct: "yes" }
            const reportedItems = await allProductsCollection.find(query).toArray()
            // console.log(reportedItems)
            res.send(reportedItems)
        })
        app.delete('/reportedItems/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const deleteReportedItem = await allProductsCollection.deleteOne(query)
            // console.log(deleteReportedItem)
            res.send(deleteReportedItem)
        })
        app.delete('/allProducts/:id', verifyJwt, verifySeller, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const result = await allProductsCollection.deleteOne(query)
            // console.log(result)
            res.send(result);
        })
        app.put('/advertisedProducts/:id', verifyJwt, verifySeller, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    advertised: true
                }
            }
            const result = await allProductsCollection.updateOne(query, updatedDoc)
            // console.log(result)
            res.send(result);
        })
        app.get('/advertisedProducts', async (req, res) => {
            const query = { advertised: true }
            const result = await allProductsCollection.find(query).toArray()
            res.send(result);
        })

        app.get('/allProducts', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {};
            const getAllProducts = await allProductsCollection.find(query).toArray()
            res.send(getAllProducts);
        })

        app.get('/allProducts/seller', verifyJwt, async (req, res) => {
            const email = req.query.email
            // console.log(email)
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { sellerEmail: decodedEmail };
            const userData = await allProductsCollection.find(query).toArray();
            // console.log(userData)
            res.send(userData)
        })

        app.post('/bookedProducts', verifyJwt, verifyBuyer, async (req, res) => {
            const bookedProduct = req.body
            // console.log(bookedProduct)
            const result = await bookedProductCollection.insertOne(bookedProduct);
            res.send(result);
        })
        app.get('/bookedProducts', verifyJwt, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { clientEmail: email }
            // console.log(bookedProduct)
            const result = await bookedProductCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/bookedProducts/:id', async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const result = await allProductsCollection.findOne(filter)
            console.log(result)
            res.send(result);
        })
        app.put('/bookedProducts/status-booked/:id', verifyJwt, verifyBuyer, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    status: "booked"
                }
            }
            const result = await allProductsCollection.updateOne(query, updateDoc, options)
            // console.log(result)
            res.send(result);
        })
        app.put('/bookedProducts/status-booked/:id', verifyJwt, verifyBuyer, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    status: "booked"
                }
            }
            const result = await allProductsCollection.updateOne(query, updateDoc, options)
            // console.log(result)
            res.send(result);
        })
        app.delete('/bookedProducts/:id', verifyJwt, verifyBuyer, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const result = await bookedProductCollection.deleteOne(query)
            // console.log(result)
            res.send(result);
        })


    }
    finally {

    }
}
run().catch(console.log)



app.get('/', (req, res) => {
    res.send("Time Craft server is running!")
})

app.listen(port, () => {
    console.log(`Time Craft server running on ${port} `)
})
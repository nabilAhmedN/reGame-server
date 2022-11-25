const express = require("express");
const cors = require("cors");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const jwt = require("jsonwebtoken");
require("dotenv").config();
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0byrl94.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});


async function run() {
    try{
        const categoriesCollection = client
            .db("reGame")
            .collection("categories");
        const soloCategoriesCollection = client
            .db("reGame")
            .collection("solocategory");

        app.get('/categories', async(req, res) => {
            const query = {};
            const options = await categoriesCollection.find(query).toArray();
            res.send(options)
        })    

        app.get('/category', async(req, res) => {
            let query = {}
            if(req.query.service_id){
                query = {
                    service_id: req.query.service_id
                }
            }

            const cursor = soloCategoriesCollection.find(query)
            result = await cursor.toArray()
            res.send(result)
        })
    }
    finally{

    }
}
run().catch(console.log);

app.get("/", async (req, res) => {
    res.send("reGame portal server is running");
});

app.listen(port, () => console.log(`reGame portal running on ${port}`));
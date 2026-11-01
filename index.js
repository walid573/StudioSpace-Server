import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'
import cors from 'cors'
const app = express()
const PORT = 8000;
app.use(express.json());
app.use(cors())



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
const connectClient = await connectToMongoDB()
const db = connectClient.db('StudioSpace');
const studiosCollection = db.collection('Studios');

app.get('/', (req,res)=>{
    res.send({msg:'Hi from server'})
})

app.post('/studios', async(req,res)=>{
  const studioData = req.body;
  const result = await studiosCollection.insertOne(studioData)
  res.send(result)
})

app.get('/featured', async(req,res)=>{
  const result = await studiosCollection.find().toArray();
  res.send(result)
})



app.get('/studios',async(req,res)=>{
  const result = await studiosCollection.find().toArray();
  res.send(result)
})

app.get('/studios/:id', async(req,res)=>{
    const {id} = req.params;
    const result = await studiosCollection.findOne({_id: new ObjectId(id) });
    res.send(result)
})

app.listen(PORT, ()=>{
    console.log(`Server is running at ${PORT}`);
    
})
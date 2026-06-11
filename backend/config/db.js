require('dotenv').config(); 
const mongoose = require('mongoose');
async function connectDB() {
    try {
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('mongoDB: Connection Established');
    } catch (error) {
        console.error('mongoDB: connection error -', error.message);
        process.exit(1); // kill the server whendb fail
    }
}

module.exports = connectDB;
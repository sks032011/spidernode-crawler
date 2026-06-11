const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
    url: { 
        type: String, 
        required: true, 
        unique: true // db gatekeeper
    },
    title: { 
        type: String, 
        default: 'No Title' 
    },
    totalLinks: { 
        type: Number, 
        default: 0 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Page', pageSchema);